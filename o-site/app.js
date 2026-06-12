/* ============================================================
   O SITE — app.js
   Tudo escrito do zero: aurora, partículas, flow field,
   física, síntese de áudio, tipografia viva. Zero dependências.
   ============================================================ */
"use strict";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- utilitários ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);

/* Redimensiona um canvas para o tamanho CSS × devicePixelRatio. */
function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w, h, dpr };
}

/* Corre o loop de animação apenas quando o canvas está visível. */
function animateWhenVisible(el, tick) {
  let raf = null;
  const loop = (t) => { tick(t); raf = requestAnimationFrame(loop); };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
    else if (!e.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }, { rootMargin: "60px" });
  io.observe(el);
}

/* Ruído de valor 2D com interpolação suave (para o flow field). */
function makeNoise(seed) {
  let s = seed >>> 0;
  const rnd = () => {
    // xorshift32 — determinístico por semente
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
  const SIZE = 64;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[((y % SIZE + SIZE) % SIZE) * SIZE + ((x % SIZE + SIZE) % SIZE)];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = lerp(at(xi, yi), at(xi + 1, yi), xf);
    const b = lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf);
    return lerp(a, b, yf);
  };
}

/* ============================================================
   PRELOADER
   ============================================================ */
(() => {
  const loader = $("#loader");
  const count = $("#loaderCount");
  let n = 0;
  const step = () => {
    n = Math.min(100, n + rand(7, 18));
    count.textContent = Math.floor(n);
    if (n < 100) setTimeout(step, rand(40, 110));
    else setTimeout(() => loader.classList.add("done"), 250);
  };
  if (REDUCED) loader.classList.add("done");
  else step();
})();

/* ============================================================
   CURSOR CUSTOM (apenas rato fino)
   ============================================================ */
(() => {
  if (!FINE_POINTER || REDUCED) return;
  document.body.classList.add("custom-cursor");
  const dot = $("#cursor"), ring = $("#cursorRing");
  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener("pointermove", (e) => {
    mx = e.clientX; my = e.clientY;
    document.body.classList.add("cursor-on");
  }, { passive: true });
  document.addEventListener("mouseleave", () => document.body.classList.remove("cursor-on"));
  (function loop() {
    rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
    dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener("pointerover", (e) => {
    ring.classList.toggle("is-hover", !!e.target.closest("[data-hover], a, button, [contenteditable]"));
  }, { passive: true });
})();

/* ============================================================
   NAV (esconder ao descer) + PROGRESSO + TEMA
   ============================================================ */
(() => {
  const nav = $("#nav"), progress = $("#progress");
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("scrolled", y > 30);
    nav.classList.toggle("hidden", y > 400 && y > lastY);
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
  }, { passive: true });

  const saved = localStorage.getItem("osite-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("osite-theme", next);
  });
})();

/* ============================================================
   REVELAÇÕES + CONTADORES
   ============================================================ */
