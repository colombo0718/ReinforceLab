"""
run_ui_tour_video.py - RR AgentVisualizer 教學巡覽錄影腳本

用途：
  1. 啟動本地靜態伺服器
  2. 用 Playwright 錄下一段完整的 RR UI 教學巡覽影片
  3. 走過主要 UI 與分析圖表
  4. 確保 AgentVisualizer 的主要能力都在片段中用到
  5. 產出影片檢查報告

需求：
  pip install playwright
  playwright install chromium
"""

from __future__ import annotations

import asyncio
import json
import shutil
from datetime import datetime
from pathlib import Path

from playwright.async_api import Page, async_playwright

from run_ui_tour import (
    BASE_URL,
    CHROME_ARGS,
    LocalSite,
    ROOT,
    click_subtab,
    ensure_plotly_ready,
    load_game,
    set_radio,
    set_slider,
    wait,
    wait_for_docs,
    wait_for_visualizer,
)


OUT_DIR = Path(__file__).resolve().parent
VIDEO_DIR = OUT_DIR / "videos"
REPORT_DIR = OUT_DIR / "reports"


def ensure_dirs() -> None:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


async def av(page: Page, expression: str):
    return await page.evaluate(expression)


async def section_pause(ms: int = 900):
    await wait(ms)


async def scroll_into_view(page: Page, selector: str) -> None:
    await page.locator(selector).first.scroll_into_view_if_needed()
    await wait(450)


async def rect_of(page: Page, selector: str) -> dict:
    return await page.evaluate(
        """
        (selector) => {
          const el = document.querySelector(selector);
          if (!el) throw new Error(`selector not found: ${selector}`);
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
        """,
        selector,
    )


async def union_rect(page: Page, selectors: list[str]) -> dict:
    return await page.evaluate(
        """
        (selectors) => {
          const rects = selectors.map(selector => {
            const el = document.querySelector(selector);
            if (!el) throw new Error(`selector not found: ${selector}`);
            return el.getBoundingClientRect();
          });
          const left = Math.min(...rects.map(r => r.left));
          const top = Math.min(...rects.map(r => r.top));
          const right = Math.max(...rects.map(r => r.right));
          const bottom = Math.max(...rects.map(r => r.bottom));
          return { left, top, width: right - left, height: bottom - top };
        }
        """,
        selectors,
    )


