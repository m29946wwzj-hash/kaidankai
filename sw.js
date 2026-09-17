/* Офлайн-кэш. Нужен, чтобы игра открывалась с домашнего экрана iPhone
   без интернета. Стратегия: отдаём из кэша, в фоне обновляем. */

var CACHE = "kaidankai-v6";
var CORE = ["./", "./index.html", "./app.css", "./manifest.webmanifest",
            "./js/city.js", "./js/items.js", "./js/roster.js", "./js/prologue.js",
            "./js/people.js", "./js/yokai.js", "./js/voices.js", "./js/engine.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Сеть вперёд, кэш — только когда сети нет. Иначе телефон после обновления
   продолжает открывать старую сборку из кэша: кнопки нарисованы, а обработчики
   в них старые, и кажется, что игра сломана. */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
