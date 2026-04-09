# BUGS.md — 已知問題清單

由 Gemini + Codex 自動審查後整理（2026-04-05）。
標記修復狀態：`[ ]` 待修、`[x]` 已修。

---

## 🔴 嚴重（教學現場必踩）

- [x] **#4 qualityCharts 載入即崩潰**
  - 位置：`qualityCharts.js:457`
  - 問題：定時器在頁面載入後立即啟動，若第一筆 `reward_state` 尚未到達，`nextState` 為 `undefined`，執行 `focusState = [...nextState]` 直接拋錯，Q-Table 熱力圖、動作分布等所有品質圖表全部停止更新。

- [x] **#6 Max/Min Q 熱力圖 z 資料結構錯誤**
  - 位置：`qualityCharts.js:296`（generateMaxQHeatmap）、`qualityCharts.js:339`（generateMinQHeatmap）
  - 問題：z 以扁平一維陣列傳入 Plotly heatmap，但 Plotly 需要二維矩陣。與 `generateActionHeatmap()` 的結構不一致，導致渲染錯誤或軸對應異常。

---

## 🟠 中等（特定操作才踩到）

- [x] **#3 `epsilonToTau` 方向相反**
  - 位置：`reinforceEngine.js`，`epsilonToTau` 函式
  - 問題：公式 `1/(epsilon+0.1)-0.5` 使 ε 越大 τ 越小（越貪婪），與 ε-greedy 的增探索方向相反。切換 Softmax 策略時行為與預期完全相反。

- [ ] **#1 DQN 空模型被信任**
  - 位置：`dqnWebWorker.js:120-136`、`index.html:689`
  - 問題：Worker QTable 為空、或 fit 被跳過時，仍回傳 `fitDone { loss: null }`，主執行緒收到任何 `fitDone` 都設 `dqnFitted = true`，之後 evaluateQuality() 用未訓練 NN 做決策。

- [ ] **#2 importQtable 後 Worker 舊資料未清除**
  - 位置：`dqnWebWorker.js:200`、`index.html:875`
  - 問題：`updateQTable` 用 merge（`{...QTable, ...data}`），importQtable 沒有先送 `resetQTable`。載入較小的 Q-Table 後，Worker 仍保留舊 key，蒸餾時資料集被污染。

- [ ] **#7 episode 圖表可能重複更新**
  - 位置：`index.html:749`、`index.html:811`
  - 問題：`done:true` 和舊協定 `endEpisode` 都會呼叫 `updateEpisodeChart()`，若遊戲同時送兩種訊息，episode 資料被重複 append。

- [ ] **#8 `eGreedyStrategy` action_size=1 時除以零**
  - 位置：`reinforceEngine.js`，`eGreedyStrategy`
  - 問題：`Epsilon / (action_size - 1)` 在單一動作環境下產生 `Infinity`。

---

## 🟡 次要（不影響訓練，但影響數字顯示）

- [ ] **#5 `qTableUpdate` 預設是 SARSA 而非 Q-Learning**
  - 位置：`reinforceEngine.js`，`qTableUpdate`
  - 問題：`Psi = 0`（預設）時 target = `actualQNext`（SARSA），而非 `maxQNext`（Q-Learning）。純 Q-Learning 需要 `Psi = 1`。名稱與預設行為不符。

- [ ] **#9 `updateQtableStats` NaN 風險**
  - 位置：`index.html:908`
  - 問題：`stateInfo.map(s => s.bin)` 若遊戲未宣告 `bin`，計算 `totalStates` 時得 NaN，面板顯示錯誤。

- [x] **#10 about.html 聯絡 Email 佔位符未填**
  - 位置：`docs/about.html`
  - 問題：`your-real-email@example.com` 未替換為真實信箱。

- [ ] **#11 Maze2D state 回傳字串而非數值**
  - 位置：`games/Maze2D_emoji.html`，`updateState()`
  - 問題：`toFixed(2)` 讓 state 為字串陣列，雖 JS 自動轉型，但有 NaN 風險與效能損耗。

---

## 待辦（非 bug，但值得改進）

- [ ] **Softmax 策略的 Tau 換算需重新設計**（與 #3 相關，但屬設計層面）
- [ ] **`eGreedyStrategy` 平手時應隨機抽選，而非永遠取 `indexOf`**（訓練初期探索偏向第一個動作）

---

> 下一步：建立 Playwright 自動巡檢系統，自動點擊各按鈕、記錄 log 輸出與畫面錄影，回報異常。
