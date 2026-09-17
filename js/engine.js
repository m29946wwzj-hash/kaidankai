/* Кайданкай — движок.
   Экраны: вход → город → сцена кайдана → провал / зачёт → город.
   Контент лежит в js/kaidans/*.js, карта — в js/city.js. Здесь только логика. */

(function () {
  "use strict";

  var SAVE_KEY = "kaidankai_v2";
  var TOTAL_CANDLES = 100;
  var app = document.getElementById("app");
  var S = null;

  function kaidans() { return window.KAIDANS || []; }
  function city() { return window.CITY; }
  function K(id) {
    for (var i = 0; i < kaidans().length; i++) if (kaidans()[i].id === id) return kaidans()[i];
    return null;
  }

  /* ---------- состояние ---------- */

  function newRun() {
    return {
      candle: TOTAL_CANDLES,
      phase: "day",
      node: city().start,
      screen: "intro",
      kaidan: null,
      scene: null,
      cleared: {}
    };
  }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.screen && city().nodes[s.node]) ? s : null;
    } catch (e) { return null; }
  }

  /* ---------- общие куски ---------- */

  function bar() {
    var cls = S.candle <= 10 ? "candles low" : "candles";
    var ph = S.phase === "night"
      ? '<span class="phase n">ночь</span>'
      : '<span class="phase">день</span>';
    return '<div class="bar"><span class="' + cls + '">свечей · ' + S.candle + '</span>' + ph + '</div>';
  }

  function setNight(on) {
    if (on) document.body.classList.add("night");
    else document.body.classList.remove("night");
  }

  function open(id) {
    var k = K(id);
    if (!k) return;
    S.kaidan = id;
    S.scene = k.start;
    S.screen = "scene";
    save();
    screenScene();
  }

  /* ---------- экраны ---------- */

  function screenIntro() {
    setNight(false);
    app.innerHTML =
      '<h1>Кайданкай</h1>' +
      '<div class="sub">сто свечей · город Кураяма</div>' +
      '<div class="text">Есть старая игра: сто свечей, сто страшных историй. После каждой гасят одну свечу. Говорят, когда погаснет последняя, придёт тот, кто ждал этого дольше всех.\n\n' +
      'Кураяма играет в неё третий год. Ты в городе недавно — и уже должен.\n\n' +
      'Днём улицы одни, ночью другие. Кайдан берут там, где он открылся. Ошибка в кайдане — смерть, и тогда всё начинается заново для того, кто придёт после тебя.</div>' +
      '<button onclick="startRun()">Войти в город</button>' +
      (load() ? '<button onclick="continueRun()">Продолжить</button>' : '');
  }

  function screenCity() {
    var node = city().nodes[S.node];
    setNight(S.phase === "night");

    var desc = S.phase === "day" ? node.day : node.night;
    var exits = (S.phase === "day" ? node.links : node.nightLinks) || [];
    var other = (S.phase === "day" ? node.nightLinks : node.links) || [];

    var here = kaidans().filter(function (k) {
      return k.where === S.node && k.when === S.phase &&
        !S.cleared[k.id] && (!k.cond || k.cond(S));
    });

    var kbtns = here.map(function (k) {
      return '<button class="kaidan" onclick="startKaidan(\'' + k.id + '\')">' + k.title +
        '<small>кайдан · провал — смерть</small></button>';
    }).join("");

    var ebtns = exits.map(function (id) {
      return '<button class="go" onclick="walkTo(\'' + id + '\')">' + city().nodes[id].name + '</button>';
    }).join("");

    var closed = other.filter(function (id) { return exits.indexOf(id) < 0; })
      .map(function (id) { return city().nodes[id].name; });
    var closedLine = closed.length
      ? '<div class="hint">Сейчас не открывается: ' + closed.join(", ") + '</div>'
      : "";

    var wait = S.phase === "day"
      ? '<button class="wait" onclick="waitPhase()">Дождаться ночи</button>'
      : '<button class="wait" onclick="waitPhase()">Дождаться утра</button>';

    var left = kaidans().filter(function (k) {
      return !S.cleared[k.id] && (!k.cond || k.cond(S));
    }).length;

    app.innerHTML = bar() +
      '<div class="loc">' + node.name + '</div>' +
      '<div class="loc-sub">' + left + ' кайданов ещё не рассказано</div>' +
      '<div class="text fade">' + desc + '</div>' +
      kbtns +
      ebtns +
      wait +
      closedLine;
    window.scrollTo(0, 0);
  }

  function screenScene() {
    var k = K(S.kaidan);
    var sc = k.scenes[S.scene];
    setNight(S.phase === "night");
    var choices = sc.c.map(function (c, i) {
      return '<button onclick="pick(' + i + ')">' + c.t + '</button>';
    }).join("");
    app.innerHTML = bar() +
      '<div class="title fade">' + k.title + '</div>' +
      '<div class="text fade">' + sc.t + '</div>' +
      choices;
    window.scrollTo(0, 0);
  }

  function screenDeath(text) {
    setNight(true);
    app.innerHTML = bar() +
      '<div class="title">Провал</div>' +
      '<div class="text death fade">' + text + '</div>' +
      '<div class="text">В Кураяму войдёт кто-то другой — с сотней свечей и без твоей памяти о том, что здесь было. Ему повезёт больше. Или нет.</div>' +
      '<button class="restart" onclick="startRun()">Начать заново</button>';
    window.scrollTo(0, 0);
  }

  function screenClear(text) {
    setNight(S.phase === "night");
    app.innerHTML = bar() +
      '<div class="title">Кайдан пройден</div>' +
      '<div class="text fade">' + text + '</div>' +
      '<button onclick="backToCity()">Идти дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenEnd() {
    setNight(true);
    var left = kaidans().length;
    app.innerHTML = bar() +
      '<div class="title">Пока всё</div>' +
      '<div class="text fade">Ты прошёл все кайданы, которые есть в этой сборке, — ' + left + ' из ста. Свечей в стене осталось ' + S.candle + '.\n\n' +
      'В Кураяме стало на ' + left + ' свечей темнее, и это ты погасил их, хотя не зажигал. В самом центре мёртвого города стоит прямоугольник, выложенный чёрным камнем: сто гнёзд, и всё меньше огня в них. Когда погаснет последняя, придёт тот, кто ждёт этого дольше всех.</div>' +
      '<div class="hint">Дальше — новые истории. Их будет девяносто.</div>' +
      '<button class="restart" onclick="startRun()">Начать заново</button>';
    window.scrollTo(0, 0);
  }

  /* ---------- переходы ---------- */

  window.startRun = function () {
    S = newRun();
    S.screen = "city";
    save();
    screenCity();
  };

  window.continueRun = function () {
    var s = load();
    if (!s) return window.startRun();
    S = s;
    render();
  };

  window.walkTo = function (id) {
    if (!city().nodes[id]) return;
    S.node = id;
    S.screen = "city";
    save();
    screenCity();
  };

  window.waitPhase = function () {
    S.phase = S.phase === "day" ? "night" : "day";
    S.screen = "city";
    save();
    screenCity();
  };

  window.startKaidan = function (id) { open(id); };

  window.pick = function (i) {
    var k = K(S.kaidan);
    var sc = k.scenes[S.scene];
    var c = sc.c[i];
    if (!c) return;
    enter(c.to);
  };

  function enter(id) {
    var k = K(S.kaidan);
    var sc = k.scenes[id];
    S.scene = id;

    if (sc.end === "death") {
      S.screen = "death"; save(); return screenDeath(sc.t);
    }
    if (sc.end === "clear") {
      S.screen = "clear"; save(); return screenClear(sc.t);
    }
    S.screen = "scene"; save(); screenScene();
  }

  window.backToCity = function () {
    var id = S.kaidan;
    if (id && !S.cleared[id]) {
      S.cleared[id] = true;
      S.candle = Math.max(0, S.candle - 1);
      S.phase = S.phase === "day" ? "night" : "day";
    }
    S.kaidan = null;
    S.scene = null;
    S.screen = "city";
    save();

    var left = kaidans().filter(function (k) {
      return !S.cleared[k.id] && (!k.cond || k.cond(S));
    }).length;
    if (left === 0) { S.screen = "end"; save(); return screenEnd(); }
    screenCity();
  };

  function render() {
    if (!S) return screenIntro();
    if (S.screen === "city") return screenCity();
    if (S.screen === "scene" && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) return screenScene();
    if (S.screen === "clear" && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) {
      return screenClear(K(S.kaidan).scenes[S.scene].t);
    }
    if (S.screen === "death") return screenDeath("Кайдан остался непройденным.");
    if (S.screen === "end") return screenEnd();
    return screenIntro();
  }

  /* ---------- офлайн-режим (для установки на iPhone) ---------- */

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  screenIntro();
})();
