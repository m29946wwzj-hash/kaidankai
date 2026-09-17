/* Кайданкай — движок.
   Экраны: пролог → создание героя → город → голос → сцена → провал / зачёт → город.
   Контент лежит в js/kaidans/*.js, карта — в js/city.js, предметы — в js/items.js,
   участники — в js/roster.js. Здесь только логика. */

(function () {
  "use strict";

  var SAVE_KEY = "kaidankai_v3";
  var BUILD = "сборка 5";
  var TOTAL_ANDON = 100;
  var MAX_WOUNDS = 3;
  var DAYS_PER_KAIDAN = 3;   /* сколько дней даётся на одну историю */
  var app = document.getElementById("app");
  var S = null;

  function kaidans() { return window.KAIDANS || []; }
  function city() { return window.CITY; }
  function K(id) {
    var all = kaidans();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function omomoriList() { return window.OMOMORI || []; }
  function weaponsList() { return window.WEAPONS || []; }
  function findIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function heroName() { return (S && S.hero && S.hero.name) || "Безымянный"; }

  /* Короткое имя дома — для кнопки: полное описание остаётся на экране голоса. */
  function houseShort(k) {
    if (!k || !k.house) return "";
    return k.house.split(/[:;.]/)[0].trim();
  }

  /* сколько историй ещё не рассказано этим героем */
  function remaining() {
    return kaidans().filter(function (k) {
      return !S.cleared[k.id] && (!k.cond || k.cond(S));
    }).length;
  }

  /* ---------- состояние ---------- */

  function blankWorld() {
    return {
      screen: "prologue",
      phase: "day",
      node: city().start,
      kaidan: null,
      scene: null,
      prevScene: null,
      cleared: {},
      andon: TOTAL_ANDON,
      roster: [],
      deck: [],
      gone: [],
      searched: {},
      news: "",
      day: 1,
      lastClearDay: 1
    };
  }

  /* Срок: три дня на историю. День идёт, когда герой дожидается утра. */
  function deadlineDay() { return (S.lastClearDay || 1) + DAYS_PER_KAIDAN; }
  function daysLeft() { return Math.max(0, deadlineDay() - S.day); }

  /* Ёкаи приходят, когда срок вышел: омомори к этому времени иссякли. */
  function yokaiCome() {
    S.omomori = [];
    S.screen = "yokai";
    save();
    screenYokai();
  }

  function screenYokai() {
    setNight(true);
    app.innerHTML = bar() +
      '<div class="title">Ёкаи пришли</div>' +
      '<div class="text death fade">Три дня в Кураяме — это три дня без единой рассказанной истории. ' +
      'За такое не прощают: омомори в кармане делаются тёплыми, потом сухими, потом их нет — ' +
      'силы в них кончились сами.\n\n' +
      'Ёкаи идут по улице не спеша. Их видно в окнах домов, мимо которых ты проходил: ' +
      'у каждого окна стоит по одному, и все смотрят на тебя.\n\n' +
      'Тебя убивают не в кайдане. Просто на улице, между двумя андо́нами, — так забирают ' +
      'тех, кто перестал слушать.</div>' +
      '<div class="text">' + esc(heroName()) + ' больше нет. На его место встал другой — ' +
      'в городе снова сто. Омомори у нового героя свои, и счёт дней начинается заново.</div>' +
      '<button class="restart" onclick="comeAgain()">Прийти снова другим</button>' +
      '<button class="wait" onclick="newRun()">Начать всё сначала</button>';
    window.scrollTo(0, 0);
  }

  function blankHero() {
    return {
      hero: { name: "", origin: "" },
      food: 0, water: 0, meds: 0,
      wounds: 0,
      weapons: [],
      omomori: [],
      burned: []
    };
  }

  function startFresh() {
    S = blankWorld();
    var h = blankHero();
    for (var k in h) S[k] = h[k];
  }

  function newRun() {
    startFresh();
    save();
    screenPrologue();
  }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.screen && s.hero && city().nodes[s.node]) ? s : null;
    } catch (e) { return null; }
  }

  /* ---------- общие куски ---------- */

  function bar() {
    var cls = S.andon <= 10 ? "candles low" : "candles";
    var ph = S.phase === "night"
      ? '<span class="phase n">ночь</span>'
      : '<span class="phase">день</span>';
    var dl = daysLeft() <= 1
      ? '<span class="phase n">срок · ' + daysLeft() + ' дн.</span>'
      : '<span class="phase">срок · ' + daysLeft() + ' дн.</span>';
    return '<div class="bar"><span class="' + cls + '">андоны · ' + S.andon + '</span>' +
      '<span class="phase">день ' + S.day + '</span>' + ph + dl + '</div>';
  }

  function status() {
    var parts = ["еда " + S.food, "вода " + S.water, "лекарства " + S.meds];
    var w = S.wounds > 0 ? "раны " + S.wounds : "без ран";
    var om = S.omomori.length ? "омомори " + S.omomori.length : "омомори нет";
    return '<div class="status">' + esc(heroName()) + " · " + parts.join(" · ") +
      " · " + w + " · " + om + '</div>';
  }

  function setNight(on) {
    if (on) document.body.classList.add("night");
    else document.body.classList.remove("night");
  }

  function news() {
    return S.news ? '<div class="news fade">' + S.news + '</div>' : "";
  }

  /* Кто-то уходит, кто-то приходит — счёт остаётся сотней. */
  function someoneDies() {
    var r = window.replaceOne(S);
    if (!r) return "";
    S.gone.push(r.gone);
    S.news = "На дальнем конце полосы погас андо́н: " + esc(r.gone) + " не вернулся. " +
      "На его место уже встал " + esc(r.came) + " — в городе снова сто.";
    return S.news;
  }

  /* ---------- если что-то сломалось ---------- */

  /* Ошибку показываем на экране, а не в консоли: на телефоне консоли нет,
     и молчание выглядит как «кнопка не нажимается». */
  window.onerror = function (msg, src, line) {
    var box = document.getElementById("app");
    if (!box) return false;
    box.innerHTML = '<div class="title">Поломка в игре</div>' +
      '<div class="text death">' + esc(String(msg)) + '\n' + esc(String(src || "")) + ':' + line + '</div>' +
      '<div class="text">Покажи это сообщение мне — по нему видно, что именно сломалось.\n\n' +
      'Если ошибка про старые файлы или экран пустой — нажми «Обновить игру»: скорее всего, ' +
      'в телефоне осталась прежняя сборка из памяти браузера.</div>' +
      '<button class="restart" onclick="hardReload()">Обновить игру</button>';
    return false;
  };

  /* Обновление с чисткой: снимаем офлайн-кэш и перезагружаем страницу заново. */
  window.hardReload = function () {
    var done = false;
    function go() { if (!done) { done = true; location.reload(); } }
    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (ks) {
          return Promise.all(ks.map(function (k) { return caches.delete(k); }));
        }).catch(function () {});
      }
      if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(rs.map(function (r) { return r.unregister(); }));
        }).then(go).catch(go);
        setTimeout(go, 900);
        return;
      }
    } catch (e) {}
    go();
  };

  /* ---------- экраны ---------- */

  function screenPrologue() {
    setNight(false);
    app.innerHTML =
      '<h1>Кайданкай</h1>' +
      '<div class="sub">сто андо́нов · город Кураяма · ' + BUILD + '</div>' +
      '<div class="text fade">' + window.PROLOGUE.intro + '</div>' +
      '<div class="text fade">' + window.PROLOGUE.arrivalCommon + '</div>' +
      '<div class="text fade">' + window.PROLOGUE.toast + '</div>' +
      '<button onclick="toCreate()">Дальше</button>' +
      '<label class="file">Загрузить сохранение<input type="file" accept=".json,application/json"' +
      ' onchange="loadFile(this)"></label>' +
      '<button class="wait" onclick="hardReload()">Обновить игру</button>';
    window.scrollTo(0, 0);
  }

  function screenCreate() {
    setNight(false);
    var origins = window.ORIGINS.map(function (o) {
      return '<button class="origin" onclick="setOrigin(\'' + o.id + '\')">' + esc(o.label) +
        '<small>' + esc(o.short) + '</small></button>';
    }).join("");
    app.innerHTML =
      '<div class="title">Кто ты</div>' +
      '<div class="text">Назови себя. Настоящее имя или выдуманное — здесь это не проверить.\n\n' +
      'И вспомни, как ты сюда попал. От этого зависит, что у тебя в карманах.</div>' +
      '<label class="field">имя<input id="heroName" maxlength="16" placeholder="как тебя звать" value="' +
      esc(S.hero.name || "") + '"></label>' +
      '<div class="loc-sub">как ты оказался в Кураяме</div>' +
      origins;
    window.scrollTo(0, 0);
  }

  function screenArrival(o) {
    setNight(false);
    app.innerHTML =
      '<div class="title">' + esc(o.label) + '</div>' +
      '<div class="text fade">' + o.arrival + '</div>' +
      '<div class="text fade">' + window.PROLOGUE.toast + '</div>' +
      '<button onclick="enterCity()">Открыть глаза</button>';
    window.scrollTo(0, 0);
  }

  function screenCity() {
    /* рассказывать больше нечего — значит, город закрыт */
    if (remaining() === 0) { S.screen = "end"; save(); return screenEnd(); }
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
        '<small>' + esc(houseShort(k)) + ' · провал — смерть</small></button>';
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

    var key = S.node + "|" + S.phase;
    var search = S.searched[key]
      ? '<div class="hint">Здесь уже обыскано.</div>'
      : '<button class="wait" onclick="searchStreet()">Обыскать улицу</button>';

    var left = remaining();

    app.innerHTML = bar() + status() +
      '<div class="loc">' + node.name + '</div>' +
      '<div class="loc-sub">' + left + ' кайданов ещё не рассказано · в городе сто</div>' +
      '<div class="text fade">' + desc + '</div>' +
      news() +
      kbtns +
      ebtns +
      '<div class="hint">История держит срок до исхода дня ' + deadlineDay() +
      '. Расскажешь одну — счёт дням пойдёт заново. Не расскажешь — омомори догорят, и придут ёкаи.</div>' +
      wait +
      search +
      '<div class="row">' +
      '<button class="mini" onclick="openPack()">Рюкзак</button>' +
      '<button class="mini" onclick="openRoster()">Участники</button>' +
      '</div>' +
      '<div class="row">' +
      '<button class="mini" onclick="saveFile()">Сохранить прогресс файлом</button>' +
      '<label class="file">Загрузить сохранение<input type="file" accept=".json,application/json"' +
      ' onchange="loadFile(this)"></label>' +
      '</div>' +
      closedLine;
    window.scrollTo(0, 0);
  }

  function screenPack() {
    setNight(S.phase === "night");
    var w = S.weapons.length
      ? S.weapons.map(function (id) { var x = findIn(weaponsList(), id); return '<li>' + esc(x ? x.name : id) + '</li>'; }).join("")
      : '<li>пусто</li>';
    var o = S.omomori.length
      ? S.omomori.map(function (id) { var x = findIn(omomoriList(), id); return '<li>' + esc(x ? x.name : id) + ' — <i>' + esc(x ? x.note : "") + '</i></li>'; }).join("")
      : '<li>пусто</li>';
    var b = S.burned.length
      ? '<div class="loc-sub">сгорели</div><ul class="plain">' + S.burned.map(function (id) {
          var x = findIn(omomoriList(), id); return '<li>' + esc(x ? x.name : id) + '</li>';
        }).join("") + '</ul>'
      : "";
    app.innerHTML = bar() + status() +
      '<div class="title">Рюкзак</div>' +
      '<div class="text">Оружие выручает в кайданах — с ним открываются варианты, которых без него нет.\n\n' +
      'Омомори сгорает один раз и уводит от верной смерти. Раны копятся: три — и никакой амулет не поможет.</div>' +
      '<div class="loc-sub">оружие</div><ul class="plain">' + w + '</ul>' +
      '<div class="loc-sub">омомори</div><ul class="plain">' + o + '</ul>' +
      b +
      '<button onclick="backFromScreen()">Назад</button>';
    window.scrollTo(0, 0);
  }

  function screenRoster() {
    setNight(S.phase === "night");
    var chips = S.roster.map(function (p) {
      return '<span class="chip' + (p.hero ? " hero" : "") + '">' + esc(p.name) + '</span>';
    }).join("");
    app.innerHTML = bar() + status() +
      '<div class="title">Участники</div>' +
      '<div class="text">В Кураяме всегда ровно сто — включая тебя. Ушло с начала: ' + S.gone.length +
      '. Каждого заменили, и ты не помнишь, кем он был до тебя.\n\n' +
      'Имена тех, кто ушёл, никто не записывает. Ты записываешь.</div>' +
      '<div class="chips">' + chips + '</div>' +
      (S.gone.length ? '<div class="loc-sub">ушли</div><div class="chips">' +
        S.gone.map(function (n) { return '<span class="chip gone">' + esc(n) + '</span>'; }).join("") + '</div>' : "") +
      '<button onclick="backFromScreen()">Назад</button>';
    window.scrollTo(0, 0);
  }

  function screenVoice() {
    var k = K(S.kaidan);
    setNight(S.phase === "night");
    app.innerHTML = bar() + status() +
      '<div class="loc">' + k.title + '</div>' +
      (k.house ? '<div class="loc-sub">дом: ' + esc(k.house) + '</div>' : "") +
      '<div class="title voice">Голос</div>' +
      '<div class="text fade">' + window.voiceFor(k) + '</div>' +
      '<button onclick="listenOn()">Слушать дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenScene() {
    var k = K(S.kaidan);
    var sc = k.scenes[S.scene];
    setNight(S.phase === "night");
    var choices = sc.c.map(function (c, i) {
      if (c.need && S.weapons.indexOf(c.need) < 0) {
        var w = findIn(weaponsList(), c.need);
        return '<button class="locked" disabled>' + c.t +
          '<small>нужно: ' + esc(w ? w.name : "оружие") + '</small></button>';
      }
      return '<button onclick="pick(' + i + ')">' + c.t + '</button>';
    }).join("");
    app.innerHTML = bar() + status() +
      '<div class="title fade">' + k.title + '</div>' +
      '<div class="text fade">' + sc.t + '</div>' +
      choices;
    window.scrollTo(0, 0);
  }

  function screenDeath(text, final) {
    setNight(true);
    var who = esc(heroName());
    app.innerHTML = bar() +
      '<div class="title">' + (final ? "Всё" : "Провал") + '</div>' +
      '<div class="text death fade">' + text + '</div>' +
      '<div class="text">' + who + ' больше нет. На его место встал другой — в городе снова сто, ' +
      'и андо́ны горят так же ровно, как горели.\n\n' +
      (final
        ? 'Раны сложились в три, и это оказалось больше, чем можно вынести.'
        : 'Кайданы, которые ты прошёл, остаются пройденными: город помнит, кто гасил его огни.') + '</div>' +
      '<button class="restart" onclick="comeAgain()">Прийти снова другим</button>' +
      '<button class="wait" onclick="newRun()">Начать всё сначала</button>';
    window.scrollTo(0, 0);
  }

  function screenClear(text) {
    setNight(S.phase === "night");
    app.innerHTML = bar() + status() +
      '<div class="title">Кайдан пройден</div>' +
      '<div class="text fade">' + text + '</div>' +
      news() +
      '<button onclick="backToCity()">Идти дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenBurned(text) {
    setNight(S.phase === "night");
    var last = S.burned[S.burned.length - 1];
    var o = findIn(omomoriList(), last);
    app.innerHTML = bar() + status() +
      '<div class="title">Омомори сгорел</div>' +
      '<div class="text death fade">' + text + '</div>' +
      '<div class="text">Амулет в твоём кармане стал тёплым, потом горячим, потом его не стало. ' +
      'Осталась горсть пепла и одна рана — но ты стоишь там же, где стоял до выбора.\n\n' +
      'Сгорело: ' + esc(o ? o.name : "омомори") + '. Раны: ' + S.wounds + ' из ' + MAX_WOUNDS + '.' +
      (S.wounds >= MAX_WOUNDS - 1 ? '\n\nСледующая смерть будет последней — это не отговорить.' : '') + '</div>' +
      '<button onclick="backFromBurn()">Вернуться</button>';
    window.scrollTo(0, 0);
  }

  function screenEnd() {
    setNight(true);
    var left = kaidans().length;
    app.innerHTML = bar() + status() +
      '<div class="title">Пока всё</div>' +
      '<div class="text fade">Ты прошёл все кайданы, которые есть в этой сборке, — ' + left + ' из ста. ' +
      'Андо́нов на полосах осталось ' + S.andon + '.\n\n' +
      'В Кураяме стало на ' + left + ' огней темнее, и это ты погасил их, хотя не зажигал. ' +
      'Где-то в середине города стоит прямоугольник, выложенный чёрным камнем: сто гнёзд, ' +
      'и всё меньше огня в них. Когда погаснет последний, придёт тот, кто ждёт этого дольше всех.</div>' +
      '<div class="hint">Дальше — новые истории. Их будет девяносто.</div>' +
      '<button class="restart" onclick="newRun()">Начать заново</button>';
    window.scrollTo(0, 0);
  }

  /* ---------- переходы ---------- */

  window.toCreate = function () {
    S.screen = "create";
    save();
    screenCreate();
  };

  window.setOrigin = function (id) {
    var inp = document.getElementById("heroName");
    var typed = inp && inp.value ? String(inp.value).trim() : "";
    S.hero.name = (typed || "Безымянный").slice(0, 16);
    S.hero.origin = id;
    var o = window.originById(id);
    S._pendingOrigin = id;
    S.screen = "arrival";
    save();
    screenArrival(o);
  };

  window.enterCity = function () {
    var o = window.originById(S._pendingOrigin || S.hero.origin);
    if (!S.roster.length) {
      var made = window.makeRoster(S.hero.name);
      S.roster = made.roster;
      S.deck = made.deck;
    }
    S.food += o.food;
    S.water += o.water;
    S.meds += o.meds;
    (o.weapons || []).forEach(function (w) { if (S.weapons.indexOf(w) < 0) S.weapons.push(w); });
    for (var i = 0; i < (o.omomori || 0); i++) {
      var free = omomoriList().filter(function (m) { return S.omomori.indexOf(m.id) < 0; });
      if (free.length) S.omomori.push(free[Math.floor(Math.random() * free.length)].id);
    }
    S.news = "Тебя посчитали. Ты — " + esc(S.hero.name) + ", и в городе снова ровно сто.";
    S.screen = "city";
    save();
    screenCity();
  };

  window.comeAgain = function () {
    var world = {
      cleared: S.cleared, andon: S.andon, roster: S.roster, deck: S.deck,
      gone: S.gone, searched: S.searched, phase: S.phase, node: S.node, day: S.day
    };
    startFresh();
    for (var k in world) S[k] = world[k];
    S.lastClearDay = S.day;   /* у нового героя свой срок */
    S.news = "Он умер, а ты пришёл. Никто не спросил, откуда.";
    S.screen = "create";
    save();
    screenCreate();
  };

  window.walkTo = function (id) {
    if (!city().nodes[id]) return;
    S.node = id;
    if (Math.random() < 0.35) someoneDies();
    S.screen = "city";
    save();
    screenCity();
  };

  /* Какие места вообще существуют в этой фазе: те, куда можно прийти
     от старта по ночным (или дневным) переходам. Ночь открывает одни
     улицы и закрывает другие, и это не только текст. */
  function phasePlaces(phase) {
    var seen = {}, q = [city().start], i;
    seen[city().start] = true;
    while (q.length) {
      var n = city().nodes[q.shift()];
      if (!n) continue;
      var links = (phase === "day" ? n.links : n.nightLinks) || [];
      for (i = 0; i < links.length; i++) {
        if (city().nodes[links[i]] && !seen[links[i]]) { seen[links[i]] = true; q.push(links[i]); }
      }
    }
    return seen;
  }

  window.waitPhase = function () {
    var toDay = S.phase === "night";
    var warn = "", note = "";
    S.phase = toDay ? "day" : "night";
    if (toDay) {
      S.day++;
      if (daysLeft() === 0) return yokaiCome();
      if (daysLeft() === 1) {
        warn = "Омомори в кармане стали тёплыми. До срока — один день: " +
          "если к утру ни одна история не будет рассказана, они догорят.";
      }
    }
    /* Смена фазы застаёт тебя там, где ты стоял, но не всякая улица есть в
       обеих фазах: переулка-щели днём нет, лестницы вниз днём нет. Город
       выставляет тебя туда, откуда это место открывается. */
    var exists = phasePlaces(S.phase);
    if (!exists[S.node]) {
      var here = city().nodes[S.node] || {};
      var exits = (S.phase === "day" ? here.links : here.nightLinks) || [];
      var fit = exits.filter(function (id) { return city().nodes[id] && exists[id]; });
      if (fit.length) {
        S.node = fit[Math.floor(Math.random() * fit.length)];
        note = "Улица, на которой ты стоял, кончилась вместе с " + (toDay ? "ночью" : "днём") +
          ". Ты выходишь на «" + esc(city().nodes[S.node].name) + "».";
      }
    }
    if (Math.random() < 0.45) someoneDies();
    /* предупреждение о сроке важнее городской сводки — оно не должно теряться */
    if (note) S.news = S.news ? note + " " + S.news : note;
    if (warn) S.news = S.news ? warn + " " + S.news : warn;
    S.screen = "city";
    save();
    screenCity();
  };

  window.searchStreet = function () {
    var key = S.node + "|" + S.phase;
    S.searched[key] = true;
    var loot = window.pickLoot();
    var line;
    if (loot.kind === "food") { S.food += loot.amount; line = "Ты нашёл " + loot.text + "."; }
    else if (loot.kind === "water") { S.water += loot.amount; line = "Ты нашёл " + loot.text + "."; }
    else if (loot.kind === "meds") { S.meds += loot.amount; line = "Ты нашёл " + loot.text + "."; }
    else if (loot.kind === "weapon") {
      var owned = weaponsList().filter(function (w) { return S.weapons.indexOf(w.id) < 0; });
      if (owned.length) {
        var w = owned[Math.floor(Math.random() * owned.length)];
        S.weapons.push(w.id);
        line = "Ты нашёл " + loot.text + ". Это " + w.name + ".";
      } else {
        S.food += 1;
        line = "Оружия больше не нашлось. Зато нашлась еда.";
      }
    } else if (loot.kind === "omomori") {
      var free = omomoriList().filter(function (m) { return S.omomori.indexOf(m.id) < 0; });
      if (free.length) {
        var m = free[Math.floor(Math.random() * free.length)];
        S.omomori.push(m.id);
        line = "Ты нашёл " + loot.text + ". Это " + m.name + ".";
      } else {
        S.meds += 1;
        line = "Омомори больше не попадаются. Под подкладкой нашлись таблетки.";
      }
    } else {
      line = "Ты обыскал всё, что можно было обыскать. " + loot.text.charAt(0).toUpperCase() + loot.text.slice(1) + ".";
    }
    S.news = line;
    save();
    screenCity();
  };

  window.startKaidan = function (id) {
    var k = K(id);
    if (!k) return;
    S.kaidan = id;
    S.scene = k.start;
    S.prevScene = k.start;
    S.screen = "voice";
    save();
    screenVoice();
  };

  window.listenOn = function () {
    S.screen = "scene";
    save();
    screenScene();
  };

  /* Сохранение отдельным файлом: переживает чистку браузера и переносится на другое устройство. */
  window.saveFile = function () {
    var name = "kaidankai-" + (S.hero.name || "geroy").replace(/[^\wА-Яа-яЁё-]/g, "") +
      "-den" + S.day + ".json";
    try {
      var blob = new Blob([JSON.stringify(S)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      S.news = "Прогресс сохранён файлом: " + name + ". Его можно открыть на другом устройстве.";
    } catch (e) {
      S.news = "Не получилось сохранить файл. Игра всё равно сохраняется сама: закрой и открой заново.";
    }
    save();
    screenCity();
  };

  window.loadFile = function (input) {
    var f = input && input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var ok = false;
      try {
        var s = JSON.parse(String(r.result));
        if (s && s.hero && city().nodes[s.node] && s.cleared) {
          S = s;
          if (!S.day) { S.day = 1; S.lastClearDay = 1; }
          if (!S.news) S.news = "";
          S.news = "Прогресс загружен: " + esc(S.hero.name || "герой") + ", день " + S.day +
            ", андо́нов " + S.andon + ".";
          save();
          render();
          ok = true;
        }
      } catch (e) {}
      if (!ok) {
        S.news = "Это не похоже на сохранение Кайданкая.";
        save();
        screenCity();
      }
      if (input.value) input.value = "";
    };
    r.readAsText(f);
  };

  window.openPack = function () { S.screen = "pack"; save(); screenPack(); };
  window.openRoster = function () { S.screen = "roster"; save(); screenRoster(); };
  window.backFromScreen = function () { S.screen = "city"; save(); screenCity(); };
  window.backFromBurn = function () {
    S.screen = "scene";
    S.scene = S.prevScene;
    save();
    screenScene();
  };

  window.pick = function (i) {
    var k = K(S.kaidan);
    var sc = k.scenes[S.scene];
    var c = sc.c[i];
    if (!c) return;
    S.prevScene = S.scene;
    enter(c.to);
  };

  function enter(id) {
    var k = K(S.kaidan);
    var sc = k.scenes[id];
    S.scene = id;

    if (sc.end === "death") return die(sc.t);
    if (sc.end === "clear") {
      S.screen = "clear"; save(); return screenClear(sc.t);
    }
    S.screen = "scene"; save(); screenScene();
  }

  function die(text) {
    if (S.omomori.length && S.wounds < MAX_WOUNDS - 1) {
      S.burned.push(S.omomori.pop());
      S.wounds++;
      S.screen = "burned";
      save();
      return screenBurned(text);
    }
    S.screen = "death";
    save();
    screenDeath(text, S.wounds >= MAX_WOUNDS - 1);
  }

  /* Истощение: после каждого пройденного кайдана нужна еда и вода. */
  function consume() {
    S.food -= 1;
    S.water -= 1;
    var lines = [];
    if (S.food < 0) { S.food = 0; S.wounds++; lines.push("Еды не осталось — ты идёшь на голоде, и это рана."); }
    if (S.water < 0) { S.water = 0; S.wounds++; lines.push("Воды не осталось — во рту сухо, и это вторая рана."); }
    if (lines.length) {
      S.news = lines.join(" ") + " Ран у тебя " + S.wounds + " из " + MAX_WOUNDS + ". " +
        (S.wounds >= MAX_WOUNDS ? "Больше не выдержать." : "Обыщи улицу, пока не стало поздно.");
    }
    return S.wounds >= MAX_WOUNDS;
  }

  window.backToCity = function () {
    var id = S.kaidan;
    if (id && !S.cleared[id]) {
      S.cleared[id] = true;
      S.andon = Math.max(0, S.andon - 1);
      S.phase = S.phase === "day" ? "night" : "day";
      S.lastClearDay = S.day;   /* история рассказана — срок отсчитывается заново */
      S.kaidan = null;
      S.scene = null;
      if (consume()) {
        S.screen = "death";
        save();
        return screenDeath("Ты гасил огни, пока хватало сил. Силы кончились раньше.", true);
      }
    }
    S.kaidan = null;
    S.scene = null;
    S.screen = "city";
    save();

    if (remaining() === 0) { S.screen = "end"; save(); return screenEnd(); }
    screenCity();
  };

  window.startRun = function () { newRun(); };

  window.continueRun = function () {
    var s = load();
    if (!s) return newRun();
    S = s;
    render();
  };

  function render() {
    if (!S) return screenPrologue();
    if (S.screen === "prologue") return screenPrologue();
    if (S.screen === "create") return screenCreate();
    if (S.screen === "arrival") return screenArrival(window.originById(S._pendingOrigin || S.hero.origin));
    if (S.screen === "city") return screenCity();
    if (S.screen === "pack") return screenPack();
    if (S.screen === "roster") return screenRoster();
    if (S.screen === "voice") return screenVoice();
    if (S.screen === "scene" && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) return screenScene();
    if (S.screen === "burned") return screenBurned("Омомори сгорел между тобой и тем, что шло за тобой.");
    if (S.screen === "clear" && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) {
      return screenClear(K(S.kaidan).scenes[S.scene].t);
    }
    if (S.screen === "yokai") return screenYokai();
    if (S.screen === "death") return screenDeath("Кайдан остался непройденным.", S.wounds >= MAX_WOUNDS - 1);
    if (S.screen === "end") return screenEnd();
    return screenPrologue();
  }

  /* ---------- офлайн-режим (для установки на iPhone) ---------- */

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  /* Вход: если игра уже начата — продолжаем с того же места, иначе начинаем заново.
     Без этого S остаётся пустым и первая же кнопка не срабатывает. */
  (function boot() {
    try {
      var saved = load();
      if (saved) { S = saved; render(); return; }
      newRun();
    } catch (e) {
      /* пустой экран хуже честной ошибки: показываем её */
      window.onerror(String((e && e.message) || e), "engine.js", 0);
    }
  })();
})();
