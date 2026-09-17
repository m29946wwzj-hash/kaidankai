#!/usr/bin/env node
/* Проверка рода: если играешь женщиной, весь текст про «ты» должен быть
   в женском роде. Тексты написаны в мужском, и движок переводит их на ходу
   (window.feminize). Здесь этот перевод проверяется на всём контенте сразу:
   ищем обороты с «ты», в которых осталась мужская форма глагола.

   node tools/gender.js */

const fs = require("fs");
const path = require("path");

global.window = global;
const root = path.resolve(__dirname, "..");
const kd = path.join(root, "js", "kaidans");

require(path.join(root, "js", "items.js"));
require(path.join(root, "js", "roster.js"));
require(path.join(root, "js", "prologue.js"));
require(path.join(root, "js", "voices.js"));
require(path.join(root, "js", "people.js"));
require(path.join(root, "js", "yokai.js"));
require(path.join(root, "js", "city.js"));
for (const f of fs.readdirSync(kd).sort()) if (f.endsWith(".js")) require(path.join(kd, f));

/* перевод рода живёт в движке — поднимаем его на заглушках браузера */
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
require(path.join(root, "js", "engine.js"));
if (typeof window.feminize !== "function") {
  console.log("движок не отдал перевод рода наружу");
  process.exit(1);
}

/* Слова, которые кончаются на «л» и при этом не глагол: полу, столу и углу
   род менять не надо. */
const NOUNS = new Set([
  "пол", "стол", "стул", "угол", "узел", "ствол", "пепел", "узел", "тыл",
  "шкаф", "щел", "свет", "холод", "голод", "шел", "мел", "удел", "предел",
  "просвет", "ответ", "совет", "запрет", "цвет", "привет", "хребет", "буфет"
]);

let bad = 0;
const seen = new Set();
const suspects = [];

function windows(text, where) {
  const words = String(text).split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].toLowerCase().replace(/[^а-яё]/g, "") !== "ты") continue;
    for (let j = i + 1; j < words.length && j <= i + 4; j++) {
      const raw = words[j].replace(/[^А-Яа-яЁё-]/g, "");
      if (!raw) break;
      const low = raw.toLowerCase();
      if (/[.!?…:;]$/.test(words[j - 1]) && j > i + 1) break;
      if (/^(он|она|они|я|мы|вы|кто|кто-то|кто-нибудь)$/.test(low)) break;
      /* мужская форма глагола: кончается на «л» или «лся» */
      if (/(л|лся)$/.test(low) && !NOUNS.has(low)) {
        const win = words.slice(i, Math.min(words.length, j + 3)).join(" ");
        const key = where + "|" + win;
        if (!seen.has(key)) { seen.add(key); suspects.push(where + ": …" + win + "…"); }
        break;
      }
    }
  }
}

/* всё, что игрок читает про себя: [где, сырой текст] */
function textAll() {
  const out = [];
  for (const k of (window.KAIDANS || [])) {
    for (const [sid, sc] of Object.entries(k.scenes || {})) {
      out.push([`${k.id}.${sid}`, sc.t]);
      for (const c of sc.c || []) out.push([`${k.id}.${sid}.выбор`, c.t]);
    }
    out.push([`${k.id}.голос`, window.voiceFor(k)]);
  }
  for (const [id, n] of Object.entries(window.CITY.nodes)) {
    for (const ph of ["day", "night", "polnoch"]) out.push([`карта.${id}.${ph}`, n[ph]]);
  }
  out.push(["пролог", window.PROLOGUE.intro]);
  out.push(["пролог.приход", window.PROLOGUE.arrivalCommon]);
  for (const o of window.ORIGINS || []) out.push([`вход.${o.id}`, o.arrival]);
  for (const a of window.AGES || []) out.push([`возраст.${a.id}`, a.line]);
  for (const lvl of Object.keys(window.TENSION || {})) {
    for (const line of window.TENSION[lvl]) out.push([`напряжение.${lvl}`, line]);
  }
  for (let i = 0; i < (window.KILLS || []).length; i++) {
    out.push([`гибель.${i}`, window.yokaiKill("Кто-то", i)]);
  }
  return out;
}

for (const [where, raw] of textAll()) windows(window.feminize(raw), where);

/* Продолжение оборота через точку: «Ты пришёл сам. Пошёл дальше.» — во втором
   предложении «ты» уже нет, но подлежащее то же, и род там тоже нужен.
   Предложения, начинающиеся с существительного («Гул идёт ровно»), сюда
   попадают зря: их видно по списку и легко отсеять глазами. */
