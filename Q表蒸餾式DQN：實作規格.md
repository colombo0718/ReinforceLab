# Q 表蒸餾式 DQN：RR 實作規格

本文件說明 Q 表蒸餾式 DQN 在 RR 平台中的具體實作方式。
設計動機與哲學見：[Q表蒸餾式DQN：設計心法.md](./Q表蒸餾式DQN：設計心法.md)

---

## 一、三種 State 表示與轉換

RR 中同一個遊戲狀態有三種表示形式：

| 形式 | 說明 | 範例（CartPole cartX） |
|------|------|----------------------|
| **原始值**（型態 1） | 遊戲端送來的物理數值 | `312.5` |
| **桶編號**（型態 2） | Q-Table 離散化後的整數索引 | `5`（共 10 桶） |
| **歸一化**（型態 3） | [-1, 1] 區間，神經網路輸入 | `0.1` |

### 轉換公式

#### 1 → 2（原始值 → 桶編號，Q-Table 用）
```javascript
// 現有函數，在 reinforceEngine.js
getBucketIndex(value, min, max, bin)
```

#### 1 → 3（原始值 → 歸一化，直接輸入神經網路用）
```javascript
function normalize(value, min, max) {
  const mid = (min + max) / 2;
  const half = (max - min) / 2;
  return Math.max(-1, Math.min(1, (value - mid) / half));
}
```

#### 2 → 3（桶編號 → 歸一化，Q-Table 蒸餾成訓練資料用）
```javascript
// 不需要 min/max，只需桶編號與桶數
function bucketToNorm(bucketIndex, numBins) {
  return (2 * bucketIndex + 1) / numBins - 1;
}
```

推導：桶 `i`（共 `N` 桶）的中心點在 [0,1] 空間是 `(i + 0.5) / N`，
映射到 [-1, 1]：`× 2 - 1` → `(2i + 1) / N - 1`

**2→3 是 Q-Table 蒸餾的關鍵路徑**，從 Q-Table key 直接產出神經網路訓練資料，不需要還原原始值。

---

## 二、整體架構

兩個系統從遊戲開始就**同時運行**，UI 切換只改變三件事（見下節）。

```
遊戲 iframe
 └─ reward_state { state, reward, done }
         ↓
    主執行緒（每步）
    ├─ 1. await evaluateQuality(nextState)
    │       ├─ Q-Table 模式 → getQArrayFromTable()（同步）
    │       └─ DQN   模式 → Worker predict（非同步）
    │              ↓ qArray（各動作 Q 值）
    ├─ 2. planningStrategy(qArray) → 機率分配 → 選動作（此層不隨模式改變）
    ├─ 3. qTableUpdate(... , qArray)   ← 把 qArray 傳入，
    │       Q-Table 模式：忽略 qArray，自己查 max Q(s')
    │       DQN   模式：用 max(qArray) 當 Bellman 的 max Q(s')
    ├─ 4. reward≠0 → learnFromTrace()
    │       各 trace 步的 nextState 同樣走 evaluateQuality（與當前模式一致）
    └─ 5. 送 action 給遊戲

    Worker（背景）
    ├─ 持有 Q-Table 副本（增量同步）
    ├─ 定期 DQNfitToQTable()：Q-Table → 訓練資料 → fit 神經網路
    └─ 回應 predict 請求
```

**關鍵：`evaluateQuality` 的結果 `qArray` 一魚兩吃：**
1. 拿來選動作（evaluateQuality 的原始用途）
2. 傳給 `qTableUpdate`，在 DQN 模式下作為 Bellman 更新的 `max Q(s')` 來源

不需要額外的 Worker 請求，沒有多餘的延遲。

---

## 三、Web Worker 通訊協定

### 主執行緒 → Worker

| type | payload | 時機 | 說明 |
|------|---------|------|------|
| `initModel` | `{ stateDim, actionCount }` | 收到 `gameInfo` 後 | 動態建立神經網路 |
| `updateStateInfo` | `{ stateRange, numBins }` | 收到 `gameInfo` 後 | 同步狀態空間定義 |
| `resetQTable` | — | `loadGame()` 換遊戲時 | 清空 Worker 的 Q-Table 副本 |
| `updateQTable` | `{ key: value, ... }` | fit 前全量同步 | 全量同步（非增量；陣列參考比較無意義） |
| `fit` | — | Qt 背景迴圈 / DQN 每回合末 | 觸發一次蒸餾訓練 |
| `predict` | `number[]`（原始物理值） | DQN 模式每步 | 傳入原始物理值，Worker 內部負責正規化 |
| `batchPredict` | `{ keys: string[] }` | 切換 DQN 繪製資料 / 每秒 / fitDone 後 | 對完整狀態空間做批量推論，供圖表用 |

### Worker → 主執行緒

