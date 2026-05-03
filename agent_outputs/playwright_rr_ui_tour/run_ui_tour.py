"""
run_ui_tour.py - RR AgentVisualizer 教學巡覽與截圖驗證腳本

用途：
  1. 啟動本地靜態伺服器
  2. 用 Playwright 走一遍 RR 主要 UI
  3. 在每個步驟同步呼叫 AgentVisualizer API
  4. 逐步截圖
  5. 產出簡單的截圖驗證報告

需求：
  pip install playwright
  playwright install chromium
"""

from __future__ import annotations

import asyncio
import json
import struct
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.async_api import Page, async_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent
SCREENSHOT_DIR = OUT_DIR / "screenshots"
REPORT_DIR = OUT_DIR / "reports"
BASE_URL = "http://127.0.0.1:8765"

CHROME_ARGS = [
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
]


def ensure_dirs() -> None:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)


class LocalSite:
    def __init__(self, root: Path, port: int):
        self.root = root
        self.port = port
        self.httpd: ThreadingHTTPServer | None = None
        self.thread: Thread | None = None

    def start(self) -> None:
        handler = partial(SimpleHTTPRequestHandler, directory=str(self.root))
        self.httpd = ThreadingHTTPServer(("127.0.0.1", self.port), handler)
        self.thread = Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        if self.httpd is not None:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.thread is not None:
            self.thread.join(timeout=1)


async def wait(ms: int = 700) -> None:
    await asyncio.sleep(ms / 1000)


async def wait_for_visualizer(page: Page) -> None:
    await page.wait_for_function("() => !!window.AgentVisualizer", timeout=15000)
    await page.evaluate("window.AgentVisualizer.enable()")
    await page.evaluate("window.AgentVisualizer.setSpeed(1)")
    await wait(300)


async def call_visualizer(page: Page, expression: str):
    return await page.evaluate(expression)


async def shot(page: Page, name: str, notes: str, selector: str | None = None) -> dict:
    target = SCREENSHOT_DIR / name
    if selector:
        locator = page.locator(selector).first
        await locator.screenshot(path=str(target))
    else:
        await page.screenshot(path=str(target))
    return {
        "file": name,
        "path": str(target),
        "notes": notes,
    }


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        header = fh.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a valid PNG")
    width, height = struct.unpack(">II", header[16:24])
    return width, height


def validate_screenshot(path: Path) -> dict:
    width, height = png_size(path)
    size = path.stat().st_size
    checks = []
    checks.append(("exists", path.exists()))
    checks.append(("width>=220", width >= 220))
    checks.append(("height>=120", height >= 120))
    checks.append(("filesize>=6KB", size >= 6 * 1024))
    ok = all(flag for _, flag in checks)
    return {
        "file": path.name,
        "width": width,
        "height": height,
        "bytes": size,
        "checks": [{"name": name, "ok": flag} for name, flag in checks],
        "ok": ok,
    }


async def set_slider(page: Page, slider_id: str, value: float) -> None:
    await page.evaluate(
        """
        ({sliderId, value}) => {
          const el = document.getElementById(sliderId);
          if (!el) throw new Error(`slider not found: ${sliderId}`);
          el.value = String(value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        """,
        {"sliderId": slider_id, "value": value},
    )
    await wait(250)


async def set_radio(page: Page, radio_id: str) -> None:
    await page.click(f"#{radio_id}")
    await wait(300)


async def click_subtab(page: Page, subtab: str) -> None:
    await page.click(f'button[data-subtab="{subtab}"]')
    await wait(700)


async def load_game(page: Page, relative_url: str) -> None:
    await page.fill("#gameUrlInput", relative_url)
    await page.click("#loadGame")
    await wait(2200)


async def ensure_plotly_ready(page: Page) -> None:
    await page.wait_for_function(
        """
        () => {
          const ids = [
            'p1-second-reward', 'p1-second-steps',
            'p1-episode-reward', 'p1-episode-steps',
            'p1-bars-value', 'p1-diff-value',
            'p1-maxi-value', 'p1-mini-value',
          ];
          return ids.every(id => document.getElementById(id));
        }
        """,
        timeout=20000,
    )


async def wait_for_docs(page: Page) -> None:
    await page.wait_for_function(
        """
        () => {
          const tutorial = document.getElementById('tutorial');
          const games = document.getElementById('offical-games');
          return tutorial && games && tutorial.textContent.trim().length > 0 && games.textContent.trim().length > 0;
        }
        """,
        timeout=20000,
    )


