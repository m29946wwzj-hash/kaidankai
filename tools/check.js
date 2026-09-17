#!/usr/bin/env node
/* Проверка целостности контента: запуск из папки kaidan/ —
   node tools/check.js

   Ловит: битые ссылки между сценами, недостижимые сцены, кайданы на
   недостижимых местах карты, сцены без выбора и без концовки. */

const fs = require("fs");
const path = require("path");

global.window = global;

const root = path.resolve(__dirname, "..");
const kaidanDir = path.join(root, "js", "kaidans");

require(path.join(root, "js", "city.js"));
for (const f of fs.readdirSync(kaidanDir).sort()) {
  if (f.endsWith(".js")) require(path.join(kaidanDir, f));
}

const CITY = window.CITY;
const KAIDANS = window.KAIDANS;

let errors = 0;
const bad = (msg) => { errors++; console.log("  ✗ " + msg); };

/* ---- места, достижимые из старта в каждой фазе ---- */
function reachable(phase) {
  const seen = new Set([CITY.start]);
  const q = [CITY.start];
  while (q.length) {
    const n = CITY.nodes[q.shift()];
    const links = (phase === "day" ? n.links : n.nightLinks) || [];
    for (const id of links) {
      if (!CITY.nodes[id]) { bad(`узел ${n.name} ссылается на несуществующее «${id}»`); continue; }
      if (!seen.has(id)) { seen.add(id); q.push(id); }
    }
  }
  return seen;
}
const reach = { day: reachable("day"), night: reachable("night") };

/* ---- карта ---- */
for (const [id, n] of Object.entries(CITY.nodes)) {
  if (!n.name || !n.day || !n.night) bad(`узел «${id}»: нет name/day/night`);
  for (const ph of ["links", "nightLinks"]) {
    for (const t of n[ph] || []) if (!CITY.nodes[t]) bad(`узел «${id}»: ${ph} → неизвестное «${t}»`);
  }
  // из любого места должно быть куда уйти в обеих фазах — иначе игрок запирается
  if (!(n.links || []).length) bad(`узел «${id}»: днём нет ни одной улицы наружу`);
  if (!(n.nightLinks || []).length) bad(`узел «${id}»: ночью нет ни одной улицы наружу`);
}

/* ---- кайданы ---- */
const ids = new Set();
for (const k of KAIDANS) {
  const tag = k.id || "(без id)";
  if (!k.id) bad("кайдан без id");
  if (ids.has(k.id)) bad(`${tag}: повтор id`);
  ids.add(k.id);
  if (!k.title) bad(`${tag}: нет title`);
  if (!CITY.nodes[k.where]) bad(`${tag}: место «${k.where}» не существует`);
  else if (!reach[k.when] || !reach[k.when].has(k.where)) {
    bad(`${tag}: место «${k.where}» недостижимо в фазе «${k.when}»`);
  }
  if (k.when !== "day" && k.when !== "night") bad(`${tag}: when = «${k.when}»`);
  if (!k.scenes) { bad(`${tag}: нет сцен`); continue; }
  if (!k.scenes[k.start]) bad(`${tag}: start «${k.start}» не существует`);

  const names = Object.keys(k.scenes);
  let clears = 0;

  for (const [sid, sc] of Object.entries(k.scenes)) {
    const sTag = `${tag}.${sid}`;
    if (!sc.t) bad(`${sTag}: пустой текст`);
    if (sc.end && sc.c) bad(`${sTag}: одновременно end и c`);
    if (sc.end) {
      if (sc.end !== "death" && sc.end !== "clear") bad(`${sTag}: end = «${sc.end}»`);
      if (sc.end === "clear") clears++;
      continue;
    }
    if (!Array.isArray(sc.c) || sc.c.length === 0) { bad(`${sTag}: нет ни выбора, ни концовки`); continue; }
    for (const choice of sc.c) {
      if (!choice.t) bad(`${sTag}: вариант без текста`);
      if (!choice.to) bad(`${sTag}: вариант «${choice.t}» без цели`);
      else if (!k.scenes[choice.to]) bad(`${sTag}: «${choice.t}» ведёт в несуществующее «${choice.to}»`);
    }
  }

  if (!clears) bad(`${tag}: нет ни одной удачной концовки`);

  // достижимость сцен из start
  const seen = new Set();
  const q = [k.start];
  while (q.length) {
    const sid = q.shift();
    if (seen.has(sid) || !k.scenes[sid]) continue;
    seen.add(sid);
    for (const choice of k.scenes[sid].c || []) if (choice.to) q.push(choice.to);
  }
  for (const sid of names) if (!seen.has(sid)) bad(`${tag}.${sid}: сцена недостижима из start`);
}

console.log(`\nкарта: ${Object.keys(CITY.nodes).length} мест · кайданов: ${KAIDANS.length}`);
console.log(`день: доступно ${reach.day.size} мест · ночь: ${reach.night.size}`);
if (errors) { console.log(`\nошибок: ${errors}`); process.exit(1); }
console.log("\nвсё сходится");
