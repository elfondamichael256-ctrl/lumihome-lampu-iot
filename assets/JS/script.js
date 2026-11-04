/* =========================================================
   LumiHome — Script
   ========================================================= */

const $ = (id) => document.getElementById(id);

const DEF = {
  mode: "demo",
  token: "",
  server: "blynk.cloud",
  ip: "",
  pins: ["v1", "v2", "v3", "v4"], // ✅ konsisten dgn placeholder
  names: ["Ruang tamu", "Kamar tidur", "Dapur", "Teras"],
  theme: "dark",
};

let cfg = { ...DEF };
let st = [0, 0, 0, 0];
let busy = [0, 0, 0, 0];
let pollTimer = null;
let allOn = false;

let timers = [null, null, null, null];
let timerMeta = [null, null, null, null];
let uniTimer = null;
let uniTimerMeta = null;

const APP_START = Date.now();
let deviceStart = null;
let deviceOnline = false;

let firstLoad = true;
let activityLog = [];

/* ============ PERSISTENCE ============ */
try {
  const s = localStorage.getItem("lumiCfg");
  if (s) cfg = { ...DEF, ...JSON.parse(s) };
  const t = localStorage.getItem("lumiTheme");
  if (t) cfg.theme = t;
  const l = localStorage.getItem("lumiLog");
  if (l) activityLog = JSON.parse(l).slice(0, 50);
} catch (e) {}

document.documentElement.setAttribute("data-theme", cfg.theme || "dark");

/* ============ UTIL ============ */
function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDurasi(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return d > 0
    ? `${d}h ${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatUptime(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return d > 0
    ? `${d}h ${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function bulb() {
  return `<svg viewBox="0 0 96 120" aria-hidden="true">
    <path class="glass" d="M48 6C27 6 12 22 12 42c0 13 7 22 14 30 4 5 6 9 6 14h32c0-5 2-9 6-14 7-8 14-17 14-30C84 22 69 6 48 6z"/>
    <rect class="base" x="32" y="90" width="32" height="8" rx="3"/>
    <rect class="base" x="35" y="100" width="26" height="8" rx="3"/>
    <rect class="base" x="41" y="110" width="14" height="7" rx="3"/>
  </svg>`;
}

/* ============ TOAST ============ */
function toast(msg, type = "error") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => (t.className = ""), 3200);
}

/* ============ ACTIVITY LOG ============ */
function logActivity(msg) {
  const now = new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  activityLog.unshift({ time, msg });
  activityLog = activityLog.slice(0, 50);
  try {
    localStorage.setItem("lumiLog", JSON.stringify(activityLog));
  } catch (e) {}
  renderLog();
}

function renderLog() {
  const list = $("logList");
  if (!activityLog.length) {
    list.innerHTML = `<li class="log-empty">Belum ada aktivitas.</li>`;
    return;
  }
  list.innerHTML = activityLog
    .map(
      (e) =>
        `<li><span class="log-time">${e.time}</span><span class="log-msg">${esc(e.msg)}</span></li>`,
    )
    .join("");
}

/* ============ STATUS ============ */
function setStatus(kind, text) {
  $("dot").className = "dot " + kind;
  $("stxt").textContent = text;
}

function markDeviceOnline() {
  if (!deviceOnline) {
    deviceOnline = true;
    deviceStart = Date.now();
  }
}

function markDeviceOffline() {
  deviceOnline = false;
  deviceStart = null;
}

/* ============ RENDER ============ */
function renderSkeleton() {
  $("grid").innerHTML = Array.from({ length: 4 })
    .map(() => `<div class="skeleton"></div>`)
    .join("");
}

function render() {
  $("grid").innerHTML = cfg.names
    .map((n, i) => {
      const timerActive = !!timers[i];
      const sisaText =
        timerActive && timerMeta[i]
          ? formatDurasi(timerMeta[i].end - Date.now())
          : "";
      return `<article class="lamp ${st[i] ? "on" : ""} ${busy[i] ? "busy" : ""}">
        ${bulb()}
        <div class="name">${esc(n)}</div>
        <div class="state">${st[i] ? "Menyala" : "Mati"}</div>
        <button class="sw" data-i="${i}" role="switch" aria-checked="${!!st[i]}" aria-label="${esc(n)}"></button>
        <button class="timer-btn ${timerActive ? "active" : ""}" data-timer="${i}">
          ${timerActive ? "⏱ Timer aktif" : "⏱ Atur timer"}
        </button>
        <div class="timer-label">${sisaText}</div>
      </article>`;
    })
    .join("");

  const allOnNow = st.every((v) => v === 1);
  allOn = allOnNow;
  const btn = $("allOnOff");
  btn.textContent = allOnNow ? "Matikan semua" : "Nyalakan semua";
  btn.classList.toggle("active", allOnNow);

  // Update stat cards
  $("onCount").textContent = st.filter((v) => v === 1).length;
  $("timerCount").textContent = timers.filter(Boolean).length;
}

