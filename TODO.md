# RR 待辦事項 / 未來想法

記錄暫時無法實現、但值得追蹤的需求與想法。

---

## 平台架構

- [ ] **支援遊戲動態更新 gameInfo**
  遊戲中途若狀態空間定義改變（如切換前處理模式），主程式應能重新接收 gameInfo、重建 Q-table 並重置 Agent。目前協定假設 gameInfo 只在 loadGame() 時送一次，需設計「重宣告」機制。
  > 起因：CartPole 前處理開關 checkbox 的嘗試，因主程式尚未支援而暫緩。

---

## 遊戲環境

- [ ] **CartPole：State 前處理可切換 UI**
  加入 checkbox 讓使用者選擇是否套用 sign·√|x| 前處理，方便對照實驗（Q-Learning 有益，DQN 不必要）。需等平台支援動態 gameInfo 後再實作。
  > 注意：sign·√|x| 對 Q-Learning 是「起點低、上限高」，前期學習緩慢（小偏差全擠在中央區間，每一點變化都是新狀態）；拿掉前處理則是「很快學個大概、但快速遇到天花板」。教學示範場景優先速成效果，目前維持有前處理版本，待未來對照實驗再開放切換。

---

## 演算法

- [ ] **DQN 完整實作**
  UI 已存在，`dqnWebWorker.js` 骨架已有，尚未完成訓練邏輯。

- [ ] **DQN 自動線性歸一化**
  選用 DQN 演算法時，平台應依據 gameInfo stateInfo 宣告的 min/max，自動將每個狀態維度線性歸一化到 [-1, 1] 後再送入網路。對應 Q-Learning 的自動 bucket 化機制，讓遊戲端只需宣告真實物理範圍，無需自行前處理。

---

## 社群 / 直播

- [ ] **Google 帳號登入（OAuth）**
  RR 平台加入 Google 帳號登入，作為後續會員功能與 YouTube 直播整合的基礎。

- [ ] **一鍵直播到 YouTube（WHIP 協定）**
  登入後透過 YouTube Data API 建立直播，用 `getDisplayMedia()` 擷取 RR 頁面畫面，經 WebRTC + WHIP 協定直接推流到 YouTube，不需 OBS 或後端伺服器。符合 RR 純前端架構。
  流程：Google OAuth → 建立直播 → 取得 WHIP endpoint → 瀏覽器直接推流 → 自動分享連結。
  > 需等 Google 登入完成後接著做。可搭配自動發文腳本同步分享到 Discord / X。

---

## UI / 體驗

- [ ] **豎屏模式（適配 YouTube Shorts / 短視頻）**
  新增豎屏版面：遊戲區與控制面板改為上下分割，大幅簡化 UI。
  - 保留：超參數調整 slider
  - 保留圖表：每秒獎勵、每回合步數（各一張）
  - 停用：Q-Table 熱力圖、其餘分析圖表、分析 tab
  目標讓直播畫面在手機直式螢幕上清晰可讀，適合錄製 Shorts 展示 Agent 學習過程。

---

## 教學 / 論文

（暫無）

---

> 最後更新：2026-03-26
