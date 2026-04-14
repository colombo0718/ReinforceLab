"""
screenshot_thesis.py — RR 平台論文截圖自動化腳本

用途：批量截取論文第三章所需的 RR 平台畫面
輸出：C:\\Users\\USER\\論文 - RL平台教學成效\\截圖\\

執行：
    python screenshot_thesis.py

需求：
    pip install playwright
    playwright install chromium
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

# ── 設定 ─────────────────────────────────────────────────────────────────────
RR_URL  = "https://reinroom.leaflune.org"
OUT_DIR = Path(r"C:\Users\USER\論文 - RL平台教學成效\截圖")

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
    """切換右側 Tab（指南/遊戲/儀錶/分析）"""
    await page.click(f'button[data-subtab="{subtab}"]')
    await wait(600)


async def set_slider(page, slider_id: str, value: float):
    """用 JS 直接設定滑桿值（避免拖曳誤差）"""
    await page.evaluate(f"""
        const el = document.getElementById('{slider_id}');
        if (el) {{ el.value = {value}; el.dispatchEvent(new Event('input')); }}
    """)
    await wait(300)


async def load_game(page, url: str):
    """將遊戲網址填入輸入框並按載入"""
    await page.fill('#gameUrlInput', url)
    await page.click('#loadGame')
    await wait(2000)


async def wait_episodes(page, target: int, timeout_s: int = 120) -> int:
    """等待智能體訓練至指定回合數，回傳實際達到的回合數"""
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


def save_path(filename: str) -> str:
    """產生輸出路徑字串（確保目錄存在）"""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    return str(OUT_DIR / filename)


# ── 精準截圖工具 ───────────────────────────────────────────────────────────────

async def shot_element(page, selector: str, filename: str, padding: int = 8):
    """
    截取單一元素（自動 clip 至元素邊界 + padding）
    使用 getBoundingClientRect 確保精準，不截到其他元素
    """
    bbox = await page.evaluate(f"""
        () => {{
            const el = document.querySelector('{selector}');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {{x: r.left, y: r.top, width: r.width, height: r.height}};
        }}
    """)
    if not bbox or bbox['width'] == 0:
        print(f"  ⚠ 找不到或不可見：{selector}")
        return
    clip = {
        'x':      max(0, bbox['x'] - padding),
        'y':      max(0, bbox['y'] - padding),
        'width':  bbox['width']  + padding * 2,
        'height': bbox['height'] + padding * 2,
    }
    await page.screenshot(path=save_path(filename), clip=clip)
    print(f"  ✅ {filename}  ({int(clip['width'])}×{int(clip['height'])}px)")


async def shot_elements(page, selectors: list[str], filename: str, padding: int = 16):
    """
    截取多個元素的聯合包圍框（適合將多個相鄰元素合拍成一張圖）
    例如：同時截取 4 張訓練圖表
    """
    bbox = await page.evaluate("""
        (sels) => {
            const rects = sels.map(sel => {
                const el = document.querySelector(sel);
                if (!el) return null;
                return el.getBoundingClientRect();
            }).filter(Boolean);
            if (!rects.length) return null;
            const x1 = Math.min(...rects.map(r => r.left));
            const y1 = Math.min(...rects.map(r => r.top));
            const x2 = Math.max(...rects.map(r => r.right));
            const y2 = Math.max(...rects.map(r => r.bottom));
            return {x: x1, y: y1, width: x2 - x1, height: y2 - y1};
        }
    """, selectors)
    if not bbox or bbox['width'] == 0:
        print(f"  ⚠ 找不到元素：{selectors}")
        return
    clip = {
        'x':      max(0, bbox['x'] - padding),
        'y':      max(0, bbox['y'] - padding),
        'width':  bbox['width']  + padding * 2,
        'height': bbox['height'] + padding * 2,
    }
    await page.screenshot(path=save_path(filename), clip=clip)
    print(f"  ✅ {filename}  ({int(clip['width'])}×{int(clip['height'])}px)")


async def shot_iframe_content(page, filename: str, padding: int = 8):
    """截取左側 game-iframe 的可視區域"""
    await shot_element(page, '#game-iframe', filename, padding)


# ── 各圖截圖函式 ──────────────────────────────────────────────────────────────

async def fig_3_1(page):
    """
    圖 3-1｜RR 平台整體介面
    前置：載入 Maze2D，訓練 80 回合後截整個 viewport
    """
    print("\n▶ 圖 3-1：整體介面（Maze2D 訓練後）")
    await load_game(page, GAME_URLS["Maze2D"])
    await click_tab(page, "p1-config")
    await set_slider(page, "delay-slider", 0)              # 快速訓練
    await set_slider(page, "exploration-rate-slider", 0.3)
    await wait_episodes(page, 80)
    await set_slider(page, "delay-slider", 20)             # 截圖前稍微放慢，畫面比較好看
    await wait(1000)
    await page.screenshot(path=save_path("圖3-1_整體介面.png"))
    print(f"  ✅ 圖3-1_整體介面.png")


async def fig_3_6(page):
    """
    圖 3-6｜儀錶 Tab 超參數滑桿區
    前置：切換到儀錶 Tab，截演算法選擇 + 超參數滑桿兩個區塊
    """
    print("\n▶ 圖 3-6：超參數滑桿介面")
    await click_tab(page, "p1-config")
    await wait(500)
    # 聯合截取「演算法選擇」與「超參數設置」兩個 div
    await shot_elements(page, [
        '#p1-config .grid-container > div:nth-child(1)',
        '#p1-config .grid-container > div:nth-child(2)',
    ], "圖3-6_超參數滑桿.png", padding=16)


async def fig_3_7(page):
    """
    圖 3-7｜即時訓練圖表（四張：每秒/每回合 Reward & Steps）
    前置：Maze2D 已訓練 80 回合（接在 fig_3_1 之後執行最省時）
    """
    print("\n▶ 圖 3-7：即時訓練圖表（四張合拍）")
    await click_tab(page, "p1-config")
    await wait(500)
    await shot_elements(page, [
        '#p1-second-reward',
        '#p1-second-steps',
        '#p1-episode-reward',
        '#p1-episode-steps',
    ], "圖3-7_訓練圖表.png", padding=12)


async def fig_3_8(page):
    """
    圖 3-8｜分析 Tab 動作選擇熱力圖（含白色確信度遮罩）
    前置：Maze2D 充分訓練後切至分析 Tab
    """
    print("\n▶ 圖 3-8：動作選擇熱力圖")
    await click_tab(page, "p1-qtable")
    await wait(1500)   # 等熱力圖重繪
    await shot_element(page, '#p1-diff-value', "圖3-8_動作選擇熱力圖.png")


async def fig_3_9(page):
    """
    圖 3-9｜最大 Q 值熱力圖 + 動作價值柱狀圖（合拍）
    前置：同 fig_3_8，在分析 Tab
    """
    print("\n▶ 圖 3-9：最大Q值熱力圖 + 動作價值柱狀圖")
    # 確保在分析 Tab
    await click_tab(page, "p1-qtable")
    await wait(1000)
    await shot_elements(page, [
        '#p1-maxi-value',
        '#p1-bars-value',
    ], "圖3-9_Q值熱力圖與柱狀圖.png", padding=12)


async def fig_3_10(page):
    """
    圖 3-10｜知識同步率（DQN 模式）
    前置：切換至 DQN 演算法，訓練 100 回合
    注意：目前 R² 以文字百分比呈現於分析頁的「知識同步」欄位（#stat-sync）
          截圖範圍為分析頁統計區塊 (#p1-ui1) + 四張訓練圖表
    """
    print("\n▶ 圖 3-10：DQN 知識同步率")
    # 切換至 DQN 模式
    await click_tab(page, "p1-config")
    await page.click('#algorithm-dqn')
    await wait(500)
    await set_slider(page, "delay-slider", 0)
    await wait_episodes(page, 100)
    await wait(1500)   # 等最後一次 fit 完成

    # 截分析頁的統計面板（含「知識同步 XX%」）
    await click_tab(page, "p1-qtable")
    await wait(1000)
    await shot_element(page, '#p1-ui1', "圖3-10_DQN知識同步率.png")

    # 還原回 Q-Table 模式
    await click_tab(page, "p1-config")
    await page.click('#algorithm-qtable')
    await wait(300)


async def fig_3_11_games(page):
    """
    圖 3-11a～e｜五個官方遊戲環境截圖
    分別載入各遊戲，截取 game-iframe 區域
    """
    shots = [
        ("MAB",      "圖3-11a_MAB.png",      None,  3000),
        ("Maze1D",   "圖3-11b_Maze1D.png",    None,  2000),
        ("Maze2D",   "圖3-11c_Maze2D.png",    None,  2000),
        ("heli",     "圖3-11d_heli.png",      None,  3000),
        ("CartPole", "圖3-11e_CartPole.png",  None,  2000),
    ]

    for name, filename, level_fn, wait_ms in shots:
        print(f"\n▶ 圖 {filename.split('_')[0].replace('圖', '圖 ')}｜{name} 環境")
        await load_game(page, GAME_URLS[name])

        # Maze2D：切換到較有內容的關卡 2
        if name == "Maze2D":
            iframe = page.frame_locator('#game-iframe')
            await iframe.locator('input[name="level"][value="2"]').click()
            await wait(500)

        # heli：稍微訓練讓直升機在飛行中
        if name == "heli":
            await set_slider(page, "delay-slider", 0)
            await wait_episodes(page, 5)
            await set_slider(page, "delay-slider", 50)

        await wait(wait_ms)
        await shot_iframe_content(page, filename)


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

        # ── 第一階段：Maze2D 訓練相關截圖（一次訓練，截多張）──────────────
        await load_game(page, GAME_URLS["Maze2D"])
        await click_tab(page, "p1-config")
        await set_slider(page, "delay-slider", 0)
        await set_slider(page, "exploration-rate-slider", 0.3)

        # 等充分訓練
        await wait_episodes(page, 80)
        await set_slider(page, "delay-slider", 20)
        await wait(1500)

        # 整體介面（訓練後）
        print("\n▶ 圖 3-1：整體介面")
        await page.screenshot(path=save_path("圖3-1_整體介面.png"))
        print(f"  ✅ 圖3-1_整體介面.png")

        # 儀錶滑桿區
        print("\n▶ 圖 3-6：超參數滑桿")
        await click_tab(page, "p1-config")
        await wait(400)
        await shot_elements(page, [
            '#p1-config .grid-container > div:nth-child(1)',
            '#p1-config .grid-container > div:nth-child(2)',
        ], "圖3-6_超參數滑桿.png", padding=16)

        # 四張訓練圖表
        print("\n▶ 圖 3-7：即時訓練圖表")
        await shot_elements(page, [
            '#p1-second-reward', '#p1-second-steps',
            '#p1-episode-reward', '#p1-episode-steps',
        ], "圖3-7_訓練圖表.png", padding=12)

        # 分析頁熱力圖
        print("\n▶ 圖 3-8：動作選擇熱力圖")
        await click_tab(page, "p1-qtable")
        await wait(1500)
        await shot_element(page, '#p1-diff-value', "圖3-8_動作選擇熱力圖.png")

        # 圖 3-5：動作價值與選擇機率三柱圖（用於 3.2.3 探索策略說明）
        # 設定 ε=0.15、τ=2.0，讓兩種策略的機率分佈有明顯差距，對比效果清楚
        print("\n▶ 圖 3-5：探索策略機率分佈（ε-greedy vs Softmax 三柱圖）")
        await click_tab(page, "p1-config")
        await set_slider(page, "exploration-rate-slider", 0.15)
        await set_slider(page, "tau-slider", 2.0)
        await click_tab(page, "p1-qtable")
        await wait(1000)
        await shot_element(page, '#p1-bars-value', "圖3-5_探索策略機率分佈比較.png")
        # 截完後還原 ε
        await click_tab(page, "p1-config")
        await set_slider(page, "exploration-rate-slider", 0.3)

        # 最大Q值熱力圖 + 三柱圖（圖 3-9）
        print("\n▶ 圖 3-9：最大Q值熱力圖 + 動作價值及選擇機率三柱圖")
        await click_tab(page, "p1-qtable")
        await wait(800)
        await shot_elements(page, [
            '#p1-maxi-value', '#p1-bars-value',
        ], "圖3-9_Q值熱力圖與柱狀圖.png", padding=12)

        # ── 第二階段：DQN 模式截圖 ────────────────────────────────────────
        print("\n▶ 圖 3-10：DQN 知識同步率")
        await click_tab(page, "p1-config")
        await page.click('#algorithm-dqn')
        await wait(500)
        await set_slider(page, "delay-slider", 0)
        await wait_episodes(page, 100)
        await wait(2000)  # 等最後一次 fit 完成

        await click_tab(page, "p1-qtable")
        await wait(1000)
        await shot_element(page, '#p1-ui1', "圖3-10_DQN知識同步率.png")

        # 還原
        await click_tab(page, "p1-config")
        await page.click('#algorithm-qtable')
        await set_slider(page, "delay-slider", 50)
        await wait(300)

        # ── 第三階段：各遊戲環境截圖 ─────────────────────────────────────
        games_to_shot = [
            ("MAB",      "圖3-11a_MAB.png",      3000),
            ("Maze1D",   "圖3-11b_Maze1D.png",   2000),
            ("Maze2D",   "圖3-11c_Maze2D.png",   2000),
            ("heli",     "圖3-11d_heli.png",      3000),
            ("CartPole", "圖3-11e_CartPole.png",  2500),
        ]

        for name, filename, wait_ms in games_to_shot:
            print(f"\n▶ {filename}｜{name} 環境")
            await load_game(page, GAME_URLS[name])

            if name == "Maze2D":
                # 切換到關卡 2（有障礙物，畫面較豐富）
                iframe = page.frame_locator('#game-iframe')
                await iframe.locator('input[name="level"][value="2"]').click()
                await wait(500)

            if name == "heli":
                # 稍微訓練幾回合讓直升機在飛行中
                await set_slider(page, "delay-slider", 0)
                await wait_episodes(page, 5, timeout_s=30)
                await set_slider(page, "delay-slider", 50)

            await wait(wait_ms)
            await shot_iframe_content(page, filename)

        # ── 完成 ──────────────────────────────────────────────────────────
        print(f"\n{'─'*50}")
        print(f"✅ 所有截圖完成！檔案位於：{OUT_DIR}")
        print("   瀏覽器保持開啟，方便檢查截圖品質。按 Ctrl+C 結束。")
        await asyncio.sleep(9999)

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
