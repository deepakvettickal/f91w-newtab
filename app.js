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
  deadlineEdit: $("#deadlineEdit"),
  deadlineInput: $("#deadlineInput"),
  deadlineStart: $("#deadlineStart"),
  deadlineShow: $("#deadlineShow"),
};
const MON3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WD3 = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Persistent settings. Extensions use chrome.storage.local (localStorage is
// unreliable on new-tab pages); fall back to localStorage for the file:// preview.
// A synchronous cache is filled once by loadStore() before first render.
const STORE_KEYS = ["f91_top", "f91_bottom", "f91_ink", "f91_border", "f91_bright", "f91_24h", "f91_tip", "f91_lit", "f91_clean", "f91_mode", "f91_tmr", "f91_sw"];
const hasChromeStore = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
let storeCache = {};
const lsGet = (k) => (k in storeCache ? storeCache[k] : null);
function lsSet(k, v) {
  storeCache[k] = v;
  if (hasChromeStore) chrome.storage.local.set({ [k]: v });
  else { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
}
function loadStore() {
  return new Promise((resolve) => {
    if (hasChromeStore) {
      chrome.storage.local.get(STORE_KEYS, (data) => { storeCache = data || {}; resolve(); });
    } else {
      try { STORE_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v != null) storeCache[k] = v; }); }
      catch { /* ignore */ }
      resolve();
    }
  });
}

let mode = "CLOCK";
let use24 = true;   // real value loaded in init()
let field = 0; // timer edit field: 0 = minutes, 1 = seconds

const sw = { running: false, elapsed: 0, startedAt: 0 };
const timer = { running: false, remaining: 5 * 60000, endsAt: 0, setMs: 5 * 60000 };