async def record_tour(page: Page, scene_ms: dict[str, int] | None = None) -> list[dict]:
    """
    scene_ms: { scene_title: pause_ms }。若傳入，各場景暫停時間由此決定；
    否則使用腳本內的預設值。
    """
    _ms = scene_ms or {}

    def pause_for(title: str, default: int) -> int:
        return _ms.get(title, default)

    steps: list[dict] = []
    start_time = asyncio.get_running_loop().time()
    last_index: int | None = None

    def log(title: str, detail: str) -> None:
        nonlocal last_index
        now = asyncio.get_running_loop().time() - start_time
        if last_index is not None:
            steps[last_index]["end"] = round(now, 3)
        steps.append({
            "title": title,
            "detail": detail,
            "start": round(now, 3),
            "end": None,
        })
        last_index = len(steps) - 1

    await page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
    await wait_for_docs(page)
    await ensure_plotly_ready(page)
    await wait_for_visualizer(page)

    await av(page, "window.AgentVisualizer.setCursorEmoji('👆')")
    await av(page, "window.AgentVisualizer.enable()")
    await av(page, "window.AgentVisualizer.moveTo(800, 500)")
    log("開場總覽", "游標出現在畫面中央，平台已載入。")
    await section_pause(pause_for("開場總覽", 1500))

    ms = pause_for("指南分頁", 1200)
    await av(page, "window.AgentVisualizer.moveToElement('button[data-subtab=\"tutorial\"]')")
    await av(page, f"window.AgentVisualizer.focusElement('button[data-subtab=\"tutorial\"]', {{padding: 6, duration: {ms}}})")
    log("指南分頁", "指出指南分頁入口。")
    await section_pause(ms)

    ms = pause_for("遊戲分頁", 1400)
    await av(page, "window.AgentVisualizer.clickElement('button[data-subtab=\"offical-games\"]')")
    await click_subtab(page, "offical-games")
    await av(page, f"window.AgentVisualizer.focusElement('#offical-games', {{padding: 10, radius: 10, duration: {ms}}})")
    log("遊戲分頁", "切到遊戲分頁並框出內容區。")
    await section_pause(ms)

    await av(
        page,
        """
        window.AgentVisualizer.dragPath([
          {x: 490, y: 54},
          {x: 790, y: 54},
          {x: 1070, y: 54},
          {x: 1320, y: 54}
        ], { segmentDuration: 260, scale: 1.02 })
        """,
    )
    log("拖曳路徑", "讓觀眾跟著上方 tab 列走。")
    await section_pause(pause_for("拖曳路徑", 1200))

    ms = pause_for("控制列", 1200)
    await av(page, f"window.AgentVisualizer.focusElement('#controls', {{padding: 10, duration: {ms}}})")
    await av(page, "window.AgentVisualizer.moveToElement('#gameUrlInput')")
    log("控制列", "框出上方控制列與載入遊戲輸入框。")
    await section_pause(ms)

    ms = pause_for("遊戲 iframe", 1700)
    await load_game(page, "/games/Maze2D_emoji.html")
    await av(page, "window.AgentVisualizer.clickElement('#loadGame')")
    await av(page, f"window.AgentVisualizer.focusElement('#game-iframe', {{padding: 8, radius: 8, duration: {ms}}})")
    log("遊戲 iframe", "載入 Maze2D 後框住左側遊戲區。")
    await section_pause(ms)

    ms = pause_for("演算法與策略", 1300)
    await click_subtab(page, "p1-config")
    await av(page, f"window.AgentVisualizer.focusElement('#p1-config .grid-container > div:nth-child(1)', {{padding: 10, duration: {ms}}})")
    log("演算法與策略", "介紹儀錶頁左上角的演算法與策略區。")
    await section_pause(ms)

    await scroll_into_view(page, "#p1-config .grid-container > div:nth-child(2)")
    await av(page, "window.AgentVisualizer.focusElement('#p1-config .grid-container > div:nth-child(2)', {padding: 8, radius: 8})")
    await set_slider(page, "learning-rate-slider", 0.35)
    await set_slider(page, "discount-factor-slider", 0.80)
    await set_slider(page, "exploration-rate-slider", 0.25)
    await set_slider(page, "optimism-slider", 0.2)
    await set_slider(page, "delay-slider", 20)
    log("超參數滑桿", "用紅框高亮右側滑桿區，並示範修改參數。")
    await section_pause(pause_for("超參數滑桿", 1700))
    await av(page, "window.AgentVisualizer.clearFocus()")

    await set_radio(page, "algorithm-dqn")
    await section_pause(500)
    await set_radio(page, "algorithm-qtable")
    await section_pause(500)
    await set_radio(page, "strategy-softmax")
    await section_pause(500)
    await set_radio(page, "strategy-egreedy")
    log("模式切換", "示範演算法與探索策略切換。")
    await section_pause(pause_for("模式切換", 1200))

    pause_rect = await rect_of(page, "#togglePause")
    pause_center_x = pause_rect["left"] + pause_rect["width"] / 2
    pause_center_y = pause_rect["top"] + pause_rect["height"] / 2
    await av(page, f"window.AgentVisualizer.moveTo({pause_center_x}, {pause_center_y})")
    await av(page, f"window.AgentVisualizer.click({pause_center_x}, {pause_center_y}, {{moveFirst: false, size: 64}})")
    log("精準點擊", "展示以真實按鈕中心點做精準點擊與波紋。")
    await section_pause(pause_for("精準點擊", 1000))

    ms = pause_for("四張訓練圖表", 1800)
    charts_rect = await union_rect(
        page,
        ["#p1-second-reward", "#p1-second-steps", "#p1-episode-reward", "#p1-episode-steps"],
    )
    await av(
        page,
        f"window.AgentVisualizer.focusRect({json.dumps(charts_rect)}, {{padding: 12, radius: 10, duration: {ms}}})",
    )
    log("四張訓練圖表", "框出儀錶頁四張訓練圖表。")
    await section_pause(ms)

    ms = pause_for("分析頁統計", 1300)
    await click_subtab(page, "p1-qtable")
    await wait(1400)
    await scroll_into_view(page, "#p1-ui1")
    await av(page, f"window.AgentVisualizer.focusElement('#p1-ui1', {{padding: 10, radius: 8, duration: {ms}}})")
    log("分析頁統計", "切到分析頁，介紹統計面板。")
    await section_pause(ms)

    chart_sequence = [
        ("#p1-bars-value", "柱狀圖", "動作價值與機率柱狀圖。"),
        ("#p1-diff-value", "動作熱力圖", "動作選擇熱力圖。"),
        ("#p1-maxi-value", "最大 Q 值", "最大 Q 值熱力圖。"),
        ("#p1-mini-value", "最小 Q 值", "最小 Q 值熱力圖。"),
        ("#p1-line-value", "切片折線圖", "切片折線圖。"),
        ("#p1-acti-color", "動作色環", "動作色環。"),
    ]

    for selector, title, detail in chart_sequence:
        ms = pause_for(title, 1500)
        await scroll_into_view(page, selector)
        await av(page, f"window.AgentVisualizer.focusElement('{selector}', {{padding: 8, radius: 8, duration: {ms}}})")
        await av(page, f"window.AgentVisualizer.moveToElement('{selector}')")
        log(title, detail)
        await section_pause(ms)

    await av(page, "window.AgentVisualizer.clearFocus()")
    await av(page, "window.AgentVisualizer.setSpeed(1.6)")
    await av(
        page,
        "window.AgentVisualizer.dragPath([{x: 1180, y: 404}, {x: 1340, y: 404}, {x: 1340, y: 720}], {segmentDuration: 180})",
    )
    log("快節奏路徑", "切換較快節奏重播一段游標路徑。")
    await section_pause(pause_for("快節奏路徑", 1200))

    await av(page, "window.AgentVisualizer.disable()")
    log("關閉 overlay", "最後停用 AgentVisualizer，收乾淨畫面。")
    await section_pause(pause_for("關閉 overlay", 900))

    end_now = asyncio.get_running_loop().time() - start_time
    if last_index is not None:
        steps[last_index]["end"] = round(end_now, 3)

    return steps


