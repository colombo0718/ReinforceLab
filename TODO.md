# RR 待辦事項 / 未來想法

記錄暫時無法實現、但值得追蹤的需求與想法。

---

## 通路合作

- [ ] **進駐 mosme.net（磨課師平台）**
  已與原工作老闆討論，RR 平台可進駐 https://www.mosme.net/ 並借助其既有教師/學生會員系統引流。
  待確認事項：
  - 接入方式：iframe 嵌入 / 外連連結 / SSO 會員對接？
  - 若需 SSO，Google OAuth 方向可能改走他們的帳號系統，影響登入功能的技術路線
  - 若有 Teacher Dashboard 需求，可與他們的教師角色系統整合

---

## 部署 / 上架 ⬅️ 當前優先

- [x] **上架到正式網址 reinroom.leaflune.org（Cloudflare）**
  已上線：https://reinroom.leaflune.org
  架構：本地 → GitHub → Cloudflare Pages（自動部署，push 即更新）

- [ ] **完善「指南」分頁內容**
  一進 RR 的預設分頁是「🧭指南」，目前只有框架，教學文章內容需補齊。
  > 需先上架正式網址後再申請 Google AdSense（廣告版位已預留）。

- [ ] **整理「遊戲」分頁**
  目前只是散亂的連結按鈕，需系統化分類。建議分類維度：
  - 任務類型：離散狀態 / 連續狀態
  - 狀態維度：1D / 2D / 3D / 4D+
  - 未來擴充：玩家人數、動作維度
  > 完善後有助於新使用者快速找到適合的入門環境。

- [ ] **申請 Google AdSense**
  指南分頁已預留廣告版位，待「指南內容完善」＋「遊戲分頁整理」完成後申請。

---

## 平台架構

- [ ] **多智能體自動建立**
  根據 `gameInfo` 宣告的 `players` 陣列長度，動態生成對應數量的智能體 Tab（儀錶 + 分析），每個智能體各自維護獨立的 QTable、DQN Worker、圖表。目前智能體 2 UI 已預留 HTML 結構但整合邏輯尚未實作（暫時隱藏）。

- [ ] **支援遊戲動態更新 gameInfo**
  遊戲中途若狀態空間定義改變（如切換前處理模式），主程式應能重新接收 gameInfo、重建 Q-table 並重置 Agent。目前協定假設 gameInfo 只在 loadGame() 時送一次，需設計「重宣告」機制。
  > 起因：CartPole 前處理開關 checkbox 的嘗試，因主程式尚未支援而暫緩。

---

## 遊戲環境

- [ ] **CC2D（CubicCraft 2D）接入 RR — 旗艦級遊戲**
  復活中的太空機體競技遊戲，物理核心（質心/慣性矩/推力扭矩/Checkpoint 驗證）已完整實作。
  缺的只有 RR 通訊層，接入後成為平台目前最複雜的示範環境。

  **接入順序：**
  - [ ] Step 1：kernal 機體（4 引擎 on/off，16 個離散動作）接上 RR 協定
    - `gameInfo`：stateInfo（x, y, vx, vy, angle, ω, dx/dy/dist to checkpoint）、actionInfo（16 動作）
    - 每幀回傳 `reward_state`（通過 checkpoint +100，時間懲罰 -0.1/幀，偏離過遠 done=true）
    - 現有 DQN 即可處理，不需等 PPO
  - [ ] Step 2：部署到 `cubiccraft.leaflune.org`，加入 RR 遊戲清單（社群遊戲區段）
  - [ ] Step 3：PPO 算法接入 RR，為 fighter 機體（512 動作）與連續推力版預備
  > CC2D 的複雜度會自然倒逼 RR 算法升級：DQN → PPO → SAC，這條路線即是課程敘事的核心。
  > 詳見 `C:\Users\USER\cubiccraft\CC2D接入RR平台的升級路線.md`

