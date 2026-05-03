import asyncio, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

BASE = "https://reinroom.leaflune.org/en/"
OUT  = "c:/Users/USER/ReinforceLab/en_screenshots"
os.makedirs(OUT, exist_ok=True)

async def shot(page, name):
    await page.wait_for_timeout(800)
    await page.screenshot(path=f"{OUT}/{name}.png", full_page=False)
    print(f"  ok {name}.png")

async def click_tab(page, subtab):
    await page.click(f'button[data-subtab="{subtab}"]')
    await page.wait_for_timeout(600)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        print("Loading /en/ ...")
        await page.goto(BASE, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)
        await shot(page, "01-tutorial-tab")

        print("Games tab...")
        await click_tab(page, "offical-games")
        await shot(page, "02-games-tab")

        print("About tab...")
        await click_tab(page, "privacy-policy")
        await shot(page, "03-about-tab")

        print("Agent config tab...")
        await click_tab(page, "p1-config")
        await page.wait_for_timeout(1000)
        await shot(page, "04-agent-config")

        print("Analysis tab...")
        await click_tab(page, "p1-qtable")
        await page.wait_for_timeout(1000)
        await shot(page, "05-analysis-tab")

        await browser.close()
        print(f"Done. Screenshots in {OUT}/")

asyncio.run(main())
