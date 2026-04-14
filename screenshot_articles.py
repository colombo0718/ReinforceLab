"""
screenshot_articles.py — 指南文章截圖自動化腳本

用途：批量截取 docs/articles/ 各篇文章所需的 RR 平台畫面
輸出：docs/articles/img/

執行：
    python screenshot_articles.py

需求：
    pip install playwright
    playwright install chromium
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

# ── 設定 ─────────────────────────────────────────────────────────────────────
RR_URL  = "https://reinroom.leaflune.org"
OUT_DIR = Path(__file__).parent / "docs" / "articles" / "img"

CHROME_ARGS = [
    "--start-maximized",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
]

GAME_URLS = {
    "MAB":      "https://reinroom.leaflune.org/games/MAB.html",
    "Maze1D":   "https://reinroom.leaflune.org/games/Maze1D.html",
    "Maze2D":   "https://reinroom.leaflune.org/games/Maze2D_emoji.html",
    "heli":     "https://reinroom.leaflune.org/games/heli.html",
    "CartPole": "https://reinroom.leaflune.org/games/CartPole.html",
}


# ── 基礎工具 ──────────────────────────────────────────────────────────────────

async def wait(ms=800):
    await asyncio.sleep(ms / 1000)


async def click_tab(page, subtab: str):
    await page.click(f'button[data-subtab="{subtab}"]')
    await wait(600)


async def set_slider(page, slider_id: str, value: float):
    await page.evaluate(f"""
        const el = document.getElementById('{slider_id}');
        if (el) {{ el.value = {value}; el.dispatchEvent(new Event('input')); }}
    """)
    await wait(200)


async def set_radio(page, radio_id: str):
    await page.evaluate(f"""
        const el = document.getElementById('{radio_id}');
        if (el) {{ el.click(); el.dispatchEvent(new Event('change')); }}
    """)
    await wait(300)


async def load_game(page, url: str):
    await page.fill('#gameUrlInput', url)
    await page.click('#loadGame')
    await wait(2500)


async def wait_episodes(page, target: int, timeout_s: int = 180) -> int:
    print(f"    ⏳ 等待訓練至第 {target} 回合…", end="", flush=True)
    for _ in range(timeout_s * 2):
        count = await page.evaluate(
            "typeof episodeCount !== 'undefined' ? episodeCount : 0"
        )
        if count >= target:
            print(f" ({count} 回合)")
            return count
        await asyncio.sleep(0.5)
    count = await page.evaluate(
        "typeof episodeCount !== 'undefined' ? episodeCount : 0"
    )
    print(f" ⚠ 超時，目前 {count} 回合")
    return count


def out(filename: str) -> str:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    return str(OUT_DIR / filename)


# ── 精準截圖工具 ───────────────────────────────────────────────────────────────

async def shot(page, selector: str, filename: str, padding: int = 8):
    """截取單一 CSS selector 元素（用 locator.screenshot，不手動算 clip）"""
    locator = page.locator(selector).first
    try:
        count = await locator.count()
        if count == 0:
            print(f"  ⚠ 找不到：{selector}")
            return
        await locator.screenshot(path=out(filename))
        print(f"  ✅ {filename}")
    except Exception as e:
        print(f"  ⚠ 截圖失敗 {selector}：{e}")


async def shot_multi(page, selectors: list, filename: str, padding: int = 16):
    """截取多個元素的聯合包圍框"""
    bbox = await page.evaluate("""
        (sels) => {
            const rects = sels.map(s => {
                const el = document.querySelector(s);
                return el ? el.getBoundingClientRect() : null;
            }).filter(Boolean);
            if (!rects.length) return null;
            const x1 = Math.min(...rects.map(r => r.left));
            const y1 = Math.min(...rects.map(r => r.top));
            const x2 = Math.max(...rects.map(r => r.right));
            const y2 = Math.max(...rects.map(r => r.bottom));
            return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
        }
    """, selectors)
    if not bbox or bbox['width'] == 0 or bbox['height'] == 0:
        print(f"  ⚠ 找不到元素群：{selectors}")
        return
    vp = page.viewport_size or {'width': 1920, 'height': 1080}
    x = max(0, bbox['x'] - padding)
    y = max(0, bbox['y'] - padding)
    w = min(bbox['width'] + padding * 2, vp['width'] - x)
    h = min(bbox['height'] + padding * 2, vp['height'] - y)
    if w <= 0 or h <= 0:
        print(f"  ⚠ clip 超出視窗範圍：{selectors}")
        return
    clip = dict(x=x, y=y, width=w, height=h)
    try:
        await page.screenshot(path=out(filename), clip=clip)
        print(f"  ✅ {filename}")
    except Exception as e:
        print(f"  ⚠ 截圖失敗 {selectors}：{e}")


async def shot_full(page, filename: str):
    await page.screenshot(path=out(filename))
    print(f"  ✅ {filename}")


# ── 各文章截圖分組 ─────────────────────────────────────────────────────────────

async def shots_intro_rr(page):
    """
    intro-rr.html 所需截圖
    - rr-ui-overview.png   整體介面（左遊戲 + 右面板）
    """
    print("\n📄 intro-rr.html")
    await load_game(page, GAME_URLS["Maze2D"])
    await click_tab(page, "p1-config")
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 60)
    await set_slider(page, "delay-slider", 30)
    await wait(1000)
    await shot_full(page, "rr-ui-overview.png")


async def shots_quickstart(page):
    """
    quickstart.html 所需截圖
    - qs-ui-start.png         初始介面
    - qs-game-tab.png         遊戲分頁（Maze2D 已選中）
    - qs-maze2d-early.png     Maze2D 遊戲畫面（訓練初期）
    - qs-reward-early.png     Reward 曲線初期（震盪）
    - qs-maze2d-late.png      Maze2D 遊戲畫面（訓練後期）
    - qs-qtable-heatmap.png   Q-Table 熱力圖（收斂後）
    """
    print("\n📄 quickstart.html")

    # 初始介面
    await page.goto(RR_URL)
    await wait(2500)
    await shot_full(page, "qs-ui-start.png")

    # 遊戲分頁
    await click_tab(page, "offical-games")
    await wait(500)
    await shot(page, '#offical-games', "qs-game-tab.png", padding=0)

    # 載入 Maze2D，截初期
    await load_game(page, GAME_URLS["Maze2D"])
    await click_tab(page, "p1-config")
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 5)
    await set_slider(page, "delay-slider", 50)
    await wait(500)
    await shot(page, '#game-iframe', "qs-maze2d-early.png")

    # Reward 曲線初期
    await shot_multi(page,
        ['#p1-episode-reward', '#p1-episode-steps'],
        "qs-reward-early.png")

    # 繼續訓練到後期
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 200)
    await set_slider(page, "delay-slider", 30)
    await wait(1000)
    await shot(page, '#game-iframe', "qs-maze2d-late.png")

    # Q-Table 熱力圖
    await click_tab(page, "p1-qtable")
    await wait(1500)
    await shot(page, '#p1-diff-value', "qs-qtable-heatmap.png")


async def shots_intro_rl(page):
    """
    intro-rl.html 所需截圖
    - rl-qtable-heatmap.png   Maze2D Q-Table 熱力圖（訓練後，終點附近高亮）
    注意：shots_quickstart 已訓練 Maze2D 至 200 回合，直接接著截即可
    """
    print("\n📄 intro-rl.html")
    # 已是 Maze2D 訓練後狀態，直接切分析頁截圖
    await click_tab(page, "p1-qtable")
    await wait(2000)
    await shot(page, '#p1-maxi-value', "rl-qtable-heatmap.png")


async def shots_qlearning(page):
    """
    qlearning.html 所需截圖
    - ql-qtable-heatmap.png   Q-Table 熱力圖（收斂後，終點附近高亮，路徑有漸層）
    """
    print("\n📄 qlearning.html")
    # Maze2D 已是訓練後狀態，直接切到分析頁截圖
    await click_tab(page, "p1-qtable")
    await wait(1200)
    await shot(page, '#p1-maxi-value', "ql-qtable-heatmap.png")


async def shots_exploration(page):
    """
    exploration.html 所需截圖
    - exp-epsilon-slider.png        ε 設定區塊（slider + cold-start）
    - exp-reward-low-eps.png        ε=0.05 的 Reward 曲線（快速收斂但低）
    - exp-reward-high-eps.png       ε=0.5 的 Reward 曲線（震盪探索）
    - exp-reward-default.png        預設 ε=0.2 的 Reward 曲線（對照組）
    """
    print("\n📄 exploration.html")

    # ε 滑桿截圖（在儀錶頁）
    await click_tab(page, "p1-config")
    await wait(400)
    await shot(page, '#p1-config .grid-container > div:nth-child(1)',
               "exp-epsilon-slider.png", padding=12)

    # 三組對比實驗（每次重新載入 Maze2D 從頭訓練）
    for eps, fname in [(0.05, "exp-reward-low-eps.png"),
                       (0.5,  "exp-reward-high-eps.png"),
                       (0.2,  "exp-reward-default.png")]:
        await load_game(page, GAME_URLS["Maze2D"])
        await click_tab(page, "p1-config")
        await set_slider(page, "delay-slider", 0)
        await set_slider(page, "exploration-rate-slider", eps)
        await wait_episodes(page, 150)
        await wait(500)
        await shot(page, '#p1-episode-reward', fname)


async def shots_read_charts(page):
    """
    read-charts.html 所需截圖
    - charts-converging.png    收斂中的 Reward 曲線（穩定上升）
    - charts-steps.png         Steps 曲線（逐漸下降收斂）
    - charts-4panel.png        四張圖合拍（每秒+每回合的 Reward & Steps）
    """
    print("\n📄 read-charts.html")
    await load_game(page, GAME_URLS["Maze2D"])
    await click_tab(page, "p1-config")
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 200)
    await wait(800)

    await shot(page, '#p1-episode-reward', "charts-converging.png")
    await shot(page, '#p1-episode-steps',  "charts-steps.png")
    await shot_multi(page,
        ['#p1-second-reward', '#p1-second-steps',
         '#p1-episode-reward', '#p1-episode-steps'],
        "charts-4panel.png", padding=12)


async def shots_qtable_viz(page):
    """
    qtable-viz.html 所需截圖
    - viz-heatmap.png          Q-Table 熱力圖（Maze2D 收斂後）
    - viz-action-heatmap.png   動作熱圖（顏色分區指向終點）
    - viz-bar-slice.png        點擊某格後的動作分布 bar 圖
    - viz-r2-stat.png          DQN 模式的 R² 同步率統計面板
    """
    print("\n📄 qtable-viz.html")

    # Q-Table 熱力圖 + 動作熱圖（Maze2D 已訓練，切到分析頁）
    await click_tab(page, "p1-qtable")
    await wait(1500)
    await shot(page, '#p1-maxi-value',  "viz-heatmap.png")
    await shot(page, '#p1-diff-value',  "viz-action-heatmap.png")
    await shot(page, '#p1-bars-value',  "viz-bar-slice.png")

    # DQN 模式的 R² 統計
    await click_tab(page, "p1-config")
    await set_radio(page, "algorithm-dqn")
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 120)
    await wait(2000)
    await click_tab(page, "p1-qtable")
    await wait(1200)
    await shot(page, '#p1-ui1', "viz-r2-stat.png")

    # 還原回 Q-Table
    await click_tab(page, "p1-config")
    await set_radio(page, "algorithm-qtable")
    await set_slider(page, "delay-slider", 50)


async def shots_choose_game(page):
    """
    choose-game.html 所需截圖
    各遊戲的 iframe 畫面（訓練數回合後截圖，畫面較有內容）
    - game-mab.png
    - game-maze1d.png
    - game-maze2d.png
    - game-heli.png
    - game-cartpole.png
    """
    print("\n📄 choose-game.html")
    shots = [
        ("MAB",      "game-mab.png",      10,  2000),
        ("Maze1D",   "game-maze1d.png",   10,  1500),
        ("Maze2D",   "game-maze2d.png",   20,  1500),
        ("heli",     "game-heli.png",      5,  2000),
        ("CartPole", "game-cartpole.png", 10,  2000),
    ]
    for name, fname, episodes, wait_ms in shots:
        await load_game(page, GAME_URLS[name])
        await click_tab(page, "p1-config")
        await set_slider(page, "delay-slider", 0)
        await wait_episodes(page, episodes, timeout_s=60)
        await set_slider(page, "delay-slider", 50)
        await wait(wait_ms)
        await shot(page, '#game-iframe', fname)


async def shots_dqn(page):
    """
    dqn.html 所需截圖
    - dqn-r2-panel.png   DQN 訓練後的 R² 同步率統計面板（CartPole，較能看出 DQN 價值）
    """
    print("\n📄 dqn.html")
    await load_game(page, GAME_URLS["CartPole"])
    await click_tab(page, "p1-config")
    await set_radio(page, "algorithm-dqn")
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 200, timeout_s=300)
    await wait(2000)
    await click_tab(page, "p1-qtable")
    await wait(1500)
    await shot(page, '#p1-ui1', "dqn-r2-panel.png")

    # 還原
    await click_tab(page, "p1-config")
    await set_radio(page, "algorithm-qtable")
    await set_slider(page, "delay-slider", 50)


# ── 主流程 ────────────────────────────────────────────────────────────────────

async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 輸出目錄：{OUT_DIR}\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=CHROME_ARGS,
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        print("▶ 開啟 Rein Room…")
        await page.goto(RR_URL)
        await wait(3000)

        # ── 執行各組截圖 ────────────────────────────────────────────────────
        # 注意：順序有依賴（後面的組假設 Maze2D 已訓練）
        await shots_intro_rr(page)        # 1. 整體介面
        await shots_quickstart(page)      # 2. 入門步驟（重新載入）
        await shots_intro_rl(page)        # 3. Maze2D Q-Table（接續訓練）
        await shots_qlearning(page)       # 4. Q-Table 熱力圖（接續）
        await shots_exploration(page)     # 5. ε 對比實驗（重新載入 3 次）
        await shots_read_charts(page)     # 6. 訓練圖表（重新訓練）
        await shots_qtable_viz(page)      # 7. 視覺化全套（接續，含 DQN）
        await shots_choose_game(page)     # 8. 五遊戲畫面
        await shots_dqn(page)             # 9. DQN CartPole R²

        print(f"\n{'─'*50}")
        print(f"✅ 所有截圖完成！共 {len(list(OUT_DIR.glob('*.png')))} 張")
        print(f"   位於：{OUT_DIR}")
        print("   瀏覽器保持開啟，方便確認品質。Ctrl+C 結束。")
        await asyncio.sleep(9999)

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