def validate_video(path: Path) -> dict:
    size = path.stat().st_size if path.exists() else 0
    checks = [
        ("exists", path.exists()),
        ("suffix=.webm", path.suffix.lower() == ".webm"),
        ("filesize>=150KB", size >= 150 * 1024),
    ]
    return {
        "file": path.name,
        "bytes": size,
        "checks": [{"name": name, "ok": flag} for name, flag in checks],
        "ok": all(flag for _, flag in checks),
    }


def write_report(video_path: Path, steps: list[dict]) -> tuple[Path, Path]:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    validation = validate_video(video_path)
    json_path = REPORT_DIR / f"ui-tour-video-report-{timestamp}.json"
    md_path = REPORT_DIR / f"ui-tour-video-report-{timestamp}.md"

    payload = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "base_url": BASE_URL,
        "video": {
            "path": str(video_path),
            "validation": validation,
        },
        "steps": steps,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# RR UI Tour Video Report",
        "",
        f"- 產生時間：{payload['created_at']}",
        f"- Base URL：`{BASE_URL}`",
        f"- 影片：`{video_path.name}`",
        f"- 大小：{validation['bytes'] / 1024:.1f} KB",
        f"- 檢查結果：{'OK' if validation['ok'] else 'FAIL'}",
        "",
        "## Steps",
        "",
    ]
    for index, step in enumerate(steps, start=1):
        lines.append(f"{index}. **{step['title']}** - {step['detail']}")

    failed = [check["name"] for check in validation["checks"] if not check["ok"]]
    lines.append("")
    if failed:
        lines.append("## Failed Checks")
        lines.append("")
        for item in failed:
            lines.append(f"- {item}")
    else:
        lines.append("## Summary")
        lines.append("")
        lines.append("- 影片檔案已成功生成，基本檢查通過。")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ 報告已輸出：{json_path}")
    print(f"✅ 報告已輸出：{md_path}")
    return json_path, md_path


async def produce_video(scene_ms: dict[str, int] | None = None) -> tuple[Path, list[dict]]:
    ensure_dirs()
    site = LocalSite(ROOT, 8765)
    site.start()
    print(f"▶ 本地伺服器啟動：{BASE_URL}")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    final_video_path = VIDEO_DIR / f"rr-ui-tour-{timestamp}.webm"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=CHROME_ARGS)
            context = await browser.new_context(
                viewport={"width": 1600, "height": 1000},
                record_video_dir=str(VIDEO_DIR),
                record_video_size={"width": 1600, "height": 1000},
            )
            page = await context.new_page()
            video = page.video

            steps = await record_tour(page, scene_ms)

            await context.close()
            await browser.close()

            raw_video_path = Path(await video.path())
            if raw_video_path != final_video_path:
                if final_video_path.exists():
                    final_video_path.unlink()
                shutil.move(str(raw_video_path), str(final_video_path))

            write_report(final_video_path, steps)
            return final_video_path, steps
    finally:
        site.stop()


async def main() -> None:
    await produce_video()


if __name__ == "__main__":
    asyncio.run(main())
