# 適用於 GG（GameGeek）按鈕控制的訊號協定整理（今日版 / v0.1）

> 目的：讓「人類手指」與「RL Agent」都用同一套按鈕事件，去控制 iframe 內的遊戲頁。
> 核心觀念：把 Agent 當作手速很快的人類玩家；同一個按鍵連續兩次相同動作不需要重複 up/down（等同手沒離開）。

---

## 01｜按鈕編號（btnID）規格（已定案）

- `btnID = 0`：代表「都不按」（保留給 action 映射用；事件通常不會送 0）
- `btnID = 1 ~ 4`：四個功能鍵（技能 / 道具 / 互動 等等，由遊戲自行定義）
- `btnID = 5 ~ 8`：四方向鍵（固定對應）
- `5 = 上`
- `6 = 左`
- `7 = 下`
- `8 = 右`

> 記憶方式：方向鍵順序等同大家熟悉的 WASD / IJKL 的概念（上左下右）。

---

## 02｜事件格式（GG → 遊戲 iframe）

### A. 完整格式（建議，易除錯）
```js
{ type: "gg_event", player: 0, btnID: 5, state: "down" }
```

- `type`: 固定 `"gg_event"`（避免接到其他網站/外掛雜訊 message 時誤判）
- `player`: 玩家編號（目前先用 0；未來擴充 1、2...）
- `btnID`: 1~8
- `state`: `"down"` / `"up"`

### B. 簡化格式（目前已實作過，用於 terminal 輸出與測試）
```js
{ id: 5, s: "down" }
```

- `id` 等同 `btnID`
- `s` 等同 `state`

> 建議：對外通訊用 A（完整格式），terminal 顯示可用 B（簡化格式）。

---

## 03｜事件語意（down / up）

- `state: "down"`：按下（按住中）
- `state: "up"`：放開

### 重要行為規則（你今天確認的重點）
- 若 Agent 連續兩次 action 對應到同一個 btnID，且仍要保持按住：
- **不需要重複送 down/up**
- 等同「手沒有離開按鍵」
- 若 action 從 A 切到 B：
- 先把 A `up`
- 再把 B `down`
- 若 action 變成不動作（對應 btnID=0）：
- 把目前所有按著的鍵 `up`（或至少把上一個按鍵 up）

---

## 04｜iframe 傳送方式（GG 端）

### 送到遊戲 iframe（目標 window）
```js
const iframeWin = document.getElementById("game").contentWindow;

iframeWin.postMessage(
{ type:"gg_event", player:0, btnID:5, state:"down" },
"*"
);
```

> 現階段 targetOrigin 先用 `"*"` 方便開發；正式版建議改成白名單（例如 StrategySpace 網域）。

---

## 05｜遊戲端接收方式（SS 遊戲端）

```js
window.addEventListener("message", (ev) => {
const d = ev.data;

// 只處理 gg_event
if (!d || d.type !== "gg_event") return;

const { player, btnID, state } = d;

// TODO: 依 btnID/state 寫入自己的 input system（例如 keys{}）
});
```

### SS 的 getPM.html（monitor）規格（已實作）
- 只顯示 `type === "gg_event"` 的訊息
- 黃色字、靠右對齊（避開 GG 綠色 terminal）
- 類似 terminal 的逐行 append，不做精緻 UI

---

## 06｜為什麼要有 type:"gg_event"（你問過的點，今天結論）

即便「理論上遊戲只會收到 GG 的訊號」：
- 實際上頁面會收到各種 message（例如瀏覽器外掛、錢包、DevTools、其他 iframe）
- 所以仍建議加 `type` 做過濾，避免誤把雜訊當控制指令

（你在 getPM.html 看到一直有訊息，就是這類雜訊的典型例子。）

---

## 07｜版本備註

- 本文件整理的是「今天討論且已實作出來」的 GG 按鈕訊號協定
- 下一步（未做）：把 SS 主頁 Play 點擊後，回傳遊戲網址給 GG 的協定（屬於「載入協定」，不是按鈕控制協定）
