# RR 平台可控遊戲環境宣告與通訊協定

本文件是製作「可被 RR 平台控制的遊戲環境」的完整規格。
將本文件提供給 AI，即可產生符合 RR 平台標準的遊戲環境。

---

## 一、概念說明

RR 平台透過 `postMessage` 與嵌入的遊戲 iframe 雙向通訊。
遊戲開發者需實作兩個部分：

1. **環境宣告**（遊戲載入時）：告訴 RR「我的狀態空間和動作空間長什麼樣」
2. **訓練通訊**（遊戲運行中）：每一步交換狀態、獎勵與動作，並支援暫停、加速等控制指令

---

## 二、訊息流總覽

### 遊戲 → RR 平台

| type | 時機 | 用途 |
|------|------|------|
| `gameInfo` | 收到 `questInfo` 後立即回傳 | 宣告狀態空間與動作空間 |
| `reward_state` | 每執行一步後 | 回傳當前狀態與獎勵 |
| `endEpisode` | 回合結束時 | 通知 RR 統計數據並開啟下一回合 |

### RR 平台 → 遊戲

| type | 用途 |
|------|------|
| `questInfo` | 請求遊戲宣告環境資訊 |
| `action` | 傳送 Agent 決定的動作索引 |
| `pause` | 切換暫停 / 繼續（toggle） |
| `accel` | 切換加速 / 正常速度（toggle） |

---

## 三、環境宣告：`gameInfo` 格式

遊戲收到 `questInfo` 後，需回傳以下結構：

```json
{
  "type": "gameInfo",
  "players": [
    {
      "stateInfo": [
        { "name": "位置X", "min": 0, "max": 100, "bin": 20 },
        { "name": "位置Y", "min": 0, "max": 200, "bin": 10 }
      ],
      "actionInfo": [
        { "type": "switch", "level": 5, "name": ["停止", "前進", "後退", "左轉", "右轉"] }
      ]
    }
  ]
}
```

### `stateInfo` 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `name` | string | 狀態維度名稱（供人類閱讀） |
| `min` | number | 狀態最小值 |
| `max` | number | 狀態最大值 |
| `bin` | number | 離散化分桶數（Q-Table 使用；DQN 可省略） |

### `actionInfo` 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `type` | string | `"switch"`（離散動作）或 `"slider"`（連續動作） |
| `level` | number | `switch` 的選項數量 |
| `name` | array | `switch` 的各選項名稱（陣列），`name[0]` 通常為「不動作」 |
| `min` / `max` | number | `slider` 的數值範圍 |

> **建議**：最簡單的情況使用單一 `switch`，最適合 Q-Table 類算法（Q-Learning、DQN）。
> 多個 `switch` 或使用 `slider` 會讓動作空間快速擴大，需搭配策略梯度類算法。

### 多玩家範例

```json
{
  "type": "gameInfo",
  "players": [
    {
      "role": "attacker",
      "stateInfo": [
        { "name": "xPos", "min": 0, "max": 100, "bin": 10 }
      ],
      "actionInfo": [
        { "type": "switch", "level": 3, "name": ["待機", "前進", "後退"] }
      ]
    },
    {
      "role": "defender",
      "stateInfo": [
        { "name": "shieldLevel", "min": 0, "max": 5, "bin": 6 }
      ],
      "actionInfo": [
        { "type": "switch", "level": 2, "name": ["防禦", "反擊"] }
      ]
    }
  ]
}
```

---

## 四、訓練通訊

### 4-1. `reward_state`（遊戲 → RR，每步）

每執行一個動作後，回傳當前狀態與獎勵：

```json
{
  "type": "reward_state",
  "reward": 1.0,
  "state": [50, 150],
  "sessionId": 3
}
```

| 欄位 | 說明 |
|------|------|
| `reward` | 本步獲得的獎勵（正數、負數或 0） |
| `state` | 當前狀態數值陣列，順序對應 `stateInfo` |
| `sessionId` | 從 `questInfo` 取得，原封不動帶回（用於 RR 識別當前回合） |

### 4-2. `endEpisode`（遊戲 → RR，回合結束）

```json
{ "type": "endEpisode" }
```

回合結束條件（例如：到達終點、碰到障礙、超過步數上限）發生時送出。
RR 收到後會統計數據、重置計數，並自動送出下一步 `action` 啟動新回合。

### 4-3. `action`（RR → 遊戲，每步）

```json
{ "type": "action", "action": 2 }
```

`action` 為整數，對應 `actionInfo[0].name` 的索引。

### 4-4. `pause`（RR → 遊戲，toggle）

```json
{ "type": "pause" }
```

收到時切換暫停 / 繼續狀態。暫停期間不需回傳 `reward_state`。

### 4-5. `accel`（RR → 遊戲，toggle）

```json
{ "type": "accel" }
```

收到時切換加速 / 正常速度。加速模式建議以 5～10 倍速推演。
加速期間仍需維持正常的狀態更新與獎勵回傳。

---

## 五、最小可用實作模板

以下為一個最簡單的可被 RR 控制的遊戲環境骨架：

```javascript
let currentSessionId = 0;

window.addEventListener("message", (event) => {
  const msg = event.data;

  // 1. RR 請求環境資訊
  if (msg.type === "questInfo") {
    currentSessionId = msg.sessionId;
    window.parent.postMessage({
      type: "gameInfo",
      players: [{
        stateInfo: [
          { name: "狀態維度0", min: 0, max: 10, bin: 10 }
        ],
        actionInfo: [
          { type: "switch", level: 3, name: ["不動", "動作A", "動作B"] }
        ]
      }]
    }, "*");
  }

  // 2. RR 傳來動作
  if (msg.type === "action") {
    const action = msg.action; // 整數，對應動作索引

    // TODO: 執行動作，更新遊戲狀態
    const reward = 0;       // 計算本步獎勵
    const state = [0];      // 取得當前狀態

    // 回傳狀態與獎勵
    window.parent.postMessage({
      type: "reward_state",
      reward: reward,
      state: state,
      sessionId: currentSessionId
    }, "*");

    // 若回合結束
    const done = false; // TODO: 判斷終止條件
    if (done) {
      window.parent.postMessage({ type: "endEpisode" }, "*");
    }
  }

  // 3. 暫停控制
  if (msg.type === "pause") {
    // TODO: toggle 暫停狀態
  }

  // 4. 加速控制
  if (msg.type === "accel") {
    // TODO: toggle 加速狀態
  }
});
```

---

## 六、狀態離散化公式（供參考）

Q-Table 算法需要將連續狀態對應到整數索引：

```javascript
function getBucketIndex(value, min, max, bin) {
  const binSize = (max - min) / bin;
  const clipped = Math.max(min, Math.min(max, value));
  const idx = Math.floor((clipped - min) / binSize);
  return Math.min(Math.max(idx, 0), bin - 1);
}
```
