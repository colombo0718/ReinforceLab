# AgentVisualizer 腳本控制指示層使用說明

**模組路徑：** `agentVisualizer.js`
**掛載點：** `window.AgentVisualizer`
**用途：** 在 RR 平台 UI 上疊加可視化指示層，供 Playwright 腳本在錄製教學影片時控制游標、框選區域、繪製路徑。

---

## 架構

AgentVisualizer 以 IIFE 注入頁面，掛在 `window.AgentVisualizer`。overlay 為固定定位（z-index: 5000），由以下四層構成：

| 層 | 元素 | 說明 |
|---|---|---|
| Trail | `<svg class="av-trail-layer">` | 拖曳路徑線段 |
| Focus | `<div class="av-focus-box">` | 紅框，主焦點標記 |
| Hover | `<div class="av-hover-box">` | 藍框，次要高亮 |
| Cursor | `<div class="av-cursor">` | 假游標（emoji），熱點在指尖 |

---

## API

### 生命週期

```js
AgentVisualizer.enable()             // 顯示 overlay
AgentVisualizer.disable()            // 隱藏 overlay，清除所有元素
AgentVisualizer.setSpeed(n)          // 調整動畫速度倍率（預設 1）
AgentVisualizer.setCursorEmoji(str)  // 設定游標 emoji（預設 "👆"）
```

---

### 游標

```js
await AgentVisualizer.moveTo(x, y, options?)
await AgentVisualizer.moveToElement(selector, options?)
```

游標以動畫移動至目標點。`options.duration`（ms）可覆蓋預設移動時間。

```js
await AgentVisualizer.click(x, y, options?)
await AgentVisualizer.clickElement(selector, options?)
```

游標移動至目標後產生點擊波紋。`options.size`（px）控制波紋大小；`options.moveFirst: false` 跳過移動直接播波紋。

---

### 框選

```js
AgentVisualizer.focusRect(rect, options?)        // 紅框，依絕對座標
AgentVisualizer.focusElement(selector, options?) // 紅框，依 selector
AgentVisualizer.hoverRect(rect, options?)        // 藍框，依絕對座標
AgentVisualizer.highlightElement(selector, options?) // 藍框，依 selector
```

**rect 格式：** `{ left, top, width, height }`（px，相對於 viewport）

**options：**

| 欄位 | 型別 | 說明 |
|---|---|---|
| `padding` | number | 框向外擴展 px（預設 0） |
| `radius` | number | 圓角 px（預設 8） |
| `duration` | number | 自動消失時間 ms；省略則需手動清除 |

框選為同步操作。CSS transition 約 250ms，若需在框穩後截圖，請在 Python 側加 `page.wait_for_timeout(260)`。

---

### 路徑

```js
await AgentVisualizer.dragPath(points, options?)
```

**points：** `Array<{ x, y }>` 或 `Array<[x, y]>`，至少兩點。

**options：**

| 欄位 | 型別 | 說明 |
|---|---|---|
| `segmentDuration` | number | 每段移動時間 ms（預設 220） |
| `keepTrail` | boolean | 是否保留路徑線（預設 false） |
| `fadeDuration` | number | 路徑淡出時間 ms（keepTrail: true 時有效） |
| `scale` | number | 移動中游標縮放（預設 1） |

---

### 清除

```js
AgentVisualizer.clearFocus()   // 清除紅框，取消 duration timer
AgentVisualizer.clearHover()   // 清除藍框，取消 duration timer
AgentVisualizer.clearTrail()   // 清除路徑
AgentVisualizer.clearAll()     // 三者一起清除
```

---

## Playwright 整合

### 呼叫方式

```python
# 同步 API（framework / enable / clear 系列）直接 evaluate
await page.evaluate("window.AgentVisualizer.enable()")

# 非同步 API（moveTo / click / dragPath）— page.evaluate 會等 Promise resolve
await page.evaluate("window.AgentVisualizer.moveToElement('#btn')")

# 帶參數（f-string + json.dumps 處理 rect）
import json
await page.evaluate(
    f"window.AgentVisualizer.focusRect({json.dumps(rect)}, {{padding: 8, duration: 1500}})"
)
```

### 框選後截圖

```python
await page.evaluate("window.AgentVisualizer.focusElement('#controls', {padding: 10})")
await page.wait_for_timeout(260)   # 等 CSS transition 收斂
await page.screenshot(path="shot.png")
```

### 分析頁圖表（必須先 scroll）

```python
await page.locator(selector).first.scroll_into_view_if_needed()
await page.wait_for_timeout(450)
await page.evaluate(
    f"window.AgentVisualizer.highlightElement('{selector}', {{padding: 8, duration: 1500}})"
)
```

### 旁白驅動影片（duration 對齊 pause 時間）

```python
_ms = pause_for("場景名", 1500)
await page.evaluate(
    f"window.AgentVisualizer.focusElement('#target', {{padding: 10, duration: {_ms}}})"
)
await page.wait_for_timeout(_ms)
```

---

## 設計限制

- overlay 為純視覺層，不攔截任何滑鼠事件（`pointer-events: none`）
- `focusRect` / `hoverRect` 為同步操作，不回傳 Promise；真實操作（點擊、填值）仍須由 Playwright 執行
- cursor hotspot 固定在 emoji 指尖（offset: -21px, -6px），`transform-origin: 21px 6px`
- 同時只能有一個紅框、一個藍框；新的 call 覆蓋舊位置，同時重置 duration timer

---

## 腳本

| 腳本 | 用途 |
|---|---|
| `run_ui_tour.py` | 截圖巡覽，產出驗證報告 |
| `run_ui_tour_video.py` | 錄製 `.webm` 導覽影片 |
| `make_intro_video_en.py` | TTS 旁白 + 字幕 + ffmpeg 合成 `.mp4` |
