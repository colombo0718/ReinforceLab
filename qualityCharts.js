/***************************************************
 * [9] QTable Chart
 ***************************************************/








// 定義全局變數 gapMax
let focusState
let cutX=0,cutY=1

const gapMax = 10;


// 動作選擇熱力圖：下層動作色塊 + 上層白色遮罩
function generateActionHeatmap() {
  const numBinsX = numBins[0]; // X 軸 bins 數量
  const numBinsY = numBins[1]; // Y 軸 bins 數量
  const z = [], text = [];
  const xvals = [], yvals = [];

  // 生成 X 軸和 Y 軸的真實值
  for (let i = 0; i < numBinsX; i++) {
    const stateX = stateInfo[0].min + (i * (stateInfo[0].max - stateInfo[0].min) / numBinsX);
    xvals.push(stateX);
  }
  for (let j = 0; j < numBinsY; j++) {
    const stateY = stateInfo[1].min + (j * (stateInfo[1].max - stateInfo[1].min) / numBinsY);
    yvals.push(stateY);
  }

  // 生成狀態網格並計算最佳動作
  for (let j = 0; j < numBinsY; j++) {
    const row = [];
    const textRow = [];
    for (let i = 0; i < numBinsX; i++) {
      // 複製 focusState 作為基準狀態
      const state = [...focusState];
      // 使用真實值設置 state
      state[0] = xvals[i]; // 第一維
      state[1] = yvals[j]; // 第二維

      const qArr = evaluateQuality(state); // 獲取 Q 值數組
      const bestAction = qArr.indexOf(Math.max(...qArr)); // 找到最佳動作
      row.push(bestAction);
      textRow.push(`State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Best action: ${bestAction}`);
    }
    z.push(row);
    text.push(textRow);
  }

  const colorscale = generateDiscreteColorscale(action_size);

  // 下層動作熱力圖
  const lowerTrace = {
    x: xvals, // 使用真實的 X 軸值
    y: yvals, // 使用真實的 Y 軸值
    z: z,
    type: 'heatmap',
    colorscale: colorscale,
    hoverinfo: 'text',
    text: text
  };

  // 上層白色遮罩
  const overlayMatrix = generateWhiteOverlayMatrix();

  const upperTrace = {
    x: xvals, // 使用真實的 X 軸值
    y: yvals, // 使用真實的 Y 軸值
    z: overlayMatrix,
    type: 'heatmap',
    colorscale: [
      [0, 'rgba(255,255,255,0)'], // 透明
      [1, 'rgba(255,255,255,1)']  // 白色
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

// HSV 轉 RGB
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

// 生成白色遮罩矩陣
function generateWhiteOverlayMatrix() {
  const overlay = [];
  const numBinsX = numBins[0];
  const numBinsY = numBins[1];
  // focusState = stateInfo.map(info => info.min); // 初始化 focusState，所有維度設為 min

  for (let j = 0; j < numBinsY; j++) {
    const row = [];
    for (let i = 0; i < numBinsX; i++) {
      // 複製 focusState 作為基準狀態
      const state = [...focusState];
      // 修改第 0 維和第 1 維的值（切片）
      state[0] = stateInfo[0].min + (i * (stateInfo[0].max - stateInfo[0].min) / numBinsX); // 第一維
      state[1] = stateInfo[1].min + (j * (stateInfo[1].max - stateInfo[1].min) / numBinsY); // 第二維

      const qArr = evaluateQuality(state); // 獲取 Q 值數組
      const sorted = qArr.slice().sort((a, b) => b - a); // 降序排序
      const gap = sorted[0] - (sorted[1] ?? sorted[0]); // 最大 Q 值與次大 Q 值的差距
      const opacity = 1 - Math.min(gap / gapMax, 1); // 計算遮罩透明度
      row.push(opacity);
    }
    overlay.push(row);
  }
  return overlay;
}








// 最大 Q 值熱力圖：青→白→橘
function generateMaxQHeatmap() {
  const numBinsX = numBins[cutX]; // X 軸 bins 數量
  const numBinsY = numBins[cutY]; // Y 軸 bins 數量
  const xvals = [], yvals = [], zvals = [], texts = [];
  // focusState = stateInfo.map(info => info.min); // 初始化 focusState，所有維度設為 min

  // 生成狀態網格並計算最大 Q 值
  for (let i = 0; i < numBinsX; i++) {
    for (let j = 0; j < numBinsY; j++) {
      // 複製 focusState 作為基準狀態
      const state = [...focusState];
      // 修改第 0 維和第 1 維的值（切片）
      state[cutX] = stateInfo[cutX].min + (i * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX); // 第一維
      state[cutY] = stateInfo[cutY].min + (j * (stateInfo[cutY].max - stateInfo[cutY].min) / numBinsY); // 第二維

      const qArr = evaluateQuality(state); // 獲取 Q 值數組
      const maxQ = Math.max(...qArr); // 找到最大 Q 值

      xvals.push(state[cutX]);
      yvals.push(state[cutY]);
      zvals.push(maxQ);
      texts.push(`(i=${i}, j=${j})<br>State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Max Q: ${maxQ.toFixed(2)}`);
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
    text: texts,
    hoverinfo: 'text'
  };

  const layout = {
    title: '最大 Q 值熱力圖（青→白→橘）',
    xaxis: { title: 'State Dimension X' },
    yaxis: { title: 'State Dimension Y' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-maxi-value', [trace], layout);
}

// 最小 Q 值熱力圖：藍→白→紅
function generateMinQHeatmap() {
  const numBinsX = numBins[0]; // X 軸 bins 數量
  const numBinsY = numBins[1]; // Y 軸 bins 數量
  const xvals = [], yvals = [], zvals = [], texts = [];
  // focusState = stateInfo.map(info => info.min); // 初始化 focusState，所有維度設為 min

  // 生成狀態網格並計算最小 Q 值
  for (let i = 0; i < numBinsX; i++) {
    for (let j = 0; j < numBinsY; j++) {
      // 複製 focusState 作為基準狀態
      const state = [...focusState];
      // 修改第 0 維和第 1 維的值（切片）
      state[0] = stateInfo[0].min + (i * (stateInfo[0].max - stateInfo[0].min) / numBinsX); // 第一維
      state[1] = stateInfo[1].min + (j * (stateInfo[1].max - stateInfo[1].min) / numBinsY); // 第二維

      const qArr = evaluateQuality(state); // 獲取 Q 值數組
      const minQ = Math.min(...qArr); // 找到最小 Q 值

      xvals.push(state[0]);
      yvals.push(state[1]);
      zvals.push(minQ);
      texts.push(`(i=${i}, j=${j})<br>State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Min Q: ${minQ.toFixed(2)}`);
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

// // 初始繪圖
// generateActionHeatmap();
// generateMaxQHeatmap();
// generateMinQHeatmap();


// 每秒更新
setInterval(() => {
  if(!stateInfo){
    // 遊戲還沒載入完成
    return;
  }
  focusState = stateInfo.map(info => info.min)
  focusState=[...nextState]
  if (stateInfo.length < 2) {
    // 狀態維度小於 2，無法繪製二維熱力圖
    return;
  }
  if(plotQualityCharts){
    generateActionHeatmap();
    generateMaxQHeatmap();
    generateMinQHeatmap();
  }


}, 1000);

// Q表 1維切片摺線圖（每個action一條摺線）
function generateQLineSlice(dim0FixedIndex = 0, dim1FixedIndex = 0) {
  const data = [];
  const numBinsX = numBins[0]; // 第 0 維的 bins 數量

  // 獲取離散顏色標度
  const colorscale = generateDiscreteColorscale(action_size);
  const actionColors = colorscale.map(entry => entry[1]); // 提取顏色部分

  // 為每個動作生成摺線
  for (let action = 0; action < action_size; action++) {
    const xvals = [], yvals = [];

    // 沿第 0 維遍歷，其他維固定為 focusState 中的值
    for (let i = 0; i < numBinsX; i++) {
      // 複製 focusState 作為基準狀態
      const state = [...focusState];
      // 修改第 0 維的值
      state[0] = stateInfo[0].min + (i * (stateInfo[0].max - stateInfo[0].min) / numBinsX);

      // 使用 evaluateQuality 獲取 Q 值
      const qArray = evaluateQuality(state);
      xvals.push(i); // x 軸是第 0 維的索引
      yvals.push(qArray[action]); // y 軸是該動作的 Q 值
    }

    data.push({
      x: xvals,
      y: yvals,
      mode: 'lines+markers',
      type: 'scatter',
      name: `Action ${action}`,
      line: {
        shape: 'linear',
        color: actionColors[action] // 使用 generateDiscreteColorscale 的顏色
      },
      marker: { color: actionColors[action] } // 標記點也使用相同顏色
    });
  }

  const layout = {
    // title: `Q 值 1維切片摺線圖 (Dim 1 = ${focusState[1]?.toFixed(2) || 'N/A'})`,
    xaxis: { title: 'State Dimension 0' },
    yaxis: { title: 'Q Value' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-line-value', data, layout);
}

// Q表 0維切片柱狀圖（每個action一根柱子）
function generateQBarSlice(dim0FixedIndex = 0, dim1FixedIndex = 0) {
  const traces = [];

  // 使用 evaluateQuality 獲取 Q 值
  const qArr = evaluateQuality(focusState);
  // console.log(focusState)
  if (!qArr) {
    console.log("無法獲取 Q 值，切片無效。");
    return;
  }

  // 獲取離散顏色標度
  const colorscale = generateDiscreteColorscale(action_size);
  const actionColors = colorscale.map(entry => entry[1]); // 提取顏色部分

  // 為每個動作生成柱子
  for (let action = 0; action < action_size; action++) {
    const xvals = [action]; // x 軸是動作索引
    const yvals = [qArr[action]]; // y 軸是該動作的 Q 值

    traces.push({
      x: xvals,
      y: yvals,
      type: 'bar',
      name: `Action ${action}`,
      marker: { color: actionColors[action] } // 使用 generateDiscreteColorscale 的顏色
    });
  }

  const layout = {
    // title: `Q 值 0維切片柱狀圖 (Dim 0 = ${focusState[0].toFixed(2)}, Dim 1 = ${focusState[1]?.toFixed(2) || 'N/A'})`,
    xaxis: { title: 'Action' },
    yaxis: { title: 'Q Value' },
    barmode: 'group',
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-bars-value', traces, layout);
}
// 初始繪圖
const fixedDim0Index = 0; // 可調整
const fixedDim1Index = 0; // 可調整


// 每秒更新
setInterval(() => {
  if(plotQualityCharts){
    if(!stateInfo){
      // 遊戲還沒載入完成
      return;
    }
    generateQBarSlice(fixedDim1Index);
    if (stateInfo.length < 1) {
      // 狀態維度小於 2，無法繪製二維熱力圖
      return;
    }
    generateQLineSlice(fixedDim0Index);
  }
}, 1000);
