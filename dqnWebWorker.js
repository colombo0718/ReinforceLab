importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.9.0/dist/tf.min.js');

const dqnModel = tf.sequential();
dqnModel.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [5] }));
dqnModel.add(tf.layers.dense({ units: 32, activation: 'relu' }));
dqnModel.add(tf.layers.dense({ units: 4 }));
dqnModel.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

let QTable = {};

self.onmessage = async (event) => {
  const { type, data } = event.data;

  if (type === 'updateQTable') {
    QTable = { ...QTable, ...data };
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

const stateRange = [
  { min: -200, max: 200 },
  { min: -300, max: 300 },
  { min: -200, max: 200 },
  { min: -200, max: 200 },
  { min: -300, max: 300 }
];
const numBins = [10, 10, 10, 10, 10];

setInterval(() => {
  DQNfitToQTable();
}, 5000);
