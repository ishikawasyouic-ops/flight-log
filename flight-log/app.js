"use strict";

const STORE_KEY = "flightlog.v1";
const PLANES_KEY = "flightlog.planes.v1";
const $ = (id) => document.getElementById(id);

let records = load();
let registry = loadPlanes();
let startedAt = 0;
let elapsedBefore = 0;
let rafId = 0;

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadPlanes() {
  try {
    const data = JSON.parse(localStorage.getItem(PLANES_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

function savePlanes() {
  localStorage.setItem(PLANES_KEY, JSON.stringify(registry));
}

function planeLabel(p) {
  return `${p.version} / ${p.date} / ${p.serial}`;
}

// Newest manufacture date first, then highest serial number first.
function sortedRegistry() {
  return [...registry].sort((a, b) =>
    b.date.localeCompare(a.date) || b.serial.localeCompare(a.serial, "ja", { numeric: true }));
}

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- stopwatch ----
function currentMs() {
  return elapsedBefore + (startedAt ? performance.now() - startedAt : 0);
}

function tick() {
  $("display").textContent = fmt(currentMs() / 1000);
  rafId = requestAnimationFrame(tick);
}

$("startStop").addEventListener("click", () => {
  const btn = $("startStop");
  if (!startedAt) {
    startedAt = performance.now();
    btn.textContent = "ストップ";
    btn.classList.add("running");
    tick();
  } else {
    elapsedBefore = currentMs();
    startedAt = 0;
    cancelAnimationFrame(rafId);
    btn.textContent = "再開";
    btn.classList.remove("running");
    const sec = elapsedBefore / 1000;
    $("display").textContent = fmt(sec);
    $("seconds").value = sec.toFixed(2);
  }
});

$("reset").addEventListener("click", () => {
  cancelAnimationFrame(rafId);
  startedAt = 0;
  elapsedBefore = 0;
  $("display").textContent = "0:00.00";
  $("startStop").textContent = "スタート";
  $("startStop").classList.remove("running");
  $("seconds").value = "";
});

// ---- form ----
const FIELDS = ["weight", "place", "weather", "wind"];
const lastInput = JSON.parse(localStorage.getItem("flightlog.last") || "{}");
FIELDS.forEach((f) => { if (lastInput[f] != null) $(f).value = lastInput[f]; });

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const seconds = parseFloat($("seconds").value);
  if (!(seconds > 0)) return;
  const planeId = $("plane").value;
  const reg = registry.find((p) => p.id === planeId);
  const rec = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    seconds,
    plane: reg ? planeLabel(reg) : "",
    weight: $("weight").value,
    place: $("place").value.trim(),
    weather: $("weather").value,
    wind: $("wind").value,
    memo: $("memo").value.trim(),
  };
  records.unshift(rec);
  save();
  const last = { planeId };
  FIELDS.forEach((f) => (last[f] = $(f).value));
  localStorage.setItem("flightlog.last", JSON.stringify(last));
  $("memo").value = "";
  $("reset").click();
  refresh();
  showTab("log");
});

// ---- tabs ----
function showTab(name) {
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
}
document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

// ---- log ----
function planes() {
  return [...new Set(records.map((r) => r.plane).filter(Boolean))];
}

function renderPlaneSelect() {
  const sel = $("plane");
  const keep = sel.value || lastInput.planeId;
  const sorted = sortedRegistry();
  sel.innerHTML = sorted.length
    ? sorted.map((p) => `<option value="${esc(p.id)}">${esc(planeLabel(p))}</option>`).join("")
    : '<option value="">「機体」タブで登録してください</option>';
  if (sorted.some((p) => p.id === keep)) sel.value = keep;
}

function renderPlaneRegList() {
  $("planeRegList").innerHTML = sortedRegistry().map((p) => `<li>
    <span>${esc(planeLabel(p))}</span>
    <button class="del" data-id="${esc(p.id)}" aria-label="削除">🗑</button>
  </li>`).join("");
}

$("pDate").value = new Date().toLocaleDateString("sv-SE");

$("planeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const p = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    version: $("pVersion").value.trim(),
    date: $("pDate").value,
    serial: $("pSerial").value.trim(),
  };
  if (!p.version || !p.date || !p.serial) return;
  if (registry.some((r) => planeLabel(r) === planeLabel(p))) {
    alert("同じ機体がすでに登録されています。");
    return;
  }
  registry.push(p);
  savePlanes();
  $("pSerial").value = "";
  refresh();
  $("plane").value = p.id;
});

