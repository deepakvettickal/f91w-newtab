/* Casio F-91W new tab — Clock / Stopwatch / Timer
 *
 * The LCD is a FIXED cell matrix: every position is reserved by a ghost
 * segment; modes only change which cells are lit. Nothing ever reflows.
 *
 * Buttons:
 *   LIGHT/RESET (top-left)      clock: toggle backlight   |  sw/timer: reset
 *   MODE (bottom-left)          cycle CLOCK -> SW -> TIMER
 *   START-STOP/24HR (bot-right) clock: 24H<->12H          |  sw/timer: start/stop
 *   Arrow keys (timer)          left/right pick field, up/down adjust
 */

const $ = (s) => document.querySelector(s);
const WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MODES = ["CLOCK", "SW", "TIMER"];

const el = {
  lcd: $("#lcd"),
  g1: $("#g1"),
  g2: $("#g2"),
  seconds: $("#seconds"),
  weekday: $("#weekday"),
  weekdayCell: $("#weekdayCell"),
  daynum: $("#daynum"),
  timemode: $("#timemode"),
  hint: $("#hint"),
  lightBtn: $("#lightBtn"),
  modeBtn: $("#modeBtn"),
  altBtn: $("#altBtn"),
};

let mode = "CLOCK";
let use24 = localStorage.getItem("f91_24h") !== "0";
let field = 0; // timer edit field: 0 = minutes, 1 = seconds

const sw = { running: false, elapsed: 0, startedAt: 0 };
const timer = { running: false, remaining: 5 * 60000, endsAt: 0, setMs: 5 * 60000 };

/* ---- helpers (values only — ghosts are static in the HTML) ---- */
const pad = (n) => String(n).padStart(2, "0");
function setTime(a, b) { el.g1.textContent = pad(a); el.g2.textContent = pad(b); }

/* ---- the ticking display ---- */
function tick() {
  const now = Date.now();

  if (mode === "CLOCK") {
    const d = new Date();
    let h = d.getHours();
    let tag = "24H";
    if (!use24) { tag = h < 12 ? "AM" : "PM"; h = h % 12 || 12; }
    el.timemode.textContent = tag;
    el.weekday.textContent = WD[d.getDay()];
    el.daynum.textContent = d.getDate();
    setTime(h, d.getMinutes());
    el.seconds.textContent = pad(d.getSeconds());

  } else if (mode === "SW") {
    // count up: MM:SS big, centiseconds small; hours cell lights past 1h, days past 24h
    const e = sw.running ? sw.elapsed + (now - sw.startedAt) : sw.elapsed;
    const cs = Math.floor((e % 1000) / 10);
    const total = Math.floor(e / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    el.timemode.textContent = sw.running ? "RUN" : "ST";
    el.weekday.textContent = days > 0 ? days + "D" : "";
    el.daynum.textContent = hours > 0 ? pad(hours) : "";
    setTime(Math.floor((total % 3600) / 60), total % 60);
    el.seconds.textContent = pad(cs);

  } else { // TIMER — days D | HH:MM | SS
    let r = timer.running ? Math.max(0, timer.endsAt - now) : timer.remaining;
    if (timer.running && r <= 0) { timer.running = false; timer.remaining = 0; r = 0; updateUI(); }
    el.timemode.textContent = timer.running ? "RUN" : "TR";
    el.daynum.textContent = "";
    const total = Math.ceil(r / 1000);  // round up until it truly hits 0
    const days = Math.floor(total / 86400);
    const rem = total % 86400;
    el.weekday.textContent = days + "D";
    setTime(Math.floor(rem / 3600), Math.floor((rem % 3600) / 60));
    el.seconds.textContent = pad(rem % 60);
  }
}

/* ---- selection + hint + marquee (only on state change, not every tick) ---- */
function updateUI() {
  const editing = mode === "TIMER" && !timer.running;
  // timer edit fields: 0=days 1=hours 2=minutes 3=seconds
  el.weekday.classList.toggle("sel", editing && field === 0);
  el.g1.classList.toggle("sel", editing && field === 1);
  el.g2.classList.toggle("sel", editing && field === 2);
  el.seconds.classList.toggle("sel", editing && field === 3);

  el.hint.textContent = editing ? "◄ ► FIELD    ▲ ▼ SET" : "";
}

/* ---- actions ---- */
function toggleFormat() {
  use24 = !use24;
  localStorage.setItem("f91_24h", use24 ? "1" : "0");
}

function startStop() {
  const now = Date.now();
  if (mode === "SW") {
    if (sw.running) { sw.elapsed += now - sw.startedAt; sw.running = false; }
    else { sw.startedAt = now; sw.running = true; }
  } else if (mode === "TIMER") {
    if (timer.running) { timer.remaining = Math.max(0, timer.endsAt - now); timer.running = false; }
    else {
      if (timer.remaining <= 0) timer.remaining = timer.setMs;
      if (timer.remaining <= 0) return;           // nothing set -> ignore
      timer.endsAt = now + timer.remaining; timer.running = true;
    }
  }
}

function resetCurrent() {
  if (mode === "SW") { sw.running = false; sw.elapsed = 0; sw.startedAt = 0; }
  else if (mode === "TIMER") { timer.running = false; timer.setMs = 0; timer.remaining = 0; }
}

function adjust(delta) {
  if (mode !== "TIMER" || timer.running) return;
  const t = Math.floor(timer.setMs / 1000);
  let d = Math.floor(t / 86400);
  let h = Math.floor((t % 86400) / 3600);
  let m = Math.floor((t % 3600) / 60);
  let s = t % 60;
  if (field === 0) d = (d + delta + 10) % 10;      // days 0-9
  else if (field === 1) h = (h + delta + 24) % 24; // hours 0-23
  else if (field === 2) m = (m + delta + 60) % 60; // minutes 0-59
  else s = (s + delta + 60) % 60;                  // seconds 0-59
  timer.setMs = (((d * 24 + h) * 60 + m) * 60 + s) * 1000;
  timer.remaining = timer.setMs;
}

/* ---- button wiring ---- */
el.lightBtn.addEventListener("click", () => {
  if (mode === "CLOCK") el.lcd.classList.toggle("lit");
  else resetCurrent();
  updateUI(); tick();
});
el.modeBtn.addEventListener("click", () => {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  updateUI(); tick();
});
el.altBtn.addEventListener("click", () => {
  if (mode === "CLOCK") toggleFormat(); else startStop();
  updateUI(); tick();
});

/* ---- keyboard ---- */
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "l" || k === "L") { el.lcd.classList.toggle("lit"); return; }
  if (k === " ") { e.preventDefault(); if (mode === "CLOCK") toggleFormat(); else startStop(); updateUI(); tick(); return; }
  if (mode === "TIMER" && !timer.running) {
    if (k === "ArrowLeft") { field = (field + 3) % 4; updateUI(); e.preventDefault(); }
    else if (k === "ArrowRight") { field = (field + 1) % 4; updateUI(); e.preventDefault(); }
    else if (k === "ArrowUp") { adjust(1); tick(); e.preventDefault(); }
    else if (k === "ArrowDown") { adjust(-1); tick(); e.preventDefault(); }
  }
});

