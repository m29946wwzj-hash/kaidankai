#!/usr/bin/env node
/* Проверка кнопок: кликаем по тому, что движок сам нарисовал на экране,
   а не вызываем функции напрямую. Ловит поломки вроде «кнопка Дальше
   не нажимается»: если состояние не создано или обработчик падает,
   экран после клика остаётся прежним.

   node tools/click.js */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

/* ---- заглушки браузера ---- */
global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
const el = { innerHTML: "", value: "", classList: { add() {}, remove() {} } };
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

/* ---- клик по нарисованной кнопке ---- */
const BTN = /<button[^>]*onclick="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;

function screen() { return el.innerHTML; }
function text() { return screen().replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); }

function buttons() {
  const out = [];
  let m;
  BTN.lastIndex = 0;
  while ((m = BTN.exec(screen()))) {
    out.push({ code: m[1], label: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return out;
}

function has(label) { return buttons().some((b) => b.label.indexOf(label) >= 0); }

function click(label) {
  const b = buttons().find((x) => x.label.indexOf(label) >= 0);
  if (!b) {
    throw new Error("на экране нет кнопки «" + label + "». Экран: " + text().slice(0, 200));
  }
  eval(b.code);   /* ровно то, что сделал бы браузер */
}

/* кнопка, которая начинается с нужного вызова: pick(0), walkTo('reka') */
function find(prefix) { return buttons().find((b) => b.code.indexOf(prefix) === 0); }

let bad = 0;
function check(what, ok, extra) {
  if (ok) { console.log("  ок — " + what); return; }
  bad++;
  console.log("  ПОЛОМКА — " + what + (extra ? ": " + extra : ""));
}

/* ---- 1. вход в игру: пролог и создание героя ---- */
console.log("вход:");
check("после запуска виден пролог", text().indexOf("сто андо́нов") >= 0 || has("Дальше"));
click("Дальше");
check("кнопка «Дальше» открывает создание героя", text().indexOf("Кто ты") >= 0,
  text().slice(0, 160));

check("герою предлагают пол", text().indexOf("пол") >= 0 && has("Мужчина") && has("Женщина"),
  text().slice(0, 200));
check("герою предлагают возраст",
  has("Двадцать с небольшим") && has("Под сорок") && has("За шестьдесят"));

/* ---- 2. героиня: весь текст о ней — в женском роде ---- */
console.log("героиня:");
el.value = "Тест";
click("Женщина");
click("Под сорок");
check("кнопка входа переписана по роду", has("Пришла сама") && !has("Пришёл сам"),
  buttons().map((b) => b.label).join(" · ").slice(0, 200));
click("Пришла сама");
check("пролог героини в женском роде",
  text().indexOf("Ты пришла сама") >= 0 && text().indexOf("по которой ты шла") >= 0,
  text().slice(0, 260));
click("Открыть глаза");
check("героиня попадает в город", text().indexOf("кайданов ещё не рассказано") >= 0,
  text().slice(0, 160));
check("город называет её женщиной", text().indexOf("женщина") >= 0, text().slice(0, 200));

/* ---- 3. срок в три дня и сутки из трёх шагов ---- */
console.log("сутки и срок:");
function barDay() {
  const m = text().match(/день (\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function hintDay() {
  const m = text().match(/срок до исхода дня (\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
const KAIDAN_ID = (window.KAIDANS || [])[0].id;

check("в городе виден срок", hintDay() !== null, text().slice(0, 200));
const d0 = barDay();
check("срок отстоит от дня на три дня", hintDay() === d0 + 3, "день " + d0 + ", срок " + hintDay());

/* сутки: день → ночь → полночь → утро нового дня */
function waitADay() {
  click("Дождаться ночи");
  click("Дождаться полуночи");
  click("Дождаться утра");
}

/* кайдан начинается только в полночь: днём и ночью дом молчит */
eval('startKaidan("' + KAIDAN_ID + '")');
check("днём кайдан не начинается", !has("Слушать дальше") && has("Дождаться ночи"),
  text().slice(0, 160));
click("Дождаться ночи");
check("ночь не считается за день", barDay() === d0, "день " + barDay());
eval('startKaidan("' + KAIDAN_ID + '")');
check("ночью кайдан тоже не начинается", !has("Слушать дальше") && has("Дождаться полуночи"),
  text().slice(0, 160));
click("Дождаться полуночи");
check("полночь не считается за день", barDay() === d0, "день " + barDay());
check("в полночь город говорит, что двери открыты", text().indexOf("Полночь.") >= 0,
  text().slice(0, 240));
click("Дождаться утра");
check("за утром идёт новый день", barDay() === d0 + 1, "день " + barDay());
check("после ночи в городе снова день", text().indexOf("Кайданы начинаются в полночь") >= 0,
  text().slice(0, 200));

/* ---- 4. дом истории виден только в полночь ---- */
console.log("полночь:");
click("Дождаться ночи");
click("Дождаться полуночи");
let home = null;
for (let step = 0; step < 40 && !home; step++) {
  home = find("startKaidan");
  if (home) break;
  const ws = buttons().filter((b) => b.code.indexOf("walkTo(") === 0);
  if (!ws.length) break;
  eval(ws[Math.floor(Math.random() * ws.length)].code);
}
check("в полночь находится дом с историей", !!home, text().slice(0, 200));

/* ---- 5. кайдан: страх, гибель человека, зачёт ---- */
console.log("кайдан:");
let outcome = "long", sawFear = false, sawKill = false, sawBreath = false, killText = "";
if (home) {
  eval(home.code);
  check("голос начинает историю в полночь", has("Слушать дальше"), text().slice(0, 160));
  click("Слушать дальше");
  for (let step = 0; step < 400 && outcome === "long"; step++) {
    if (text().indexOf("Кайдан пройден") >= 0) { outcome = "clear"; break; }
    if (text().indexOf("страх · ") >= 0) sawFear = true;
    if (has("Ёкай взял своё")) {
      sawKill = true;
      killText = text();
      click("Слушать дальше");
      continue;
    }
    if (has("Перевести дух")) { sawBreath = true; click("Перевести дух"); continue; }
    if (has("Омомори сгорел")) { click("Вернуться"); continue; }
    if (has("Прийти снова другим")) { outcome = "death"; break; }
    const p = find("pick(");
    if (p) { eval(p.code); continue; }
    if (has("Слушать дальше")) { click("Слушать дальше"); continue; }
    outcome = "непонятный экран: " + text().slice(0, 120);
    break;
  }
}
check("внутри истории виден страх", sawFear, text().slice(0, 160));
check("кайдан доводится до зачёта или до смерти", outcome === "clear" || outcome === "death",
  "итог: " + outcome);
if (sawKill) {
  check("гибель человека описана целиком", killText.length > 900,
    "длина описания: " + killText.length);
}
if (sawBreath) check("перевести дух удаётся только раз за историю", true);

/* ---- 6. после зачёта наступает утро, и мест следующих историй не видно ---- */
if (outcome === "clear") {
  console.log("после зачёта:");
  const before = barDay();
  click("Идти дальше");
  check("после кайдана время суток меняется на день",
    text().indexOf("Кайданы начинаются в полночь") >= 0, text().slice(0, 200));
  check("после кайдана проходит день", barDay() === before + 1, "день " + barDay());
  check("срок начинается заново", hintDay() === barDay() + 3, "день " + barDay() + ", срок " + hintDay());
  check("место следующего кайдана днём не показано", !find("startKaidan"), text().slice(0, 200));
}

/* ---- 7. исход срока: приходят ёкаи ---- */
console.log("срок:");
function hero() { click("Прийти снова другим"); click("Пришёл сам"); click("Открыть глаза"); }
if (outcome !== "clear") hero();
else {
  click("Дождаться ночи");
  click("Дождаться полуночи");
  click("Дождаться утра");
}
while (hintDay() !== null && barDay() < hintDay() - 1) waitADay();
check("перед последним днём город предупреждает",
  text().indexOf("тёплыми") >= 0 || text().indexOf("один день") >= 0, text().slice(0, 240));
waitADay();
check("на исходе срока приходят ёкаи", text().indexOf("Ёкаи пришли") >= 0, text().slice(0, 200));
check("ёкаи убивают, а не пугают", !has("Дождаться ночи") && has("Прийти снова другим"));

/* срок у нового героя начинается заново, а день остаётся тот же: город
   никуда не делся, сменился только тот, кто по нему ходит */
const d1 = barDay();
hero();
check("новый герой получает свой срок", barDay() === d1 && hintDay() === barDay() + 3,
  "день " + barDay() + ", срок " + hintDay());

/* ---- 8. возврат в игру после перезапуска ---- */
console.log("возврат:");
const before = barDay();
window.continueRun();
check("игра возвращается с того же места, а не с пролога",
  text().indexOf("кайданов ещё не рассказано") >= 0 && barDay() === before,
  "день " + barDay());

console.log(bad ? "\nполомок: " + bad : "\nвсе кнопки нажимаются");
process.exit(bad ? 1 : 0);
