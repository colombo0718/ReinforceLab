// 向外傳遞訊息
function log(message) {
  self.postMessage({ type:'log', message });
}

log("Worker 已啟動");

importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.9.0/dist/tf.min.js');

const dqnModel = tf.sequential();
dqnModel.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [5] }));
dqnModel.add(tf.layers.dense({ units: 32, activation: 'relu' }));
dqnModel.add(tf.layers.dense({ units: 4 }));
dqnModel.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

let QTable = {};
let stateRange = [];
let numBins = [];

// 從主執行緒接收訊息
self.onmessage = async (event) => {
  const { type, data } = event.data;

  // 更新Q表內容
  if (type === 'updateQTable') {
    QTable = { ...QTable, ...data };
    log(QTable)
  } else if (type === 'updateStateInfo') {
    log(data)
    // 接收 stateRange 和 numBins
    stateRange = data.stateRange;
    numBins = data.numBins;
    // self.postMessage({ type: 'log', message: 'StateInfo 已更新' });
  } else if (type === 'fit') {
    await DQNfitToQTable();
    self.postMessage({ type: 'fitDone' });
  } else if (type === 'predict') {
    const state = data;
    const input = tf.tensor2d([state]);
    const qValues = dqnModel.predict(input).dataSync();
    input.dispose();
    self.postMessage({ type: 'predictResult', qValues: Array.from(qValues) });
  }
};

async function DQNfitToQTable() {
  const batchSize = 32;
  const states = [];
  const targets = [];

  const qTableEntries = Object.entries(QTable);
  if (qTableEntries.length === 0) return;

  const stateMap = new Map();
  for (let [key, qValue] of qTableEntries) {
    const keyParts = key.split("_");
    const stateKey = keyParts.slice(0, 5).join("_");
    const action = parseInt(keyParts[5]);

    if (!stateMap.has(stateKey)) {
      stateMap.set(stateKey, Array(4).fill(0));
    }
    const qValues = stateMap.get(stateKey);
    qValues[action] = qValue;
    stateMap.set(stateKey, qValues);
  }

  const stateEntries = Array.from(stateMap.entries());
  const sampleSize = Math.min(stateEntries.length, batchSize);
  const batch = stateEntries.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

  for (let [stateKey, qValues] of batch) {
    const state = getStateFromKey(stateKey);
    states.push(state);
    targets.push(qValues);
  }

  if (states.length === 0) return;

  const xs = tf.tensor2d(states);
  const ys = tf.tensor2d(targets);
  await dqnModel.fit(xs, ys, { epochs: 1, batchSize: Math.min(sampleSize, 32) });

  xs.dispose();
  ys.dispose();
}

function getStateFromKey(key) {
  const indices = key.split("_").map(Number);
  const stateValues = indices.map((bucketIdx, dim) => {
    let min = 0, max = 100;
    if (stateRange[dim]) {
      min = stateRange[dim].min;
      max = stateRange[dim].max;
    }
    const binSize = (max - min) / numBins[dim];
    return min + bucketIdx * binSize + binSize / 2;
  });
  return stateValues;
}

// setInterval(() => {
//   DQNfitToQTable();
// }, 5000);
