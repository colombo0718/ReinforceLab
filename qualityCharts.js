/***************************************************
 * qualityCharts.js — Q-Table 分析圖表
 *
 * 負責六種分析視覺化的生成與定時更新：
 *   動作色環        (p1-acti-color)   — CSS + DOM
 *   動作選擇熱力圖  (p1-diff-value)   — 最佳動作 + 確信度遮罩
 *   動作價值柱狀圖  (p1-bars-value)   — 當前 focusState 各動作 Q 值
 *   狀態價值折線圖  (p1-line-value)   — 沿 cutX 掃描的 Q 值切片
 *   最大 Q 值熱力圖 (p1-maxi-value)   — max Q over cutX × cutY
 *   最小 Q 值熱力圖 (p1-mini-value)   — min Q over cutX × cutY
 *
 * 依賴 index.html 提供的全局變數：
 *   stateInfo, numBins, action_size
 *   getQArrayFromTable(), plotQualityCharts, nextState
 ***************************************************/


/***************************************************
 * [A] 全局控制變數
 *
 * focusState：觀測基準點，熱力圖掃描時其他維度固定在此值
 *   tracking 開啟 → 每秒跟隨 nextState（Agent 當前狀態）
 *   tracking 關閉 → 由 dim0/1/2 滑桿控制
 *
 * cutX, cutY：熱力圖與折線圖的掃描維度（由 x-axis/y-axis select 決定）
 *
 * gapMax：確信度遮罩的基準差距
 *   最佳與次佳 Q 值差距 >= gapMax → 遮罩透明（動作確定）
 *   差距 = 0 → 遮罩全白（各動作無差異）
 ***************************************************/
let focusState;
let cutX = 0, cutY = 1;
const gapMax = 10;


/***************************************************
 * [B] 圖表控制 UI 接線
 *
 * initChartControls()
 *   收到 gameInfo 後由 index.html 呼叫
 *   - 填入 x-axis / y-axis select 選項，格式「狀態N-name」
 *   - 依 stateInfo 動態生成 dim 滑桿（幾個狀態就幾條）
 *     每條滑桿初始位置在中間桶，顯示桶中心真實值與 (min~max) 範圍
 *   - 初始化 focusState 為各維度中間桶的真實值
 *
 * x-axis / y-axis select change → 更新 cutX / cutY
 * dim 滑桿 input → 跟隨滑桿模式時更新 focusState 對應維度（值為桶中心真實值）
 ***************************************************/
function bucketToReal(dim, bucketIdx) {
  const { min, max } = stateInfo[dim];
  return min + (bucketIdx + 0.5) * (max - min) / numBins[dim];
}

function initChartControls() {
  // 填入 x-axis / y-axis 選項，格式「狀態N-name」
  const dimOptions = stateInfo.map((info, i) =>
    `<option value="${i}">狀態${i + 1}-${info.name ?? '維度' + i}</option>`
  ).join('');
  document.getElementById('x-axis').innerHTML = dimOptions;
  document.getElementById('y-axis').innerHTML = dimOptions;
  document.getElementById('y-axis').value = stateInfo.length > 1 ? 1 : 0;
  cutX = 0;
  cutY = stateInfo.length > 1 ? 1 : 0;

  // 動態生成 dim 滑桿 table（幾個狀態就幾行）
  const table = document.getElementById('dim-sliders-table');
  table.innerHTML = '';
  focusState = [];

  stateInfo.forEach((info, dim) => {
    const midBucket = Math.floor(numBins[dim] / 2);
    const initReal  = bucketToReal(dim, midBucket);
    focusState.push(initReal);

    const row = document.createElement('tr');

    // 標籤欄
    const tdLabel = document.createElement('td');
    tdLabel.textContent = `狀態${dim + 1}-${info.name ?? '維度' + dim}`;
    tdLabel.style.whiteSpace = 'nowrap';
    tdLabel.style.paddingRight = '6px';

    // 滑桿欄
    const tdSlider = document.createElement('td');

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.id    = `dim${dim}`;
    slider.min   = 0;
    slider.max   = numBins[dim] - 1;
    slider.value = midBucket;
    slider.style.width = '120px';

    const valSpan = document.createElement('span');
    valSpan.id          = `dim${dim}-value`;
    valSpan.textContent = initReal.toFixed(2);
    valSpan.style.margin = '0 4px';

    const rangeSpan = document.createElement('span');
    rangeSpan.textContent = `(${info.min}~${info.max})`;
    rangeSpan.style.color    = '#888';
    rangeSpan.style.fontSize = '0.82em';

    slider.addEventListener('input', () => {
      if (document.querySelector('input[name="tracking"]:checked')?.value === 'live') return;
      const idx  = parseInt(slider.value);
      const real = bucketToReal(dim, idx);
      valSpan.textContent = real.toFixed(2);
      if (focusState) focusState[dim] = real;
    });

    tdSlider.append(slider, valSpan, rangeSpan);
    row.append(tdLabel, tdSlider);
    table.appendChild(row);
  });

}

