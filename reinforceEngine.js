/***************************************************
 * reinforceEngine.js — Q-Learning 核心引擎
 *
 * 依賴 index.html 提供的全局變數：
 *   QTable, Alpha, Gamma, Epsilon, Psi, action_size
 *   stateRange, numBins（由 gameInfo 填入）
 ***************************************************/


/***************************************************
 * [A] 狀態離散化（State Discretization）
 *
 * 連續狀態空間 → 離散桶編號 → Q-Table key
 *
 * stateRange：每個維度的 [min, max]，由 gameInfo 填入
 * numBins：每個維度的桶數，由 gameInfo 填入（預設 20）
 *
 * getStateKey([v0, v1, ...]) → "b0_b1_..."
 *   對每個維度呼叫 getBucketIndex，結果用 "_" 串接成字串 key
 *
 * getBucketIndex(value, dim) → 桶編號（0 ~ numBins[dim]-1）
 *   等寬離散化：binSize = (max-min) / N，超出範圍的值 clip 到邊界桶
 ***************************************************/
let stateRange = [];
let numBins    = [];

function getStateKey(stateValues) {
  return stateValues.map((value, dim) => getBucketIndex(value, dim)).join("_");
}

function getBucketIndex(value, dim) {
  let min = 0, max = 100; // 預設範圍（正常情況下由 stateRange 覆蓋）
  if (stateRange[dim]) {
    min = stateRange[dim].min;
    max = stateRange[dim].max;
  }

  const binSize = (max - min) / numBins[dim];
  const clipped = Math.max(min, Math.min(max, value)); // clip 到有效範圍
  let idx = Math.floor((clipped - min) / binSize);
  idx = Math.min(Math.max(idx, 0), numBins[dim] - 1);  // 防邊界（value===max 時 idx===N）

  return idx;
}


/***************************************************
 * [B] Q-Table 查詢與更新
 *
 * getQArrayFromTable(state) → [q0, q1, ...]
 *   查詢（或初始化）某狀態對應的 Q 值陣列
 *   首次存取時以 0 填充（未使用樂觀初始化）
 *
 * qTableUpdate(prevS, prevA, reward, nextS, nextA)
 *   Bellman 更新：Q(s,a) ← Q(s,a) + α [r + γ·targetQ - Q(s,a)]
 *
 *   targetQ 由 Psi 控制混合比例：
 *     Psi =  0 → targetQ = actualQNext  → SARSA（跟隨實際下一步動作）
 *     Psi =  1 → targetQ = maxQNext     → Q-Learning（取下一狀態最大值）
 *     Psi = -1 → targetQ = minQNext     → 悲觀策略（取下一狀態最小值）
 *     中間值   → 三者的線性混合
 *
 *   公式：targetQ = (1-|Psi|)·actual + max(0,Psi)·max + max(0,-Psi)·min
 ***************************************************/
function getQArrayFromTable(state) {
  const stateKey = getStateKey(state);
  if (!QTable[stateKey]) {
    QTable[stateKey] = Array(action_size).fill(0);
  }
  return QTable[stateKey];
}

function qTableUpdate(prevS, prevA, reward, nextS, nextA) {
  const prevQArray  = getQArrayFromTable(prevS);
  const nextQArray  = getQArrayFromTable(nextS);

  const maxQNext    = Math.max(...nextQArray);
  const minQNext    = Math.min(...nextQArray);
  const actualQNext = nextQArray[nextA];

  // Psi 混合公式（詳見上方說明）
  const targetQ = (1 - Math.abs(Psi)) * actualQNext +
                  Math.max(0,  Psi)   * maxQNext    +
                  Math.max(0, -Psi)   * minQNext;

  if (isNaN(targetQ)) {
    console.error("Invalid Q update detected.", { nextS, actualQNext, maxQNext, minQNext });
    return;
  }

  const oldQ  = prevQArray[prevA] || 0;
  const newQ  = oldQ + Alpha * (reward + Gamma * targetQ - oldQ);

  if (isNaN(newQ)) {
    console.error("Invalid newQ detected.", { oldQ, Alpha, reward, Gamma, targetQ });
    return;
  }

  prevQArray[prevA] = newQ;
}


/***************************************************
 * [C] 探索策略
 *
 * eGreedyStrategy(qArray) → strategy（機率陣列）
 *   全零時：均等機率（冷啟動）
 *   否則：最佳動作機率 = 1-ε，其餘各分 ε/(N-1)
 *   ⚠ 多個動作 Q 值相同時，只選 indexOf 找到的第一個（無打平機制）
 *
 * softmaxStrategy(qArray) → strategy
 *   Boltzmann 探索：P(a) = exp(Q(a)/τ) / Σexp(Q(i)/τ)
 *   τ（temperature）由 epsilonToTau(Epsilon) 換算
 *
 * epsilonToTau(epsilon) → τ
 *   ⚠ 注意：此公式單調遞減，epsilon 越大 τ 越小（越貪婪）
 *   與 ε-greedy 的方向相反（ε 大 → 探索強 → τ 應該大）
 *   若 ε 和 softmax 同時使用，此換算邏輯需重新確認
 *
 * selectAction(strategy) → actionIndex
 *   根據機率分布抽樣（輪盤法）
 ***************************************************/
function eGreedyStrategy(qArray) {
  const strategy = new Array(action_size).fill(0);

  // 全零向量（冷啟動或未探索）→ 均等機率
  if (qArray.every(val => val === 0)) {
    strategy.fill(1 / action_size);
    return strategy;
  }

  const maxQ       = Math.max(...qArray);
  const bestAction = qArray.indexOf(maxQ); // 最大值的第一個動作

  const bestProb = 1 - Epsilon;
  const elseProb = Epsilon / (action_size - 1);

  strategy.fill(elseProb);
  strategy[bestAction] = bestProb;

  return strategy;
}

// ⚠ 此公式為單調遞減（epsilon↑ → tau↓），與直覺相反，待確認
function epsilonToTau(epsilon) {
  if (epsilon === 0) return 0.01; // 避免後續除以極小值
  return 1 / (epsilon + 0.1) - 0.5;
}

function softmaxStrategy(qArray) {
  const tau      = epsilonToTau(Epsilon);
  const expValues = qArray.map(q => Math.exp(q / tau));
  const sumExp   = expValues.reduce((sum, val) => sum + val, 0);
  return expValues.map(exp => exp / sumExp);
}

function selectAction(strategy) {
  const rand = Math.random();
  let cumulativeProb = 0;

  for (let i = 0; i < strategy.length; i++) {
    cumulativeProb += strategy[i];
    if (rand <= cumulativeProb) return i;
  }

  // 浮點誤差導致 cumulativeProb 略小於 1 時的保底，回傳最後一個動作
  return strategy.length - 1;
}
