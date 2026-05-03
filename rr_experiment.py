"""
RR Platform Experiment Runner
用 Playwright 自動對 RR 平台做系統性實驗，讀 window.rrLog 收數據。
"""
import asyncio, json, sys, statistics
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding='utf-8')

RR_URL = "https://reinroom.leaflune.org/en/"

SLIDER_IDS = {
    "alpha":   "learning-rate-slider",
    "gamma":   "discount-factor-slider",
    "epsilon": "exploration-rate-slider",
}

async def set_param(page, key, value):
    sid = SLIDER_IDS[key]
    await page.evaluate(f"""
        (function() {{
            const el = document.getElementById('{sid}');
            const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            nativeInput.set.call(el, {value});
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
        }})()
    """)

async def load_game(page, game_url):
    await page.evaluate(f"""
        (function() {{
            document.getElementById('gameUrlInput').value = '{game_url}';
            document.getElementById('loadGame').click();
        }})()
    """)
    await page.wait_for_timeout(2000)

async def set_maze2d_level(page, level):
    await page.evaluate(f"""
        (function() {{
            const iframe = document.getElementById('game-iframe');
            if (!iframe || !iframe.contentWindow) return;
            const radios = iframe.contentDocument.querySelectorAll('input[name="level"]');
            if (radios[{level}]) {{
                radios[{level}].click();
            }}
        }})()
    """)
    await page.wait_for_timeout(500)

async def wait_episodes(page, n, timeout_ms=180_000):
    await page.wait_for_function(
        f"window.rrLog && window.rrLog.episodes.length >= {n}",
        timeout=timeout_ms
    )

async def read_log(page):
    return await page.evaluate("window.rrLogSnapshot()")

def analyze(episodes, label=""):
    rewards = [e["reward"] for e in episodes]
    steps   = [e["steps"]  for e in episodes]
    n = len(rewards)
    if n == 0:
        return {}
    early  = rewards[:20]
    late   = rewards[-20:]
    result = {
        "label":        label,
        "n_episodes":   n,
        "early_avg_r":  round(sum(early) / len(early), 2),
        "late_avg_r":   round(sum(late)  / len(late),  2),
        "improvement":  round(sum(late)/len(late) - sum(early)/len(early), 2),
        "max_reward":   max(rewards),
        "late_avg_steps": round(sum(steps[-20:]) / 20, 1),
    }
    # 找首次連續 5 回合 reward > 0 的起點（收斂點估計）
    streak, conv = 0, None
    for i, r in enumerate(rewards):
        streak = streak + 1 if r > 0 else 0
        if streak >= 5 and conv is None:
            conv = i - 4
    result["converge_ep"] = conv
    return result

async def set_delay(page, ms):
    await page.evaluate(f"""
        (function() {{
            const el = document.getElementById('delay-slider');
            const nv = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
            nv.set.call(el, {ms});
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
        }})()
    """)

async def run_condition(page, label, game_url, params, n_ep=150, maze_level=None):
    print(f"\n▶ {label}")
    await load_game(page, game_url)
    await set_delay(page, 0)   # 全速跑
    for k, v in params.items():
        await set_param(page, k, v)
    if maze_level is not None:
        await set_maze2d_level(page, maze_level)
    await wait_episodes(page, n_ep)
    log = await read_log(page)
    result = analyze(log["episodes"], label)
    result["params"] = log["params"]
    print(f"   收斂回合: {result['converge_ep']}  |  前20均: {result['early_avg_r']}  |  後20均: {result['late_avg_r']}  |  進步: {result['improvement']}")
    return result

async def main():
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page    = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto(RR_URL)
        await page.wait_for_timeout(2000)

        # === 實驗一：Maze2D Open Field，不同 alpha ===
        for alpha in [0.1, 0.3, 0.5, 0.8]:
            r = await run_condition(
                page, f"Maze2D-L0 α={alpha}",
                "/games/Maze2D_emoji_en.html",
                {"alpha": alpha, "gamma": 0.9, "epsilon": 0.2},
                n_ep=150, maze_level=0
            )
            results.append(r)

        # === 實驗二：Maze2D Open Field，不同 gamma ===
        for gamma in [0.5, 0.7, 0.9, 0.95]:
            r = await run_condition(
                page, f"Maze2D-L0 γ={gamma}",
                "/games/Maze2D_emoji_en.html",
                {"alpha": 0.3, "gamma": gamma, "epsilon": 0.2},
                n_ep=150, maze_level=0
            )
            results.append(r)

        # === 實驗三：Maze2D 跨關卡，固定標準參數 ===
        level_names = {0: "Open Field", 1: "Walled In", 2: "Coins Added",
                       3: "Detour Rewards", 4: "Watch Fire", 5: "False Shortcut"}
        for lv in range(6):
            r = await run_condition(
                page, f"Maze2D-L{lv} {level_names[lv]}",
                "/games/Maze2D_emoji_en.html",
                {"alpha": 0.3, "gamma": 0.9, "epsilon": 0.2},
                n_ep=200, maze_level=lv
            )
            results.append(r)

        # === 實驗四：Maze1D，不同 epsilon ===
        for eps in [0.05, 0.2, 0.5, 0.8]:
            r = await run_condition(
                page, f"Maze1D ε={eps}",
                "/games/Maze1D_en.html",
                {"alpha": 0.5, "gamma": 0.9, "epsilon": eps},
                n_ep=150
            )
            results.append(r)

        await browser.close()

    # 存結果
    with open("rr_experiment_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\n\n======= 實驗結果總覽 =======")
    for r in results:
        conv = r.get("converge_ep", "未收斂")
        print(f"{r['label']:35s}  收斂:{str(conv):>6}  後20均:{r['late_avg_r']:>7}  進步:{r['improvement']:>6}")

    print("\n結果已存至 rr_experiment_results.json")

asyncio.run(main())