- [ ] **CartPole：State 前處理可切換 UI**
  加入 checkbox 讓使用者選擇是否套用 sign·√|x| 前處理，方便對照實驗（Q-Learning 有益，DQN 不必要）。需等平台支援動態 gameInfo 後再實作。
  > 注意：sign·√|x| 對 Q-Learning 是「起點低、上限高」，前期學習緩慢（小偏差全擠在中央區間，每一點變化都是新狀態）；拿掉前處理則是「很快學個大概、但快速遇到天花板」。教學示範場景優先速成效果，目前維持有前處理版本，待未來對照實驗再開放切換。

---

## 腳本系統 × 錄放系統

- [ ] **腳本系統（Blockly Agent）**
  使用者用 Blockly 積木搭建一個「規則型 Agent」，取代 RL 演算法從收到 SR 訊號到回傳 A 的整個過程。
  流程：遊戲送 `gameInfo` → 平台根據 stateInfo / actionInfo 自動生成對應積木類型 → 使用者拖拉積木定義取值邏輯與動作選擇 → 每步收到 `reward_state` 時執行積木程式回傳 action。
  仍在 RR 通訊協定框架內，gameInfo / reward_state / action 的收發結構不變，只是「RL 演算法」那一層換成積木腳本。
  > 定位：讓不懂 RL 的使用者也能用邏輯積木寫出可對戰的 Agent，也可作為 RL 學習的比較基準。

- [ ] **錄放系統（Episode Recorder）**
  遊戲進行時即時記錄每一步的 SARS 資料，回合結束後串成一條 episode 紀錄。
  功能包含：
  - 每回合自動標記元資料（使用步數、最終得分、演算法種類）
  - 回合分類與篩選（依步數、得分排序，挑選「好的對局」）
  - 選定回合後可讓 Agent 反覆學習（類 Imitation Learning / Offline RL）
  - 長期：提取不同打法的特徵值，標記「流派」

  **核心概念：**
  Q-table 是 Agent 的內在心智模型；episode 紀錄是外部明確的行為資料。
  紀錄與演算法解耦——好的對局資料存下來，之後不管給什麼演算法都能吃進去。

  > 長期延伸：LLM 離線讀整段對局歷程 → 分析對手弱點與最佳路線 → 輸出行為決策樹 → 腳本照著高頻執行。
  > LLM 負責思考，腳本負責反應，各司其職，繞開即時反應速度限制。
  > 符合 RR 通訊協定的遊戲，其對局紀錄天然可被 LLM 研究、進而自動生成 Blockly 腳本——這是協定標準化帶來的副產品。

---

## 演算法

- [x] **DQN 完整實作**
  Q-Table 蒸餾式 DQN，雙向互學架構，詳見 `Q表蒸餾式DQN：設計心法.md`。

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

## 雙向觀察共控平台（長期開發方向）

- [ ] **假游標層（第一步）**
  在 RR 前端加一個 `position: fixed; pointer-events: none` 的 overlay div，
  讓 Playwright 腳本操作平台時，觀眾能看到假游標移動、點擊波紋、hover 高亮、拖曳路徑與操作節奏控制。
  錄影版 MVP 先不做角落步驟提示文字，改為支援「標紅框聚焦」：讓假游標可主動框出目前要觀察的按鈕、圖表或區塊。
  適用：教學影片錄製、直播展示、平台導覽。
  > 後續延伸：Human-Agent 雙介面 → 語意化操作描述層 → 人機共控 → 雙向觀察（側錄 shadow mode）
  > 詳見 `雙向觀察的共控平台UI架構討論.md`

---

## UI / 體驗

- [ ] **手機端響應式設計（論文 1.0 版完成後第一優先）**
  目前 RR 平台在手機上幾乎無法使用：左右分割布局在窄螢幕擠爆、滑桿難以操作、圖表過小、iframe 遊戲區觸控體驗差。
  需要全面的 RWD 改造，至少達到「手機可觀看 AI 訓練過程」的基本可用狀態。
  > 優先順序：論文截圖與 1.0 版內容統整完成後立即開始。

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

> 最後更新：2026-04-03