async def tour(page: Page) -> list[dict]:
    records: list[dict] = []

    await page.goto(f"{BASE_URL}/index.html", wait_until="domcontentloaded")
    await page.set_viewport_size({"width": 1600, "height": 1000})
    await wait_for_docs(page)
    await ensure_plotly_ready(page)
    await wait_for_visualizer(page)

    await call_visualizer(page, "window.AgentVisualizer.focusRect({left: 8, top: 8, width: 1584, height: 984}, {padding: 0, radius: 12})")
    await wait(500)
    records.append(await shot(page, "01-overview.png", "全頁初始總覽，使用 focusRect 框整個平台"))

    await call_visualizer(page, "window.AgentVisualizer.moveToElement('button[data-subtab=\"tutorial\"]')")
    await call_visualizer(page, "window.AgentVisualizer.highlightElement('button[data-subtab=\"tutorial\"]', {padding: 6})")
    await wait(500)
    records.append(await shot(page, "02-tutorial-tab.png", "用 moveToElement + highlightElement 指向指南分頁"))

    await call_visualizer(page, "window.AgentVisualizer.clickElement('button[data-subtab=\"offical-games\"]')")
    await click_subtab(page, "offical-games")
    await call_visualizer(page, "window.AgentVisualizer.focusElement('#offical-games', {padding: 10, radius: 10})")
    await wait(700)
    records.append(await shot(page, "03-games-tab.png", "切到遊戲分頁，使用 clickElement + focusElement 框內容區"))

    await call_visualizer(
        page,
        """
        window.AgentVisualizer.dragPath([
          {x: 480, y: 56},
          {x: 760, y: 56},
          {x: 1040, y: 56},
          {x: 1290, y: 56}
        ], { segmentDuration: 220, keepTrail: true, fadeDuration: 1400 })
        """,
    )
    await wait(500)
    records.append(await shot(page, "04-tab-drag-path.png", "拖曳路徑示範，讓視線沿著上方 tab 列移動"))
    await call_visualizer(page, "window.AgentVisualizer.clearTrail()")

    await call_visualizer(page, "window.AgentVisualizer.focusElement('#controls', {padding: 10})")
    await call_visualizer(page, "window.AgentVisualizer.moveToElement('#gameUrlInput')")
    await wait(300)
    records.append(await shot(page, "05-top-controls.png", "上方控制列示範，框出載入遊戲控制區"))

    await load_game(page, "/games/Maze2D_emoji.html")
    await call_visualizer(page, "window.AgentVisualizer.clickElement('#loadGame')")
    await call_visualizer(page, "window.AgentVisualizer.focusElement('#game-iframe', {padding: 8, radius: 8})")
    await wait(1000)
    records.append(await shot(page, "06-iframe-focus.png", "載入 Maze2D 後，框出左側遊戲 iframe"))

    await click_subtab(page, "p1-config")
    await call_visualizer(page, "window.AgentVisualizer.focusElement('#p1-config .grid-container > div:nth-child(1)', {padding: 10})")
    await wait(500)
    records.append(await shot(page, "07-config-algorithm.png", "儀錶頁演算法與策略區"))

    await set_slider(page, "learning-rate-slider", 0.35)
    await set_slider(page, "discount-factor-slider", 0.80)
    await set_slider(page, "exploration-rate-slider", 0.25)
    await set_slider(page, "optimism-slider", 0.2)
    await set_slider(page, "delay-slider", 20)
    await call_visualizer(page, "window.AgentVisualizer.hoverRect({left: 830, top: 120, width: 330, height: 270}, {padding: 8, radius: 8})")
    await wait(450)
    records.append(await shot(page, "08-config-sliders.png", "使用 hoverRect 強調超參數滑桿區"))
    await call_visualizer(page, "window.AgentVisualizer.clearHover()")

    await set_radio(page, "algorithm-dqn")
    await set_radio(page, "algorithm-qtable")
    await set_radio(page, "strategy-softmax")
    await set_radio(page, "strategy-egreedy")
    await call_visualizer(page, "window.AgentVisualizer.moveTo(1040, 235)")
    await call_visualizer(page, "window.AgentVisualizer.click(1040, 235, {moveFirst: false})")
    await wait(300)
    records.append(await shot(page, "09-manual-point-click.png", "直接使用 moveTo(x,y) + click(x,y) 示範任意座標點擊"))

    await call_visualizer(page, "window.AgentVisualizer.focusRect({left: 760, top: 330, width: 800, height: 530}, {padding: 12, radius: 10})")
    await wait(500)
    records.append(await shot(page, "10-training-charts-group.png", "用 focusRect 框住四張訓練圖表區"))

    await click_subtab(page, "p1-qtable")
    await wait(1400)
    await call_visualizer(page, "window.AgentVisualizer.focusElement('#p1-ui1', {padding: 10, radius: 8})")
    await wait(500)
    records.append(await shot(page, "11-analysis-stats.png", "分析頁統計面板"))

    chart_steps = [
        ("#p1-bars-value", "12-analysis-bars.png", "動作價值與機率柱狀圖"),
        ("#p1-diff-value", "13-analysis-diff.png", "動作選擇熱力圖"),
        ("#p1-maxi-value", "14-analysis-max.png", "最大 Q 值熱力圖"),
        ("#p1-mini-value", "15-analysis-min.png", "最小 Q 值熱力圖"),
        ("#p1-line-value", "16-analysis-line.png", "切片折線圖"),
        ("#p1-acti-color", "17-analysis-wheel.png", "動作色環"),
    ]

    for selector, filename, notes in chart_steps:
        await call_visualizer(page, f"window.AgentVisualizer.highlightElement('{selector}', {{padding: 8, radius: 8}})")
        await call_visualizer(page, f"window.AgentVisualizer.moveToElement('{selector}')")
        await wait(500)
        records.append(await shot(page, filename, notes, selector))

    await call_visualizer(page, "window.AgentVisualizer.clearAll()")
    await call_visualizer(page, "window.AgentVisualizer.setSpeed(1.5)")
    await call_visualizer(page, "window.AgentVisualizer.dragPath([{x: 1180, y: 405},{x: 1340, y: 405},{x: 1340, y: 720}], {segmentDuration: 180, keepTrail: true})")
    await wait(450)
    records.append(await shot(page, "18-fast-trail.png", "切換較快節奏，重播一段拖曳路徑"))
    await call_visualizer(page, "window.AgentVisualizer.disable()")
    await wait(200)
    records.append(await shot(page, "19-overlay-disabled.png", "停用 AgentVisualizer，確認 overlay 可關閉"))

    return records