function updateUptimeDisplay() {
  $("appUptime").textContent = formatUptime(Date.now() - APP_START);
  $("devUptime").textContent =
    deviceOnline && deviceStart
      ? formatUptime(Date.now() - deviceStart)
      : "Offline";
}

/* ============ HTTP ============ */
async function http(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}

async function send(i, val) {
  if (cfg.mode === "demo") return;
  if (cfg.mode === "blynk") {
    const pin = (cfg.pins[i] || "v" + (i + 1)).toLowerCase();
    await http(
      `https://${cfg.server}/external/api/update?token=${encodeURIComponent(cfg.token)}&${pin}=${val}`,
    );
  } else {
    await http(`http://${cfg.ip}/set?ch=${i + 1}&state=${val}`);
  }
}

/* ============ POLL ============ */
async function pull() {
  if (cfg.mode === "demo") {
    setStatus("on", "Mode demo");
    markDeviceOnline();
    if (firstLoad) {
      render();
      firstLoad = false;
    }
    return;
  }
  try {
    if (cfg.mode === "blynk") {
      if (!cfg.token) {
        setStatus("err", "Token belum diisi");
        markDeviceOffline();
        if (firstLoad) {
          render();
          firstLoad = false;
        }
        return;
      }
      const pins = cfg.pins.map((p, i) => (p || "v" + (i + 1)).toLowerCase());
      const j = JSON.parse(
        await http(
          `https://${cfg.server}/external/api/get?token=${encodeURIComponent(cfg.token)}&${pins.join("&")}`,
        ),
      );
      st = pins.map((p) => (+j[p] ? 1 : 0));

      let hw = "true";
      try {
        hw = await http(
          `https://${cfg.server}/external/api/isHardwareConnected?token=${encodeURIComponent(cfg.token)}`,
        );
      } catch (e) {}

      if (hw.trim() === "true") {
        setStatus("on", "ESP online via Blynk");
        markDeviceOnline();
      } else {
        setStatus("err", "Blynk terhubung, ESP offline");
        markDeviceOffline();
      }
    } else {
      if (!cfg.ip) {
        setStatus("err", "IP belum diisi");
        markDeviceOffline();
        if (firstLoad) {
          render();
          firstLoad = false;
        }
        return;
      }
      const j = JSON.parse(await http(`http://${cfg.ip}/status`));
      st = [1, 2, 3, 4].map((n) => (+(j[n] ?? j["l" + n]) ? 1 : 0));
      setStatus("on", "ESP online (" + cfg.ip + ")");
      markDeviceOnline();
    }
    render();
    firstLoad = false;
  } catch (e) {
    setStatus("err", "Gagal terhubung");
    markDeviceOffline();
    if (firstLoad) {
      render();
      firstLoad = false;
    }
  }
}

/* ============ TOGGLE ============ */
async function toggle(i, val, silent = false) {
  const prev = st[i];
  st[i] = val;
  busy[i] = 1;
  render();
  try {
    await send(i, val);
    if (!silent) {
      logActivity(`${cfg.names[i]} ${val ? "dinyalakan" : "dimatikan"}`);
    }
  } catch (e) {
    st[i] = prev;
    toast("Gagal mengirim perintah. Cek token/IP dan koneksi.", "error");
  }
  busy[i] = 0;
  render();
}

/* ============ TIMER ============ */
let currentTimerIdx = -1;

function readTimerFields(prefix) {
  const ids =
    prefix === "t"
      ? { d: "tDay", h: "tHour", m: "tMin", s: "tSec" }
      : { d: "uDay", h: "uHour", m: "uMin", s: "uSec" };
  const d = Math.max(0, +$(ids.d).value || 0);
  const h = Math.max(0, +$(ids.h).value || 0);
  const m = Math.max(0, +$(ids.m).value || 0);
  const s = Math.max(0, +$(ids.s).value || 0);
  return ((d * 24 + h) * 60 + m) * 60 * 1000 + s * 1000;
}

function openTimerDialog(i) {
  currentTimerIdx = i;
  $("timerTitle").textContent = "Timer: " + cfg.names[i];
  $("timerInfo").textContent = timers[i]
    ? "Timer sedang aktif. Kamu bisa menghentikannya atau mengatur ulang."
    : "Atur waktu nyala/mati otomatis.";
  $("tDay").value = 0;
  $("tHour").value = 0;
  $("tMin").value = 1;
  $("tSec").value = 0;
  $("timerAction").value = "off";
  $("timerStop").hidden = !timers[i];
  $("dlgTimer").showModal();
}

