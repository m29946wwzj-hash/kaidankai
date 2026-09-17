#!/usr/bin/env node
/* Прогон игры без браузера: подменяем DOM, гоняем случайные прохождения
   и смотрим, что движок не падает и все сцены живые.

   node tools/smoke.js [число прогонов на кайдан]   (по умолчанию 400) */

const fs = require("fs");
const path = require("path");

const RUNS = parseInt(process.argv[2] || "400", 10);
const root = path.resolve(__dirname, "..");

/* ---- заглушки браузера ---- */
global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
const el = {
  innerHTML: "",
  classList: { add() {}, remove() {}, toggle() {} }
};
global.document = { getElementById: () => el, body: el };
global.navigator = {};
global.location = { protocol: "file:" };
global.scrollTo = () => {};

require(path.join(root, "js", "city.js"));
const kd = path.join(root, "js", "kaidans");
for (const f of fs.readdirSync(kd).sort()) if (f.endsWith(".js")) require(path.join(kd, f));
require(path.join(root, "js", "engine.js"));

const CITY = window.CITY;
const KAIDANS = window.KAIDANS;

/* ---- обход карты ---- */
function bfs(from, to, phase) {
  const prev = { [from]: null };
  const q = [from];
  while (q.length) {
    const n = q.shift();
    if (n === to) break;
    const links = (phase === "day" ? CITY.nodes[n].links : CITY.nodes[n].nightLinks) || [];
    for (const id of links) if (!(id in prev)) { prev[id] = n; q.push(id); }
  }
  if (!(to in prev)) return null;
  const out = [];
  for (let c = to; c !== from; c = prev[c]) out.unshift(c);
  return out;
}

/* ---- определение текущей сцены по тексту ---- */
const textToScene = new Map();
for (const k of KAIDANS) {
  for (const [sid, sc] of Object.entries(k.scenes)) textToScene.set(sc.t, `${k.id}.${sid}`);
}

const visited = new Set();
let deaths = 0, clears = 0, stuck = 0;

function state() {
  const h = el.innerHTML;
  if (h.includes('class="restart"')) return "death";
  if (h.includes('onclick="backToCity()"')) return "clear";
  return "playing";
}

/* какая сцена сейчас на экране — по тексту (годится и для концовок) */
function currentScene() {
  for (const [t, id] of textToScene) if (el.innerHTML.includes(t)) return id;
  return "?";
}

let phase = "day";
let here = CITY.start;

for (const k of KAIDANS) {
  for (let r = 0; r < RUNS; r++) {
    window.startRun();
    phase = "day"; here = CITY.start;

    while (phase !== k.when) { window.waitPhase(); phase = phase === "day" ? "night" : "day"; }
    const route = bfs(here, k.where, phase);
    if (!route) { console.log(`нет дороги к ${k.where} (${k.when})`); process.exit(1); }
    for (const n of route) { window.walkTo(n); here = n; }

    window.startKaidan(k.id);

    let steps = 0;
    for (;;) {
      visited.add(currentScene());
      const st = state();
      if (st === "death") { deaths++; break; }
      if (st === "clear") { clears++; window.backToCity(); phase = phase === "day" ? "night" : "day"; break; }
      if (steps++ > 60) { stuck++; break; }

      const m = el.innerHTML.match(/onclick="pick\((\d+)\)"/g) || [];
      if (!m.length) { stuck++; break; }
      window.pick(Math.floor(Math.random() * m.length));
    }
  }
}

let total = 0;
const missing = [];
for (const k of KAIDANS) {
  for (const sid of Object.keys(k.scenes)) { total++; if (!visited.has(`${k.id}.${sid}`)) missing.push(`${k.id}.${sid}`); }
}

console.log(`кайданов: ${KAIDANS.length} · сцен: ${total}`);
console.log(`прогонов: ${KAIDANS.length * RUNS} · смертей: ${deaths} · зачётов: ${clears} · застряло: ${stuck}`);
console.log(`покрытие сцен: ${total - missing.length}/${total}`);
if (missing.length) console.log("не встретились: " + missing.join(", "));
if (stuck) { console.log("\nзастряли — где-то нет выхода из сцены"); process.exit(1); }
console.log("\nдвижок не падает");
