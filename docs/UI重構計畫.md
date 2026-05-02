# RR UI 重構計畫

> 建立日期：2026-05-02
> 狀態：計畫中（等實驗教學結束後執行）

---

## 一、現況診斷

### 問題不在骨髓，在皮膚

讀完 `style.css` 與 `index.html` 後，**JS 邏輯層完全乾淨**（Q-Learning、postMessage 協定、圖表更新全部與佈局無關）。RWD 問題是純粹的 CSS + HTML 結構層問題，不需要動演算法或通訊協定。

### 具體病灶（按嚴重度）

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| 1 | **圖表固定像素尺寸** | `.chart { width: 500px; height: 300px }` | 在任何非 1080p 螢幕都溢出；平板/手機直接壞版 |
| 2 | **Grid 欄數硬編碼** | `.gamelist-grid { grid-template-columns: repeat(4, 1fr) }` | 手機 4 欄塞死 |
| 3 | **Grid 欄數硬編碼** | `.grid-container { grid-template-columns: repeat(2, 1fr) }` | 窄螢幕儀錶 2 欄超出容器 |
| 4 | **Tab 列不換行** | `.sub-tab-buttons { display: flex }` 無 overflow 處理 | 多 Tab 時超出容器，右側按鈕消失 |
| 5 | **左右分割比例固定** | `#leftPanel { width: 40% }` `#rightPanel { width: 70% }` | 加起來 110%，靠 flex 吸收，小螢幕不好用 |
| 6 | **動作色環固定像素** | `#p1-acti-color { width: 260px; height: 260px }` | 在窄欄格子裡溢出 |
| 7 | **Tab 區塊滾動性差** | `.sub-tab-content { overflow: auto }` 但圖表是固定寬度 | 圖表溢出後觸發橫向捲動，體驗差 |

### Portrait 模式現況

已有基本 `@media (orientation: portrait)` 但只做到「能用」：
- 隱藏 `#controls` 和 `#actions`（功能損失）
- 只留一張 Reward 圖（圖表反應性仍靠固定 500px）
- Tab 列在手機上仍然擁擠

---

## 二、重構方向

### 策略：CSS 層重構 ＋ HTML 輕度清理，不動 JS

這不是打掉重練。JS 層（reinforceEngine.js、generalCharts.js、qualityCharts.js）完全不碰。

重構目標：
1. 圖表 → Plotly `responsive: true`（移除固定 px，圖表自動撐滿格子）
2. Grid → CSS Grid 搭配 `repeat(auto-fit, minmax(...))`，自動斷行
3. 分割比例 → `clamp()` 或 CSS 自定義屬性控制，支援拖曳調整（選做）
4. Tab 列 → `overflow-x: auto; white-space: nowrap`
5. 色環 → `width: min(260px, 100%)` 讓它在窄格中自動縮
6. 清理 HTML 中的遺留 p2 區塊（p2-blocks、p2-config、p2-logs 暫時用 hidden 封存）

---

## 三、施工計畫

### Phase A：Plotly 圖表響應化（最高收益）

**目標：** 移除 `.chart` 的固定像素，改為撐滿父容器

```css
/* 現狀 */
.chart { width: 500px; height: 300px; }

/* 改為 */
.chart { width: 100%; min-height: 200px; }
```

Plotly 初始化加 `responsive: true`：
```js
Plotly.newPlot(el, data, layout, { responsive: true });
```

搭配 `ResizeObserver` 或 `window.addEventListener('resize', ...)` 觸發 `Plotly.Plots.resize(el)`。

影響範圍：`generalCharts.js`、`qualityCharts.js` 的每個 `Plotly.newPlot` 呼叫。

---

### Phase B：Grid 系統響應化

**儀錶區（p1-config）：**
```css
/* 現狀 */
.grid-container { grid-template-columns: repeat(2, 1fr); }

/* 改為 */
.grid-container { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
```

**遊戲清單：**
```css
/* 現狀 */
.gamelist-grid { grid-template-columns: repeat(4, 1fr); }

/* 改為 */
.gamelist-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
```

---

### Phase C：Tab 列與控制列整理

```css
.sub-tab-buttons {
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: thin;
}
```

Portrait 模式補回 `#controls` 的精簡版（只留遊戲 URL + 載入鈕）。

---

### Phase D：色環與固定尺寸元件

```css
#p1-acti-color {
  width: min(260px, 100%);
  height: min(260px, 100%);
}
```

所有 hardcoded px 元件都改用 `clamp()` 或 `min()` 限制上限但保持流動。

---

### Phase E：左右分割比例（選做）

```css
/* 用 CSS 自定義屬性讓比例可配置 */
:root { --left-w: 40%; }
#leftPanel { width: var(--left-w); }
#rightPanel { flex: 1; }
```

拖曳調整分割線：在 leftPanel/rightPanel 之間加 `<div id="resize-handle">` + mousemove 事件更新 `--left-w`。

---

## 四、驗收標準

| 場景 | 目標 |
|------|------|
| 1080p 桌面 | 與現況相同，無視覺差異 |
| 720p / 13 吋筆電 | 圖表自動縮放，不溢出 |
| iPad 橫屏（1024px） | 左右分割可用，Tab 不裁切 |
| iPhone 豎屏（390px） | 上下分割，可看 Reward 圖，可調超參數 |
| Playwright 截圖 | `no_viewport=True` 仍正常運作 |

---

## 五、注意事項

- `/en/index.html` 封存中，**不納入此次重構**
- `agentVisualizer.js` 用 `position: fixed`，對佈局無影響，不需改
- Plotly `responsive: true` 在某些舊版瀏覽器有 bug，需實機測試
- 色環的 `needle::after { transform: translateX(92px) }` 是固定偏移量，改完色環尺寸後需重新計算

---

## 六、執行時機

實驗教學結束（/en 解封）後即可開始。

建議執行順序：Phase A → B → C → D → E（選做）
Phase A 獨立可做，完成後就有明顯改善，可先截圖確認再繼續。