(() => {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
      const counter = e.target.querySelector?.("[data-count]") ||
        (e.target.matches?.("[data-count]") ? e.target : null);
      if (counter) countUp(counter);
    }
  }, { threshold: 0.2 });
  $$("[data-reveal]").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(el);
  });
  $$(".number").forEach((el) => io.observe(el));

  function countUp(el) {
    const target = +el.dataset.count;
    if (REDUCED) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 1400;
    (function tick(t) {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
})();

/* ============================================================
   HERO — palavras magnéticas
   ============================================================ */
(() => {
  if (!FINE_POINTER || REDUCED) return;
  $$("[data-magnet]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `translate(${dx * 18}px, ${dy * 14}px)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  });
})();

/* ============================================================
   AURORA — fundo do hero (dual buffer: pinta pequeno, amplia)
   ============================================================ */
function startAurora(canvas, blobCount = 5) {
  const ctx = canvas.getContext("2d");
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  const SCALE = 0.16; // o buffer pequeno ampliado dá um desfoque natural e barato

  const palettes = [
    ["#7df9d4", "#b388ff", "#ff7ab8", "#4dd0ff", "#9bff8a"],
  ];
  const colors = palettes[0];
  const blobs = Array.from({ length: blobCount }, (_, i) => ({
    c: colors[i % colors.length],
    px: Math.random(), py: Math.random(),
    ax: rand(0.18, 0.42), ay: rand(0.14, 0.36),
    sx: rand(0.00012, 0.00028) * (Math.random() < 0.5 ? -1 : 1),
    sy: rand(0.0001, 0.00024) * (Math.random() < 0.5 ? -1 : 1),
    ph: rand(0, Math.PI * 2),
    r: rand(0.28, 0.5),
  }));

  let staticDrawn = false;
  const draw = (t) => {
    const { w, h } = fitCanvas(canvas);
    buf.width = Math.max(1, Math.round(w * SCALE));
    buf.height = Math.max(1, Math.round(h * SCALE));
    const bw = buf.width, bh = buf.height;

    const dark = document.documentElement.dataset.theme !== "light";
    bctx.globalCompositeOperation = "source-over";
    bctx.fillStyle = dark ? "#070710" : "#f4f2ec";
    bctx.fillRect(0, 0, bw, bh);
    bctx.globalCompositeOperation = dark ? "lighter" : "multiply";

    for (const b of blobs) {
      const x = (0.5 + Math.sin(t * b.sx + b.ph) * b.ax) * bw;
      const y = (0.5 + Math.cos(t * b.sy + b.ph * 1.7) * b.ay) * bh;
      const r = b.r * Math.max(bw, bh) * (1 + 0.12 * Math.sin(t * 0.0004 + b.ph));
      const g = bctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, b.c + (dark ? "55" : "33"));
      g.addColorStop(1, b.c + "00");
      bctx.fillStyle = g;
      bctx.beginPath();
      bctx.arc(x, y, r, 0, Math.PI * 2);
      bctx.fill();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h);
  };

  if (REDUCED) {
    // uma única frame estática chega
    const drawOnce = () => { if (!staticDrawn) { draw(9000); staticDrawn = true; } };
    drawOnce();
    window.addEventListener("resize", () => { staticDrawn = false; drawOnce(); });
    return;
  }
  animateWhenVisible(canvas, draw);
}
startAurora($("#auroraCanvas"), 5);
startAurora($("#fimCanvas"), 4);

/* ============================================================
   CAPÍTULO 01 — CONSTELAÇÃO
   ============================================================ */
(() => {
  const canvas = $("#particleCanvas");
  const ctx = canvas.getContext("2d");
  const N = 120, LINK = 120;
  let pts = [], mouse = { x: -9999, y: -9999 }, repel = true;

  function init() {
    const { w, h } = fitCanvas(canvas);
    pts = Array.from({ length: N }, () => ({
      x: rand(0, w), y: rand(0, h),
      vx: rand(-0.35, 0.35), vy: rand(-0.35, 0.35),
      r: rand(1.2, 2.6),
    }));
  }
  init();
  window.addEventListener("resize", init);

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
  };
  canvas.addEventListener("pointermove", (e) => { mouse = toLocal(e); }, { passive: true });
  canvas.addEventListener("pointerleave", () => { mouse = { x: -9999, y: -9999 }; });

  const modeBtn = $("#particleMode");
  const setMode = () => { modeBtn.textContent = `modo: ${repel ? "repelir" : "atrair"}`; };
  canvas.addEventListener("pointerdown", () => { repel = !repel; setMode(); });
  modeBtn.addEventListener("click", () => { repel = !repel; setMode(); });

  function accent() {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  }

  animateWhenVisible(canvas, () => {
    const { w, h, dpr } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const col = accent();
    const R = 150 * dpr;

    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R * R && d2 > 1) {
        const d = Math.sqrt(d2);
        const f = ((R - d) / R) * 0.6 * (repel ? 1 : -1);
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
      p.vx *= 0.985; p.vy *= 0.985;
      // deriva mínima para nunca pararem por completo
      p.vx += rand(-0.012, 0.012); p.vy += rand(-0.012, 0.012);
      p.x += p.vx * dpr; p.y += p.vy * dpr;
      if (p.x < 0) { p.x = 0; p.vx *= -1; } if (p.x > w) { p.x = w; p.vx *= -1; }
      if (p.y < 0) { p.y = 0; p.vy *= -1; } if (p.y > h) { p.y = h; p.vy *= -1; }
    }

    const L = LINK * dpr;
    ctx.lineWidth = 1;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < L * L) {
          const a = (1 - Math.sqrt(d2) / L) * 0.45;
          ctx.strokeStyle = col;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  });
})();