function startLampTimer(i, ms, action) {
  if (ms <= 0) {
    toast("Durasi timer harus lebih dari 0", "error");
    return;
  }
  if (timers[i]) clearTimeout(timers[i]);
  const end = Date.now() + ms;
  timerMeta[i] = { end, action };

  timers[i] = setTimeout(async () => {
    let target;
    if (action === "on") target = 1;
    else if (action === "off") target = 0;
    else target = st[i] ? 0 : 1;

    await toggle(i, target, true);
    logActivity(`Timer "${cfg.names[i]}" selesai`);
    toast(`Timer lampu "${cfg.names[i]}" selesai`, "success");

    timers[i] = null;
    timerMeta[i] = null;
    render();
  }, ms);

  logActivity(`Timer dimulai: ${formatDurasi(ms)} untuk "${cfg.names[i]}"`);
  render();
  toast(`Timer dimulai: ${formatDurasi(ms)}`, "info");
}

function stopLampTimer(i) {
  if (timers[i]) {
    clearTimeout(timers[i]);
    timers[i] = null;
    timerMeta[i] = null;
    logActivity(`Timer "${cfg.names[i]}" dihentikan`);
    toast(`Timer "${cfg.names[i]}" dihentikan`, "info");
    render();
  }
}

function openUniTimerDialog() {
  $("uDay").value = 0;
  $("uHour").value = 0;
  $("uMin").value = 1;
  $("uSec").value = 0;
  $("uniAction").value = "off";
  $("uniStop").hidden = !uniTimer;
  $("dlgUniTimer").showModal();
}

function startUniTimer(ms, action) {
  if (ms <= 0) {
    toast("Durasi timer harus lebih dari 0", "error");
    return;
  }
  if (uniTimer) clearTimeout(uniTimer);
  const end = Date.now() + ms;
  uniTimerMeta = { end, action };

  uniTimer = setTimeout(async () => {
    let target;
    if (action === "on") target = 1;
    else if (action === "off") target = 0;
    else target = null;

    for (let i = 0; i < 4; i++) {
      const val = target === null ? (st[i] ? 0 : 1) : target;
      await toggle(i, val, true);
    }
    logActivity("Timer universal selesai");
    toast("Timer universal selesai", "success");
    uniTimer = null;
    uniTimerMeta = null;
    render();
  }, ms);

  logActivity(`Timer universal dimulai: ${formatDurasi(ms)}`);
  toast(`Timer universal dimulai: ${formatDurasi(ms)}`, "info");
}

function stopUniTimer() {
  if (uniTimer) {
    clearTimeout(uniTimer);
    uniTimer = null;
    uniTimerMeta = null;
    logActivity("Timer universal dihentikan");
    toast("Timer universal dihentikan", "info");
  }
}

/* ============ INTERVAL ============ */
setInterval(() => {
  updateUptimeDisplay();

  // Clock
  const now = new Date();
  $("clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  document.querySelectorAll(".timer-label").forEach((el, i) => {
    if (timerMeta[i]) {
      el.textContent = formatDurasi(timerMeta[i].end - Date.now());
    }
  });
}, 1000);

/* ============ EVENT: GRID ============ */
$("grid").addEventListener("click", (e) => {
  const sw = e.target.closest(".sw");
  if (sw) {
    const i = +sw.dataset.i;
    toggle(i, st[i] ? 0 : 1);
    return;
  }
  const tb = e.target.closest(".timer-btn");
  if (tb) openTimerDialog(+tb.dataset.timer);
});

/* ============ EVENT: ALL ON/OFF ============ */
$("allOnOff").onclick = () => {
  const target = allOn ? 0 : 1;
  [0, 1, 2, 3].forEach((i) => toggle(i, target, true));
  logActivity(target ? "Semua lampu dinyalakan" : "Semua lampu dimatikan");
};

/* ============ EVENT: SCENES ============ */
document.querySelectorAll(".scene").forEach((btn) => {
  btn.onclick = async () => {
    const scene = btn.dataset.scene;
    let targets = [0, 0, 0, 0];
    let label = "";

    if (scene === "all-off") {
      targets = [0, 0, 0, 0];
      label = "Scene: Semua mati";
    } else if (scene === "all-on") {
      targets = [1, 1, 1, 1];
      label = "Scene: Semua nyala";
    } else if (scene === "sleep") {
      targets = [0, 1, 0, 0];
      label = "Scene: Mode tidur";
    } else if (scene === "away") {
      targets = [0, 0, 0, 1];
      label = "Scene: Keluar rumah";
    }

    for (let i = 0; i < 4; i++) {
      if (st[i] !== targets[i]) await toggle(i, targets[i], true);
    }
    logActivity(label);
    toast(label + " diterapkan", "success");
  };
});

