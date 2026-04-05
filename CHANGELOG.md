# CHANGELOG — Rein Room

重大改動里程碑與架構決策紀錄。
小 bug fix 與日常提交見 `git log`。

---

## 2026-04-05｜指南分頁重構 + 文章系統建立

### 新增
- 指南分頁改為摘要卡 2×n 布局（12 張卡片，3 個區段，廣告位在區段間）
- 建立 `docs/articles/` 文章系統，共 12 篇完整文章
- 共用樣式 `docs/articles/article.css`（`.callout`、`.step-block`、`.compare-grid` 等）
- 文章圖片系統：26 張平台截圖 + 6 張 AI 插圖，統一存於 `docs/articles/img/`
- `screenshot_articles.py`：Playwright 腳本，批量截取文章所需截圖

### 修正
- 所有 Vercel hardcode URL 改為 root-relative 路徑（`/games/xxx.html`）
- `autoWeb_playwright.py` / `screenshot_thesis.py` 的 RR_URL 更新至 `reinroom.leaflune.org`

---

## 2026-04-04｜正式部署上線

### 新增
- 正式部署至 `reinroom.leaflune.org`（Cloudflare Pages，push master 自動更新）
- `dev` 分支 preview 環境建立（取代 Vercel 作為開發測試環境）

### 架構決策
- 棄用 Vercel，改用 Cloudflare Pages（同帳號管理 DNS + 部署，減少跳轉）
- 部署流程：本地 → GitHub master → Cloudflare Pages 自動重新部署

---

## 2026-04-03｜DQN 完整實作 + UI 清空功能

### 新增
- Q-Table 蒸餾式 DQN 完整實作（雙向互學架構）
- 「🧹清空」按鈕：清空 Q-Table 與 NN 記憶
- Agent 統一改名為「智能體」

### 架構決策
- DQN 採 Q-Table 蒸餾式（非標準 DQN）：Q-Table 當老師，神經網路當學生
- 原因：可解釋性高、不需要 replay buffer、R² 量化知識轉移
- 詳見 `Q表蒸餾式DQN：設計心法.md`

---

## 2026-03 以前｜平台核心建立

### 完成項目
- Q-Learning 核心引擎（`reinforceEngine.js`）
- 通訊協定確立：`postMessage` iframe 雙向通訊，`gameInfo` / `reward_state` / `action`
- 官方遊戲環境：MAB、Maze1D、Maze2D_emoji、heli、CartPole
- 訓練視覺化：每秒/每回合圖表、Q-Table 熱力圖、動作分布、動作熱圖
- 匯出/匯入 Q-Table 功能

### 協定版本說明
- 新協定：`done` 欄位在 `reward_state` 裡，不再用獨立 `endEpisode`
- 舊協定 `endEpisode` 保留於 index.html 向後相容，新遊戲不應依賴
