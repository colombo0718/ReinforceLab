/***************************************************
 * [5] Q-Learning 相關設定 (範例)
 ***************************************************/

let stateRange = [];
let numBins = [];

// 計算當下狀態對應到Q表的鍵值
function getStateKey(stateValues) {
  let indices = []; // 用於儲存每個維度的離散化索引
  // console.log(stateValues)
  // console.log(stateValues)
  stateValues.forEach((value,dim) => {
    const bucketIdx = getBucketIndex(value,dim);
    // 將索引加入陣列
    indices.push(bucketIdx);
  });
  // 索引轉成字串標籤
  return indices.join("_");
}

// 針對state其中一個數值，取得分桶編號
function getBucketIndex(value,dim){
    // 設定預設範圍
    let min = 0, max = 100;
    // 取得該狀態有效範圍
    if (stateRange[dim]) {
      min = stateRange[dim].min;
      max = stateRange[dim].max;
    }
    // 計算桶的大小
    let binSize = (max - min) / numBins[dim];
    // 限制值在範圍內
    let clipped = Math.max(min, Math.min(max, value));
    // 計算索引
    let idx = Math.floor((clipped - min) / binSize);
    // 確保索引在合法範圍內
    idx = Math.min(Math.max(idx, 0), numBins[dim] - 1);

    return idx;
}

    // 從 Q 表中取得當下狀態的動作價值陣列
    function getQArrayFromTable(state) {
      let stateKey=getStateKey(state)
      if (!QTable[stateKey]) {
        // console.warn(`QTable[${stateKey}] 未初始化，將自動初始化。`);
        QTable[stateKey] = Array(action_size).fill(0);
      }
      return QTable[stateKey];
    }

    // Q 值更新
    function qTableUpdate(prevS, prevA, reward, nextS, nextA) {
      // 獲取 Q 值陣列
      const prevQArray = getQArrayFromTable(prevS);
      const nextQArray = getQArrayFromTable(nextS);

      // 計算下一狀態的統計值
      const maxQNext = Math.max(...nextQArray);
      const minQNext = Math.min(...nextQArray);
      const actualQNext = nextQArray[nextA];


      // 根據 λ 的值計算目標 Q 值
      let targetQ = (1 - Math.abs(Psi)) * actualQNext +
                    Math.max(0, Psi) * maxQNext +
                    Math.max(0, -Psi) * minQNext;


      if (isNaN(targetQ)) {
        console.error("Invalid Q update detected.", { QTable,nextS ,actualQNext , maxQNext , minQNext});
        return; // 提前返回，避免更新
      }
      // 計算 Q 值更新
      let oldQ = prevQArray[prevA] || 0;
      let deltaQ = Alpha * (reward + Gamma * targetQ - oldQ);
      // if(Math.abs(deltaQ)<0.001){return;}
      // console.log(deltaQ)

      let newQ = oldQ + deltaQ

      if (isNaN(newQ)) {
        console.error("Invalid newQ detected.", { oldQ, Alpha, reward, Gamma, targetQ });
        return; // 提前返回
      }
      // 更新 Q 表
      // if(prevA==0){console.log(prevA,newQ)}
      if(deltaQ>0){
        console.log(prevS,newQ,targetQ,Gamma,Alpha,targetQ*Gamma*Alpha)
      }
      
      
      prevQArray[prevA] = newQ;
    }

    // 制定策略函數---------------------------------
    function eGreedyStrategy(qArray) {
      const strategy = new Array(action_size).fill(0); // 初始化策略機率陣列

      // 檢查 qArray 是否為零向量
      if (qArray.every(val => val === 0)) {
        strategy.fill(1 / action_size); // 全 0 時均等機率
        return strategy;
      }

      // ε-greedy 策略
      const elseProb = Epsilon / (action_size-1); // 其他動作的探索機率
      const bestProb = 1 - Epsilon; // 最佳動作的機率

      // 找到最大 Q 值的動作
      const maxQ = Math.max(...qArray);
      const bestAction = qArray.indexOf(maxQ);

      // 設置策略機率
      strategy.fill(elseProb); // 默認其他動作的探索機率
      strategy[bestAction] = bestProb; // 最大 Q 值的動作加權

      return strategy;
    }

    // 轉換 Epsilon 到 Tau
    function epsilonToTau(epsilon) {
      if (epsilon === 0) return 0.01; // 最小值，避免除以 0
      return 1 / (epsilon + 0.1) - 0.5; // 映射公式
    }

    function softmaxStrategy(qArray) {
      const tau = epsilonToTau(Epsilon);
      const expValues = qArray.map(q => Math.exp(q / tau));
      const sumExp = expValues.reduce((sum, val) => sum + val, 0);
      const strategy = expValues.map(exp => exp / sumExp); // 正規化為機率陣列

      return strategy;
    }

    function selectAction(strategy) {
      const rand = Math.random();
      let cumulativeProb = 0;

      for (let i = 0; i < strategy.length; i++) {
        cumulativeProb += strategy[i];
        if (rand <= cumulativeProb) {
          return i; // 根據機率分佈隨機選擇動作
        }
      }
      return 0; // 預防性返回最後一個動作
    }