// x-axis / y-axis select → 更新 cutX / cutY
document.getElementById('x-axis')?.addEventListener('change', (e) => {
  cutX = parseInt(e.target.value);
});
document.getElementById('y-axis')?.addEventListener('change', (e) => {
  cutY = parseInt(e.target.value);
});


/***************************************************
 * [C] 動作色環（renderActionColorWheel）
 * 依 actionInfo 動態繪製 CSS 色環，僅支援 type="switch"
 * a0 顯示在中心，a1~a(n-1) 等角指針排列在外圍
 ***************************************************/
function renderActionColorWheel(actionInfo) {
  const host = document.getElementById("p1-acti-color");
  if (!host) return;

  host.innerHTML = `
    <div class="title">動作色環</div>
    <div class="wheel"></div>
    <div class="center">a0<br>none</div>
  `;

  if (!actionInfo?.length) return;
  const a0 = actionInfo[0];
  if (a0.type !== "switch") return;

  const names = a0.name || [];
  host.querySelector(".center").innerHTML = `a0<br>${names[0] ?? "none"}`;

  const n = Math.max(0, a0.level - 1);
  for (let i = 0; i < n; i++) {
    const actionId = i + 1;
    const deg      = (i / n) * 360;
    const label    = `a${actionId} ${names[actionId] ?? ""}`.trim();
    const needle   = document.createElement("div");
    needle.className = "needle";
    needle.style.transform = `rotate(${deg}deg)`;
    needle.innerHTML = `<span style="transform: translateX(100px) translateY(-8px) rotate(${-deg}deg)">${label}</span>`;
    host.appendChild(needle);
  }
}


/***************************************************
 * [D] 熱力圖工具函數
 *
 * generateDiscreteColorscale(actionSize)
 *   a0 = 黑色，其餘以 HSV 色環等分配色
 *
 * hsvToRgb(h, s, v) → 'rgb(r,g,b)'
 *
 * generateWhiteOverlayMatrix()
 *   返回確信度遮罩矩陣（0=透明, 1=全白）
 *   以 cutX × cutY 掃描，其他維度固定為 focusState
 *
 * dimLabel(dim)
 *   回傳維度標籤：優先使用 stateInfo[dim].name，否則 '維度 N'
 ***************************************************/
function generateDiscreteColorscale(actionSize) {
  const colorscale = [[0, 'black']];
  for (let i = 1; i < actionSize; i++) {
    const hue = ((i - 1) * 360 / (actionSize - 1)) % 360;
    colorscale.push([i / (actionSize - 1), hsvToRgb(hue, 1, 1)]);
  }
  return colorscale;
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  return `rgb(${Math.round((r+m)*255)},${Math.round((g+m)*255)},${Math.round((b+m)*255)})`;
}

function generateWhiteOverlayMatrix() {
  const hasX     = stateInfo.length >= 1;
  const hasY     = stateInfo.length >= 2;
  const numBinsX = hasX ? numBins[cutX] : 1;
  const numBinsY = hasY ? numBins[cutY] : 1;
  const overlay  = [];
  for (let j = 0; j < numBinsY; j++) {
    const row = [];
    for (let i = 0; i < numBinsX; i++) {
      const state = [...focusState];
      if (hasX) state[cutX] = stateInfo[cutX].min + (i + 0.5) * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX;
      if (hasY) state[cutY] = stateInfo[cutY].min + (j + 0.5) * (stateInfo[cutY].max - stateInfo[cutY].min) / numBinsY;
      const sorted = getQArrayFromTable(state).slice().sort((a, b) => b - a);
      const gap    = sorted[0] - (sorted[1] ?? sorted[0]);
      row.push(1 - Math.min(gap / gapMax, 1));
    }
    overlay.push(row);
  }
  return overlay;
}