/* ============================================================
   CAPÍTULO 02 — CAMPO DE FLUXO (arte generativa)
   ============================================================ */
(() => {
  const canvas = $("#flowCanvas");
  const ctx = canvas.getContext("2d");
  const seedLabel = $("#flowSeed");
  const PALETTES = [
    ["#7df9d4", "#b388ff", "#ff7ab8", "#4dd0ff"],
    ["#ffb74d", "#ff7043", "#f06292", "#ba68c8"],
    ["#aed581", "#4db6ac", "#4fc3f7", "#fff176"],
    ["#e0e0e0", "#90a4ae", "#7df9d4", "#546e7a"],
    ["#ff8a80", "#ffd180", "#ffff8d", "#ccff90"],
  ];
  let walkers = [], noise, palette, seed, frames = 0;
  const MAX_FRAMES = 700; // a obra "termina" e fica pendurada

  function regen() {
    seed = Math.floor(Math.random() * 1e9) || 1;
    noise = makeNoise(seed);
    palette = PALETTES[seed % PALETTES.length];
    seedLabel.textContent = `semente ${seed}`;
    const { w, h } = fitCanvas(canvas);
    const dark = document.documentElement.dataset.theme !== "light";
    ctx.fillStyle = dark ? "#0b0b16" : "#f7f5ef";
    ctx.fillRect(0, 0, w, h);
    walkers = Array.from({ length: 420 }, () => ({
      x: rand(0, w), y: rand(0, h),
      c: palette[Math.floor(rand(0, palette.length))],
      lw: rand(0.4, 1.6),
    }));
    frames = 0;
  }

  regen();
  window.addEventListener("resize", regen);
  $("#flowRegen").addEventListener("click", regen);
  $("#flowSave").addEventListener("click", () => {
    const a = document.createElement("a");
    a.download = `o-site-fluxo-${seed}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  animateWhenVisible(canvas, () => {
    if (frames++ > MAX_FRAMES) return;
    const { w, h, dpr } = fitCanvas(canvas);
    const SC = 0.0045 / dpr;
    ctx.lineCap = "round";
    for (const wk of walkers) {
      const ang = noise(wk.x * SC * 4, wk.y * SC * 4) * Math.PI * 4;
      const nx = wk.x + Math.cos(ang) * 1.6 * dpr;
      const ny = wk.y + Math.sin(ang) * 1.6 * dpr;
      ctx.strokeStyle = wk.c;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = wk.lw * dpr;
      ctx.beginPath();
      ctx.moveTo(wk.x, wk.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      wk.x = nx; wk.y = ny;
      if (wk.x < 0 || wk.x > w || wk.y < 0 || wk.y > h) {
        wk.x = rand(0, w); wk.y = rand(0, h);
      }
    }
    ctx.globalAlpha = 1;
  });
})();

/* ============================================================
   CAPÍTULO 03 — GRAVIDADE (motor de física)
   ============================================================ */
(() => {
  const canvas = $("#physicsCanvas");
  const ctx = canvas.getContext("2d");
  const countLabel = $("#physicsCount");
  const COLORS = ["#7df9d4", "#b388ff", "#ff7ab8", "#4dd0ff", "#ffd166"];
  let balls = [], gravityOn = true;
  let pointer = { x: 0, y: 0, down: false };

  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    const dpr = canvas.width / r.width;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
  };

  function addBall(x, y, burst = false) {
    const { dpr } = fitCanvas(canvas);
    balls.push({
      x, y,
      vx: rand(-3, 3) * dpr, vy: burst ? rand(-7, -2) * dpr : rand(-2, 2) * dpr,
      r: rand(8, 26) * dpr,
      c: COLORS[Math.floor(rand(0, COLORS.length))],
    });
    if (balls.length > 60) balls.shift();
    countLabel.textContent = `${balls.length} corpos`;
  }

  function seedBalls() {
    balls = [];
    const { w, h } = fitCanvas(canvas);
    for (let i = 0; i < 10; i++) addBall(rand(0, w), rand(0, h * 0.5));
  }
  seedBalls();
  window.addEventListener("resize", seedBalls);

  canvas.addEventListener("pointerdown", (e) => {
    pointer = { ...toLocal(e), down: true };
    addBall(pointer.x, pointer.y, true);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toLocal(e);
    pointer.x = p.x; pointer.y = p.y;
  }, { passive: true });
  canvas.addEventListener("pointerup", () => { pointer.down = false; });
  canvas.addEventListener("pointercancel", () => { pointer.down = false; });

  $("#physicsReset").addEventListener("click", seedBalls);
  const gravBtn = $("#physicsGravity");
  gravBtn.addEventListener("click", () => {
    gravityOn = !gravityOn;
    gravBtn.textContent = `gravidade: ${gravityOn ? "normal" : "zero"}`;
  });

  animateWhenVisible(canvas, () => {
    const { w, h, dpr } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const G = gravityOn ? 0.32 * dpr : 0;

    for (const b of balls) {
      b.vy += G;
      if (pointer.down) {
        const dx = pointer.x - b.x, dy = pointer.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = Math.min(2.2 * dpr, (260 * dpr) / d);
        b.vx += (dx / d) * f * 0.25;
        b.vy += (dy / d) * f * 0.25;
      }
      b.vx *= 0.995; b.vy *= 0.998;
      b.x += b.vx; b.y += b.vy;
      const e = 0.78; // restituição
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * e; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * e; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * e; }
      if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * e; b.vx *= 0.96; }
    }

    // colisões entre pares (impulso elástico simplificado, massa ∝ r²)
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d > 0 && d < min) {
          const nx = dx / d, ny = dy / d;
          const overlap = (min - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const ma = a.r * a.r, mb = b.r * b.r;
          const dvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (dvn < 0) {
            const imp = (2 * dvn) / (ma + mb) * 0.9;
            a.vx += imp * mb * nx; a.vy += imp * mb * ny;
            b.vx -= imp * ma * nx; b.vy -= imp * ma * ny;
          }
        }
      }
    }

    for (const b of balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.c;
      ctx.fill();
      // brilho
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fill();
    }
  });
})();

/* ============================================================
   CAPÍTULO 04 — MÁQUINA DE SOM (Web Audio)
   ============================================================ */
(() => {
  const STEPS = 8, NOTES = 5;
  // pentatónica de Lá menor, de cima (agudo) para baixo (grave)
  const FREQS = [440, 392, 329.63, 293.66, 261.63];
  const grid = $("#seqGrid");
  const state = Array.from({ length: NOTES }, () => Array(STEPS).fill(false));
  const cells = [];

  for (let n = 0; n < NOTES; n++) {
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement("button");
      cell.className = "seq-cell";
      cell.dataset.hover = "";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `nota ${n + 1}, passo ${s + 1}`);
      cell.addEventListener("click", () => {
        state[n][s] = !state[n][s];
        cell.classList.toggle("on", state[n][s]);
        if (state[n][s]) playNote(FREQS[n], 0); // pré-escuta
      });
      grid.appendChild(cell);
      cells.push(cell);
    }
  }
  const cellAt = (n, s) => cells[n * STEPS + s];

  // padrão inicial simpático
  [[0, 0], [2, 2], [1, 3], [4, 4], [2, 6], [0, 7]].forEach(([n, s]) => {
    state[n][s] = true; cellAt(n, s).classList.add("on");
  });

  let actx = null, delay = null, master = null;
  function audio() {
    if (actx) return actx;
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = 0.5;
    delay = actx.createDelay(1);
    delay.delayTime.value = 0.28;
    const fb = actx.createGain();
    fb.gain.value = 0.32;
    const wet = actx.createGain();
    wet.gain.value = 0.35;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
    master.connect(actx.destination);
    return actx;
  }

  function playNote(freq, when) {
    const ctx = audio();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc2.type = "sine";
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2.001; // oitava ligeiramente desafinada = brilho
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    // envelope ADSR curto
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(gain);
    osc2.connect(g2).connect(gain);
    gain.connect(master);
    gain.connect(delay);
    osc.start(t); osc2.start(t);
    osc.stop(t + 0.6); osc2.stop(t + 0.6);
  }

  let playing = false, step = 0, timer = null, bpm = 112;
  const playBtn = $("#seqPlay");

  function tick() {
    const stepDur = 60 / bpm / 2; // colcheias
    for (let n = 0; n < NOTES; n++) {
      if (state[n][step]) {
        playNote(FREQS[n], 0);
        const c = cellAt(n, step);
        c.classList.add("playing");
        setTimeout(() => c.classList.remove("playing"), 150);
      }
    }
    cells.forEach((c, i) => c.classList.toggle("col-active", i % STEPS === step));
    step = (step + 1) % STEPS;
    timer = setTimeout(tick, stepDur * 1000);
  }

  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "■ stop" : "▶ play";
    if (playing) { audio().resume(); step = 0; tick(); }
    else {
      clearTimeout(timer);
      cells.forEach((c) => c.classList.remove("col-active"));
    }
  });

  $("#seqClear").addEventListener("click", () => {
    for (let n = 0; n < NOTES; n++) state[n].fill(false);
    cells.forEach((c) => c.classList.remove("on"));
  });
  $("#seqRandom").addEventListener("click", () => {
    for (let n = 0; n < NOTES; n++)
      for (let s = 0; s < STEPS; s++) {
        state[n][s] = Math.random() < 0.22;
        cellAt(n, s).classList.toggle("on", state[n][s]);
      }
  });
  const tempoSlider = $("#seqTempo"), bpmLabel = $("#seqBpm");
  tempoSlider.addEventListener("input", () => {
    bpm = +tempoSlider.value;
    bpmLabel.textContent = `${bpm} bpm`;
  });
})();

/* ============================================================
   CAPÍTULO 05 — TIPOGRAFIA VIVA
   ============================================================ */
(() => {
  const stage = $("#typeStage");
  const text = $("#typeText");
  const label = $("#typeWeight");
  const setWeight = (w) => {
    const weight = Math.round(w);
    text.style.fontWeight = weight;
    label.textContent = `peso ${weight}`;
  };
  if (FINE_POINTER && !REDUCED) {
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      setWeight(lerp(400, 800, t)); // Syne é variável 400–800
    }, { passive: true });
  } else if (!REDUCED) {
    // em touch, o peso oscila sozinho
    let t0 = performance.now();
    (function breathe(t) {
      setWeight(600 + 200 * Math.sin((t - t0) * 0.0012));
      requestAnimationFrame(breathe);
    })(t0);
  }
  // manter o contenteditable num só parágrafo simples
  text.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
})();

/* ============================================================
   KONAMI → CONFETTI
   ============================================================ */
(() => {
  const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  window.addEventListener("keydown", (e) => {
    pos = e.key === CODE[pos] ? pos + 1 : (e.key === CODE[0] ? 1 : 0);
    if (pos === CODE.length) { pos = 0; confetti(); }
  });
  // em touch: 5 toques rápidos no título final
  let taps = 0, tapTimer = null;
  $(".fim-title")?.addEventListener("click", () => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 600);
    if (taps >= 5) { taps = 0; confetti(); }
  });

  function confetti() {
    const colors = ["#7df9d4", "#b388ff", "#ff7ab8", "#4dd0ff", "#ffd166"];
    for (let i = 0; i < 120; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left = `${rand(0, 100)}vw`;
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${rand(1.6, 3.4)}s`;
      p.style.animationDelay = `${rand(0, 0.6)}s`;
      p.style.transform = `rotate(${rand(0, 360)}deg)`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4500);
    }
  }
})();

/* ============================================================
   RODAPÉ — ano dinâmico
   ============================================================ */
(() => {
  const el = $(".footer-inner span");
  if (el) el.innerHTML = el.innerHTML.replace("{{ano}}", new Date().getFullYear());
})();
