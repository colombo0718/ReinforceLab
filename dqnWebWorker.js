/***************************************************
 * dqnWebWorker.js — DQN 神經網路 Web Worker
 *
 * 在獨立執行緒中持有 Q-Table 副本，定期 fit 神經網路（Q-Table 蒸餾），
 * 並在 DQN 模式下回應主執行緒的 predict 請求。
 *
 * 訊息協定（完整規格見「Q表蒸餾式DQN：實作規格.md」）：
 *
 *   主→Worker：
 *     initModel      { stateDim, actionCount }  → 建立（或重建）神經網路
 *     updateStateInfo { stateRange, numBins }    → 同步狀態空間定義
 *     updateQTable   { key: [q0,q1,...], ... }   → 增量更新 Q-Table 副本
 *     resetQTable    —                           → 清空 Q-Table 副本與 fit 歷史
 *     fit            —                           → 執行一次蒸餾訓練
 *     predict        number[]（原始物理值）       → 回傳各動作 Q 值估計
 *
 *   Worker→主：
 *     log            { message }                 → debug 訊息
 *     ready          —                           → initModel 完成
 *     fitDone        { loss }                    → 一次 fit 結束，附上最終 loss
 *     predictResult  { qValues: number[] }       → predict 結果
 ***************************************************/

function log(message) {
  self.postMessage({ type: 'log', message });
}

log("Worker 已啟動，等待 initModel...");

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.9.0/dist/tf.min.js');


/***************************************************
 * [A] 狀態變數
 ***************************************************/
let model      = null;   // TF 神經網路，initModel 後才建立
let numActions = 0;      // 動作數量（輸出維度）
let stateDim   = 0;      // 狀態維度（輸入維度）

let QTable     = {};     // Q-Table 副本，格式：{ stateKey: [q0, q1, ...] }
let stateRange = [];     // 各維度 { min, max }，由 updateStateInfo 填入
let numBins    = [];     // 各維度桶數，由 updateStateInfo 填入


/***************************************************
 * [B] State 表示轉換
 *
 * 三種型態（詳見實作規格）：
 *   型態 1：原始物理值（主執行緒送來）
 *   型態 2：桶編號（Q-Table key 的每個維度）
 *   型態 3：[-1, 1] 歸一化（神經網路輸入）
 *
 * bucketToNorm(idx, N)  — 型態 2 → 3
 *   桶 i（共 N 桶）的中心映射到 [-1, 1]
 *   公式：(2i + 1) / N - 1
 *
 * normalizeState(rawState) — 型態 1 → 3
 *   依 stateRange 線性壓縮到 [-1, 1]
 *
 * getStateFromKey(key) — 型態 2 → 3（蒸餾訓練用）
 *   從 Q-Table key（"b0_b1_..."）直接產出神經網路輸入
 *   不需要還原原始物理值
 ***************************************************/
function bucketToNorm(idx, N) {
  return (2 * idx + 1) / N - 1;
}

function normalizeState(rawState) {
  return rawState.map((value, dim) => {
    if (!stateRange[dim]) return 0;
    const { min, max } = stateRange[dim];
    const mid  = (min + max) / 2;
    const half = (max - min) / 2;
    return Math.max(-1, Math.min(1, (value - mid) / half));
  });
}

function getStateFromKey(key) {
  return key.split('_').map((idx, dim) => bucketToNorm(Number(idx), numBins[dim]));
}


/***************************************************
 * [C] 模型建立（initModel）
 * 動態建立三層全連接網路：64 → 32 → numActions
 * 若已有舊模型先 dispose 釋放記憶體
 ***************************************************/
function initModel(sDim, aCount) {
  if (model) model.dispose();
  stateDim   = sDim;
  numActions = aCount;

  model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [stateDim] }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: numActions }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

  log(`模型已建立：stateDim=${stateDim}, numActions=${numActions}`);
  self.postMessage({ type: 'ready' });
}


/***************************************************
 * [D] Q-Table 蒸餾訓練（DQNfitToQTable）
 *
 * 從 Worker 持有的 Q-Table 副本萃取訓練資料：
 *   input  = getStateFromKey(stateKey)  — 桶編號 → [-1,1]（型態 2→3）
 *   target = Q-Table[stateKey]          — 各動作 Q 值陣列
 *
 * 隨機取樣最多 batchSize 筆已探索格子，fit 5 個 epoch
 * fitDone 附上最終 loss 供主執行緒顯示
 *
 * Q-Table 格式說明：
 *   { "b0_b1_..._bN": [q0, q1, ..., q(M-1)] }
 *   key  = 各維度桶編號以 "_" 串接（與主執行緒 getStateKey 相同）
 *   value = 長度為 numActions 的 Q 值陣列
 ***************************************************/
