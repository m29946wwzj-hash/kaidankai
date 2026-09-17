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
  value: "",
  classList: { add() {}, remove() {}, toggle() {} }
};
global.document = { getElementById: () => el, body: el };
global.navigator = {};
global.location = { protocol: "file:" };
global.scrollTo = () => {};

require(path.join(root, "js", "items.js"));
require(path.join(root, "js", "roster.js"));
require(path.join(root, "js", "prologue.js"));
require(path.join(root, "js", "voices.js"));
require(path.join(root, "js", "people.js"));
require(path.join(root, "js", "yokai.js"));
require(path.join(root, "js", "city.js"));
const kd = path.join(root, "js", "kaidans");
for (const f of fs.readdirSync(kd).sort()) if (f.endsWith(".js")) require(path.join(kd, f));
require(path.join(root, "js", "engine.js"));

const CITY = window.CITY;
const KAIDANS = window.KAIDANS;
const ORIGINS = window.ORIGINS;

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
let deaths = 0, clears = 0, stuck = 0, burned = 0, exhausted = 0, replacements = 0;
let kills = 0, breaths = 0, misses = 0;

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

/* новый герой: пролог → имя → пол и возраст → вход в город */
function freshRun(originId, sex, age) {
  el.value = "Тест";
  window.startRun();
  window.toCreate();
  window.setSex(sex);
  window.setAge(age);
  window.setOrigin(originId);
  window.enterCity();
}

/* сутки идут тремя шагами: день → ночь → полночь → утро нового дня */
const NEXT = { day: "night", night: "polnoch", polnoch: "day" };

let phase = "day";
let here = CITY.start;

const SEXES = ["m", "f"];
const AGES = window.AGES.map((a) => a.id);

for (const k of KAIDANS) {
  for (let r = 0; r < RUNS; r++) {
    freshRun(ORIGINS[r % ORIGINS.length].id, SEXES[r % 2], AGES[r % AGES.length]);
    phase = "day"; here = CITY.start;

    /* иногда заглядываем в рюкзак и в список участников */
    if (r % 5 === 0) { window.openPack(); window.backFromScreen(); }
    if (r % 7 === 0) { window.openRoster(); window.backFromScreen(); }
    /* набиваем рюкзак, чтобы дотянуться и до вариантов, требующих оружия */
    for (let i = 0; i < 80; i++) window.searchStreet();

    /* кайдан начинается только в полночь: днём голос молчит и дом не открывается */
    if (r % 11 === 0) {
      window.startKaidan(k.id);
      if (el.innerHTML.includes('onclick="listenOn()"')) {
        console.log(`кайдан ${k.id} открылся не в полночь`); process.exit(1);
      }
      misses++;
    }

    while (phase !== "polnoch") { window.waitPhase(); phase = NEXT[phase]; }
    const route = bfs(here, k.where, phase);
    if (!route) { console.log(`нет дороги к ${k.where} (полночь)`); process.exit(1); }
    for (const n of route) { window.walkTo(n); here = n; }

    /* в полночь голос называет дом — до этого его не видно */
    window.startKaidan(k.id);
    if (!el.innerHTML.includes('onclick="listenOn()"')) {
      console.log(`голос не начал кайдан ${k.id} в полночь`); process.exit(1);
    }

    let steps = 0;
    for (;;) {
      const h = el.innerHTML;
      /* сперва то, что показывается до и вместо сцены */
      if (h.includes('onclick="listenOn()"')) { window.listenOn(); continue; }
      if (h.includes('onclick="backFromBurn()"')) { burned++; window.backFromBurn(); continue; }
      /* ёкай забрал человека: описание гибели показывается целиком */
      if (h.includes('onclick="afterKill()"')) {
        kills++;
        if (h.length < 900) { console.log(`гибель в ${k.id} описана слишком коротко`); process.exit(1); }
        window.afterKill();
        continue;
      }

      /* перевод духа: страх спадает, но только один раз за историю */
      if (r % 3 === 0 && h.includes('onclick="breathe()"')) { breaths++; window.breathe(); continue; }

      visited.add(currentScene());
      const st = state();
      if (st === "death") {
        deaths++;
        if (h.includes("Силы кончились")) exhausted++;
        break;
      }
      if (st === "clear") {
        clears++;
        window.backToCity();
        phase = NEXT[phase];
        if (state() === "death") { deaths++; exhausted++; }
        else if (!el.innerHTML.includes('class="phase">день<')) {
          console.log("после кайдана время суток не сменилось"); process.exit(1);
        }
        break;
      }
      if (steps++ > 60) { stuck++; break; }

      const m = el.innerHTML.match(/onclick="pick\((\d+)\)"/g) || [];
      if (!m.length) { stuck++; break; }
      window.pick(Math.floor(Math.random() * m.length));
    }
    /* на первом прогоне каждой истории проверяем саму замену участника */
    if (r === 0) {
      const probe = window.makeRoster("Проверка");
      const world = { roster: probe.roster, deck: probe.deck };
      const before = world.roster.length;
      const gone = window.replaceOne(world);
      if (!gone || world.roster.length !== before) {
        console.log("замена погибшего ломает состав"); process.exit(1);
      }
      if (world.roster.filter((p) => p.name === gone.came).length !== 1) {
        console.log("пришедший на замену повторяет чужое имя"); process.exit(1);
      }
      replacements++;
    }
  }
}

let total = 0;
const missing = [];
for (const k of KAIDANS) {
  for (const sid of Object.keys(k.scenes)) { total++; if (!visited.has(`${k.id}.${sid}`)) missing.push(`${k.id}.${sid}`); }
}

console.log(`кайданов: ${KAIDANS.length} · сцен: ${total}`);
console.log(`прогонов: ${KAIDANS.length * RUNS} · смертей: ${deaths} (из них от истощения: ${exhausted}) · ` +
  `зачётов: ${clears} · сгорело омомори: ${burned} · застряло: ${stuck}`);
console.log(`ёкай забрал человека: ${kills} · переводов духа: ${breaths} · ` +
  `попыток начать кайдан не в полночь: ${misses} (все отбиты)`);
console.log(`замена участников: ${replacements} проверок · ` +
  `омомори в колоде: ${(window.OMOMORI || []).length} · оружия: ${(window.WEAPONS || []).length}`);
console.log(`покрытие сцен: ${total - missing.length}/${total}`);
if (missing.length) console.log("не встретились: " + missing.join(", "));
if (stuck) { console.log("\nзастряли — где-то нет выхода из сцены"); process.exit(1); }
console.log("\nдвижок не падает");
