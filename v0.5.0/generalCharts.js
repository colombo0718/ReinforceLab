/***************************************************
 * 全局變數 (請確保這些變數在其他邏輯中也有適當更新)
 ***************************************************/
// let secondReward = 0;    // 每秒累計 Reward，其他邏輯中需要累加此值
// let secondSteps  = 0;    // 每秒累計步數，其他邏輯中需要累加此值
//
// let rewardData   = [];
// let rewardLabels = [];
// let stepsData    = [];
// let stepsLabels  = [];
//
// let startTime = Date.now();
//
// // 每回合數據（episode）相關變數
// let episodeIndex      = [];  // 回合編號
// let episodeRewardData = [];  // 每回合累積 Reward
// let episodeStepsData  = [];  // 每回合累積步數
//
// // 假設這些變數在每回合結束時被更新：
// let episodeCount = 1;    // 當前回合編號
// let episodeReward = 0;   // 當前回合累積 Reward
// let episodeSteps  = 0;   // 當前回合累積步數
/***************************************************
 * 配色方案
 ***************************************************/
// Reward 相關統一使用藍綠色系
const rewardLineColor   = 'rgba(75, 192, 192, 1)';
const rewardMarkerColor = 'rgba(75, 192, 192, 0.7)';

// Steps 相關統一使用橙色系
const stepsLineColor    = 'rgba(255, 159, 64, 1)';
const stepsMarkerColor  = 'rgba(255, 159, 64, 0.7)';

console.log(stepsLineColor)
/***************************************************
 * Second Charts (每秒數據圖表)
 ***************************************************/

// 初始化每秒數據的 Reward 與 Steps 圖表
function initSecondChart() {
  // Reward Flow 圖表
  const rewardLayout = {
    title: 'Reward Flow',
    xaxis: { title: 'Time (s)' },
    yaxis: { title: 'Reward per Second' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-second-reward', [{
    x: rewardLabels,
    y: rewardData,
    mode: 'lines',
    fill: 'tozeroy',
    line: { color: rewardLineColor }
  }], rewardLayout);

  // Steps Flow 圖表
  const stepsLayout = {
    title: 'Steps Flow',
    xaxis: { title: 'Time (s)' },
    yaxis: { title: 'Steps per Second' },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  };

  Plotly.newPlot('p1-second-steps', [{
    x: stepsLabels,
    y: stepsData,
    mode: 'lines',
    fill: 'tozeroy',
    line: { color: stepsLineColor }
  }], stepsLayout);
}

// 更新每秒數據圖表（Reward 與 Steps）
function updateSecondChart() {
  // 按下暫停後圖表停止更新
  // startTime向後延一秒
  if(isPaused){startTime+=1000;return}
  // 取得目前時間（秒）
  const currentTime = ((Date.now() - startTime) / 1000).toFixed(1);
  // console.log(currentTime)

  // 更新 Reward 資料
  rewardLabels.push(currentTime);
  rewardData.push(secondReward);
  if (rewardData.length > 60) {
    rewardLabels.shift();
    rewardData.shift();
  }
  Plotly.update('p1-second-reward', {
    x: [rewardLabels],
    y: [rewardData]
  });
  // 重置累計 Reward
  secondReward = 0;

  // 更新 Steps 資料
  stepsLabels.push(currentTime);
  stepsData.push(secondSteps);
  if (stepsData.length > 60) {
    stepsLabels.shift();
    stepsData.shift();
  }
  Plotly.update('p1-second-steps', {
    x: [stepsLabels],
    y: [stepsData]
  });
  // 重置累計 Steps
  secondSteps = 0;
}


/***************************************************
 * Episode Charts (每回合數據圖表)
 ***************************************************/

// 初始化每回合數據的圖表（Reward 與 Steps）
function initEpisodeChart() {
  // 每回合累積 Reward 柱狀圖
  Plotly.newPlot("p1-episode-reward", [{
    x: episodeIndex,
    y: episodeRewardData,
    type: 'bar',
    marker: { color: rewardMarkerColor }
  }], {
    title: {
      text: "每回合累積 Reward",
      font: { size: 18 },
      yanchor: "top",
      y: 0.95,
      pad: { b: 0 }
    },
    xaxis: { title: "回合數 (Episode)" },
    yaxis: { title: "累積 Reward" },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });

  // 每回合累積 Steps 柱狀圖
  Plotly.newPlot("p1-episode-steps", [{
    x: episodeIndex,
    y: episodeStepsData,
    type: 'bar',
    marker: { color: stepsMarkerColor }
  }], {
    title: {
      text: "每回合累積步數",
      font: { size: 18 },
      yanchor: "top",
      y: 0.95,
      pad: { b: 0 }
    },
    xaxis: { title: "回合數 (Episode)" },
    yaxis: { title: "步數 (Steps)" },
    margin: { t: 30, b: 40, l: 50, r: 20 }
  });
}

// 更新每回合數據圖表
function updateEpisodeChart() {
  // 將本回合資料加入陣列（假設 episodeCount、episodeReward、episodeSteps 由其他邏輯更新）
  episodeIndex.push(episodeCount);
  episodeRewardData.push(episodeReward);
  episodeStepsData.push(episodeSteps);

  if (episodeIndex.length > 100) {
    episodeIndex.shift();
    episodeRewardData.shift();
    episodeStepsData.shift();
  }

  Plotly.update("p1-episode-reward", {
    x: [episodeIndex],
    y: [episodeRewardData]
  });



  Plotly.update("p1-episode-steps", {
    x: [episodeIndex],
    y: [episodeStepsData]
  });
}


/***************************************************
 * 初始化與定時更新調用
 ***************************************************/
// 初始化每秒數據圖表
initSecondChart();

// 初始化每回合數據圖表
initEpisodeChart();

// 每秒更新一次 Reward 與 Steps 的數據圖表
setInterval(() => {
  updateSecondChart();
}, 1000);




function resetGeneralCharts() {
  // 清空每秒資料陣列
  rewardData = [];
  rewardLabels = [];
  stepsData = [];
  stepsLabels = [];

  // 清空每回合資料陣列
  episodeIndex = [];
  episodeRewardData = [];
  episodeStepsData = [];

  // 可選：重置 startTime 與其他累計數值
  startTime = Date.now();
  secondReward = 0;
  secondSteps = 0;
  episodeCount = 1;
  episodeReward = 0;
  episodeSteps = 0;

  // 重新初始化圖表
  initSecondChart();
  initEpisodeChart();

  console.log("圖表已重置");
}
