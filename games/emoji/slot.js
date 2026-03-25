(() => {
  const SYMBOLS = ["🍎","🍌","🍇","🍓","🍍","🥝","🍒","🍑","🍉","🍊","🍐","🍋"];
  const REEL_COUNT = 5;

  const ROWS = 5;
  const CENTER_ROW = 2; // 5 rows 的中間格
  const REPEAT = 70;

  const $reels = document.getElementById("reels");
  const $reelsWrap = document.getElementById("reelsWrap");
  const $msg = document.getElementById("msg");

  const mod = (x, m) => ((x % m) + m) % m;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const rnd = (n) => Math.floor(Math.random() * n);

  const reels = [];
  const state = { spinning:false, resultIdx: Array(REEL_COUNT).fill(0) };

  function setMsg(text){ $msg.textContent = text; }

  function setSymbolPx(px){
    document.documentElement.style.setProperty("--symbol", `${px}px`);
  }
  function symbolSize(){
    const v = getComputedStyle(document.documentElement).getPropertyValue("--symbol").trim();
    return parseFloat(v.replace("px","")) || 64;
  }

  // ✅ 版型核心：依 reelsWrap 實際尺寸，盡量撐滿 5x5
  function computeBestSymbolPx(){
    const rect = $reelsWrap.getBoundingClientRect();
    const styles = getComputedStyle(document.documentElement);
    const gap = parseFloat(styles.getPropertyValue("--gap")) || 10;

    const usableW = rect.width  - gap * (REEL_COUNT - 1);
    const usableH = rect.height; // reels 區本身高度固定為 rows * symbol

    const symByW = usableW / REEL_COUNT;
    const symByH = usableH / ROWS;

    return Math.floor(Math.max(34, Math.min(92, Math.min(symByW, symByH))));
  }

  function stripHeightPx(){
    const h = symbolSize();
    return SYMBOLS.length * REPEAT * h;
  }

  function updateTransform(reel){
    const H = stripHeightPx();
    const y = mod(reel.offsetPx, H);
    reel.stripEl.style.transform = `translateY(${-y}px)`;
  }

  function buildReels(){
    $reels.innerHTML = "";
    reels.length = 0;

    for (let i=0; i<REEL_COUNT; i++){
      const reelEl = document.createElement("div");
      reelEl.className = "reel";

      const stripEl = document.createElement("div");
      stripEl.className = "strip";

      for (let r=0; r<REPEAT; r++){
        for (const s of SYMBOLS){
          const cell = document.createElement("div");
          cell.className = "sym";
          cell.textContent = s;
          stripEl.appendChild(cell);
        }
      }

      reelEl.appendChild(stripEl);
      $reels.appendChild(reelEl);

      const reel = {
        stripEl,
        offsetPx: 0,
        running: false,
        startOffsetPx: 0,
        targetOffsetPx: 0,
        startTime: 0,
        duration: 0
      };
      reels.push(reel);
      updateTransform(reel);
    }
  }

  // ✅ 停輪目標：確保中間格是 targetSymbolIdx
  function computeTravelPx(startOffsetPx, targetSymbolIdx, loops){
    const N = SYMBOLS.length;
    const h = symbolSize();

    const startSteps = Math.round(startOffsetPx / h);
    const curMod = mod(startSteps, N);

    const wantOffsetMod = mod(targetSymbolIdx - CENTER_ROW, N);
    const deltaMod = mod(wantOffsetMod - curMod, N);

    const steps = loops * N + deltaMod;
    return steps * h;
  }

  function finishSpin(){
    state.spinning = false;
    setMsg("按下 [1] 開始遊戲");
  }

  function tick(t){
    let allDone = true;

    for (const reel of reels){
      if (!reel.running) continue;

      if (t < reel.startTime){
        allDone = false;
        continue;
      }

      const tt = clamp01((t - reel.startTime) / reel.duration);
      const eased = easeOutCubic(tt);

      reel.offsetPx = reel.startOffsetPx + (reel.targetOffsetPx - reel.startOffsetPx) * eased;
      updateTransform(reel);

      if (tt >= 1){
        const h = symbolSize();
        reel.offsetPx = Math.round(reel.offsetPx / h) * h;
        reel.offsetPx = mod(reel.offsetPx, stripHeightPx());
        updateTransform(reel);
        reel.running = false;
      } else {
        allDone = false;
      }
    }

    if (!allDone){
      requestAnimationFrame(tick);
      return;
    }
    finishSpin();
  }

  function spin(){
    if (state.spinning) return;
    state.spinning = true;
    setMsg("轉輪中…");

    const now = performance.now();
    const baseDelay = 90;

    for (let i=0; i<REEL_COUNT; i++){
      const reel = reels[i];
      reel.running = true;
      reel.startOffsetPx = reel.offsetPx;

      const targetIdx = rnd(SYMBOLS.length);
      state.resultIdx[i] = targetIdx;

      const loops = 10 + i*3 + rnd(3);
      const travel = computeTravelPx(reel.startOffsetPx, targetIdx, loops);

      reel.targetOffsetPx = reel.startOffsetPx + travel;
      reel.duration = 900 + i*260 + rnd(160);
      reel.startTime = now + i * baseDelay;
    }

    requestAnimationFrame(tick);
  }

  // ✅ 只認 [1] 觸發（你要的極簡）
  document.addEventListener("keydown", (e) => {
    if (e.key === "1") {
      e.preventDefault();
      spin();
    }
  });

// ✅ 支援 GG 通訊協定：{ type:"gg_event", player:0, btnID:1~8, state:"down"/"up" }
const GG_ALLOWED_ORIGINS = new Set([
  "https://game-geek-kappa.vercel.app",
  // 你若有其他正式網域再加，開發時要測 localhost 也可先加
  // "http://localhost:5500",
]);

window.addEventListener("message", (event) => {
  // （建議）來源檢查：避免別的網站亂丟 message
  if (!GG_ALLOWED_ORIGINS.has(event.origin)) return;

  const data = event.data;
  if (!data || typeof data !== "object") return;

  // 1) ✅ 新協定：gg_event
  if (data.type === "gg_event") {
    const btnID = Number(data.btnID);
    const state = String(data.state || "");

    // 你現在只要做到「按 1 開始轉」
    if (btnID === 1 && state === "down") {
      spin();
    }
    return;
  }

  // 2) （保留）舊測試協定：action
  if (data.type === "action") {
    const act = String(data.action || "").toUpperCase();
    if (act === "1" || act === "START" || act === "A" || act === "SPIN") spin();
  }
});
  // Relayout
  let lastSymbol = 0;
  function relayout(){
    const sym = computeBestSymbolPx();
    if (sym !== lastSymbol){
      lastSymbol = sym;
      setSymbolPx(sym);
      buildReels();
    }
  }

  // Boot
  setMsg("按下 [1] 開始遊戲");
  relayout();

  const ro = new ResizeObserver(() => relayout());
  ro.observe($reelsWrap);
})();
