# CHANGELOG — Rein Room

重大改動里程碑與架構決策紀錄。
小 bug fix 與日常提交見 `git log`。

---

## 2026-04-05｜**v1.0.0 正式版**

### 里程碑
- 平台功能完整，進入穩定版本供論文研究與教學實驗使用

### 新增
- `BUGS.md`：Gemini + Codex 自動審查後整理的已知問題清單
- `privacy.html` / `terms.html`：隱私權政策與使用條款完整頁面
- 遊戲清單改為卡片式 4 欄布局，整張卡片可點擊載入

### 修正
- `qualityCharts.js`：定時器在第一筆 reward_state 抵達前崩潰（#4）
- `qualityCharts.js`：Max/Min Q 熱力圖 z 資料結構改為 2D 矩陣（#6）
- 所有教學文章返回連結改為「← 返回 Rein Room」
- `about.html`：聯絡 Email 佔位符補上真實信箱，路徑改為相對路徑
- 加速按鈕圖示 🐢 → 🐇

### 遊戲頁面
- 5 個官方遊戲頁面統一佈局：移除標題、說明改為「任務說明」+「RL 資訊」摺疊區
- 建立共用 `games/game-info.css`

---

## 2026-04-05｜文件架構重整 + 指南文章圖片完整

### 新增
- 拆分 `CLAUDE.md`（通用規範）+ `PROJECT.md`（專案描述），新增 `CHANGELOG.md`
- 12 篇指南文章全數插入截圖與 AI 插圖，替換所有 `img-placeholder`

---

## 2026-04-04｜指南分頁重構 + 文章系統建立

### 新增
- 指南分頁改為摘要卡 2×n 布局（12 張卡片，3 個區段，廣告位在區段間）
- 建立 `docs/articles/` 文章系統，共 12 篇完整文章（含共用 `article.css`）
- `screenshot_articles.py`：Playwright 腳本，批量截取文章所需截圖

### 修正
- 所有 Vercel hardcode URL 改為 root-relative 路徑（`/games/xxx.html`）

---

## 2026-03-31｜DQN 完整實作 + UI 清空功能

### 新增
- 「🧹清空」按鈕：清空 Q-Table 與 NN 記憶（`3ffa129`）
- 知識同步（蒸餾）同步率 R² 顯示（`957cf57`）
- 暫停遊戲時自動持續蒸餾，NN 不因遊戲暫停而停止學習（`1cf0d26`）
- 全量資料蒸餾、相對收斂停止（`96795e3`）
- 關閉所有 Plotly 圖表的 modebar 工具列（`0f08221`）
- Agent 統一改名為「智能體」（`a61b541`）

### 修正
- `importQtable`：重複載入失效與 Worker 副本不同步問題（`e912897`）
- 切換遊戲時主動取消 pending `requestFit()`，防止迴圈卡死（`21fe95c`, `3ebb83f`）
- 補回 Qt 背景蒸餾迴圈，`batchPredict` 改為每秒刷新（`d5e16d8`）

---

## 2026-03-30｜DQN 視覺化 + 圖表控制 UI

### 新增
- 圖表控制加「繪製資料」UI，支援切換 Q-Table / DQN 視覺化（`b0ea5c9`）
- 圖表控制區加「展開狀態」「切片位置」標籤，滑桿改用 details 折疊（`dcb0a24`）
- 熱力圖低維退化改用固定格子 + NaN 留白，預設 bin 改 10（`7ed47e3`）

### 修正
- 動作熱力圖固定 `zmin/zmax`（`f642d64`）
- 熱力圖 1D 遊戲顯示修正（`3613d77`）

---

## 2026-03-29｜DQN 主訓練管線完整實作

### 新增
- Q-Table 蒸餾式 DQN 主訓練管線（`d2c9ac1`）
- `dqnWebWorker.js` 重建，補齊規格中所有待實作項目（`5c21fc1`）
- 圖表控制 UI 動態 slider 與 radio 追蹤模式（`6d6ac20`）

### 架構決策
- DQN 採 Q-Table 蒸餾式（非標準 DQN）：Q-Table 當老師，神經網路當學生
- 原因：可解釋性高、不需要 replay buffer、R² 量化知識轉移
- 詳見 `Q表蒸餾式DQN：設計心法.md`

---

## 2026-03-28｜貓貓排球手機版 + 程式碼重整

### 新增
- `cat_volley_app.html`：手機版貓貓排球（`84bac46`）
- iOS 直屏提示、emoji 字型修正（`879fc98`, `8db920b`）
- 蒸餾式 DQN 設計心法文件（`67c2d04`）

### 重構
- `reinforceEngine.js`、`index.html`、`generalCharts.js` 重整區塊說明（`828b35c`, `b8b70e6`, `332dd18`）

---

## 2026-03-26｜CartPole 精調 + 協定定版 + 文件建立

### 新增
- `TODO.md`（`139ca25`）、`CLAUDE.md` 專案快速指引（`aef3135`）

### 修正
- CartPole：bin 從 10 降為 6（狀態數 10000 → 1296）（`5d6712a`）
- CartPole：移除 state 前處理，改送原始物理值，平台端負責歸一化（`2a2a3cc`）
- 更新 MAB、Maze1D/2D 遊戲至新協定（`2f6add4`）
- gamelist 加入 heli/CartPole 連結（`304ed15`）

---

## 2026-03-25｜CartPole 上線 + 通訊協定改版

### 新增
- `CartPole.html`：Matter.js 物理，4D state，完整 RR 通訊協定（`4e27b9d`）

### 架構決策（破壞性變更）
- 通訊協定改版：`done` 欄位整併進 `reward_state`，廢棄獨立 `endEpisode`（`2fd00ac`）
- 舊版 `endEpisode` 在 `index.html` 保留向後相容，新遊戲不應依賴

---

## 2026-03 以前｜平台核心建立

### 完成項目
- Q-Learning 核心引擎（`reinforceEngine.js`）
- 通訊協定初版：`postMessage` iframe 雙向通訊，`gameInfo` / `reward_state` / `action`
- 官方遊戲環境：MAB、Maze1D、Maze2D_emoji、heli
- 訓練視覺化：每秒/每回合圖表（`generalCharts.js`）、Q-Table 熱力圖、動作分布（`qualityCharts.js`）
- 匯出/匯入 Q-Table 功能
