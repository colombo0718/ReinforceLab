# RWD 豎屏模式開發計畫

## 目標

手機點開分享連結能直接使用 RR，不需要縮放或橫持。
豎屏模式定位：**展示 demo**，不是完整研究工具。

---

## 最終設計

```
┌─────────────────────┐
│                     │
│   遊戲 iframe  50%  │  [⛶] 浮動全屏鈕
│                     │
├─────────────────────┤
│  [ 遊戲 ] [ 儀表 ]  │  tab bar
│                     │
│  （遊戲 tab）       │
│  遊戲選單清單       │
│                     │
│  （儀表 tab）       │
│  gamma   ●──── 0.95 │
│  epsilon ●──── 0.2  │
│  alpha   ●──── 0.3  │
│  樂觀值  ●──── 0.0  │
│  延遲量  ●──── 0ms  │
│                     │
│  [ reward 折線圖 ]  │
└─────────────────────┘
```

---

## 消失的元素（portrait only）

| 元素 | 說明 |
|------|------|
| 頂部 header 列 | URL 顯示、全屏/載入/暫停/加速按鈕（淺綠色區域） |
| 底部動作按鈕列 | none/left/right/shoot 等（淺綠色區域） |
| 算法選擇器 | 豎屏預設 Q-Learning，不提供切換 |
| 品質圖表 | Q-table 熱力圖、動作分布、Q 值分析 |
| Steps 折線圖 | 只保留 reward 折線 |
| bins 設定 | 進階參數，豎屏不顯示 |

回合數/得分不需要另外顯示，遊戲 iframe 內部抬頭顯示已包含。

---

## 檔案異動範圍

### 1. `style.css`（主要工作）

新增 `@media (orientation: portrait)` 區塊：

```css
@media (orientation: portrait) {
  /* 左右切分 → 上下切分 */
  body > .main-container {
    flex-direction: column;
  }

  /* 遊戲區：上半 50% */
  .game-section {
    width: 100%;
    height: 50vh;
  }

  /* 頂部 header 列隱藏 */
  .game-header {
    display: none;
  }

  /* 底部動作按鈕隱藏 */
  .action-buttons {
    display: none;
  }

  /* 全屏浮動按鈕 */
  .fullscreen-float {
    display: flex;  /* 預設 display:none，portrait 才顯示 */
    position: absolute;
    top: 8px;
    right: 8px;
  }

  /* 控制區：下半 50% */
  .control-section {
    width: 100%;
    height: 50vh;
    overflow-y: auto;
  }

  /* 算法選擇器隱藏 */
  .algo-selector {
    display: none;
  }

  /* 品質圖表隱藏 */
  .quality-charts {
    display: none;
  }

  /* Steps 圖隱藏，只留 reward 圖 */
  .steps-chart {
    display: none;
  }

  /* 遊戲清單：tab 化 */
  /* 儀表：tab 化 */
}
```

### 2. `index.html`

- 遊戲區加 `.game-section` class（若無）
- header 列加 `.game-header` class
- 動作按鈕列加 `.action-buttons` class
- 新增浮動全屏按鈕（預設隱藏，portrait 才顯示）：
  ```html
  <button class="fullscreen-float" style="display:none">⛶</button>
  ```
- 控制區加入 tab 結構（遊戲 / 儀表），portrait 時啟用，desktop 時正常顯示全部

### 3. `en/index.html`

**不動。** 英文版目前封存，實驗教學進行中，不納入此次 RWD 開發範圍。

---

## Tab 結構設計

```html
<div class="portrait-tabs">
  <button class="tab-btn active" data-tab="game">遊戲</button>
  <button class="tab-btn" data-tab="dashboard">儀表</button>
</div>

<div class="tab-content" id="tab-game">
  <!-- 遊戲清單 -->
</div>

<div class="tab-content" id="tab-dashboard">
  <!-- 5 個 slider -->
  <!-- reward 折線圖 -->
</div>
```

Desktop 時 `.portrait-tabs` 和 `.tab-content` 的 tab 邏輯不啟用，兩個 content 都顯示（現有行為不變）。

---

## 實作進度

### Phase 1（已完成，commit `31c5754`，在 `dev` 分支）

- [x] body 改 column 排列，上下各 50dvh
- [x] `#controls`、`#actions` 隱藏
- [x] 指南 / 關於 / 分析 tab 隱藏
- [x] `#algo-selection` 隱藏
- [x] Steps 圖隱藏，reward 圖撐全欄
- [x] 浮動全屏鈕 HTML + CSS
- [x] portrait tab 自動切換 JS

### 待修（Phase 1 已知問題）

- [ ] `智能體 1:` label 仍顯示（`.agent-label` 選擇器未生效，待查）
- [ ] 浮動全屏鈕實機位置待確認

### Phase 2（排後續，各遊戲個別處理）

- [ ] 各遊戲 canvas RWD（目前固定大小，豎屏下顯示不完整）

---

## 注意事項

- `en/index.html` **不動**，論文實驗封存中
- `@media (orientation: portrait)` 在桌面瀏覽器拉窄視窗也會觸發，測試時注意
- Phase 1 完成確認後：merge `dev` → `master`
