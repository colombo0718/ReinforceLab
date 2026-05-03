import asyncio, sys
from playwright.async_api import async_playwright
sys.stdout.reconfigure(encoding='utf-8')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # 有頭，方便看
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto("https://reinroom.leaflune.org/en/")
        await page.wait_for_timeout(3000)

        # 確認 rrLog 存在
        has_log = await page.evaluate("typeof window.rrLog")
        print(f"rrLog type: {has_log}")

        # 載入遊戲
        await page.evaluate("""
            document.getElementById('gameUrlInput').value = '/games/Maze1D_en.html';
            document.getElementById('loadGame').click();
        """)
        await page.wait_for_timeout(3000)

        # 看有幾回合
        ep_count = await page.evaluate("window.rrLog.episodes.length")
        print(f"episodes after 3s: {ep_count}")

        # delay slider 目前值
        delay_val = await page.evaluate("document.getElementById('delay-slider').value")
        print(f"delay slider: {delay_val}ms")

        # 把 delay 設到 0
        await page.evaluate("""
            const el = document.getElementById('delay-slider');
            const nv = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            nv.set.call(el, 0);
            el.dispatchEvent(new Event('input', {bubbles: true}));
        """)
        print("delay set to 0, waiting 5s...")
        await page.wait_for_timeout(5000)

        ep_count2 = await page.evaluate("window.rrLog.episodes.length")
        print(f"episodes after 5s at delay=0: {ep_count2}")

        if ep_count2 > 0:
            sample = await page.evaluate("window.rrLog.episodes.slice(0,3)")
            print(f"sample episodes: {sample}")

        await browser.close()

asyncio.run(main())
