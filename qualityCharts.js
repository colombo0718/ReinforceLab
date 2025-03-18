/***************************************************
 * [9] QTable Chart
 ***************************************************/// 假設全域變數：
// numBins = [xBins, yBins]
// QTable 為物件，鍵為 `${i}_${j}`，值為 Q 值陣列
// gapMax 為你設定的最大 gap 值
gapMax =10


// 動作選擇熱力圖：下層動作色塊 + 上層白色遮罩
function generateActionHeatmap() {
  const z = [], text = [];

  for (let j = 0; j < numBins[1]; j++) {
    const row = [];
    const textRow = [];
    for (let i = 0; i < numBins[0]; i++) {
      const stateKey = `${i}_${j}`;
      const qArr = QTable[stateKey] || [0, 0];
      const bestAction = qArr.indexOf(Math.max(...qArr));
      row.push(bestAction);
      textRow.push(`State ${stateKey}<br>Best action: ${bestAction}`);
      // text.push(`State ${stateKey}<br>Best action: ${bestAction}`);
    }
    z.push(row);
    text.push(textRow);
  }

  const colorscale = generateDiscreteColorscale(action_size);

  const lowerTrace = {
    x: [...Array(numBins[0]).keys()],
    y: [...Array(numBins[1]).keys()],
    z: z,
    type: 'heatmap',
    colorscale: colorscale,
    // showscale: false,
    hoverinfo: 'text',
    text: text
  };

  const overlayMatrix = generateWhiteOverlayMatrix();

  const upperTrace = {
    x: [...Array(numBins[0]).keys()],
    y: [...Array(numBins[1]).keys()],
    z: overlayMatrix,
    type: 'heatmap',
    colorscale: [
      [0, 'rgba(255,255,255,0)'],
      [1, 'rgba(255,255,255,1)']
    ],
    zmin: 0,
    zmax: 1,
    showscale: false,
    hoverinfo: 'skip'
  };

  const layout = {
    title: '動作選擇熱力圖（含白色遮罩）',
    xaxis: { title: 'State Dimension X' },
    yaxis: { title: 'State Dimension Y' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-diff-value', [lowerTrace, upperTrace], layout);
}

// 生成離散色階（a0=黑色，剩下等分色環）
function generateDiscreteColorscale(actionSize) {
  const colorscale = [[0, 'black']];
  for (let i = 1; i < actionSize; i++) {
    const hue = ((i - 1) * 360 / (actionSize - 1)) % 360;
    const color = hsvToRgb(hue, 1, 1);
    colorscale.push([i / (actionSize - 1), color]);
  }
  return colorscale;
}

// HSV轉RGB
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  return `rgb(${r},${g},${b})`;
}

// 生成白色遮罩
function generateWhiteOverlayMatrix() {
  const overlay = [];
  for (let j = 0; j < numBins[1]; j++) {
    const row = [];
    for (let i = 0; i < numBins[0]; i++) {
      const stateKey = `${i}_${j}`;
      const qArr = QTable[stateKey] || [0, 0];
      const sorted = qArr.slice().sort((a, b) => b - a);
      const gap = sorted[0] - (sorted[1] ?? sorted[0]);
      const opacity = 1 - Math.min(gap / gapMax, 1);
      row.push(opacity);
    }
    overlay.push(row);
  }
  return overlay;
}



// 最大 Q 值熱力圖：藍→白→紅
function generateMaxQHeatmap() {
  const xvals = [], yvals = [], zvals = [], texts = [];

  // state key 再分離成 index array
  // if(currentState){
  //   console.log(getStateKey(currentState).split('_'))
  // }
  for (let i = 0; i < numBins[0]; i++) {
    for (let j = 0; j < numBins[1]; j++) {
      const stateKey = `${i}_${j}`;
      const qArr = QTable[stateKey] || [0];
      const maxQ = Math.max(...qArr);

      xvals.push(i);
      yvals.push(j);
      zvals.push(maxQ);
      texts.push(`(i=${i}, j=${j})<br>Max Q: ${maxQ.toFixed(2)}`);
    }
  }

  const trace = {
    x: xvals,
    y: yvals,
    z: zvals,
    type: 'heatmap',
    colorscale: [
      [0, 'cyan'],
      [0.5, 'white'],
      [1, 'orange']
    ],
    zmid: 0,
    // showscale: false,
    text: texts,
    hoverinfo: 'text'
  };

  const layout = {
    title: '最大 Q 值熱力圖（藍→白→紅）',
    xaxis: { title: 'State Dimension X' },
    yaxis: { title: 'State Dimension Y' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-maxi-value', [trace], layout);
}

// 最大 Q 值熱力圖：藍→白→紅
function generateMinQHeatmap() {
  const xvals = [], yvals = [], zvals = [], texts = [];

  for (let i = 0; i < numBins[0]; i++) {
    for (let j = 0; j < numBins[1]; j++) {
      const stateKey = `${i}_${j}`;
      const qArr = QTable[stateKey] || [0];
      const maxQ = Math.min(...qArr);

      xvals.push(i);
      yvals.push(j);
      zvals.push(maxQ);
      texts.push(`(i=${i}, j=${j})<br>Max Q: ${maxQ.toFixed(2)}`);
    }
  }

  const trace = {
    x: xvals,
    y: yvals,
    z: zvals,
    type: 'heatmap',
    colorscale: [
      [0, 'blue'],
      [0.5, 'white'],
      [1, 'red']
    ],
    zmid: 0,
    // showscale: false,
    text: texts,
    hoverinfo: 'text'
  };

  const layout = {
    title: '最小 Q 值熱力圖（藍→白→紅）',
    xaxis: { title: 'State Dimension X' },
    yaxis: { title: 'State Dimension Y' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-mini-value', [trace], layout);
}


// 初始繪圖
generateActionHeatmap();
generateMaxQHeatmap();
generateMinQHeatmap();


// 每秒更新
setInterval(() => {
  generateActionHeatmap();
  generateMaxQHeatmap();
  generateMinQHeatmap();

}, 1000);

// Q表 1維切片摺線圖（每個action一條摺線）
function generateQLineSlice(dim0FixedIndex = 0,dim1FixedIndex = 0) {
  const data = [];

  for (let action = 0; action < action_size; action++) {
    const xvals = [], yvals = [];

    // for (let i = 0; i < numBins[1]; i++) {
    //   const stateKey = `${i}_${dim1FixedIndex}`;
    //   const qArr = QTable[stateKey] || Array(action_size).fill(0);
    //   xvals.push(i);
    //   yvals.push(qArr[action]);
    // }

    // 沿第一維遍歷，其他維固定為 min
    for (let i = 0; i < numBins[0]; i++) {
      // 構建狀態數組
      const state = [
        stateInfo[0].min + (i * (stateInfo[0].max - stateInfo[0].min) / numBins[0]), // 第一維
        // ...stateInfo.slice(1).map(info => (info.min+info.max)/2) // 其他維固定為 min
        ...stateInfo.slice(1).map(info => info.min) // 其他維固定為 min
      ];


      // 使用 getQArray 獲取 Q 值
      const qArray = evaluateQuality(state);
      // console.log(state,qArray)
      xvals.push(i); // x 軸是第一維的索引
      yvals.push(qArray[action]); // y 軸是該動作的 Q 值
    }

    data.push({
      x: xvals,
      y: yvals,
      mode: 'lines+markers',
      type: 'scatter',
      name: `Action ${action}`,
      line: { shape: 'linear' }
    });
  }

  const layout = {
    title: `Q 值 1維切片摺線圖 (Dim0 = ${dim0FixedIndex})`,
    xaxis: { title: 'State Dimension Y' },
    yaxis: { title: 'Q Value' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-line-value', data, layout);
}

// Q表 0維切片柱狀圖（每個action一根柱子）
function generateQBarSlice(dim0FixedIndex = 0,dim1FixedIndex = 0) {
  const xvals = [], traces = [];

  for (let j = 0; j < numBins[0]; j++) {
    xvals.push(j);
  }
  if(!nextState){return}
  const qArr=evaluateQuality(nextState)
  for (let action = 0; action < action_size; action++) {
    const yvals = [];

    // for (let j = 0; j < numBins[0]; j++) {
      // const stateKey = `${dim0FixedIndex}_${dim1FixedIndex}`;
      // const qArr = QTable[stateKey] || Array(action_size).fill(0);

      yvals.push(qArr[action]);
    // }

    traces.push({
      x: xvals,
      y: yvals,
      type: 'bar',
      name: `Action ${action}`
    });
  }

  const layout = {
    title: `Q 值 0維切片柱狀圖 (Dim1 = ${dim1FixedIndex})`,
    xaxis: { title: 'State Dimension X' },
    yaxis: { title: 'Q Value' },
    barmode: 'group',
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-bars-value', traces, layout);
}

// 初始繪圖
const fixedDim0Index = 0; // 可調整
const fixedDim1Index = 0; // 可調整

generateQLineSlice(fixedDim0Index);
generateQBarSlice(fixedDim1Index);

// 每秒更新
setInterval(() => {
  generateQLineSlice(fixedDim0Index);
  generateQBarSlice(fixedDim1Index);
}, 1000);