function dimLabel(dim) {
  return stateInfo[dim]?.name ?? `維度 ${dim}`;
}


/***************************************************
 * [E] 分析圖表生成
 * 所有圖表的 x/y 軸 title 使用 dimLabel()（即 stateInfo[dim].name）
 * 所有熱力圖掃描維度統一由 cutX / cutY 控制
 ***************************************************/

// 動作選擇熱力圖：下層最佳動作色塊 + 上層確信度遮罩
// 維度不足時退化：1D → 單列，0D → 單格
function generateActionHeatmap() {
  const hasX     = stateInfo.length >= 1;
  const hasY     = stateInfo.length >= 2;
  const numBinsX = hasX ? numBins[cutX] : 1;
  const numBinsY = hasY ? numBins[cutY] : 1;
  const z = [], text = [], xvals = [], yvals = [];

  for (let i = 0; i < numBinsX; i++) {
    xvals.push(hasX ? stateInfo[cutX].min + (i + 0.5) * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX : 0);
  }
  for (let j = 0; j < numBinsY; j++) {
    yvals.push(hasY ? stateInfo[cutY].min + (j + 0.5) * (stateInfo[cutY].max - stateInfo[cutY].min) / numBinsY : 0);
  }

  for (let j = 0; j < numBinsY; j++) {
    const row = [], textRow = [];
    for (let i = 0; i < numBinsX; i++) {
      const state = [...focusState];
      if (hasX) state[cutX] = xvals[i];
      if (hasY) state[cutY] = yvals[j];
      const qArr  = getQArrayFromTable(state);
      const best  = qArr.indexOf(Math.max(...qArr));
      row.push(best);
      textRow.push(`State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Best action: ${best}`);
    }
    z.push(row);
    text.push(textRow);
  }

  Plotly.newPlot('p1-diff-value', [
    { x: xvals, y: yvals, z, type: 'heatmap',
      colorscale: generateDiscreteColorscale(action_size), hoverinfo: 'text', text },
    { x: xvals, y: yvals, z: generateWhiteOverlayMatrix(), type: 'heatmap',
      colorscale: [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']],
      zmin: 0, zmax: 1, showscale: false, hoverinfo: 'skip' }
  ], {
    title: '動作選擇熱力圖',
    xaxis: { title: hasX ? dimLabel(cutX) : '（無狀態維度）' },
    yaxis: { title: hasY ? dimLabel(cutY) : '（無狀態維度）' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}

// 最大 Q 值熱力圖：青（負）→ 白（0）→ 橘（正）
// 維度不足時退化：1D → 單列，0D → 單格
function generateMaxQHeatmap() {
  const hasX     = stateInfo.length >= 1;
  const hasY     = stateInfo.length >= 2;
  const numBinsX = hasX ? numBins[cutX] : 1;
  const numBinsY = hasY ? numBins[cutY] : 1;
  const xvals = [], yvals = [], zvals = [], texts = [];

  for (let i = 0; i < numBinsX; i++) {
    for (let j = 0; j < numBinsY; j++) {
      const state = [...focusState];
      if (hasX) state[cutX] = stateInfo[cutX].min + (i + 0.5) * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX;
      if (hasY) state[cutY] = stateInfo[cutY].min + (j + 0.5) * (stateInfo[cutY].max - stateInfo[cutY].min) / numBinsY;
      const maxQ = Math.max(...getQArrayFromTable(state));
      xvals.push(hasX ? state[cutX] : 0);
      yvals.push(hasY ? state[cutY] : 0);
      zvals.push(maxQ);
      texts.push(`State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Max Q: ${maxQ.toFixed(2)}`);
    }
  }

  Plotly.newPlot('p1-maxi-value', [{
    x: xvals, y: yvals, z: zvals, type: 'heatmap',
    colorscale: [[0, 'cyan'], [0.5, 'white'], [1, 'orange']],
    zmid: 0, text: texts, hoverinfo: 'text'
  }], {
    title: '最大 Q 值熱力圖',
    xaxis: { title: hasX ? dimLabel(cutX) : '（無狀態維度）' },
    yaxis: { title: hasY ? dimLabel(cutY) : '（無狀態維度）' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}

// 最小 Q 值熱力圖：藍（負）→ 白（0）→ 紅（正）
// 維度不足時退化：1D → 單列，0D → 單格
function generateMinQHeatmap() {
  const hasX     = stateInfo.length >= 1;
  const hasY     = stateInfo.length >= 2;
  const numBinsX = hasX ? numBins[cutX] : 1;
  const numBinsY = hasY ? numBins[cutY] : 1;
  const xvals = [], yvals = [], zvals = [], texts = [];

  for (let i = 0; i < numBinsX; i++) {
    for (let j = 0; j < numBinsY; j++) {
      const state = [...focusState];
      if (hasX) state[cutX] = stateInfo[cutX].min + (i + 0.5) * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX;
      if (hasY) state[cutY] = stateInfo[cutY].min + (j + 0.5) * (stateInfo[cutY].max - stateInfo[cutY].min) / numBinsY;
      const minQ = Math.min(...getQArrayFromTable(state));
      xvals.push(hasX ? state[cutX] : 0);
      yvals.push(hasY ? state[cutY] : 0);
      zvals.push(minQ);
      texts.push(`State [${state.map(v => v.toFixed(2)).join(', ')}]<br>Min Q: ${minQ.toFixed(2)}`);
    }
  }

  Plotly.newPlot('p1-mini-value', [{
    x: xvals, y: yvals, z: zvals, type: 'heatmap',
    colorscale: [[0, 'blue'], [0.5, 'white'], [1, 'red']],
    zmid: 0, text: texts, hoverinfo: 'text'
  }], {
    title: '最小 Q 值熱力圖',
    xaxis: { title: hasX ? dimLabel(cutX) : '（無狀態維度）' },
    yaxis: { title: hasY ? dimLabel(cutY) : '（無狀態維度）' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}

// 1D Q 值折線圖：沿 cutX 掃描，各動作一條線
// x 軸為 cutX 維度的真實物理值
function generateQLineSlice() {
  const numBinsX     = numBins[cutX];
  const actionColors = generateDiscreteColorscale(action_size).map(e => e[1]);
  const data         = [];

  for (let action = 0; action < action_size; action++) {
    const xvals = [], yvals = [];
    for (let i = 0; i < numBinsX; i++) {
      const state = [...focusState];
      state[cutX]  = stateInfo[cutX].min + (i + 0.5) * (stateInfo[cutX].max - stateInfo[cutX].min) / numBinsX;
      xvals.push(state[cutX]);
      yvals.push(getQArrayFromTable(state)[action]);
    }
    data.push({
      x: xvals, y: yvals,
      mode: 'lines+markers', type: 'scatter',
      name: `Action ${action}`,
      line:   { shape: 'linear', color: actionColors[action] },
      marker: { color: actionColors[action] }
    });
  }

  Plotly.newPlot('p1-line-value', data, {
    title: '狀態價值折線圖',
    xaxis: { title: dimLabel(cutX) },
    yaxis: { title: '評估價值' },
    showlegend: false,
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}

// 當前狀態動作柱狀圖：focusState 的各動作 Q 值
function generateQBarSlice() {
  const qArr = getQArrayFromTable(focusState);
  if (!qArr) return;

  const actionColors = generateDiscreteColorscale(action_size).map(e => e[1]);
  const traces       = qArr.map((q, action) => ({
    x: [action], y: [q],
    type: 'bar', name: `Action ${action}`,
    marker: { color: actionColors[action] }
  }));

  Plotly.newPlot('p1-bars-value', traces, {
    title: '動作價值柱狀圖',
    xaxis: { title: '動作選擇' },
    yaxis: { title: '評估價值' },
    barmode: 'group', showlegend: false,
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}


/***************************************************
 * [F] 定時更新（每秒一次）
 *
 * 前置條件：stateInfo 已載入 且 plotQualityCharts = true
 *
 * focusState 更新策略：
 *   tracking 開啟 → 跟隨 nextState（Agent 當前狀態）
 *   tracking 關閉 → 維持滑桿設定值（不在這裡覆蓋）
 *
 * 2D 圖表（熱力圖）需要至少 2 個狀態維度才能繪製
 ***************************************************/
setInterval(() => {
  if (!stateInfo || !plotQualityCharts) return;

  // 更新 focusState
  if (document.querySelector('input[name="tracking"]:checked')?.value === 'live') {
    focusState = [...nextState];
  } else if (!focusState) {
    focusState = stateInfo.map(info => info.min); // 初次備援
  }

  generateQBarSlice();
  generateQLineSlice();
  generateActionHeatmap();
  generateMaxQHeatmap();
  generateMinQHeatmap();
}, 1000);
