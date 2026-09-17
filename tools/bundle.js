#!/usr/bin/env node
/* Собирает всё в один файл dist/kaidankai.html — чтобы отправить и открыть
   где угодно, без сервера. Запуск из папки kaidan/: node tools/bundle.js */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let html = read("index.html");

// стили — внутрь
html = html.replace(
  /<link rel="stylesheet" href="app\.css">/,
  () => "<style>\n" + read("app.css").trim() + "\n</style>"
);

// скрипты — по порядку, как в index.html
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  "<script>\n" + read(src).trim() + "\n</script>"
);

// то, что в одном файле не работает, убираем
html = html
  .replace(/<link rel="manifest"[^>]*>\n?/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, "")
  .replace(/<link rel="icon"[^>]*>\n?/, "");

fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, "kaidankai.html");
fs.writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`собрала ${path.relative(root, out)} — ${kb} КБ, ${html.split("<script>").length - 1} скриптов внутри`);
