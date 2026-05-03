"""
make_intro_video_en.py — RR 英文版教學影片製作

流程（旁白驅動影片，不是影片驅動旁白）：

  Step 1  讀 narration_script.json，用 edge-tts 合成每段旁白
          → 量測實際秒數，決定影片每段的停留時間
          ★ checkpoint：在這裡先聽旁白，確認 OK 再繼續

  Step 2  以 Step 1 的時長驅動影片錄製節奏
          每場景 pause = 旁白秒數 + lead_in + lead_out
          → 旁白與畫面完全對齊，不會飄移

  Step 3  組片
          → 根據影片 step 時間戳對齊旁白音軌
          → 生成 .srt
          → ffmpeg 輸出兩版：無字幕版 + 字幕燒入版

需求：
  pip install edge-tts
  ffmpeg 路徑：C:\\ffmpeg\\bin\\ffmpeg.exe
"""

from __future__ import annotations

import asyncio
import json
import subprocess
from datetime import datetime
from pathlib import Path

import edge_tts

from run_ui_tour_video import produce_video


OUT_DIR     = Path(__file__).resolve().parent
AUDIO_DIR   = OUT_DIR / "audio"
SUBTITLE_DIR = OUT_DIR / "subtitles"
FINAL_DIR   = OUT_DIR / "final"
REPORT_DIR  = OUT_DIR / "reports"
SCRIPT_PATH = OUT_DIR / "narration_script.json"

FFMPEG  = r"C:\ffmpeg\bin\ffmpeg.exe"
FFPROBE = r"C:\ffmpeg\bin\ffprobe.exe"


# ---------------------------------------------------------------------------
# Step 1 — 合成旁白
# ---------------------------------------------------------------------------

async def synthesize_scene(text: str, voice: str, rate: str, out_mp3: Path) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    await communicate.save(str(out_mp3))


def audio_duration(path: Path) -> float:
    result = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True, encoding="utf-8",
    )
    return float(result.stdout.strip())


async def build_narration(script: dict, timestamp: str) -> list[dict]:
    """
    合成每段旁白，回傳 timings list。
    timings[i] = { id, text, path, duration }
    """
    voice    = script["voice"]
    rate     = script.get("rate", "+0%")
    seg_dir  = AUDIO_DIR / f"segments-{timestamp}"
    seg_dir.mkdir(parents=True, exist_ok=True)

    timings: list[dict] = []
    for i, scene in enumerate(script["scenes"], start=1):
        mp3 = seg_dir / f"{i:02d}-{scene['id']}.mp3"
        print(f"  [{i:02d}/{len(script['scenes'])}] {scene['id']}")
        await synthesize_scene(scene["text"], voice, rate, mp3)
        dur = audio_duration(mp3)
        timings.append({
            "id":       scene["id"],
            "text":     scene["text"],
            "path":     str(mp3),
            "duration": round(dur, 3),
        })

    return timings


def scene_ms_from_timings(timings: list[dict], lead_in: float, lead_out: float) -> dict[str, int]:
    """每場景的影片暫停 ms = 旁白秒數 + lead_in + lead_out"""
    return {
        t["id"]: int((t["duration"] + lead_in + lead_out) * 1000)
        for t in timings
    }


# ---------------------------------------------------------------------------
# Step 3 — 組片
# ---------------------------------------------------------------------------

def assign_audio_offsets(timings: list[dict], steps: list[dict],
                         lead_in: float, pre_roll: float = 0.0) -> list[dict]:
    """
    依影片 step 時間戳，計算每段旁白在音軌中的 actual_start。
    step.start + lead_in - pre_roll = 旁白在裁切後影片中的開始時間。
    """
    step_map = {s["title"]: s for s in steps}
    result = []
    for t in timings:
        step = step_map.get(t["id"])
        if step is None:
            continue
        actual_start = round(step["start"] + lead_in - pre_roll, 3)
        actual_end   = round(actual_start + t["duration"], 3)
        result.append({**t, "actual_start": actual_start, "actual_end": actual_end})
    return result


def compose_audio(timings: list[dict], output: Path) -> None:
    """
    用 ffmpeg adelay + amix 把各段旁白放在正確時間點，合成單一音軌。
    各段不重疊，normalize=0 避免音量被壓低。
    """
    cmd = [FFMPEG, "-y"]
    delays, filter_parts = [], []
    for i, t in enumerate(timings):
        delay_ms = int(t["actual_start"] * 1000)
        cmd += ["-i", t["path"]]
        filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
        delays.append(delay_ms)

    n = len(timings)
    mix_ins = "".join(f"[a{i}]" for i in range(n))
    filter_complex = ";".join(filter_parts) + f";{mix_ins}amix=inputs={n}:normalize=0:duration=longest[out]"

    cmd += ["-filter_complex", filter_complex, "-map", "[out]",
            "-c:a", "aac", "-b:a", "192k", str(output)]
    subprocess.run(cmd, check=True, capture_output=True, text=True, encoding="utf-8")