$("planeRegList").addEventListener("click", (e) => {
  const b = e.target.closest(".del");
  if (!b || !confirm("この機体の登録を削除しますか？（過去の記録は残ります）")) return;
  registry = registry.filter((r) => r.id !== b.dataset.id);
  savePlanes();
  refresh();
});

function refresh() {
  const pl = planes();
  renderPlaneSelect();
  renderPlaneRegList();
  $("placeList").innerHTML = [...new Set(records.map((r) => r.place).filter(Boolean))]
    .map((p) => `<option value="${esc(p)}">`).join("");

  const sel = $("filterPlane");
  const cur = sel.value;
  sel.innerHTML = '<option value="">すべての機体</option>' +
    pl.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  sel.value = pl.includes(cur) ? cur : "";

  renderList();
  renderStats();
}

function renderList() {
  const f = $("filterPlane").value;
  const rows = records.filter((r) => !f || r.plane === f);
  const best = Math.max(0, ...rows.map((r) => r.seconds));
  $("empty").style.display = rows.length ? "none" : "";
  $("list").innerHTML = rows.map((r) => {
    const d = new Date(r.at);
    const when = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const meta = [r.plane, r.weight && r.weight + "g", r.place, r.weather, r.wind && "風" + r.wind + "m/s"]
      .filter(Boolean).map(esc).join(" / ");
    return `<li>
      <span class="time ${r.seconds === best ? "best" : ""}">${r.seconds === best ? "★ " : ""}${fmt(r.seconds)}</span>
      <button class="del" data-id="${esc(r.id)}" aria-label="削除">🗑</button>
      <span class="meta">${when}${meta ? " — " + meta : ""}</span>
      ${r.memo ? `<span class="memo">${esc(r.memo)}</span>` : ""}
    </li>`;
  }).join("");
}

$("filterPlane").addEventListener("change", renderList);
$("list").addEventListener("click", (e) => {
  const b = e.target.closest(".del");
  if (!b || !confirm("この記録を削除しますか？")) return;
  records = records.filter((r) => r.id !== b.dataset.id);
  save();
  refresh();
});

// ---- stats ----
function renderStats() {
  if (!records.length) {
    $("stats").innerHTML = '<p class="muted">記録がありません。</p>';
    return;
  }
  const groups = new Map();
  records.forEach((r) => {
    const k = r.plane || "(機体名なし)";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r.seconds);
  });
  const rows = [...groups].map(([name, v]) => {
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    return `<tr><td>${esc(name)}</td><td>${v.length}</td><td>${fmt(Math.max(...v))}</td><td>${fmt(avg)}</td></tr>`;
  }).join("");
  $("stats").innerHTML = `<table>
    <tr><th>機体</th><th>回数</th><th>最高</th><th>平均</th></tr>${rows}</table>`;
}

// ---- export / import ----
function download(name, type, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("exportCsv").addEventListener("click", () => {
  const head = ["日時", "秒", "機体", "重さg", "場所", "天気", "風m/s", "メモ"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = records.map((r) => [r.at, r.seconds, r.plane, r.weight, r.place, r.weather, r.wind, r.memo].map(q).join(","));
  download("flight-log.csv", "text/csv", "\ufeff" + [head.map(q).join(","), ...lines].join("\r\n"));
});

$("exportJson").addEventListener("click", () => {
  download("flight-log-backup.json", "application/json", JSON.stringify({ records, planes: registry }));
});

$("importJson").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    // Older backups were a plain array of records.
    const data = Array.isArray(raw) ? raw : raw.records;
    const planeData = Array.isArray(raw) ? [] : raw.planes || [];
    if (!Array.isArray(data) || !data.every((r) => r && typeof r.seconds === "number" && r.at && r.id)) throw new Error();
    if (!Array.isArray(planeData) || !planeData.every((p) => p && p.id && p.version && p.date && p.serial)) throw new Error();
    if (!confirm(`記録${data.length}件、機体${planeData.length}件を読み込みます。既存のデータとマージします。`)) return;
    const ids = new Set(records.map((r) => r.id));
    data.forEach((r) => { if (!ids.has(r.id)) records.push(r); });
    records.sort((a, b) => (a.at < b.at ? 1 : -1));
    const pids = new Set(registry.map((p) => p.id));
    planeData.forEach((p) => { if (!pids.has(p.id)) registry.push(p); });
    save();
    savePlanes();
    refresh();
  } catch {
    alert("バックアップファイルを読み込めませんでした。");
  }
});

refresh();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
