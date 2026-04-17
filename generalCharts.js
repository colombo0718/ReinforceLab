/***************************************************
 * generalCharts.js — 通用訓練指標圖表
 *
 * 負責四張 Plotly 圖表的初始化與更新：
 *   每秒 Reward 折線圖  (p1-second-reward)
 *   每秒 Steps 折線圖   (p1-second-steps)
 *   每回合 Reward 柱狀圖 (p1-episode-reward)
 *   每回合 Steps 柱狀圖  (p1-episode-steps)
 *
 * 依賴 index.html [12] 提供的全局變數：
 *   secondReward, secondSteps        — 每步累加，每秒歸零
 *   rewardData/Labels, stepsData/Labels — 每秒圖表的資料緩衝
 *   episodeCount, episodeReward, episodeSteps — 每回合結束時讀取
 *   episodeIndex, episodeRewardData, episodeStepsData — 每回合圖表資料
 *   startTime, isPaused, plotGeneralCharts
 ***************************************************/


/***************************************************
 * [A] 語言字典 & 配色方案
 ***************************************************/
window.chartLang = window.chartLang ?? "en";

window.CHART_TEXT = {
  zh: {
    rewardPerSec: "每秒獲得獎勵",  stepsPerSec:  "每秒輸出步數",
    rewardPerEp:  "每回合獲得獎勵", stepsPerEp:   "每回合輸出步數",
    timeAxis:     "時間(秒)",       episodeAxis:  "回合數 (Episode)",
    rewardAxis:   "獎勵",           stepsAxis:    "步數",    stepsAxisEp: "步數 (Steps)",
    actionHeatmap:"動作選擇熱力圖", maxQHeatmap:  "最大 Q 值熱力圖",
    minQHeatmap:  "最小 Q 值熱力圖",qLineSlice:   "狀態價值折線圖",
    qBarSlice:    "動作價值與選擇機率",
    noStateDim:   "（無狀態維度）", actionAxis:   "動作",
    qValueAxis:   "評估價值",       qValueBar:    "價值評估",
    probAxis:     "選擇機率",       actionColors: "動作色環",
    statePrefix:  "狀態",           dimPrefix:    "維度",
  },
  en: {
    rewardPerSec: "Reward / Second", stepsPerSec:  "Steps / Second",
    rewardPerEp:  "Reward / Episode", stepsPerEp:   "Steps / Episode",
    timeAxis:     "Time (s)",         episodeAxis:  "Episode",
    rewardAxis:   "Reward",           stepsAxis:    "Steps", stepsAxisEp: "Steps",
    actionHeatmap:"Policy Heatmap",   maxQHeatmap:  "Max Q Heatmap",
    minQHeatmap:  "Min Q Heatmap",    qLineSlice:   "Q-Value Slice",
    qBarSlice:    "Action Values & Probability",
    noStateDim:   "(no state dim)",   actionAxis:   "Action",
    qValueAxis:   "Q-Value",          qValueBar:    "Q-Value",
    probAxis:     "Probability",      actionColors: "Action Colors",
    statePrefix:  "State",            dimPrefix:    "Dim",
  }
};

const rewardLineColor   = 'rgba(75, 192, 192, 1)';
const rewardMarkerColor = 'rgba(75, 192, 192, 0.7)';

const stepsLineColor    = 'rgba(255, 159, 64, 1)';
const stepsMarkerColor  = 'rgba(255, 159, 64, 0.7)';


/***************************************************
 * [B] 每秒圖表（Second Charts）
 * 以每秒為單位，顯示最近 60 秒的 Reward 與 Steps
 *
 * initSecondChart()
 *   用空陣列初始化兩張折線圖（帶面積填色）
 *
 * updateSecondChart()
 *   每秒由 setInterval 呼叫
 *   暫停時：不記錄資料，改把 startTime 推後 1000ms，
 *           讓時間軸不出現空缺（x 軸保持連續）
 *   超過 60 筆後移除最舊資料（滑動視窗）
 *   更新完後把 secondReward / secondSteps 歸零
 ***************************************************/
