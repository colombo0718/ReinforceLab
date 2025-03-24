/***************************************************
 * [1] dqn 相關設定 (範例)
 ***************************************************/
 let dqnModel = null; // DQN 神經網路模型
 let targetModel = null; // 目標網路
 const replayBuffer = []; // 經驗回放緩衝區
 const bufferSize = 10000; // 緩衝區大小
 const batchSize = 64; // 批量訓練大小
 const syncTargetSteps = 100; // 目標網路同步頻率
 let stepCounter = 0; // 步數計數器

 function initializeDQNModel() {
    dqnModel = tf.sequential();
    dqnModel.add(tf.layers.dense({ units: 8, inputShape: [state_size], activation: 'relu' }));
    dqnModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    dqnModel.add(tf.layers.dense({ units: action_size, activation: 'linear' }));
    dqnModel.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    targetModel = tf.sequential();
    targetModel.add(tf.layers.dense({ units: 8, inputShape: [state_size], activation: 'relu' }));
    targetModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    targetModel.add(tf.layers.dense({ units: action_size, activation: 'linear' }));
    targetModel.setWeights(dqnModel.getWeights());
 }

function normalizeState(stateValues) {
  // console.log(stateValues)
  return stateValues.map((value, dim) => {
    // console.log(dim,stateInfo[dim])
    const min=stateInfo[dim].min
    const max=stateInfo[dim].max
    // const { min, max } = stateRange[dim];
    return (value - min) / (max - min); // 範圍 [0, 1]
  });
}

function addToBuffer(prevS, prevA, r, nextS, nextA) {
  if (replayBuffer.length >= bufferSize) replayBuffer.shift();
  replayBuffer.push([prevS, prevA, r, nextS, nextA]);
}

async function trainDQN() {
  if (replayBuffer.length < batchSize) return;
  stepCounter++;
  if (stepCounter % syncTargetSteps === 0) {
    targetModel.setWeights(dqnModel.getWeights());
  }

  const batch = replayBuffer.sort(() => 0.5 - Math.random()).slice(0, batchSize);
  const prevS_array = batch.map(s => normalizeState(s[0]));
  const nextS_array = batch.map(s => normalizeState(s[3]));
  const reward_array = batch.map(s => s[2]);
  const prevA_array = batch.map(s => s[1]);
  const nextA_array = batch.map(s => s[4]);

  const prevQ_Tensor = dqnModel.predict(tf.tensor2d(prevS_array));
  const nextQ_Tensor = targetModel.predict(tf.tensor2d(nextS_array));
  const prevQ_array = await prevQ_Tensor.array();
  const nextQ_array = await nextQ_Tensor.array();

  for (let i = 0; i < batchSize; i++) {
      const prevS = prevS_array[i];
      const prevA = prevA_array[i];
      const reward = reward_array[i];
      const nextS = nextS_array[i];
      const nextA = nextA_array[i];
      const nextQ = nextQ_array[i];
      const actualQNext = nextQ[nextA];
      const maxQNext = Math.max(...nextQ);
      const minQNext = Math.min(...nextQ);
      // const targetQ = (1 - Math.abs(Psi)) * actualQNext +
      //                 Math.max(0, Psi) * maxQNext +
      //                 Math.max(0, -Psi) * minQNext;
      const targetQ = maxQNext
      // const finalTarget = done ? reward : reward + Gamma * targetQ;

      if (isNaN(targetQ)) {
        console.error("Invalid target detected in DQN training.", {prevS, prevA, reward, nextS, nextA,targetQ});
        continue;
      }

      // 引入 Alpha 調整目標 Q 值
      const oldQ = prevQ_array[i][prevA];
      const updatedQ = oldQ + Alpha * (reward + Gamma * targetQ - oldQ); // 類似 Q-Table 的更新
      prevQ_array[i][prevA] = updatedQ;
  }

  await dqnModel.fit(tf.tensor2d(prevS_array), tf.tensor2d(prevQ_array), { batchSize, epochs: 1 });
  tf.dispose([prevQ_Tensor, nextQ_Tensor]);
}

function getQArrayFromDQNet(state) {
  const normalizedState = normalizeState(state);
  const stateTensor = tf.tensor2d([normalizedState]);
  const qValues = dqnModel.predict(stateTensor);
  const qArray = qValues.dataSync();
  tf.dispose([stateTensor, qValues]);
  return Array.from(qArray);
}


// 從 Q-table 的 key 反運算回真實 state
function getStateFromKey(key) {
  // 將 key 分解成桶索引陣列，例如 "0_1_2_3_4" -> [0, 1, 2, 3, 4]
  const indices = key.split("_").map(Number);

  // 計算每個維度的真實值
  const stateValues = indices.map((bucketIdx, dim) => {
    // 預設範圍
    let min = 0, max = 100;
    if (stateRange[dim]) {
      min = stateRange[dim].min;
      max = stateRange[dim].max;
    }
    // 計算桶大小
    const binSize = (max - min) / numBins[dim];
    // 計算該桶的中間值作為近似真實值
    const value = min + bucketIdx * binSize + binSize / 2;
    return value;
  });

  return stateValues;
}


async function DQNfitToQTable() {
  const batchSize = 32;
  const states = [];
  const targets = [];

  const qTableEntries = Object.entries(QTable);
  if (qTableEntries.length === 0) return;

  const tableLength = qTableEntries.length;
  const batch = qTableEntries.sort(() => 0.5 - Math.random()).slice(0, tableLength);

  for (let [key, qValue] of batch) {

    const state = getStateFromKey(key);
    states.push(state);
    targets.push(qValue);
  }

  const xs = tf.tensor2d(states);
  const ys = tf.tensor2d(targets);
  await dqnModel.fit(xs, ys, { epochs: 1, batchSize:tableLength});

  xs.dispose();
  ys.dispose();
}
