# AgentVisualizer 截圖驗收標準

你的任務：逐張讀取截圖，對照下方標準判斷 PASS 或 FAIL。

截圖目錄：C:/Users/USER/ReinforceLab/agent_outputs/playwright_rr_ui_tour/screenshots/
共 19 張，從 01-overview.png 到 19-overlay-disabled.png。

背景知識：
- AgentVisualizer 的 focus box 是紅色框線（有輕微脈衝動畫）
- hover box 是藍色框線（較淡）
- 游標 emoji 固定是 👆
- trail（路徑）是藍色 SVG 線條
- 元素截圖（12-17）是用 locator.screenshot() 裁切，畫面只有圖表本身

---

## 驗收標準

### 01-overview.png
意圖：全頁總覽，focusRect 框住整個平台（距邊 8px）
標準：
- 紅色框線貼近畫面四邊
- 👆 游標可見
- 左側導覽列 + 中央文章列表可見

### 02-tutorial-tab.png
意圖：highlightElement 指向「指南」tab
標準：
- 藍色框框在上方 tab 列的「指南」按鈕附近
- 👆 游標在框附近
- 文章列表在右側可見

### 03-games-tab.png
意圖：focusElement 框住遊戲卡片列表區
標準：
- 紅色框線框住中央遊戲卡片列表
- 遊戲卡片至少 4 張可見
- 👆 游標可見

### 04-tab-drag-path.png
意圖：dragPath 沿上方 tab 列移動，keepTrail
標準：
- 藍色 SVG 路徑線橫跨畫面上方 tab 列（水平線，y 約在頂部）
- 👆 游標在路徑末端（右側）
- 遊戲分頁內容在背景可見

### 05-top-controls.png
意圖：框出上方控制列，游標指向遊戲網址輸入框
標準：
- 紅色框線框住頂部控制列
- 👆 游標在輸入框附近
- 輸入框可見

### 06-iframe-focus.png
意圖：框住左側遊戲 iframe（Maze2D）
標準：
- 紅色框線框住左側迷宮區域
- 迷宮格子 + 角色可見
- 👆 游標可見

### 07-config-algorithm.png
意圖：框住演算法與策略選項區（radio buttons）
標準：
- 紅色框線框住左上角演算法/策略區
- Q-Table / DQN 選項可見
- eGreedy / Softmax 選項可見

### 08-config-sliders.png
意圖：hoverRect 框住右側超參數滑桿區
標準：
- 藍色框框住右側滑桿群
- 滑桿可見（learning rate 等）
- 👆 游標可見

### 09-manual-point-click.png
意圖：moveTo(1040,235) 示範任意座標點擊
標準：
- 👆 游標可見
- 游標位置在畫面中上方偏右（約 x=1040, y=235）
- 游標落在有意義的 UI 元素上（非空白）

### 10-training-charts-group.png
意圖：focusRect 框住四張訓練圖表群
標準：
- 紅色框線框住右側圖表區
- 圖表標題或座標軸可見
- 框的範圍明顯是圖表群

### 11-analysis-stats.png
意圖：切到分析頁，框住頂部統計面板
標準：
- 紅色框線框住分析頁頂部統計區
- 統計標籤/數字可見
- 👆 游標可見

### 12-analysis-bars.png（元素截圖，只有圖表）
意圖：動作價值 vs 選擇機率柱狀圖
標準：
- 彩色柱狀圖已渲染（多種顏色的柱子）
- 👆 游標 emoji 可見於圖內
- x 軸有 a0, a1, a2... 標籤

### 13-analysis-diff.png（元素截圖）
意圖：動作選擇熱力圖
標準：
- 熱力圖有色塊或漸層可見
- 👆 游標可見於圖內

### 14-analysis-max.png（元素截圖）
意圖：最大 Q 值熱力圖
標準：
- 熱力圖有色彩分布（非全白/全黑）
- 👆 游標可見

### 15-analysis-min.png（元素截圖）
意圖：最小 Q 值熱力圖
標準：
- 熱力圖可見
- 👆 游標可見

### 16-analysis-line.png（元素截圖）
意圖：切片折線圖
標準：
- 折線圖可見
- 👆 游標可見

### 17-analysis-wheel.png（元素截圖）
意圖：動作色環
標準：
- 圓形色環可見（有顏色的扇形或環狀圖）
- 👆 游標可見

### 18-fast-trail.png
意圖：快速 dragPath，L 型路徑
標準：
- 藍色 SVG 路徑線可見
- 路徑呈 L 型（先橫後縱）
- 分析頁圖表在背景

### 19-overlay-disabled.png
意圖：disable() 後 overlay 完全消失
標準：
- 無紅色框線
- 無藍色框線
- 無 👆 游標 emoji
- 無藍色路徑線
- 畫面乾淨（只有 RR 原生 UI）

---

## 輸出格式

Markdown table，共 19 行：
| 檔案 | PASS/FAIL | 備註（50字內） |

最後加總：N PASS / N FAIL，最大問題是什麼。