function initSecondChart() {
  const L = window.CHART_TEXT[window.chartLang ?? "en"];
  Plotly.newPlot('p1-second-reward', [{
    x: rewardLabels,
    y: rewardData,
    mode: 'lines',
    fill: 'tozeroy',
    line: { color: rewardLineColor }
  }], {
    title: L.rewardPerSec,
    xaxis: { title: L.timeAxis },
    yaxis: { title: L.rewardAxis },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  }, { displayModeBar: false });

  Plotly.newPlot('p1-second-steps', [{
    x: stepsLabels,
    y: stepsData,
    mode: 'lines',
    fill: 'tozeroy',
    line: { color: stepsLineColor }
  }], {
    title: L.stepsPerSec,
    xaxis: { title: L.timeAxis },
    yaxis: { title: L.stepsAxis },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  }, { displayModeBar: false });
}

function updateSecondChart() {
  // 暫停時不記資料，把 startTime 推後 1 秒讓時間軸保持連續
  if (isPaused) { startTime += 1000; return; }

  const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);

  rewardLabels.push(currentTime);
  rewardData.push(secondReward);
  if (rewardData.length > 60) { rewardLabels.shift(); rewardData.shift(); }
  Plotly.update('p1-second-reward', { x: [rewardLabels], y: [rewardData] });
  secondReward = 0;

  stepsLabels.push(currentTime);
  stepsData.push(secondSteps);
  if (stepsData.length > 60) { stepsLabels.shift(); stepsData.shift(); }
  Plotly.update('p1-second-steps', { x: [stepsLabels], y: [stepsData] });
  secondSteps = 0;
}


/***************************************************
 * [C] 每回合圖表（Episode Charts）
 * 以回合（episode）為單位，顯示最近 100 回合的 Reward 與 Steps
 *
 * initEpisodeChart()
 *   用空陣列初始化兩張柱狀圖
 *
 * updateEpisodeChart()
 *   由主迴圈在 done:true 時呼叫
 *   讀取當前 episodeCount / episodeReward / episodeSteps，推入陣列
 *   超過 100 筆後移除最舊資料（滑動視窗）
 ***************************************************/
function initEpisodeChart() {
  const L = window.CHART_TEXT[window.chartLang ?? "en"];
  Plotly.newPlot("p1-episode-reward", [{
    x: episodeIndex,
    y: episodeRewardData,
    type: 'bar',
    marker: { color: rewardMarkerColor }
  }], {
    title: { text: L.rewardPerEp, font: { size: 18 }, yanchor: "top", y: 0.95, pad: { b: 0 } },
    xaxis: { title: L.episodeAxis },
    yaxis: { title: L.rewardAxis },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  }, { displayModeBar: false });

  Plotly.newPlot("p1-episode-steps", [{
    x: episodeIndex,
    y: episodeStepsData,
    type: 'bar',
    marker: { color: stepsMarkerColor }
  }], {
    title: { text: L.stepsPerEp, font: { size: 18 }, yanchor: "top", y: 0.95, pad: { b: 0 } },
    xaxis: { title: L.episodeAxis },
    yaxis: { title: L.stepsAxisEp },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  }, { displayModeBar: false });
}

function updateEpisodeChart() {
  episodeIndex.push(episodeCount);
  episodeRewardData.push(episodeReward);
  episodeStepsData.push(episodeSteps);

  if (episodeIndex.length > 100) {
    episodeIndex.shift();
    episodeRewardData.shift();
    episodeStepsData.shift();
  }

  Plotly.update("p1-episode-reward", { x: [episodeIndex], y: [episodeRewardData] });
  Plotly.update("p1-episode-steps",  { x: [episodeIndex], y: [episodeStepsData]  });
}


/***************************************************
 * [D] 初始化與定時更新
 * 頁面載入時立即初始化四張圖表
 * setInterval 每秒呼叫 updateSecondChart（由 plotGeneralCharts 控制開關）
 ***************************************************/
initSecondChart();
initEpisodeChart();

setInterval(() => {
  if (plotGeneralCharts) updateSecondChart();
}, 1000);


/***************************************************
 * [E] 重置（工具函數，目前未在主流程呼叫）
 * 清空所有圖表資料陣列並重新初始化
 * 可在換遊戲或手動重置訓練時呼叫
 ***************************************************/
function resetGeneralCharts() {
  rewardData = []; rewardLabels = [];
  stepsData  = []; stepsLabels  = [];

  episodeIndex = []; episodeRewardData = []; episodeStepsData = [];

  startTime    = Date.now();
  secondReward = 0;
  secondSteps  = 0;
  episodeCount  = 1;
  episodeReward = 0;
  episodeSteps  = 0;

  initSecondChart();
  initEpisodeChart();

  console.log("圖表已重置");
}