const OPEN_NOUN = /^(пол|стол|стул|угол|свет|холод|голод|колокол|котёл|котел|гул|мел|ствол|узел|зал|рассол|журнал|вёсел|весёл|правил|день|шум|звон)$/;
const opens = [];
for (const [where, raw] of textAll()) {
  const sents = String(raw).split(/(?<=[.!?…])\s+|\n+/);
  let seenYou = false;
  for (const s of sents) {
    const hasYou = /(^|[^а-яё])(ты|тебе|тебя|тобой|твой|твоя|твоё)([^а-яё]|$)/i.test(s);
    if (seenYou && !hasYou) {
      const w = (s.match(/[А-Яа-яЁё-]+/g) || [])[0];
      if (w && /(л|лся)$/i.test(w) && !OPEN_NOUN.test(w.toLowerCase())) {
        opens.push(where + ": " + s.replace(/\s+/g, " ").slice(0, 100));
      }
    }
    if (hasYou) seenYou = true;
  }
}
if (opens.length) {
  console.log("продолжения через точку без «ты» — проверить род (" + opens.length + "):");
  for (const s of opens.slice(0, 20)) console.log("  · " + s);
}

/* ---- что перевод точно делает ---- */
const probes = [
  ["Ты вошёл в дом и закрыл дверь.", "Ты вошла в дом и закрыла дверь."],
  ["Ты пришёл сам, и это худшее.", "Ты пришла сама, и это худшее."],
  ["Ты должен был уйти.", "Ты должна была уйти."],
  ["Он вошёл первым и закрыл дверь.", "Он вошёл первым и закрыл дверь."],
  ["Конюх подошёл к двери и встал.", "Конюх подошёл к двери и встал."],
  ["Ты взял нож, и он сломался.", "Ты взяла нож, и он сломался."],
  ["Ты снял доску, и кирпич упал.", "Ты сняла доску, и кирпич упал."]
];
for (const [src, want] of probes) {
  const got = window.feminize(src);
  if (got !== want) {
    bad++;
    console.log("  ✗ «" + src + "»\n     получено: " + got + "\n     нужно:    " + want);
  }
}

/* Неправильные глаголы: правило «-л → -ла» их не берёт (рос, нёс, мог, лёг…),
   все они должны стоять в словаре движка. */
const IRREGULAR = [
  "ты шёл", "ты пришёл", "ты ушёл", "ты мог", "ты нёс", "ты вёл", "ты лёг",
  "ты умер", "ты замер", "ты стёр", "ты запер", "ты жёг", "ты рос", "ты мёрз",
  "ты вёз", "ты тряс", "ты лез", "ты грыз", "ты разгрёб", "ты скрёб", "ты помер",
  "ты замолк", "ты стих", "ты засох", "ты промок", "ты продрог", "ты ослеп",
  "ты оглох", "ты погиб", "ты застыл", "ты поник", "ты отвык", "ты иссяк",
  "ты утих", "ты озяб", "ты ослаб", "ты вырос", "ты замёрз", "ты залез"
];
for (const s of IRREGULAR) {
  if (window.feminize(s) === s) {
    bad++;
    console.log("  ✗ не переводится: " + s);
  }
}

/* Название входа в город видно на кнопке ещё до всякого текста: у него нет
   «ты» рядом, поэтому женский вариант задаётся в самих ORIGINS. */
for (const o of window.ORIGINS || []) {
  if (!o.fem) {
    bad++;
    console.log("  ✗ у входа «" + o.label + "» нет женского названия (fem)");
  } else if (o.fem === o.label) {
    bad++;
    console.log("  ✗ женское название входа «" + o.label + "» совпадает с мужским");
  } else {
    windows(window.feminize(o.fem), `вход.${o.id}.название`);
  }
}

/* Окно вокруг «ты» не знает, кто подлежащее: «ты слышишь, как хлопнул
   дерматин» — тут мужская форма и должна остаться. Поэтому список — не
   ошибка, а то, что стоит просмотреть глазами: настоящий промах движка
   выглядел бы здесь как глагол про самого героя. */
if (suspects.length) {
  console.log("просмотреть глазами: мужские формы в обороте про «ты» (" + suspects.length + "):");
  for (const s of suspects.slice(0, 40)) console.log("  · " + s);
  if (suspects.length > 40) console.log("  … и ещё " + (suspects.length - 40));
}

const total = (window.KAIDANS || []).reduce((n, k) => n + Object.keys(k.scenes || {}).length, 0);
console.log(`\nпроверено сцен: ${total} · спорных оборотов про «ты»: ${suspects.length}`);
if (bad) { console.log(`\nполомок перевода: ${bad}`); process.exit(1); }
console.log("перевод на женский род работает");