| type | payload | 時機 | 說明 |
|------|---------|------|------|
| `log` | `{ message }` | 任何時候 | debug 用 |
| `ready` | — | `initModel` 完成後 | 模型就緒通知 |
| `predictResult` | `{ qValues: number[] }` | 回應 `predict` | 各動作 Q 值 |
| `fitDone` | `{ loss }` | 一次 fit 完成後（含 skip） | 附上 loss；skip 時 loss=null；必定送出以 resolve Promise |
| `batchPredictResult` | `{ results: { key: number[] } }` | 回應 `batchPredict` | 整個狀態空間的 Q 值預測，存入 `dqnPreviewTable` |

---

## 四、Worker 內部函數規劃

**封裝原則：主執行緒只傳原始物理值，所有正規化在 Worker 內部完成，外部不感知。**
（就像晶片封裝後對外只有接腳，內部金線如何連接是實作細節。）

| 函數 | 現況 | 說明 |
|------|------|------|
| `initModel(stateDim, actionCount)` | ❌ 待實作 | 動態建立 TF 模型，取代 hardcode |
| `normalizeState(rawState)` | ❌ 待加入 | 原始值 → [-1,1]，依 stateRange（型態 1→3） |
| `bucketToNorm(i, N)` | ❌ 待加入 | 桶編號 → [-1,1]（型態 2→3，蒸餾訓練用） |
| `getStateFromKey(key)` | ✅ 在，需簡化 | 改用 bucketToNorm，不再還原原始值 |
| `DQNfitToQTable()` | ✅ 骨架在，需修改 | 從 Q-Table key 萃取訓練資料，fit 神經網路 |

### `initModel` 實作方向
```javascript
let model = null;
let numActions = 0;

function initModel(stateDim, actionCount) {
  if (model) model.dispose();
  numActions = actionCount;
  model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [stateDim] }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: actionCount }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
}
```

### `getStateFromKey` 簡化方向
```javascript
function getStateFromKey(key) {
  return key.split('_').map((i, dim) =>
    bucketToNorm(Number(i), numBins[dim])
  );
}
```

---

## 五、主執行緒需補的邏輯

### 5-1. gameInfo 收到後初始化 Worker
```javascript
// 現有的 syncStateInfoToWorker() 之後，補上：
dqnWorker.postMessage({
  type: 'initModel',
  stateDim: stateRange.length,
  actionCount: actionInfo[0].level,
});
```

### 5-2. UI 切換控制的三件事

UI 切換的是**價值評估來源**（產出 qArray），動作選擇永遠是根據 qArray 的機率分配執行（ε-greedy 或 Softmax），不隨模式改變。

| 切換項目 | Q-Table 模式 | DQN 模式 |
|----------|-------------|---------|
| **價值評估**（產出 qArray） | `getQArrayFromTable(state)` | Worker `predict(state)` |
| 動作選擇 | qArray → planningStrategy → action | 同左，不變 |
| Q-Table Bellman 更新的 `max Q(s')` | Q-Table 自己查 | 用已取得的 `qArray` |
| Trace 回放的 `max Q(s')` | Q-Table 自己查 | 同樣呼叫 `evaluateQuality`（與當前模式一致） |
| **NN fit 時機** | 背景持續迴圈（不阻塞遊戲） | 每回合結束 `await fit`（復盤） |
| **遊戲暫停時 NN** | 背景迴圈繼續，不受影響 | 啟動追趕蒸餾，直到恢復 |

**熱力圖繪製資料** 是**獨立於演算法的選擇**（分析頁的「繪製資料」radio）：

| 繪製資料選項 | 說明 |
|------------|------|
| 價值表格（Q-Table） | 直接查 `QTable`，只有探索過的格子有值 |
| 價值網路（DQN） | 查 `dqnPreviewTable`（batchPredict 快取），覆蓋整個狀態空間 |

兩個選項與演算法無關，可以任意組合。

Trace 回放在 DQN 模式下對每個 nextState 各自呼叫 `evaluateQuality`，因為 trace 觸發時 Worker 沒有在 fit（fit 只在局間），可以快速處理多次 predict。

### 5-3. evaluateQuality() 分流
```javascript
function evaluateQuality(state) {
  if (currentAlgorithm === 'DQN') {
    return new Promise((resolve) => {
      pendingPredictResolve = resolve;
      dqnWorker.postMessage({ type: 'predict', data: state });
    });
  }
  return Promise.resolve(getQArrayFromTable(state));
}
```

> 注意：改成 async 後，主訓練迴圈的 `evaluateQuality` 呼叫處也需要加 `await`。

### 5-4. qTableUpdate 修改：接受外部 nextQArray，並加入 dqnFitted 門檻

DQN 剛初始化時權重是亂數（為了打破對稱性，讓訓練能展開），此時估值無意義。
**至少等 DQN 完成第一次 fit 之後，才讓 Q-Table 採用它的估值。**

