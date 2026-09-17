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

let bad = 0;
function check(what, ok, extra) {
  if (ok) { console.log("  ок — " + what); return; }
  bad++;
  console.log("  ПОЛОМКА — " + what + (extra ? ": " + extra : ""));
}

/* ---- 1. вход в игру: кнопка «Дальше» ---- */
console.log("вход:");
check("после запуска виден пролог", text().indexOf("сто андо́нов") >= 0 || has("Дальше"));
click("Дальше");
check("кнопка «Дальше» открывает создание героя", text().indexOf("Кто ты") >= 0,
  text().slice(0, 160));

el.value = "Тест";
click("Пришёл сам");
check("выбор входа открывает пролог героя", has("Открыть глаза"), text().slice(0, 160));
click("Открыть глаза");
check("герой попадает в город", text().indexOf("кайданов ещё не рассказано") >= 0,
  text().slice(0, 160));

/* ---- 2. срок в три дня и ёкаи ---- */
console.log("срок:");
function barDay() {
  const m = text().match(/день (\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
function hintDay() {
  const m = text().match(/срок до исхода дня (\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

check("в городе виден срок", hintDay() !== null, text().slice(0, 200));
const d0 = barDay();
const h0 = hintDay();
check("срок отстоит от дня на три дня", h0 === d0 + 3, "день " + d0 + ", срок " + h0);

function waitADay() {
  if (has("Дождаться ночи")) click("Дождаться ночи");
  if (has("Дождаться утра")) click("Дождаться утра");
}

click("Дождаться ночи");
check("ночь не считается за день", barDay() === d0, "день " + barDay());
click("Дождаться утра");
check("за ночью идёт новый день", barDay() === d0 + 1, "день " + barDay());
waitADay();
check("перед последним днём город предупреждает",
  text().indexOf("тёплыми") >= 0 || text().indexOf("один день") >= 0, text().slice(0, 220));
waitADay();
check("на исходе третьего дня приходят ёкаи", text().indexOf("Ёкаи пришли") >= 0,
  text().slice(0, 200));
check("ёкаи убивают, а не пугают", !has("Дождаться ночи") && has("Прийти снова другим"));
click("Прийти снова другим");
click("Пришёл сам");
click("Открыть глаза");
check("новый герой получает свой срок", barDay() === d0 + 3 && hintDay() === d0 + 6,
  "день " + barDay() + ", срок " + hintDay());

/* ---- 3. рассказанная история отодвигает срок ---- */
console.log("рассказанная история:");
function pickRandomChoice() {
  const bs = buttons().filter((b) => b.code.indexOf("pick(") === 0);
  if (!bs.length) return false;
  eval(bs[Math.floor(Math.random() * bs.length)].code);
  return true;
}

let result = "long";
for (let step = 0; step < 3000 && result === "long"; step++) {
  if (text().indexOf("Кайдан пройден") >= 0) { result = "clear"; break; }
  if (has("Слушать дальше")) { click("Слушать дальше"); continue; }
  if (has("Прийти снова другим")) {
    click("Прийти снова другим"); click("Пришёл сам"); click("Открыть глаза"); continue;
  }
  if (pickRandomChoice()) continue;
  const kb = buttons().find((b) => b.code.indexOf("startKaidan") >= 0);
  if (kb) { eval(kb.code); continue; }
  const wb = buttons().find((b) => b.code.indexOf("walkTo(") === 0);
  if (wb) { eval(wb.code); continue; }
  result = "непонятный экран: " + text().slice(0, 120);
  break;
}

check("кайдан доводится до зачёта кликами", result === "clear", "итог: " + result);
if (result === "clear") {
  click("Идти дальше");
  const d1 = barDay();
  const h1 = hintDay();
  check("после рассказанной истории срок начинается заново", h1 === d1 + 3,
    "день " + d1 + ", срок " + h1);
  waitADay();
  waitADay();
  check("после зачёта ёкаи не приходят в прежний срок", text().indexOf("Ёкаи пришли") < 0,
    text().slice(0, 160));
}

/* ---- 4. возврат в игру после перезапуска ---- */
console.log("возврат:");
const before = barDay();
window.continueRun();
check("игра возвращается с того же места, а не с пролога",
  text().indexOf("кайданов ещё не рассказано") >= 0 && barDay() === before,
  "день " + barDay());

console.log(bad ? "\nполомок: " + bad : "\nвсе кнопки нажимаются");
process.exit(bad ? 1 : 0);