/* ===== inline colour edit mode (WR badge) ===== */
// gradient/digit palette: neons + black + grey
const NEON = ["#39FF14", "#00FF9F", "#00FFFF", "#2E9BFF", "#4D5BFF", "#B026FF",
              "#FF3DF2", "#FF2D95", "#FF3131", "#FF7A00", "#FFD400", "#FFFFFF",
              "#808080", "#000000"];
// border palette: muted line colors (no neon) + white / grey / black
const BORDER = ["#4f8bd0", "#3fb6c8", "#5a6fd6", "#7f8a99", "#4fb07a", "#c06a6a",
                "#c9a86a", "#FFFFFF", "#808080", "#000000"];
const paletteFor = (t) => (t === "border" ? BORDER : NEON);

// defaults: gradient = original subtle backlight, ink off-white, border blue
const THEME_DEFAULTS = { top: "#2a2a26", bottom: "#050505", ink: "#e8e7e2", border: "#4f8bd0" };
const theme = {
  top: localStorage.getItem("f91_top") || THEME_DEFAULTS.top,
  bottom: localStorage.getItem("f91_bottom") || THEME_DEFAULTS.bottom,
  ink: localStorage.getItem("f91_ink") || THEME_DEFAULTS.ink,
  border: localStorage.getItem("f91_border") || THEME_DEFAULTS.border,
};
let brightness = parseInt(localStorage.getItem("f91_bright") || "70", 10);

function hexToRgba(hex, a) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty("--grad-top", theme.top);
  r.setProperty("--grad-bottom", theme.bottom);
  r.setProperty("--ink", theme.ink);
  r.setProperty("--ghost", hexToRgba(theme.ink, 0.1));
  r.setProperty("--accent", theme.border);
  r.setProperty("--lite", (brightness / 100).toFixed(2));
  // glow follows the top color; default keeps the original soft off-white glow
  const topDefault = theme.top.toLowerCase() === THEME_DEFAULTS.top.toLowerCase();
  r.setProperty("--glow", topDefault ? "rgba(232, 231, 226, 0.4)" : hexToRgba(theme.top, 0.6));
}

function markSelected(box, target) {
  const cur = theme[target].toLowerCase();
  const isDefault = cur === THEME_DEFAULTS[target].toLowerCase();
  box.querySelectorAll(".sw").forEach((b) => {
    const on = b.classList.contains("def") ? isDefault : (b.dataset.color || "").toLowerCase() === cur;
    b.classList.toggle("on", on);
  });
}

function pickColor(target, color) {
  theme[target] = color;
  localStorage.setItem("f91_" + target, color);
  applyTheme();
  markSelected(document.querySelector(`.swatches[data-target="${target}"]`), target);
}

function buildSwatches() {
  document.querySelectorAll(".swatches").forEach((box) => {
    const target = box.dataset.target;
    // border has no "default" swatch — blue is simply one of the choices
    if (target !== "border") {
      const def = document.createElement("button");
      def.className = "sw def";
      def.title = "Default";
      def.addEventListener("click", () => pickColor(target, THEME_DEFAULTS[target]));
      box.append(def);
    }
    paletteFor(target).forEach((c) => {
      const b = document.createElement("button");
      b.className = "sw";
      b.style.background = c;
      b.style.color = c;
      b.dataset.color = c;
      b.addEventListener("click", () => pickColor(target, c));
      box.append(b);
    });
    markSelected(box, target);
  });
}

$("#wrBox").addEventListener("click", () => el.lcd.classList.add("editing"));
$("#editX").addEventListener("click", () => el.lcd.classList.remove("editing"));

const brightSlider = $("#bright");
brightSlider.value = brightness;
brightSlider.addEventListener("input", () => {
  brightness = parseInt(brightSlider.value, 10);
  localStorage.setItem("f91_bright", String(brightness));
  applyTheme();
});

buildSwatches();
applyTheme();

/* ---- boot ---- */
updateUI();
tick();
setInterval(tick, 50);
