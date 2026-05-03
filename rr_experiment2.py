"""
RR 第二輪實驗：針對教學示範價值最高的對比條件
"""
import asyncio, json, sys, statistics
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')

RR_URL = "https://reinroom.leaflune.org/en/"

async def set_slider(page, slider_id, value):
    await page.evaluate(f"""
        (function() {{
            const el = document.getElementById('{slider_id}');
            const nv = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            nv.set.call(el, {value});
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
        }})()
    """)

async def load_and_setup(page, game_url, alpha, gamma, epsilon, maze_level=None):
    await page.evaluate(f"""
        document.getElementById('gameUrlInput').value = '{game_url}';
        document.getElementById('loadGame').click();
    """)
    await page.wait_for_timeout(2000)
    await set_slider(page, "delay-slider",            0)
    await set_slider(page, "learning-rate-slider",    alpha)
    await set_slider(page, "discount-factor-slider",  gamma)
    await set_slider(page, "exploration-rate-slider", epsilon)
    if maze_level is not None:
        await page.evaluate(f"""
            (function() {{
                const iframe = document.getElementById('game-iframe');
                const radios = iframe.contentDocument.querySelectorAll('input[name="level"]');
                if (radios[{maze_level}]) radios[{maze_level}].click();
            }})()
        """)
        await page.wait_for_timeout(500)

async def run(page, label, game_url, alpha, gamma, epsilon, n_ep, maze_level=None):
    print(f"\n▶ {label}")
    await load_and_setup(page, game_url, alpha, gamma, epsilon, maze_level)
    await page.wait_for_function(
        f"window.rrLog && window.rrLog.episodes.length >= {n_ep}",
        timeout=300_000
    )
    log = await page.evaluate("window.rrLogSnapshot()")
    eps = log["episodes"]
    rewards = [e["reward"] for e in eps]
    steps   = [e["steps"]  for e in eps]
    early_r = sum(rewards[:20]) / 20
    late_r  = sum(rewards[-20:]) / 20
    late_s  = sum(steps[-20:]) / 20
    # 收斂點：連續 5 回合 reward > threshold
    threshold = max(rewards) * 0.8
    streak, conv = 0, None
    for i, r in enumerate(rewards):
        streak = streak + 1 if r >= threshold else 0
        if streak >= 5 and conv is None:
            conv = i - 4
    result = {
        "label": label, "n": len(eps),
        "early_r": round(early_r, 1), "late_r": round(late_r, 1),
        "delta": round(late_r - early_r, 1),
        "late_steps": round(late_s, 1),
        "max_r": max(rewards), "min_r": min(rewards),
        "converge_ep": conv,
        "params": log["params"]
    }
    print(f"   前20均:{early_r:7.1f}  後20均:{late_r:7.1f}  Δ:{late_r-early_r:+6.1f}  "
          f"後20步:{late_s:5.1f}  收斂:{str(conv):>6}")
    return result

async def main():
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(RR_URL)
        await page.wait_for_timeout(2000)

        print("=== 實驗 A：L3 Detour Rewards × Gamma（核心教學示範） ===")
        for gamma in [0.3, 0.5, 0.7, 0.9, 0.95]:
            r = await run(page, f"L3-Detour γ={gamma}",
                          "/games/Maze2D_emoji_en.html",
                          alpha=0.3, gamma=gamma, epsilon=0.2,
                          n_ep=200, maze_level=3)
            results.append(r)

        print("\n=== 實驗 B：L4 Watch Fire × Epsilon（探索率教學示範） ===")
        for eps in [0.05, 0.15, 0.3, 0.5]:
            r = await run(page, f"L4-Fire ε={eps}",
                          "/games/Maze2D_emoji_en.html",
                          alpha=0.3, gamma=0.9, epsilon=eps,
                          n_ep=200, maze_level=4)
            results.append(r)

        print("\n=== 實驗 C：L3 × Alpha（學習率效果） ===")
        for alpha in [0.05, 0.2, 0.5, 0.9]:
            r = await run(page, f"L3-Detour α={alpha}",
                          "/games/Maze2D_emoji_en.html",
                          alpha=alpha, gamma=0.9, epsilon=0.2,
                          n_ep=200, maze_level=3)
            results.append(r)

        print("\n=== 實驗 D：Maze1D × Epsilon（稀疏 reward 下的探索） ===")
        for eps in [0.05, 0.2, 0.5, 0.9]:
            r = await run(page, f"Maze1D ε={eps}",
                          "/games/Maze1D_en.html",
                          alpha=0.5, gamma=0.9, epsilon=eps,
                          n_ep=150)
            results.append(r)

        await browser.close()

    with open("rr_experiment2_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n\n======= 總覽 =======")
    for r in results:
        print(f"{r['label']:30s}  前20:{r['early_r']:7.1f}  後20:{r['late_r']:7.1f}  "
              f"Δ:{r['delta']:+6.1f}  後20步:{r['late_steps']:5.1f}  收斂:{str(r['converge_ep']):>6}")
    print("\n結果已存至 rr_experiment2_results.json")

asyncio.run(main())