/* ============ EVENT: THEME ============ */
$("themeToggle").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  cfg.theme = next;
  try {
    localStorage.setItem("lumiTheme", next);
  } catch (e) {}
};

/* ============ EVENT: LOG ============ */
$("clearLog").onclick = () => {
  activityLog = [];
  try {
    localStorage.removeItem("lumiLog");
  } catch (e) {}
  renderLog();
  toast("Riwayat dibersihkan", "info");
};

/* ============ EVENT: SETTINGS ============ */
function showFields() {
  $("fBlynk").hidden = $("mode").value !== "blynk";
  $("fEsp").hidden = $("mode").value !== "esp";
}
$("mode").onchange = showFields;

$("btnSet").onclick = () => {
  $("mode").value = cfg.mode;
  $("token").value = cfg.token;
  $("server").value = cfg.server;
  $("ip").value = cfg.ip;
  [1, 2, 3, 4].forEach((n) => {
    $("vp" + n).value = cfg.pins[n - 1];
    $("n" + n).value = cfg.names[n - 1];
  });
  showFields();
  $("dlg").showModal();
};

$("cancel").onclick = () => $("dlg").close();

$("save").onclick = () => {
  cfg = {
    ...cfg,
    mode: $("mode").value,
    token: $("token").value.trim(),
    server: $("server").value,
    ip: $("ip").value.trim(),
    pins: [1, 2, 3, 4].map((n) => $("vp" + n).value.trim() || "v" + n),
    names: [1, 2, 3, 4].map((n) => $("n" + n).value.trim() || "Lampu " + n),
  };
  try {
    localStorage.setItem("lumiCfg", JSON.stringify(cfg));
  } catch (e) {}
  $("dlg").close();
  render();
  pull();
  logActivity("Pengaturan disimpan");
  toast("Pengaturan disimpan", "success");
};

/* ============ EVENT: OVERLAY INFO PROJECT ============ */
const infoOverlay = $("infoOverlay");

function openInfo() {
  // Isi data runtime sebelum ditampilkan
  $("infoMode").textContent = cfg.mode;
  $("infoUptime").textContent = formatUptime(Date.now() - APP_START);
  $("infoDevice").textContent =
    deviceOnline && deviceStart
      ? formatUptime(Date.now() - deviceStart)
      : "Offline";
  $("infoOnCount").textContent = st.filter((v) => v === 1).length;

  infoOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeInfo() {
  infoOverlay.hidden = true;
  document.body.style.overflow = "";
}

// Tombol di header
$("btnInfo").onclick = openInfo;

// Tombol close di dalam overlay
$("infoClose").onclick = closeInfo;

// Klik backdrop untuk menutup
document.querySelector("[data-close-info]").onclick = closeInfo;

// Tombol Escape untuk menutup
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !infoOverlay.hidden) {
    closeInfo();
  }
});

// Update runtime di overlay kalau sedang terbuka
setInterval(() => {
  if (!infoOverlay.hidden) {
    $("infoUptime").textContent = formatUptime(Date.now() - APP_START);
    $("infoDevice").textContent =
      deviceOnline && deviceStart
        ? formatUptime(Date.now() - deviceStart)
        : "Offline";
    $("infoOnCount").textContent = st.filter((v) => v === 1).length;
  }
}, 1000);

/* ============ EVENT: TIMER DIALOGS ============ */
$("timerCancel").onclick = () => $("dlgTimer").close();
$("timerStart").onclick = () => {
  const ms = readTimerFields("t");
  const action = $("timerAction").value;
  startLampTimer(currentTimerIdx, ms, action);
  $("dlgTimer").close();
};
$("timerStop").onclick = () => {
  stopLampTimer(currentTimerIdx);
  $("dlgTimer").close();
};

$("btnUniversal").onclick = openUniTimerDialog;
$("uniCancel").onclick = () => $("dlgUniTimer").close();
$("uniStart").onclick = () => {
  const ms = readTimerFields("u");
  const action = $("uniAction").value;
  startUniTimer(ms, action);
  $("dlgUniTimer").close();
};
$("uniStop").onclick = () => {
  stopUniTimer();
  $("dlgUniTimer").close();
};

/* ============ INIT ============ */
renderSkeleton();
renderLog();
updateUptimeDisplay();
render();
pull();
pollTimer = setInterval(pull, 5000);