```javascript
let dqnFitted = false;  // 換遊戲或載入新遊戲時重置

// fitDone 收到時：
pendingFitResolve();
dqnFitted = true;       // 第一次 fit 完成，DQN 開始被信任

// qTableUpdate：
function qTableUpdate(prevState, prevAction, reward, nextState, nextAction, nextQArray = null) {
  const useDQN = currentAlgorithm === 'DQN' && dqnFitted && nextQArray !== null;
  const maxNextQ = useDQN
    ? Math.max(...nextQArray)                     // DQN fit 過了，用泛化估值
    : Math.max(...getQArrayFromTable(nextState));  // 還沒 fit，用 Q-Table 自己

  const key = getStateKey(prevState) + '_' + prevAction;
  const oldQ = QTable[key] ?? Psi;
  QTable[key] = oldQ + Alpha * (reward + Gamma * maxNextQ - oldQ);
}
```

主迴圈呼叫方式：
```javascript
const qArray = await evaluateQuality(nextState);  // 一魚兩吃
const strategy = planningStrategy(qArray);
const nextAction = selectAction(strategy);
qTableUpdate(prevState, prevAction, reward, nextState, nextAction, qArray);
```

`dqnFitted` 在 `loadGame()` 時連同 `QTable`、`dqnWorker resetQTable` 一起重置。

### 5-5. Fit 觸發時機

兩種演算法的 fit 策略完全不同：

#### Qt 模式：背景持續迴圈

啟動後永遠在跑，不受遊戲暫停影響，fit 完馬上下一輪：

```javascript
async function runQtDistillationLoop() {
  while (true) {
    if (currentAlgorithm !== 'DQN' && !fitInProgress && Object.keys(QTable).length > 0) {
      fitInProgress = true;
      syncQTableToWorker();
      await requestFit();  // fitDone handler 會重置 fitInProgress
    } else {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}
runQtDistillationLoop();  // 頁面載入後立即啟動
```

#### DQN 模式：每回合末復盤

回合結束後 `await fit`，fit 完才送下一局第一個 action（確保下一局的 predict 用的是最新的 NN）：

```javascript
if (currentAlgorithm === 'DQN') {
  syncQTableToWorker();
  fitInProgress = true;
  await requestFit();
}
```

#### 暫停期間

- **Qt 模式**：背景迴圈本來就不理暫停，自動持續
- **DQN 模式**：暫停時啟動 `runPausedDistillation()`，一輪接一輪直到恢復

**重要：`fitDone` 必定送出**（含 skip 情況），否則 `await requestFit()` 永遠 pending。
Worker 的所有 early return 路徑都補上 `postMessage({ type: 'fitDone', loss: null })`。

---

## 六、實作狀態

**Worker 端**
- [x] `initModel(stateDim, actionCount)`：動態建立三層 FC 網路，換遊戲時 dispose 重建
- [x] `normalizeState(rawState)`：原始值 → [-1,1]，predict 用
- [x] `bucketToNorm(i, N)` + `getStateFromKey(key)`：Q-Table key → 訓練輸入
- [x] `DQNfitToQTable()`：全量資料（非取樣），相對收斂停止（patience=3, relThreshold=1%, maxEpochs=100）
- [x] 所有 early return 路徑補送 `fitDone`，防止主執行緒 Promise 永遠 pending
- [x] `batchPredict`：對所有傳入 key 做批量推論，一次 forward pass 回傳整張結果

**主執行緒**
- [x] `loadGame()` 重置 `dqnFitted = false`、`fitInProgress = false`，發 `resetQTable` + `initModel` + `updateStateInfo`
- [x] `evaluateQuality()` async，DQN 模式走 Worker predict，dqnFitted 前退回 Q-Table
- [x] 主迴圈 `await evaluateQuality()`，qArray 傳入 `qTableUpdate` 和 `learnFromTrace`
- [x] `qTableUpdate` 接受 `nextQArray`，DQN 模式 + dqnFitted → 用 max(nextQArray) 做 Bellman
- [x] Qt 模式背景持續蒸餾迴圈（不阻塞遊戲，不因暫停停止）
- [x] DQN 模式每回合末 `await requestFit()`（復盤語義）
- [x] 暫停時 DQN 模式自動追趕蒸餾

**繪製資料（分析頁）**
- [x] `chartDataSource` 獨立切換（'qtable' / 'dqn'），與演算法無關
- [x] `getQArrayForChart()` 根據 chartDataSource 決定來源
- [x] `requestBatchPredict()` 傳完整狀態空間 key（笛卡兒積），非只有已探索格子
- [x] DQN 繪製模式每秒觸發 batchPredict，fitDone 後也立即刷新

**待實作**
- [ ] fit loss 曲線 UI（fitDone 回傳的 loss 逐輪記錄並顯示）
- [ ] dqnFitted 狀態顯示（讓使用者知道 NN 是否已可信任）
