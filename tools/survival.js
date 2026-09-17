#!/usr/bin/env node
/* Долгая жизнь одного города: герой ходит, обыскивает, берёт кайданы,
   умирает — и на его место приходит следующий. Проверяем то, чего не видно
   в одиночном прогоне: истощение, раны, сгоревшие омомори, замену участников,
   финальный экран.

   node tools/survival.js [число прохождений]   (по умолчанию 20) */

const fs = require("fs");
const path = require("path");

const GAMES = parseInt(process.argv[2] || "20", 10);
const root = path.resolve(__dirname, "..");

global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
const el = { innerHTML: "", value: "", classList: { add() {}, remove() {}, toggle() {} } };
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

const ORIGINS = window.ORIGINS;
const total = window.KAIDANS.length;

const grabs = (re) => (el.innerHTML.match(re) || []).map((m) => m.replace(re, "$1"));
const kaidanBtns = () => grabs(/onclick="startKaidan\('([^']+)'\)"/g);
const exitBtns = () => grabs(/onclick="walkTo\('([^']+)'\)"/g);

let lives = 0, heroes = 0, deaths = 0, clears = 0, exhaustion = 0, amuletSaves = 0, ends = 0, stuck = 0;
let kills = 0, breaths = 0;

const SEXES = ["m", "f"];
const AGES = window.AGES.map((a) => a.id);

for (let g = 0; g < GAMES; g++) {
  el.value = "Тест";
  window.startRun();
  window.toCreate();
  window.setSex(SEXES[g % 2]);
  window.setAge(AGES[g % AGES.length]);
  window.setOrigin(ORIGINS[g % ORIGINS.length].id);
  window.enterCity();
  lives = 1;

  let guard = 0;
  for (;;) {
    if (guard++ > 4000) {
      stuck++;
      console.log("застряли на экране:\n" + el.innerHTML.slice(0, 500));
      break;
    }
    const h = el.innerHTML;

    if (h.includes('onclick="listenOn()"')) { window.listenOn(); continue; }
    if (h.includes('onclick="backFromBurn()"')) { amuletSaves++; window.backFromBurn(); continue; }
    if (h.includes('onclick="backToCity()"')) { clears++; window.backToCity(); continue; }
    if (h.includes('onclick="afterKill()"')) { kills++; window.afterKill(); continue; }
    if (h.includes('onclick="breathe()"') && Math.random() < 0.5) { breaths++; window.breathe(); continue; }
    if (h.includes('onclick="comeAgain()"')) {
      deaths++;
      /* ёкаи приходят за тем, кто три дня не рассказал ни одной истории */
      if (h.includes("Ёкаи пришли") || h.includes("Раны сложились в предел")) exhaustion++;
      lives++;
      if (lives > 400) { console.log("город не кончается: слишком много смертей"); process.exit(1); }
      window.comeAgain();
      window.setSex(SEXES[(g + lives) % 2]);
      window.setAge(AGES[(g + lives) % AGES.length]);
      window.setOrigin(ORIGINS[(g + lives) % ORIGINS.length].id);
      window.enterCity();
      continue;
    }
    if (h.includes('onclick="newRun()"')) { ends++; break; }  /* финальный экран */

    /* сцена кайдана */
    if (h.includes('onclick="pick(')) {
      const m = h.match(/onclick="pick\((\d+)\)"/g) || [];
      window.pick(Math.floor(Math.random() * m.length));
      continue;
    }

    /* город */
    if (!h.includes('class="loc"')) {
      console.log("непонятный экран:\n" + h.slice(0, 400));
      process.exit(1);
    }
    if (h.includes('onclick="searchStreet()"') && Math.random() < 0.25) {
      window.searchStreet();
      continue;
    }
    const ks = kaidanBtns();
    if (ks.length) { window.startKaidan(ks[Math.floor(Math.random() * ks.length)]); continue; }
    const ex = exitBtns();
    if (ex.length && Math.random() < 0.6) {
      window.walkTo(ex[Math.floor(Math.random() * ex.length)]);
      continue;
    }
    window.waitPhase();
  }
  heroes += lives;
}

console.log(`прохождений: ${GAMES} · героев: ${heroes} · кайданов зачтено: ${clears}`);
console.log(`смертей: ${deaths} (из них от истощения: ${exhaustion}) · омомори сгорело: ${amuletSaves} · ` +
  `дошли до конца сборки: ${ends} (из ${total} кайданов)`);
console.log(`ёкай забрал людей: ${kills} · переводов духа: ${breaths}`);
if (stuck) { console.log(`\nзастряло: ${stuck}`); process.exit(1); }
console.log("\nгород переживает героев");
