(function () {
  "use strict";

  class AgentVisualizerController {
    constructor() {
      this.enabled = false;
      this.speed = 1;
      this.cursorX = 72;
      this.cursorY = 72;
      this.cursorScale = 1;
      this.cursorEmoji = "👆";
      this.lastMoveMs = 0;
      this.root = null;
      this.cursor = null;
      this.cursorGlyph = null;
      this.focusBox = null;
      this.hoverBox = null;
      this.rippleLayer = null;
      this.trailSvg = null;
      this.trailPath = null;
      this.ensureDom();
      this.renderCursor(this.cursorX, this.cursorY, this.cursorScale);
      this.disable();
    }

    ensureDom() {
      if (this.root) return;

      const root = document.createElement("div");
      root.id = "rr-agent-visualizer";
      root.innerHTML = [
        '<svg class="av-trail-layer" viewBox="0 0 1 1" preserveAspectRatio="none">',
        '<path class="av-trail-path" d=""></path>',
        "</svg>",
        '<div class="av-focus-box"></div>',
        '<div class="av-hover-box"></div>',
        '<div class="av-ripple-layer"></div>',
        '<div class="av-cursor">',
        '<span class="av-cursor-glyph" role="img" aria-label="agent cursor">👆</span>',
        "</div>",
      ].join("");

      document.body.appendChild(root);

      this.root = root;
      this.cursor = root.querySelector(".av-cursor");
      this.cursorGlyph = root.querySelector(".av-cursor-glyph");
      this.focusBox = root.querySelector(".av-focus-box");
      this.hoverBox = root.querySelector(".av-hover-box");
      this.rippleLayer = root.querySelector(".av-ripple-layer");
      this.trailSvg = root.querySelector(".av-trail-layer");
      this.trailPath = root.querySelector(".av-trail-path");
    }

    enable() {
      this.enabled = true;
      this.root.classList.add("is-enabled");
      this.root.setAttribute("aria-hidden", "true");
      return true;
    }

    disable() {
      this.enabled = false;
      this.root.classList.remove("is-enabled");
      this.clearFocus();
      this.clearHover();
      this.clearTrail();
      return true;
    }

    setSpeed(multiplier) {
      const value = Number(multiplier);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("AgentVisualizer.setSpeed requires a positive number.");
      }
      this.speed = value;
      return this.speed;
    }

    setCursorEmoji(emoji) {
      if (typeof emoji !== "string" || !emoji.trim()) {
        throw new Error("AgentVisualizer.setCursorEmoji requires a non-empty string.");
      }
      this.cursorEmoji = emoji;
      this.cursorGlyph.textContent = emoji;
      return this.cursorEmoji;
    }

    async moveTo(x, y, options = {}) {
      this.enable();
      const point = this.normalizePoint(x, y);
      const duration = this.resolveDuration(options.duration ?? 500);

      this.cursor.classList.add("is-moving");
      this.cursor.style.transitionDuration = duration + "ms";
      this.renderCursor(point.x, point.y, options.scale ?? this.cursorScale);

      this.cursorX = point.x;
      this.cursorY = point.y;
      this.cursorScale = options.scale ?? this.cursorScale;
      this.lastMoveMs = duration;

      await this.wait(duration + 20);
      this.cursor.classList.remove("is-moving");
      return { x: this.cursorX, y: this.cursorY, duration };
    }

    async click(x, y, options = {}) {
      const point = this.normalizePoint(x, y);
      const moveFirst = options.moveFirst !== false;

      if (moveFirst) {
        await this.moveTo(point.x, point.y, { duration: options.duration, scale: options.scale });
      } else {
        this.enable();
        this.renderCursor(point.x, point.y, options.scale ?? this.cursorScale);
        this.cursorX = point.x;
        this.cursorY = point.y;
      }

      const pressMs = this.resolveDuration(options.pressDuration ?? 110);
      const rippleMs = this.resolveDuration(options.rippleDuration ?? 650);

      this.cursor.classList.add("is-pressing");
      this.spawnRipple(point.x, point.y, options);
      await this.wait(pressMs);
      this.cursor.classList.remove("is-pressing");
      await this.wait(Math.max(0, rippleMs - pressMs));
      return { x: point.x, y: point.y };
    }

    hoverRect(rect, options = {}) {
      this.enable();
      const box = this.normalizeRect(rect, options);
      this.applyBox(this.hoverBox, box);
      this.hoverBox.classList.add("is-visible");
      if (this._hoverTimer) { clearTimeout(this._hoverTimer); this._hoverTimer = null; }
      if (options.duration > 0) {
        this._hoverTimer = setTimeout(() => this.clearHover(), options.duration);
      }
    }

    clearHover() {
      if (this._hoverTimer) { clearTimeout(this._hoverTimer); this._hoverTimer = null; }
      this.hoverBox.classList.remove("is-visible");
      return true;
    }

    focusRect(rect, options = {}) {
      this.enable();
      const box = this.normalizeRect(rect, options);
      this.applyBox(this.focusBox, box);
      this.focusBox.classList.add("is-visible");
      if (this._focusTimer) { clearTimeout(this._focusTimer); this._focusTimer = null; }
      if (options.duration > 0) {
        this._focusTimer = setTimeout(() => this.clearFocus(), options.duration);
      }
    }

    clearFocus() {
      if (this._focusTimer) { clearTimeout(this._focusTimer); this._focusTimer = null; }
      this.focusBox.classList.remove("is-visible");
      return true;
    }

    async dragPath(points, options = {}) {
      this.enable();
      if (!Array.isArray(points) || points.length < 2) {
        throw new Error("AgentVisualizer.dragPath requires at least two points.");
      }

      const normalizedPoints = points.map((point) => {
        if (Array.isArray(point)) return this.normalizePoint(point[0], point[1]);
        return this.normalizePoint(point.x, point.y);
      });

      this.drawTrail(normalizedPoints);

      const segmentDuration = this.resolveDuration(options.segmentDuration ?? 220);
      for (const point of normalizedPoints) {
        await this.moveTo(point.x, point.y, {
          duration: segmentDuration,
          scale: options.scale,
        });
      }

      if (options.keepTrail !== true) {
        const fadeMs = this.resolveDuration(options.fadeDuration ?? 900);
        this.trailSvg.classList.add("is-fading");
        await this.wait(fadeMs);
        this.clearTrail();
      }

      return normalizedPoints;
    }

    clearTrail() {
      this.trailSvg.classList.remove("is-visible", "is-fading");
      this.trailPath.setAttribute("d", "");
      return true;
    }

    async moveToElement(selector, options = {}) {
      const rect = this.getElementRect(selector, options);
      const point = this.rectCenter(rect);
      return this.moveTo(point.x, point.y, options);
    }

    async clickElement(selector, options = {}) {
      const rect = this.getElementRect(selector, options);
      const point = this.rectCenter(rect);
      return this.click(point.x, point.y, options);
    }

    focusElement(selector, options = {}) {
      const rect = this.getElementRect(selector, options);
      return this.focusRect(rect, options);
    }

    highlightElement(selector, options = {}) {
      const rect = this.getElementRect(selector, options);
      return this.hoverRect(rect, options);
    }

    clearAll() {
      this.clearFocus();
      this.clearHover();
      this.clearTrail();
      return true;
    }

    getElementRect(selector, options = {}) {
      const element = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!element) {
        throw new Error("AgentVisualizer could not find element: " + selector);
      }
      const rect = element.getBoundingClientRect();
      return this.normalizeRect(rect, options);
    }

    normalizePoint(x, y) {
      const pointX = Number(x);
      const pointY = Number(y);
      if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
        throw new Error("AgentVisualizer requires finite x/y coordinates.");
      }
      return { x: pointX, y: pointY };
    }

    normalizeRect(rect, options = {}) {
      if (!rect) throw new Error("AgentVisualizer requires a rect.");
      const padding = Number(options.padding ?? 8);
      const radius = Number(options.radius ?? 8);
      const x = Number(rect.left ?? rect.x);
      const y = Number(rect.top ?? rect.y);
      const width = Number(rect.width);
      const height = Number(rect.height);

      if (![x, y, width, height].every(Number.isFinite)) {
        throw new Error("AgentVisualizer received an invalid rect.");
      }

      return {
        left: x - padding,
        top: y - padding,
        width: Math.max(0, width + padding * 2),
        height: Math.max(0, height + padding * 2),
        radius,
      };
    }

    applyBox(node, rect) {
      node.style.left = rect.left + "px";
      node.style.top = rect.top + "px";
      node.style.width = rect.width + "px";
      node.style.height = rect.height + "px";
      node.style.borderRadius = rect.radius + "px";
    }

    rectCenter(rect) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    drawTrail(points) {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      this.trailSvg.setAttribute("viewBox", "0 0 " + width + " " + height);
      const d = points
        .map((point, index) => (index === 0 ? "M" : "L") + point.x.toFixed(1) + " " + point.y.toFixed(1))
        .join(" ");
      this.trailPath.setAttribute("d", d);
      this.trailSvg.classList.remove("is-fading");
      this.trailSvg.classList.add("is-visible");
    }

    spawnRipple(x, y, options = {}) {
      const ripple = document.createElement("div");
      ripple.className = "av-ripple";
      ripple.style.left = x + "px";
      ripple.style.top = y + "px";
      ripple.style.width = (options.size ?? 56) + "px";
      ripple.style.height = (options.size ?? 56) + "px";
      ripple.style.animationDuration = this.resolveDuration(options.rippleDuration ?? 650) + "ms";
      this.rippleLayer.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), this.resolveDuration(options.rippleDuration ?? 650) + 40);
    }

    renderCursor(x, y, scale = 1) {
      // Cursor box is 42×42 px with the emoji flexbox-centered inside.
      // Hotspot: finger tip of 👆 is at roughly center-x (21 px) and near the top (6 px).
      // Subtract the hotspot offset so the finger tip aligns with (x, y).
      const tx = (x - 21).toFixed(1);
      const ty = (y - 6).toFixed(1);
      this.cursor.style.transform =
        "translate(" + tx + "px, " + ty + "px) scale(" + Number(scale).toFixed(3) + ")";
    }

    resolveDuration(baseMs) {
      const duration = Number(baseMs);
      if (!Number.isFinite(duration) || duration < 0) return 0;
      return Math.max(0, Math.round(duration / this.speed));
    }

    wait(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
  }

  function mountAgentVisualizer() {
    if (window.AgentVisualizer) return;
    window.AgentVisualizer = new AgentVisualizerController();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAgentVisualizer, { once: true });
  } else {
    mountAgentVisualizer();
  }
})();
