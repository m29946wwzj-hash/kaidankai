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
require(path.join(root, "js", "people.js"));
require(path.join(root, "js", "yokai.js"));
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
  if (!n.polnoch) bad(`узел «${id}»: нет описания на полночь`);
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
  else {
    if (!reach[k.when] || !reach[k.when].has(k.where)) {
      bad(`${tag}: место «${k.where}» недостижимо в фазе «${k.when}»`);
    }
    // кайданы начинаются в полночь, а полночь ходит по ночным улицам:
    // место обязано быть достижимым ночью, иначе история недостижима вообще
    if (!reach.night.has(k.where)) {
      bad(`${tag}: место «${k.where}» недостижимо в полночь (ночная карта)`);
    }
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
  if (!k.house) bad(`${tag}: не указан дом, в котором начинается кайдан`);

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
/* ---- пол и возраст героя ---- */
uniqueIds(window.SEXES, "SEXES");
if ((window.SEXES || []).length < 2) bad("SEXES: меньше двух вариантов пола");
for (const s of window.SEXES || []) if (!s.label || !s.short) bad(`SEXES «${s.id}»: нет label/short`);
if (!(window.SEXES || []).some((s) => s.id === "f")) bad("SEXES: нет женского варианта");
if (!(window.SEXES || []).some((s) => s.id === "m")) bad("SEXES: нет мужского варианта");

uniqueIds(window.AGES, "AGES");
if ((window.AGES || []).length < 2) bad("AGES: меньше двух вариантов возраста");
for (const a of window.AGES || []) {
  if (!a.label || !a.short || !a.line) bad(`AGES «${a.id}»: нет label/short/line`);
  if (!(a.fear > 0)) bad(`AGES «${a.id}»: страх за шаг = ${a.fear}`);
  if (!(a.wounds >= 2)) bad(`AGES «${a.id}»: предел ран = ${a.wounds}, нужно хотя бы 2`);
  for (const f of ["food", "water", "meds", "omomori"]) {
    if (a[f] !== undefined && (typeof a[f] !== "number" || a[f] < 0)) bad(`AGES «${a.id}»: ${f} = ${a[f]}`);
  }
}
if (typeof window.sexById !== "function" || !window.sexById("f").id) bad("нет sexById");
if (typeof window.ageById !== "function" || !window.ageById("pozhiloy").id) bad("нет ageById");

/* ---- страх, ёкаи, гибель человека ---- */
if (!(window.FEAR_MAX >= 2)) bad(`FEAR_MAX = ${window.FEAR_MAX}, нужно хотя бы 2`);
for (let lvl = 1; lvl < window.FEAR_MAX; lvl++) {
  const arr = (window.TENSION || {})[lvl];
  if (!Array.isArray(arr) || !arr.length) bad(`TENSION: нет строк для страха ${lvl}`);
}
if (!(window.KILLS || []).length) bad("KILLS: нет ни одного описания гибели");
for (let i = 0; i < (window.KILLS || []).length; i++) {
  const text = window.yokaiKill("Проверка", i);
  if (!text || text.length < 400) bad(`KILLS[${i}]: описание гибели короткое или пустое`);
  for (const must of ["Проверка"]) {
    if (!text.includes(must)) bad(`KILLS[${i}]: в описании нет имени погибшего`);
  }
}
if (!window.tensionLine(1, "проба")) bad("tensionLine не отдаёт строку");
if (!(window.streetDeath || []).length) bad("streetDeath: пусто");

/* ---- люди в городе ---- */
for (const id of Object.keys(CITY.nodes)) {
  const p = (window.PRESENCE || {})[id];
  if (!p) { bad(`PRESENCE: нет людей для места «${id}»`); continue; }
  for (const ph of ["day", "night", "polnoch"]) {
    if (!Array.isArray(p[ph]) || !p[ph].length) bad(`PRESENCE «${id}»: нет строк на фазу «${ph}»`);
  }
}
for (const id of Object.keys(window.PRESENCE || {})) {
  if (!CITY.nodes[id]) bad(`PRESENCE: место «${id}» не существует на карте`);
}
/* люди действительно встают в места: состав из движка должен их отдавать */
{
  const probeRoster = window.makeRoster("Проверка");
  const probe = { roster: probeRoster.roster, day: 3 };
  for (const id of Object.keys(CITY.nodes)) {
    for (const ph of ["day", "night", "polnoch"]) {
      const list = window.presentAt(probe, id, ph);
      if (list.length < 2) bad(`presentAt(«${id}», ${ph}) отдаёт ${list.length} человек, нужно 2–3`);
      for (const p of list) if (!p.name || !p.line) bad(`presentAt(«${id}», ${ph}): человек без имени или строки`);
    }
  }
  /* один и тот же день — одни и те же люди: экран не должен переставлять их сам */
  const a = window.presentAt(probe, "dom", "night").map((p) => p.name).join(",");
  const b = window.presentAt(probe, "dom", "night").map((p) => p.name).join(",");
  if (a !== b) bad("presentAt: выбор людей не устойчив в пределах дня");
  /* гибель человека не меняет счёт: на место ушедшего приходит новый */
  const probe2 = { roster: probeRoster.roster.map((p) => ({ ...p })), deck: probeRoster.deck.slice() };
  const gone = probe2.roster[1].name;
  const rep = window.removeFromRoster(probe2, gone);
  if (!rep) bad("removeFromRoster: не нашёл человека из состава");
  else {
    if (rep.gone !== gone) bad("removeFromRoster: ушёл не тот, кого назвали");
    if (probe2.roster.length !== 100) bad("removeFromRoster: состав изменил размер");
    if (!probe2.roster.some((p) => p.name === rep.came)) bad("removeFromRoster: новый не попал в состав");
    const alive = window.aliveNames(probe2);
    if (alive.includes(gone)) bad("removeFromRoster: ушедший остался среди живых");
    if (alive.length !== 99) bad(`aliveNames: живых ${alive.length}, а должно быть 99`);
  }
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
