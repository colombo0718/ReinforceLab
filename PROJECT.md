# PROJECT.md — Rein Room 專案快速指引

## 這個專案是什麼

**Rein Room (RR)** 是一個純前端的強化學習教育平台，讓使用者在瀏覽器中訓練 AI Agent 玩各種遊戲。
開發者（colombo0718）是碩士生，論文研究主題就是 RR 平台在 RL 教學的成效。

## 線上網址

- 正式部署：`https://reinroom.leaflune.org`（Cloudflare Pages，push master 自動更新）
- 舊網址：`https://reinforcelab.vercel.app`（Vercel，已棄用）
- GitHub：`https://github.com/colombo0718/ReinforceLab`

---

## 架構概覽

```
index.html          主平台，包含所有 Q-Learning 邏輯、UI、圖表控制
reinforceEngine.js  Q-Table 核心（getBucketIndex、updateQ、策略函數）
dqnWebWorker.js     Q-Table 蒸餾式 DQN（TensorFlow.js，Web Worker）
generalCharts.js    每秒/每回合 Reward & Steps 折線/柱狀圖
qualityCharts.js    Q-Table 熱力圖、動作分布、Q 值分析
style.css           全站樣式
docs/               教學文章、遊戲清單、關於頁（動態 fetch 載入進 index.html）
docs/articles/      12 篇指南文章（共用 article.css，圖片在 img/）
games/              各遊戲 HTML 環境
```

---

## 通訊協定（重要）

平台透過 `postMessage` 與 iframe 遊戲雙向通訊。

### RR → 遊戲
| type | 說明 |
|------|------|
| `questInfo` | `{ type, sessionId }` 請求環境宣告 |
| `action` | `{ type, action }` 傳送動作索引 |
| `pause` | toggle 暫停 |
| `accel` | toggle 加速 |

### 遊戲 → RR
| type | 說明 |
|------|------|
| `gameInfo` | `{ type, players: [{ stateInfo, actionInfo }] }` |
| `reward_state` | `{ type, reward, state, done, sessionId }` |

**關鍵設計：**
- `done: true/false` 在 `reward_state` 裡，**不再用獨立的 `endEpisode`**
- `done: true` 時 `reward` 必須已包含終局懲罰
- `sessionId` 從 `questInfo` 取得，每次 `loadGame()` 遞增，遊戲需原封不動帶回
- 舊的 `endEpisode` 在 index.html 還保留（向後相容），但新遊戲不應依賴它

完整規格：`RR平台可控遊戲環境宣告與通訊協定.md`

---

## 官方遊戲現況

| 檔案 | 協定版本 | 備註 |
|------|----------|------|
| MAB.html | 新（done 欄位） | 多臂拉霸 |
| Maze1D.html | 新 | 一維迷宮 |
| Maze2D_emoji.html | 新 | 二維迷宮，emoji 渲染 |
| heli.html | 新 | 直升機，p5.js，即時制 |
| CartPole.html | 新 | Matter.js 物理，4D state |

CartPole 額外特性：
- State 直接送原始物理值，無任何前處理（歸一化交由平台處理）
- stateInfo 宣告真實物理範圍：cartX [0,600]、cartVelX [-10,10]、poleAngle [-1.57,1.57]、poleAngularVel [-6,6]

---

## Q-Learning 實作位置

`index.html` 內依區塊有 JSDoc 式分段標記，關鍵位置：

- **訊息接收**（`window.addEventListener("message")`）：`reward_state` 處理區塊
- **loadGame()**：每次呼叫 `currentSessionId += 1`，接著設定 iframe src
- **getBucketIndex()**：在 `reinforceEngine.js`，等距離散化

DQN 為 Q-Table 蒸餾式架構，已完整實作。設計細節見 `Q表蒸餾式DQN：設計心法.md`。

---

## 開發規範

- 這個平台短期（1.0 版）以截圖和論文用途為主，**避免大幅改動**
- 遊戲自己負責 state 表示（前處理在遊戲端，不在平台端）
- 提交訊息用中文或英文都可以，但要清楚說明改了什麼

---

## 開發習慣與規範

### 遊戲頁面佈局規範
- 不加 header 標題，遊戲畫面直接顯示
- 遊戲畫面：`max-width` + `margin: auto`，盡量 RWD（canvas 大小目前固定，待後續處理）
- 說明區：`<p>` 任務說明（2~3 句，口吻是「模擬任務」，不寫技術細節）
- RL 資訊用 `<details>` 收攏，順序：🎯 獎勵機制 → 🧭 狀態描述 → 🕹️ 動作功能 → ⚙️ 參數建議
- 參數建議分「新手」／「進階」兩欄（`.param-grid` / `.param-col`）
- 共用樣式：`games/game-info.css`

### 截圖腳本（Playwright）
- 用 `locator.screenshot()` 而非手動計算 clip（避免越界錯誤）
- `shot_multi()` 需加 viewport 邊界保護
- 訓練等待用輪詢（`wait_episodes()`），不要 `sleep` 固定秒數
- Windows 最大化：`--start-maximized` + `no_viewport=True`
- 截圖命名：`[縮寫]-[描述].png`（例：`qs-maze2d-early.png`）

### 文章 / 文件
- 共用樣式抽成獨立 CSS，不要內嵌 `<style>`
- 圖片佔位符格式：`📸 需要截圖：描述` 或 `🎨 AI插圖：prompt描述`
- AI 插圖命名：`illus-[主題].png`
- 文章連結使用 root-relative 路徑（`/docs/articles/xxx.html`）

### URL 硬編碼原則
- 平台內部遊戲連結 → root-relative（`/games/xxx.html`）
- 外部遊戲 → 完整 URL
- 腳本中的 RR_URL → 正式網址（不用 localhost 或舊網址）
- 不在 HTML 屬性裡寫死任何環境相關 URL

---

## 注意事項

- `docs/gamelist.html` 是動態載入進 index.html 的，不是獨立頁面
- `docs/tutorial.html`、`docs/about.html` 同上，都是 HTML 片段不是獨立頁面
- CartPole.html 裡有個 typo：`CANVAS_H \ 2`（反斜線），是 Matter.js 靜態邊界計算，目前不影響功能
- 智能體 2 UI 已暫時隱藏（HTML 中保留註解），待多智能體自動建立後啟用