/* ---- helpers (values only — ghosts are static in the HTML) ---- */
const pad = (n) => String(n).padStart(2, "0");
function setTime(a, b) { el.g1.textContent = pad(a); el.g2.textContent = pad(b); }
const fmtDeadline = (ts) => {
  const d = new Date(ts);
  return `${WD3[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localDatetimeMin = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
    if (timer.running && r <= 0) { timer.running = false; timer.remaining = 0; r = 0; saveTimer(); updateUI(); }
    el.timemode.textContent = timer.running ? "RUN" : "TR";
    el.daynum.textContent = "";
    const total = Math.ceil(r / 1000);  // round up until it truly hits 0
    const days = Math.floor(total / 86400);
    const rem = total % 86400;
    // 2-char cell: "5D" for < 10 days, else the (capped) day count
    el.weekday.textContent = days < 10 ? days + "D" : String(Math.min(days, 99));
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

  // deadline input while editing the timer; deadline readout while it runs
  if (editing) { el.deadlineEdit.style.display = "flex"; el.deadlineInput.min = localDatetimeMin(); }
  else { el.deadlineEdit.style.display = "none"; }
  el.deadlineShow.textContent =
    (mode === "TIMER" && timer.running) ? "DEADLINE  " + fmtDeadline(timer.endsAt) : "";
}

/* ---- persist mode + stopwatch/timer state so they survive across new tabs.
   Timestamps are absolute (Date.now-based), so a running timer/stopwatch keeps
   counting in real time no matter which tab reads it. ---- */
function saveMode() { lsSet("f91_mode", mode); }
function saveTimer() { lsSet("f91_tmr", JSON.stringify(timer)); }
function saveSw() { lsSet("f91_sw", JSON.stringify(sw)); }

/* ---- actions ---- */
function toggleFormat() {
  use24 = !use24;
  lsSet("f91_24h", use24 ? "1" : "0");
}

function startStop() {
  const now = Date.now();
  if (mode === "SW") {
    if (sw.running) { sw.elapsed += now - sw.startedAt; sw.running = false; }
    else { sw.startedAt = now; sw.running = true; }
    saveSw();
  } else if (mode === "TIMER") {
    if (timer.running) { timer.remaining = Math.max(0, timer.endsAt - now); timer.running = false; }
    else {
      if (timer.remaining <= 0) timer.remaining = timer.setMs;
      if (timer.remaining <= 0) return;           // nothing set -> ignore
      timer.endsAt = now + timer.remaining; timer.running = true;
    }
    saveTimer();
  }
}

function resetCurrent() {
  if (mode === "SW") { sw.running = false; sw.elapsed = 0; sw.startedAt = 0; saveSw(); }
  else if (mode === "TIMER") { timer.running = false; timer.setMs = 0; timer.remaining = 0; saveTimer(); }
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
  saveTimer();
}

/* ---- button wiring ---- */
function toggleLight() {
  el.lcd.classList.toggle("lit");
  lsSet("f91_lit", el.lcd.classList.contains("lit") ? "1" : "0");
}
el.lightBtn.addEventListener("click", () => {
  if (mode === "CLOCK") toggleLight();
  else resetCurrent();
  updateUI(); tick();
});
el.modeBtn.addEventListener("click", () => {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  saveMode();
  updateUI(); tick();
});
el.altBtn.addEventListener("click", () => {
  if (mode === "CLOCK") toggleFormat(); else startStop();
  updateUI(); tick();
});

// timer START: use the entered deadline date/time if given, else the field duration
el.deadlineStart.addEventListener("click", () => {
  if (mode !== "TIMER" || timer.running) return;
  const now = Date.now();
  const val = el.deadlineInput.value;
  if (val) {
    const t = new Date(val).getTime();
    if (isNaN(t) || t <= now) return;            // ignore empty/past
    timer.remaining = t - now; timer.setMs = timer.remaining; timer.endsAt = t;
  } else {
    if (timer.remaining <= 0) timer.remaining = timer.setMs;
    if (timer.remaining <= 0) return;            // nothing set at all
    timer.endsAt = now + timer.remaining;
  }
  timer.running = true;
  el.deadlineInput.value = "";
  saveTimer(); updateUI(); tick();
});

/* ---- keyboard ---- */
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "l" || k === "L") { toggleLight(); return; }
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
// border palette: muted line colors (no neon) + white / grey / black + transparent
const BORDER = ["#4f8bd0", "#3fb6c8", "#5a6fd6", "#7f8a99", "#4fb07a", "#c06a6a",
                "#c9a86a", "#FFFFFF", "#808080", "#000000", "transparent"];
const paletteFor = (t) => (t === "border" ? BORDER : NEON);

// defaults: gradient = original subtle backlight, ink off-white, border blue
const THEME_DEFAULTS = { top: "#2a2a26", bottom: "#050505", ink: "#e8e7e2", border: "#4f8bd0" };
const theme = { ...THEME_DEFAULTS };   // real values loaded in init()
let brightness = 70;

function toRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function hexToRgba(hex, a) { const [r, g, b] = toRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; }
const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

// the outer glow reflects the LIGHT gradient — blend of its *bright* colors
// (a near-black end, e.g. the default bottom, is ignored so it doesn't dim it)
function glowColor() {
  const cols = [theme.top, theme.bottom].map(toRgb).filter((c) => luma(c) > 40);
  if (!cols.length) return "rgba(232, 231, 226, 0.4)";   // both dark -> original soft glow
  const avg = cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
                  .map((v) => Math.round(v / cols.length));
  return `rgba(${avg[0]}, ${avg[1]}, ${avg[2]}, 0.7)`;
}

function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty("--grad-top", theme.top);
  r.setProperty("--grad-bottom", theme.bottom);
  r.setProperty("--ink", theme.ink);
  r.setProperty("--ghost", hexToRgba(theme.ink, 0.1));
  r.setProperty("--accent", theme.border);
  r.setProperty("--lite", (brightness / 100).toFixed(2));
  r.setProperty("--glow", glowColor());
  // per-edge glow colors so the no-border halo matches the fill at each edge
  r.setProperty("--glow-top", hexToRgba(theme.top, 0.85));
  r.setProperty("--glow-bottom", hexToRgba(theme.bottom, 0.85));
  el.lcd.classList.toggle("borderless", theme.border === "transparent");
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
  lsSet("f91_" + target, color);
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
      b.dataset.color = c;
      if (c === "transparent") {
        b.className = "sw clear";      // "no border" — empty ring with a slash
        b.title = "None (transparent)";
      } else {
        b.className = "sw";
        b.style.background = c;
        b.style.color = c;
      }
      b.addEventListener("click", () => pickColor(target, c));
      box.append(b);
    });
    markSelected(box, target);
  });
}

function resetTheme() {
  theme.top = THEME_DEFAULTS.top;
  theme.bottom = THEME_DEFAULTS.bottom;
  theme.ink = THEME_DEFAULTS.ink;
  theme.border = THEME_DEFAULTS.border;
  brightness = 70;
  ["top", "bottom", "ink", "border"].forEach((k) => lsSet("f91_" + k, theme[k]));
  lsSet("f91_bright", "70");
  brightSlider.value = 70;
  applyTheme();
  document.querySelectorAll(".swatches").forEach((box) => markSelected(box, box.dataset.target));
}

$("#wrBox").addEventListener("click", () => el.lcd.classList.add("editing"));
$("#editX").addEventListener("click", () => el.lcd.classList.remove("editing"));
$("#editReset").addEventListener("click", resetTheme);

const cleanBtn = $("#cleanBtn");
cleanBtn.addEventListener("click", () => {
  const on = el.lcd.classList.toggle("clean");
  cleanBtn.classList.toggle("on", on);
  lsSet("f91_clean", on ? "1" : "0");
});

const brightSlider = $("#bright");
brightSlider.addEventListener("input", () => {
  brightness = parseInt(brightSlider.value, 10);
  lsSet("f91_bright", String(brightness));
  applyTheme();
});

function showTipOnce() {
  if (lsGet("f91_tip")) return;
  const tip = $("#wrTip");
  const dismissTip = () => { tip.classList.remove("show"); lsSet("f91_tip", "1"); };
  tip.classList.add("show");
  setTimeout(dismissTip, 6000);
  $("#wrBox").addEventListener("click", dismissTip, { once: true });
}

/* ---- boot: load saved settings first, then render ---- */
async function init() {
  await loadStore();
  use24 = lsGet("f91_24h") !== "0";
  theme.top = lsGet("f91_top") || THEME_DEFAULTS.top;
  theme.bottom = lsGet("f91_bottom") || THEME_DEFAULTS.bottom;
  theme.ink = lsGet("f91_ink") || THEME_DEFAULTS.ink;
  theme.border = lsGet("f91_border") || THEME_DEFAULTS.border;
  brightness = parseInt(lsGet("f91_bright") || "70", 10);
  brightSlider.value = brightness;
  if (lsGet("f91_lit") === "1") el.lcd.classList.add("lit");
  if (lsGet("f91_clean") === "1") { el.lcd.classList.add("clean"); cleanBtn.classList.add("on"); }

  // restore mode + stopwatch/timer state (so a new tab resumes where you were)
  restoreState();

  buildSwatches();
  applyTheme();
  showTipOnce();
  updateUI();
  tick();
  // saved state is applied and painted — reveal without the default-state flash
  document.documentElement.classList.add("ready");
  setInterval(tick, 50);

  // keep already-open tabs in sync when mode/timer/stopwatch change elsewhere
  if (hasChromeStore) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      let touched = false;
      for (const k of ["f91_mode", "f91_tmr", "f91_sw"]) {
        if (changes[k]) { storeCache[k] = changes[k].newValue; touched = true; }
      }
      if (touched) { restoreState(); updateUI(); tick(); }
    });
  }
}

function restoreState() {
  mode = lsGet("f91_mode") || "CLOCK";
  try { const t = lsGet("f91_tmr"); if (t) Object.assign(timer, JSON.parse(t)); } catch { /* ignore */ }
  try { const s = lsGet("f91_sw"); if (s) Object.assign(sw, JSON.parse(s)); } catch { /* ignore */ }
  // a timer that already elapsed while all tabs were closed reads as finished
  if (timer.running && timer.endsAt <= Date.now()) { timer.running = false; timer.remaining = 0; }
}

init();
// safety: never leave the face hidden if init() is delayed or errors
setTimeout(() => document.documentElement.classList.add("ready"), 500);