def format_srt_time(seconds: float) -> str:
    total_ms = max(0, int(round(seconds * 1000)))
    h, total_ms = divmod(total_ms, 3_600_000)
    m, total_ms = divmod(total_ms, 60_000)
    s, ms       = divmod(total_ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def build_srt(timings: list[dict], output: Path) -> None:
    chunks = []
    for i, t in enumerate(timings, start=1):
        start = format_srt_time(t["actual_start"])
        end   = format_srt_time(t["actual_end"] + 0.2)
        chunks.append(f"{i}\n{start} --> {end}\n{t['text']}\n")
    output.write_text("\n".join(chunks), encoding="utf-8")


def ffmpeg_srt_path(path: Path) -> str:
    return path.resolve().as_posix().replace(":", "\\:").replace("'", r"\'")


def compose_video(video: Path, audio: Path, srt: Path, timestamp: str,
                  trim_start: float = 0.0) -> tuple[Path, Path]:
    """輸出兩版：無字幕版 + 字幕燒入版。trim_start > 0 時裁掉片頭空白。"""
    no_sub   = FINAL_DIR / f"rr-intro-en-{timestamp}.mp4"
    with_sub = FINAL_DIR / f"rr-intro-en-{timestamp}-sub.mp4"

    ss = ["-ss", str(round(trim_start, 3))] if trim_start > 0 else []

    # 無字幕版
    subprocess.run(
        [FFMPEG, "-y", *ss, "-i", str(video), "-i", str(audio),
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p", "-shortest",
         str(no_sub)],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )

    # 字幕燒入版
    subprocess.run(
        [FFMPEG, "-y", *ss, "-i", str(video), "-i", str(audio),
         "-vf", f"subtitles='{ffmpeg_srt_path(srt)}'",
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p", "-shortest",
         str(with_sub)],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )

    return no_sub, with_sub


# ---------------------------------------------------------------------------
# 報告
# ---------------------------------------------------------------------------

def write_report(timestamp: str, video: Path, audio: Path, srt: Path,
                 no_sub: Path, with_sub: Path, timings: list[dict]) -> None:
    report = REPORT_DIR / f"intro-en-report-{timestamp}.md"
    lines = [
        "# RR Intro Video Report",
        "",
        f"- 產生時間：{datetime.now().isoformat(timespec='seconds')}",
        f"- 來源影片：`{video.name}`",
        f"- 旁白音軌：`{audio.name}`",
        f"- 字幕：`{srt.name}`",
        f"- 無字幕版：`{no_sub.name}` ({no_sub.stat().st_size / 1024 / 1024:.1f} MB)",
        f"- 字幕版：`{with_sub.name}` ({with_sub.stat().st_size / 1024 / 1024:.1f} MB)",
        "",
        "## 旁白時間軸",
        "",
        "| # | 場景 | 開始 | 結束 | 旁白 |",
        "|---|---|---:|---:|---|",
    ]
    for i, t in enumerate(timings, start=1):
        lines.append(f"| {i} | {t['id']} | {t['actual_start']:.2f}s | {t['actual_end']:.2f}s | {t['text']} |")

    report.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ 報告：{report}")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

async def main(reuse_audio_dir: str | None = None) -> None:
    """
    reuse_audio_dir: 已存在的 segments 目錄名稱（AUDIO_DIR 下的子目錄），
                     例如 "segments-20260415-204733"，用來跳過 Step 1 重新合成。
    """
    for d in (AUDIO_DIR, SUBTITLE_DIR, FINAL_DIR, REPORT_DIR):
        d.mkdir(parents=True, exist_ok=True)

    script    = json.loads(SCRIPT_PATH.read_text(encoding="utf-8"))
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    lead_in   = script.get("lead_in", 0.4)
    lead_out  = script.get("lead_out", 0.5)

    # Step 1 — 合成旁白（或重用已有音檔）
    if reuse_audio_dir:
        seg_dir = AUDIO_DIR / reuse_audio_dir
        print(f"▶ Step 1：重用既有音檔 {seg_dir.name}…")
        timings: list[dict] = []
        for i, scene in enumerate(script["scenes"], start=1):
            mp3 = seg_dir / f"{i:02d}-{scene['id']}.mp3"
            dur = audio_duration(mp3)
            timings.append({"id": scene["id"], "text": scene["text"],
                            "path": str(mp3), "duration": round(dur, 3)})
    else:
        print("▶ Step 1：合成旁白…")
        timings = await build_narration(script, timestamp)
    total_narration = sum(t["duration"] for t in timings)
    print(f"  旁白總長：{total_narration:.1f}s，共 {len(timings)} 段")

    # Step 2 — 錄製影片（停留時間由旁白驅動）
    print("▶ Step 2：錄製影片…")
    s_ms = scene_ms_from_timings(timings, lead_in, lead_out)
    video, steps = await produce_video(scene_ms=s_ms)
    print(f"  影片：{video.name}")

    # Step 3 — 組片
    print("▶ Step 3：組片…")
    # pre_roll：片頭等待載入的空白時間，裁掉後影片從游標出現那刻開始
    pre_roll = max(0.0, round((steps[0]["start"] if steps else 0) - 0.3, 3))
    print(f"  裁切片頭：{pre_roll:.1f}s")

    timed = assign_audio_offsets(timings, steps, lead_in, pre_roll)

    audio = AUDIO_DIR / f"rr-narration-{timestamp}.m4a"
    compose_audio(timed, audio)

    srt = SUBTITLE_DIR / f"rr-intro-en-{timestamp}.srt"
    build_srt(timed, srt)

    no_sub, with_sub = compose_video(video, audio, srt, timestamp, trim_start=pre_roll)

    write_report(timestamp, video, audio, srt, no_sub, with_sub, timed)

    print(f"✅ 無字幕版：{no_sub}")
    print(f"✅ 字幕版：  {with_sub}")


if __name__ == "__main__":
    import sys
    # 傳入已有音檔目錄名可跳過 Step 1，例如：
    #   python make_intro_video_en.py segments-20260415-204733
    reuse = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(main(reuse_audio_dir=reuse))