async function DQNfitToQTable() {
  if (!model) { log("fit 跳過：模型尚未初始化"); self.postMessage({ type: 'fitDone', loss: null }); return; }

  const entries = Object.entries(QTable);
  if (entries.length === 0) { log("fit 跳過：Q-Table 為空"); self.postMessage({ type: 'fitDone', loss: null }); return; }

  // 全量資料（不再隨機取樣，確保網路學到整張表）
  const states  = [];
  const targets = [];
  for (const [stateKey, qValues] of entries) {
    if (!Array.isArray(qValues) || qValues.length !== numActions) continue;
    const stateVec = getStateFromKey(stateKey);
    if (stateVec.length !== stateDim) continue;
    states.push(stateVec);
    targets.push(qValues);
  }

  if (states.length === 0) { log("fit 跳過：無有效訓練資料"); self.postMessage({ type: 'fitDone', loss: null }); return; }

  const xs        = tf.tensor2d(states);
  const ys        = tf.tensor2d(targets);
  const batchSize = Math.min(states.length, 32);

  // 相對收斂停止：連續 patience 次 epoch 相對改善 < relThreshold → 停
  // 上限 maxEpochs 防止極端情況跑太久
  const maxEpochs    = 100;
  const relThreshold = 0.01;  // 1% 相對改善門檻
  const patience     = 3;     // 連續幾次低於門檻才停
  let prevLoss    = Infinity;
  let stableCount = 0;
  let finalLoss   = 0;

  for (let epoch = 0; epoch < maxEpochs; epoch++) {
    const result = await model.fit(xs, ys, { epochs: 1, batchSize, verbose: 0 });
    finalLoss = result.history.loss[0];

    const relImprovement = (prevLoss - finalLoss) / (prevLoss + 1e-8);
    if (relImprovement < relThreshold) {
      stableCount++;
      if (stableCount >= patience) break;
    } else {
      stableCount = 0;
    }
    prevLoss = finalLoss;
  }

  xs.dispose();
  ys.dispose();

  log(`fit 完成，loss=${finalLoss?.toFixed(4)}，訓練筆數=${states.length}`);
  self.postMessage({ type: 'fitDone', loss: finalLoss });
}


/***************************************************
 * [E] 訊息處理器
 ***************************************************/
self.onmessage = async (event) => {
  const { type, data } = event.data;

  switch (type) {

    case 'initModel':
      // 建立神經網路（換遊戲時也會重新呼叫）
      initModel(event.data.stateDim, event.data.actionCount);
      break;

    case 'updateStateInfo':
      // 同步狀態空間定義（供 normalizeState / getStateFromKey 使用）
      stateRange = data.stateRange;
      numBins    = data.numBins;
      log(`stateRange / numBins 已更新，維度=${numBins.length}`);
      break;

    case 'updateQTable':
      // 增量合併（data 格式與主執行緒 QTable 相同：stateKey → [q0,q1,...] ）
      QTable = { ...QTable, ...data };
      break;

    case 'resetQTable':
      // 換遊戲時清空副本
      QTable = {};
      log("Q-Table 副本已清空");
      break;

    case 'fit':
      // 執行一次蒸餾訓練（主執行緒在 episode 結束後呼叫，await fitDone 再開下一局）
      // try-catch 保底：initModel 在 fit await 期間可能 dispose 舊 model 導致例外，
      // 若不補送 fitDone，主執行緒的 requestFit() Promise 會永遠 pending
      try {
        await DQNfitToQTable();
      } catch (e) {
        log(`fit 異常中止：${e.message}`);
        self.postMessage({ type: 'fitDone', loss: null });
      }
      break;

    case 'predict':
      // 主執行緒傳入原始物理值，Worker 內部正規化後推論
      if (!model) {
        self.postMessage({ type: 'predictResult', qValues: Array(numActions).fill(0) });
        break;
      }
      const normalized = normalizeState(data);
      const input      = tf.tensor2d([normalized]);
      const qValues    = model.predict(input).dataSync();
      input.dispose();
      self.postMessage({ type: 'predictResult', qValues: Array.from(qValues) });
      break;

    case 'batchPredict': {
      // 對主執行緒傳來的所有 Q-Table key 做一次批量推論，供圖表視覺化使用
      if (!model) { self.postMessage({ type: 'batchPredictResult', results: {} }); break; }
      const keys      = event.data.keys.filter(k => getStateFromKey(k).length === stateDim);
      const results   = {};
      if (keys.length > 0) {
        const stateVecs = keys.map(k => getStateFromKey(k));
        const batchIn   = tf.tensor2d(stateVecs);
        const batchOut  = model.predict(batchIn);
        const allQ      = batchOut.arraySync();
        batchIn.dispose();
        batchOut.dispose();
        keys.forEach((k, i) => { results[k] = allQ[i]; });
      }
      self.postMessage({ type: 'batchPredictResult', results });
      break;
    }

    default:
      log(`未知訊息 type：${type}`);
  }
};
