"""
autoWeb_playwright.py — Rein Room Playwright 自動控制腳本

功能：
  - 以禁用節能 flag 啟動 Chrome，避免分頁背景時 timer throttling
  - 依序走過 RR 的主要 UI：切換分頁、調整超參數、換遊戲、切換遊戲內關卡

需求：
  pip install playwright
  playwright install chromium
"""

import asyncio
from playwright.async_api import async_playwright

RR_URL = "https://reinroom.leaflune.org"

# 禁用 Chrome 節能機制的啟動參數
CHROME_ARGS = [
    "--start-maximized",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
]

async def wait(ms=800):
    await asyncio.sleep(ms / 1000)

async def click_tab(page, subtab: str):
    """點擊右側 sub-tab（指南、遊戲、儀錶、分析等）"""
    await page.click(f'button[data-subtab="{subtab}"]')
    await wait()

async def set_slider(page, slider_id: str, value: float):
    """將 range slider 設定為指定值（透過 JS 直接設，避免拖曳誤差）"""
    await page.evaluate(f"""
        const el = document.getElementById('{slider_id}');
        el.value = {value};
        el.dispatchEvent(new Event('input'));
    """)
    await wait(400)

async def click_quick_load(page, data_url: str):
    """點擊遊戲清單裡的快速載入按鈕"""
    await page.click(f'button.quick-load-button[data-url="{data_url}"]')
    await wait(1500)

async def set_radio(page, radio_id: str):
    """點選指定 radio button"""
    await page.click(f'#{radio_id}')
    await wait(400)

async def demo_maze1d_levels(page):
    """在 Maze1D 遊戲內切換關卡設定（起始位置 slider、小回饋模式）"""
    iframe = page.frame_locator('#game-iframe')

    # 切換起始位置
    for pos in [2, 6, 4]:
        await iframe.locator('#startPos').evaluate(f"""
            el => {{
                el.value = {pos};
                el.dispatchEvent(new Event('input'));
            }}
        """)
        await wait(600)

    # 切換小回饋模式
    for mode in ['positive', 'negative']:
        await iframe.locator(f'input[name="feedback"][value="{mode}"]').click()
        await wait(600)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=CHROME_ARGS,
        )
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        print("▶ 開啟 Rein Room...")
        await page.goto(RR_URL)
        await wait(2000)

        # ── 1. 走過右側分頁 ──────────────────────────────────────
        print("▶ 切換分頁：指南 → 遊戲 → 儀錶 → 分析")
        for tab in ["tutorial", "offical-games", "p1-config", "p1-qtable"]:
            await click_tab(page, tab)

        # ── 2. 儀錶：調整超參數 ──────────────────────────────────
        print("▶ 切換到儀錶，調整超參數")
        await click_tab(page, "p1-config")

        await set_slider(page, "learning-rate-slider",    0.3)
        await set_slider(page, "discount-factor-slider",  0.8)
        await set_slider(page, "exploration-rate-slider", 0.4)
        await set_slider(page, "optimism-slider",         0.2)
        await set_slider(page, "delay-slider",            20)

        # 切換演算法
        print("▶ 切換演算法：DQN → 回 Q-Table")
        await set_radio(page, "algorithm-dqn")
        await set_radio(page, "algorithm-qtable")

        # 切換探索策略
        print("▶ 切換策略：Softmax → 回 ε-greedy")
        await set_radio(page, "strategy-softmax")
        await set_radio(page, "strategy-egreedy")

        # ── 3. 換遊戲 ───────────────────────────────────────────
        print("▶ 切到遊戲分頁，依序載入各遊戲")
        await click_tab(page, "offical-games")

        games = [
            ("MAB",     "https://reinroom.leaflune.org/games/MAB.html"),
            ("Maze2D",  "https://reinroom.leaflune.org/games/Maze2D_emoji.html"),
            ("Heli",    "https://reinroom.leaflune.org/games/heli.html"),
            ("CartPole","https://reinroom.leaflune.org/games/CartPole.html"),
            ("Maze1D",  "https://reinroom.leaflune.org/games/Maze1D.html"),
        ]
        for name, url in games:
            print(f"  → 載入 {name}")
            await click_quick_load(page, url)

        # ── 4. Maze1D 關卡切換 ───────────────────────────────────
        print("▶ Maze1D：切換起始位置與小回饋模式")
        await demo_maze1d_levels(page)

        # ── 5. 分析頁：切換繪製資料來源 ─────────────────────────
        print("▶ 切到分析頁，切換繪製資料來源")
        await click_tab(page, "p1-qtable")
        await set_radio(page, "chart-src-dqn")
        await wait(1000)
        await set_radio(page, "chart-src-qtable")

        print("✅ Demo 結束，瀏覽器保持開啟，按 Ctrl+C 結束")
        await asyncio.sleep(9999)

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