def write_reports(records: list[dict]) -> None:
    validations = []
    for record in records:
        validations.append({
            "file": record["file"],
            "notes": record["notes"],
            "validation": validate_screenshot(Path(record["path"])),
        })

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    json_path = REPORT_DIR / f"ui-tour-report-{timestamp}.json"
    md_path = REPORT_DIR / f"ui-tour-report-{timestamp}.md"

    with json_path.open("w", encoding="utf-8") as fh:
        json.dump(
            {
                "created_at": datetime.now().isoformat(timespec="seconds"),
                "base_url": BASE_URL,
                "screenshots": validations,
            },
            fh,
            ensure_ascii=False,
            indent=2,
        )

    lines = [
        "# RR UI Tour Report",
        "",
        f"- 產生時間：{datetime.now().isoformat(timespec='seconds')}",
        f"- Base URL：`{BASE_URL}`",
        "",
        "| 檔案 | 說明 | 尺寸 | 大小 | 結果 |",
        "|---|---|---:|---:|---|",
    ]

    for item in validations:
        v = item["validation"]
        result = "OK" if v["ok"] else "FAIL"
        dims = f"{v['width']}x{v['height']}"
        size_kb = f"{v['bytes'] / 1024:.1f} KB"
        lines.append(f"| `{item['file']}` | {item['notes']} | {dims} | {size_kb} | {result} |")

    failed = [item for item in validations if not item["validation"]["ok"]]
    lines.append("")
    if failed:
        lines.append("## Failed Checks")
        lines.append("")
        for item in failed:
            failed_checks = [c["name"] for c in item["validation"]["checks"] if not c["ok"]]
            lines.append(f"- `{item['file']}`: {', '.join(failed_checks)}")
    else:
        lines.append("## Summary")
        lines.append("")
        lines.append(f"- 全部通過：{len(validations)} / {len(validations)}")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅ 報告已輸出：{json_path}")
    print(f"✅ 報告已輸出：{md_path}")


async def main() -> None:
    ensure_dirs()
    site = LocalSite(ROOT, 8765)
    site.start()
    print(f"▶ 本地伺服器啟動：{BASE_URL}")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=CHROME_ARGS)
            context = await browser.new_context(viewport={"width": 1600, "height": 1000})
            page = await context.new_page()
            records = await tour(page)
            write_reports(records)
            await context.close()
            await browser.close()
    finally:
        site.stop()


if __name__ == "__main__":
    asyncio.run(main())
