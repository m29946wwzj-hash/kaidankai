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

require(path.join(root, "js", "items.js"));
require(path.join(root, "js", "roster.js"));
require(path.join(root, "js", "prologue.js"));
require(path.join(root, "js", "voices.js"));
require(path.join(root, "js", "city.js"));
for (const f of fs.readdirSync(kaidanDir).sort()) {
  if (f.endsWith(".js")) require(path.join(kaidanDir, f));
}

const CITY = window.CITY;
const KAIDANS = window.KAIDANS;
const WEAPON_IDS = new Set((window.WEAPONS || []).map((w) => w.id));

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
    // всегда должен остаться вариант, доступный без оружия, — иначе сцена запирает
    if (!sc.c.some((ch) => !ch.need)) {
      bad(`${sTag}: все варианты требуют оружия — без него сцена запирает`);
    }
    for (const choice of sc.c) {
      if (!choice.t) bad(`${sTag}: вариант без текста`);
      if (!choice.to) bad(`${sTag}: вариант «${choice.t}» без цели`);
      else if (!k.scenes[choice.to]) bad(`${sTag}: «${choice.t}» ведёт в несуществующее «${choice.to}»`);
      if (choice.need && !WEAPON_IDS.has(choice.need)) {
        bad(`${sTag}: «${choice.t}» требует оружие «${choice.need}», которого нет в WEAPONS`);
      }
    }
  }

  if (!clears) bad(`${tag}: нет ни одной удачной концовки`);
  if (!k.voice && !(window.VOICES || {})[k.id]) bad(`${tag}: нет голоса — ни поля voice, ни записи в VOICES`);

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

/* ---- повторяющиеся ключи сцен ----
   В объекте одинаковые ключи не спорят, а затирают друг друга: сцена с тем же
   именем просто исчезает, и в движке остаётся последняя. Поэтому смотрим сам
   исходник, а не загруженный объект. */
for (const f of fs.readdirSync(kaidanDir).sort()) {
  if (!f.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(kaidanDir, f), "utf8").split("\n");
  const seenKeys = new Map();
  src.forEach((line, i) => {
    const m = line.match(/^ {4}([A-Za-z0-9_$]+): \{$/);
    if (!m) return;
    if (seenKeys.has(m[1])) bad(`${f}: сцена «${m[1]}» объявлена дважды (строки ${seenKeys.get(m[1])} и ${i + 1})`);
    else seenKeys.set(m[1], i + 1);
  });
}

/* ---- предметы, герой, участники ---- */
function uniqueIds(list, tag) {
  const seen = new Set();
  for (const x of list || []) {
    if (!x.id) bad(`${tag}: запись без id`);
    if (seen.has(x.id)) bad(`${tag}: повтор id «${x.id}»`);
    seen.add(x.id);
  }
  return seen;
}

uniqueIds(window.WEAPONS, "WEAPONS");
for (const w of window.WEAPONS || []) if (!w.name) bad(`оружие «${w.id}»: нет name`);
uniqueIds(window.OMOMORI, "OMOMORI");
for (const m of window.OMOMORI || []) {
  if (!m.name || !m.note) bad(`омомори «${m.id}»: нет name/note`);
}
for (const l of window.LOOT || []) {
  if (!(l.weight > 0)) bad(`LOOT: вес «${l.kind}» не положительный`);
  if (!l.text) bad(`LOOT: у «${l.kind}» нет текста`);
  if (l.kind === "weapon" && !WEAPON_IDS.size) bad("LOOT: оружие выпадает, а WEAPONS пуст");
}
uniqueIds(window.ORIGINS, "ORIGINS");
if ((window.ORIGINS || []).length < 2) bad("ORIGINS: меньше двух вариантов входа в город");
for (const o of window.ORIGINS || []) {
  if (!o.label || !o.arrival || !o.short) bad(`ORIGINS «${o.id}»: нет label/arrival/short`);
  for (const f of ["food", "water", "meds"]) {
    if (typeof o[f] !== "number" || o[f] < 0) bad(`ORIGINS «${o.id}»: ${f} = ${o[f]}`);
  }
  for (const w of o.weapons || []) if (!WEAPON_IDS.has(w)) bad(`ORIGINS «${o.id}»: нет оружия «${w}»`);
}
const allNames = new Set([...(window.NAMES || []), ...(window.RESERVE || [])]);
if (allNames.size < 120) bad(`имён участников мало: ${allNames.size}, нужно хотя бы 120`);
const rosterProbe = window.makeRoster("Проверка");
if (rosterProbe.roster.length !== 100) bad(`в городе ${rosterProbe.roster.length} участников, а должно быть 100`);
if (new Set(rosterProbe.roster.map((p) => p.name)).size !== 100) bad("в составе есть повторяющиеся имена");
if (rosterProbe.deck.length < 40) bad(`запасных имён мало: ${rosterProbe.deck.length}`);

console.log(`\nкарта: ${Object.keys(CITY.nodes).length} мест · кайданов: ${KAIDANS.length}`);
console.log(`предметов: оружие ${(window.WEAPONS || []).length} · омомори ${(window.OMOMORI || []).length} · ` +
  `вариантов входа ${(window.ORIGINS || []).length} · имён в запасе ${rosterProbe.deck.length}`);
console.log(`день: доступно ${reach.day.size} мест · ночь: ${reach.night.size}`);
if (errors) { console.log(`\nошибок: ${errors}`); process.exit(1); }
console.log("\nвсё сходится");
