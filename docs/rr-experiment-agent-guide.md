# RR 平台 Agent 實驗指南

本文說明如何用 Playwright 自動操作 RR 平台並讀取訓練數據，供 AI Agent 自主做 RL 實驗使用。

---

## 核心機制：window.rrLog

RR 平台（`index.html` / `en/index.html`）在每回合結束時會更新 `window.rrLog`：

```js
window.rrLog = {
  game:     "/games/Maze2D_emoji_en.html",   // 目前載入的遊戲 URL
  params:   { alpha, gamma, epsilon, bins }, // 當前訓練參數
  episodes: [                                // 每回合一筆，依序累積
    { ep: 1, reward: -8,  steps: 47 },
    { ep: 2, reward: 12,  steps: 23 },
    ...
  ]
}
```

`window.rrLogSnapshot()` 回傳一份深拷貝（避免讀到寫入中的陣列）。

換遊戲（loadGame）時 `episodes` 會自動清空。

---

## Playwright 基本流程

```python
from playwright.async_api import async_playwright
import asyncio, json

RR_URL = "https://reinroom.leaflune.org"   # 或 /en/ 英文版

async def run_experiment(game_url, params, n_episodes=200):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page    = await browser.new_page()
        await page.goto(RR_URL)

        # 1. 設遊戲 URL 並載入
        await page.fill("#gameUrlInput", game_url)
        await page.click("#loadGame")
        await page.wait_for_timeout(1500)   # 等 iframe 初始化

        # 2. 調參數（alpha / gamma / epsilon / bins slider）
        await page.fill("#alpha-slider",   str(params["alpha"]))
        await page.fill("#gamma-slider",   str(params["gamma"]))
        await page.fill("#epsilon-slider", str(params["epsilon"]))
        # 觸發 oninput 讓值寫入 JS 變數
        await page.dispatch_event("#alpha-slider",   "input")
        await page.dispatch_event("#gamma-slider",   "input")
        await page.dispatch_event("#epsilon-slider", "input")

        # 3. 等 N 回合跑完
        await page.wait_for_function(
            f"window.rrLog.episodes.length >= {n_episodes}",
            timeout=120_000
        )

        # 4. 讀結果
        log = await page.evaluate("window.rrLogSnapshot()")
        await browser.close()
        return log

log = asyncio.run(run_experiment(
    game_url   = "/games/Maze2D_emoji_en.html",
    params     = { "alpha": 0.3, "gamma": 0.9, "epsilon": 0.2 },
    n_episodes = 200
))

# log["episodes"] 是 [{ep, reward, steps}, ...] 的 list
rewards = [e["reward"] for e in log["episodes"]]
print(f"最後 20 回合平均 reward：{sum(rewards[-20:]) / 20:.2f}")
```

---

## 分析面向建議

拿到 `log["episodes"]` 後可以分析：

| 問題 | 分析方法 |
|------|----------|
| Agent 有沒有學起來？ | 前 20 回合 vs 後 20 回合平均 reward |
| 何時開始收斂？ | 找 reward 首次超過某閾值的 ep |
| 探索效率？ | 前期 steps 是否隨回合數下降 |
| 參數對比 | 跑兩組不同 alpha/gamma，比較收斂速度 |

---

## 官方遊戲清單

| 遊戲 | URL（英文版） | 備註 |
|------|--------------|------|
| MAB（多臂拉霸） | `/games/MAB_en.html` | 離散，最簡單 |
| Maze1D（一維迷宮） | `/games/Maze1D_en.html` | 稀疏 reward 入門 |
| Maze2D（二維迷宮） | `/games/Maze2D_emoji_en.html` | 6 個關卡，level 選項見下 |
| Heli（直升機） | `/games/heli_en.html` | 即時制，連續 reward |
| Fighter（戰鬥機） | `/games/fighter_en.html` | 連續狀態，難收斂 |

### Maze2D 切換關卡

關卡在 iframe 內的 radio button 控制，需透過 `evaluate` 在 iframe 裡觸發：

```python
# level 0~5：Open Field / Walled In / Coins Added /
#             Detour Rewards / Watch the Fire / False Shortcut
await page.frame_locator("#gameIframe").locator(
    f"input[name='level'][value='{level}']"
).click()
```

---

## 注意事項

- `bins` 參數讀回來是 array（每個 state 維度各自的桶數），例如 `[10, 10]`
- `rrLog.params` 在每回合結束時更新，記的是「最後一回合用的參數」
- 若中途改了 slider 但沒重新 `loadGame`，舊 episodes 和新 episodes 可能用不同參數——若要做受控實驗，每次實驗都重新 loadGame
- `wait_for_function` 的 timeout 預設 30 秒，複雜遊戲（Heli、Fighter）建議加到 120 秒以上
