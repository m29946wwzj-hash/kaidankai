/* Кайданкай — движок.
   Экраны: пролог → создание героя → город → голос → сцена → провал / зачёт → город.
   Контент лежит в js/kaidans/*.js, карта — в js/city.js, предметы — в js/items.js,
   участники — в js/roster.js, люди в городе — в js/people.js, ёкаи — в js/yokai.js.
   Здесь только логика.

   Сутки идут тремя шагами: день → ночь → полночь → (утро) новый день.
   Кайданы начинаются только в полночь, поэтому до полуночи в городе не видно,
   какой дом этой ночью откроется. История кончается утром: время суток после
   кайдана всегда меняется. */

(function () {
  "use strict";

  var SAVE_KEY = "kaidankai_v3";
  var BUILD = "сборка 6";
  var TOTAL_ANDON = 100;
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
  function fearMax() { return window.FEAR_MAX || 5; }
  function maxWounds() { return (S && S.maxWounds) || 3; }

  /* ---------- род героя ----------
     Тексты написаны в мужском роде: «ты вошёл», «ты взял». Для героини движок
     переводит их на ходу — по формам глаголов, которые идут при «ты» и в
     цепочке «и …», и по словам вроде «сам», «один», «готов». Существительные
     и чужая речь не трогаются: конверсия идёт только внутри оборота про «ты». */

  var FEM_VERB = {
    "вошёл": "вошла", "вышел": "вышла", "ушёл": "ушла", "пришёл": "пришла",
    "зашёл": "зашла", "нашёл": "нашла", "подошёл": "подошла", "отошёл": "отошла",
    "прошёл": "прошла", "перешёл": "перешла", "дошёл": "дошла", "обошёл": "обошла",
    "сошёл": "сошла", "взошёл": "взошла", "снял": "сняла", "взял": "взяла",
    "дал": "дала", "стал": "стала", "встал": "встала", "привстал": "привстала",
    "устал": "устала", "отстал": "отстала", "понял": "поняла", "поднял": "подняла",
    "принял": "приняла", "сделал": "сделала", "увидел": "увидела", "услышал": "услышала",
    "сказал": "сказала", "спросил": "спросила", "ответил": "ответила", "заметил": "заметила",
    "открыл": "открыла", "закрыл": "закрыла", "положил": "положила", "поставил": "поставила",
    "опустил": "опустила", "повернул": "повернула", "тронул": "тронула", "коснулся": "коснулась",
    "держал": "держала", "смотрел": "смотрела", "слушал": "слушала", "знал": "знала",
    "помнил": "помнила", "забыл": "забыла", "думал": "думала", "решил": "решила",
    "вернулся": "вернулась", "остался": "осталась", "оказался": "оказалась", "взялся": "взялась",
    "занялся": "занялась", "шёл": "шла", "был": "была", "мог": "могла",
    "успел": "успела", "хотел": "хотела", "видел": "видела", "жил": "жила",
    "спал": "спала", "сидел": "сидела", "стоял": "стояла", "начал": "начала",
    "кончил": "кончила", "бросил": "бросила", "пустил": "пустила", "выпустил": "выпустила",
    "пропустил": "пропустила", "сбился": "сбилась", "сорвал": "сорвала", "рвал": "рвала",
    "резал": "резала", "копал": "копала", "искал": "искала", "достал": "достала",
    "застал": "застала", "отдал": "отдала", "продал": "продала", "сдал": "сдала",
    "узнал": "узнала", "признал": "признала", "нажал": "нажала", "лежал": "лежала",
    "бежал": "бежала", "дрожал": "дрожала", "дышал": "дышала", "сжал": "сжала",
    "разжал": "разжала", "работал": "работала", "шагнул": "шагнула", "замер": "замерла",
    "умер": "умерла", "стёр": "стёрла", "запер": "заперла", "отпер": "отперла",
    "вытер": "вытерла", "сел": "села", "слез": "слезла", "влез": "влезла",
    "глянул": "глянула", "взглянул": "взглянула", "кивнул": "кивнула", "качнул": "качнула",
    "толкнул": "толкнула", "дёрнул": "дёрнула", "вынул": "вынула", "сунул": "сунула",
    "засунул": "засунула", "ткнул": "ткнула", "стукнул": "стукнула", "хлопнул": "хлопнула",
    "щёлкнул": "щёлкнула", "сорвался": "сорвалась", "оглянулся": "оглянулась",
    "обернулся": "обернулась", "наклонился": "наклонилась", "выпрямился": "выпрямилась",
    "нагнулся": "нагнулась", "присел": "присела", "поднялся": "поднялась",
    "спустился": "спустилась", "выбрался": "выбралась", "добрался": "добралась",
    "отказался": "отказалась", "согласился": "согласилась", "проснулся": "проснулась",
    "очнулся": "очнулась", "задохнулся": "задохнулась", "попал": "попала",
    "попался": "попался", "упал": "упала", "лёг": "легла", "прилёг": "прилегла",
    "прочитал": "прочитала", "читал": "читала", "писал": "писала", "написал": "написала",
    "попробовал": "попробовала", "пробовал": "пробовала", "трогал": "трогала",
    "гладил": "гладила", "лизал": "лизала", "жевал": "жевала", "пил": "пила",
    "нёс": "несла", "вёл": "вела", "привёл": "привела", "увёл": "увела",
    "налил": "налила", "вылил": "вылила", "полил": "полила", "сжёг": "сожгла",
    "жёг": "жгла", "поджёг": "подожгла", "сломал": "сломала", "ломал": "ломала",
    "мял": "мяла", "гнул": "гнула", "согнул": "согнула", "разогнул": "разогнула",
    "тянул": "тянула", "потянул": "потянула", "натянул": "натянула", "вытянул": "вытянула",
    "кинул": "кинула", "схватил": "схватила", "зацепил": "зацепила", "отцепил": "отцепила",
    "привязал": "привязала", "развязал": "развязала", "завязал": "завязала",
    "обмотал": "обмотала", "намотал": "намотала", "размотал": "размотала",
    "наступил": "наступила", "ступил": "ступила", "переступил": "переступила",
    "отступил": "отступила", "выронил": "выронила", "уронил": "уронила",
    "подхватил": "подхватила", "придержал": "придержала", "поддержал": "поддержала",
    "сдержал": "сдержала", "выждал": "выждала", "подождал": "подождала",
    "ждал": "ждала", "искал": "искала", "перестал": "перестала", "успел": "успела",
    "захотел": "захотела", "сумел": "сумела", "умел": "умела", "привык": "привыкла",
    "смог": "смогла", "помог": "помогла", "лёг": "легла", "открылся": "открылась",
    "закрылся": "закрылась", "кончился": "кончилась", "начался": "началась",
    "потерял": "потеряла", "нашёл": "нашла", "выбрал": "выбрала", "выбросил": "выбросила",
    "собрал": "собрала", "разобрал": "разобрала", "забрал": "забрала", "убрал": "убрала",
    "набрал": "набрала", "перебрал": "перебрала", "подобрал": "подобрала",
    "выпрямил": "выпрямила", "выставил": "выставила", "выложил": "выложила",
    "разложил": "разложила", "сложил": "сложила", "приложил": "приложила",
    "подложил": "подложила", "проложил": "проложила", "отложил": "отложила",
    "заглянул": "заглянула", "вгляделся": "вгляделась", "прислушался": "прислушалась",
    "отшатнулся": "отшатнулась", "шарахнулся": "шарахнулась", "отпрянул": "отпрянула",
    "подался": "подалась", "тронулся": "тронулась", "двинулся": "двинулась",
    "отодвинулся": "отодвинулась", "придвинулся": "придвинулась", "нащупал": "нащупала",
    "ощупал": "ощупала", "потрогал": "потрогала", "погладил": "погладила",
    "поддел": "поддела", "приподнял": "приподняла", "перевернул": "перевернула",
    "развернул": "развернула", "свернул": "свернула", "завернул": "завернула",
    "обернул": "обернула", "отвернул": "отвернула", "вывернул": "вывернула",
    "вставил": "вставила", "вынул": "вынула", "воткнул": "воткнула",
    "задвинул": "задвинула", "выдвинул": "выдвинула", "задвинул": "задвинула",
    "прикрыл": "прикрыла", "отворил": "отворила", "распахнул": "распахнула",
    "захлопнул": "захлопнула", "прихлопнул": "прихлопнула", "заложил": "заложила",
    "отвинтил": "отвинтила", "привинтил": "привинтила", "зацепился": "зацепилась",
    "задел": "задела", "ударил": "ударила", "бил": "била", "хватил": "хватила",
    "рубил": "рубила", "срубил": "срубила", "подрубил": "подрубила", "колол": "колола",
    "расколол": "расколола", "наколол": "наколола", "срубил": "срубила",
    "резал": "резала", "отрезал": "отрезала", "нарезал": "нарезала", "разрезал": "разрезала",
    "вспорол": "вспорола", "порол": "порола", "проткнул": "проткнула", "проколол": "проколола",
    "смял": "смяла", "скомкал": "скомкала", "размял": "размяла", "тёр": "тёрла",
    "потёр": "потёрла", "протёр": "протёрла", "стёр": "стёрла", "смешал": "смешала",
    "перемешал": "перемешала", "взял": "взяла", "хватился": "хватилась",
    "спохватился": "спохватилась", "догадался": "догадалась", "понял": "поняла",
    "осознал": "осознала", "сообразил": "сообразила", "додумал": "додумала",
    "запомнил": "запомнила", "вспомнил": "вспомнила", "припомнил": "припомнила",
    "уговорил": "уговорила", "упросил": "упросила", "попросил": "попросила",
    "велел": "велела", "приказал": "приказала", "разрешил": "разрешила",
    "запретил": "запретила", "обещал": "обещала", "поклялся": "поклялась",
    "соврал": "соврала", "обманул": "обманула", "промолчал": "промолчала",
    "крикнул": "крикнула", "закричал": "закричала", "шепнул": "шепнула",
    "прошептал": "прошептала", "произнёс": "произнесла", "выговорил": "выговорила",
    "пробормотал": "пробормотала", "бормотал": "бормотала", "молчал": "молчала",
    "замолчал": "замолчала", "вздохнул": "вздохнула", "охнул": "охнула",
    "ахнул": "ахнула", "фыркнул": "фыркнула", "усмехнулся": "усмехнулась",
    "улыбнулся": "улыбнулась", "нахмурился": "нахмурилась", "содрогнулся": "содрогнулась",
    "вздрогнул": "вздрогнула", "поежился": "поежилась", "съёжился": "съёжилась",
    "сжался": "сжалась", "потянулся": "потянулась", "сдвинулся": "сдвинулась",
    "застыл": "застыла", "оцепенел": "оцепенела", "занемел": "занемела",
    "опустился": "опустилась", "уселся": "уселась", "устроился": "устроилась",
    "вышел": "вышла", "перешагнул": "перешагнула", "шагнул": "шагнула",
    "ступил": "ступила", "побежал": "побежала", "подбежал": "подбежала",
    "отбежал": "отбежала", "сбежал": "сбежала", "прибежал": "прибежала",
    "побрел": "побрела", "потащился": "потащилась", "поплёлся": "поплелась",
    "возвратился": "возвратилась", "собрался": "собралась", "решился": "решилась",
    "отважился": "отважилась", "осмелился": "осмелилась", "посмел": "посмела",
    /* неправильные: правило «-л → -ла» их не берёт */
    "разгрёб": "разгребла", "грёб": "гребла", "сгрёб": "сгребла", "скрёб": "скребла",
    "рос": "росла", "вырос": "выросла", "дорос": "доросла", "вёз": "везла",
    "привёз": "привезла", "увёз": "увезла", "тряс": "трясла", "затряс": "затрясла",
    "лез": "лезла", "залез": "залезла", "грыз": "грызла", "мёрз": "мёрзла",
    "замёрз": "замёрзла", "увяз": "увязла", "завяз": "завязла", "слёг": "слегла",
    "помер": "померла", "замолк": "замолкла", "смолк": "смолкла", "стих": "стихла",
    "заглох": "заглохла", "засох": "засохла", "промок": "промокла", "продрог": "продрогла",
    "озяб": "озябла", "ослеп": "ослепла", "оглох": "оглохла", "поник": "поникла",
    "возник": "возникла", "умолк": "умолкла", "отвык": "отвыкла", "сник": "сникла",
    "иссяк": "иссякла", "погиб": "погибла", "ослаб": "ослабла", "озяб": "озябла",
    "застыл": "застыла", "отвык": "отвыкла", "приник": "приникла", "вник": "вникла",
    "утих": "утихла", "затих": "затихла", "вспух": "вспухла", "оглох": "оглохла"
  };

  var FEM_WORD = {
    "сам": "сама", "один": "одна", "готов": "готова", "должен": "должна",
    "согласен": "согласна", "виноват": "виновата", "уверен": "уверена",
    "рад": "рада", "привычен": "привычна", "жив": "жива", "мёртв": "мертва",
    "сыт": "сыта", "первый": "первая", "последний": "последняя",
    "вынужден": "вынуждена", "осторожен": "осторожна",
    "цел": "цела", "бел": "бела", "нужен": "нужна", "страшен": "страшна"
  };

  /* Слова на «-л», которые не глаголы: полу и столу род менять не надо.
     Список нужен потому, что дальше формы делаются правилом, а не словарём. */
  var FEM_NOUNS = {
    "пол": 1, "стол": 1, "стул": 1, "угол": 1, "узел": 1, "ствол": 1, "пепел": 1,
    "тыл": 1, "мел": 1, "зал": 1, "холл": 1, "подвал": 1, "вокзал": 1, "обвал": 1,
    "провал": 1, "сигнал": 1, "кинжал": 1, "финал": 1, "квартал": 1, "подол": 1,
    "отдел": 1, "предел": 1, "удел": 1, "козел": 1, "орел": 1, "щегол": 1,
    /* на «-ла»: иначе их примут за женскую форму глагола */
    "смола": 1, "пчела": 1, "метла": 1, "игла": 1, "зола": 1, "скала": 1,
    "школа": 1, "сила": 1, "пила": 1, "юла": 1, "хула": 1, "кабала": 1,
    "опала": 1, "дела": 1, "масла": 1, "сверла": 1, "русла": 1, "числа": 1
  };

  /* Слова-связки: по ним оборот про «ты» продолжается на следующее действие. */
  var FEM_CONN = { "и": 1, "а": 1, "но": 1, "да": 1, "потом": 1, "затем": 1, "что": 1 };

  /* Связка открывает новый глагол только если он идёт сразу за ней (для «что»
     строго сразу: «ты был, что видел» — но «не то, что рядом сидел старик»). */
  var FEM_CONN_PLAIN = { "и": 1, "а": 1, "но": 1, "да": 1, "потом": 1, "затем": 1 };

  var FEM_FILLER = {
    "не": 1, "уже": 1, "всё": 1, "ещё": 1, "опять": 1, "снова": 1, "почти": 1,
    "просто": 1, "наконец": 1, "сразу": 1, "долго": 1, "быстро": 1, "тихо": 1,
    "медленно": 1, "ровно": 1, "осторожно": 1, "спокойно": 1, "легко": 1,
    "тяжело": 1, "страшно": 1, "по-прежнему": 1, "дальше": 1, "потом": 1,
    "очень": 1, "совсем": 1, "сильно": 1, "слегка": 1, "немного": 1, "слишком": 1,
    "вовсе": 1, "вдруг": 1, "заранее": 1, "впервые": 1, "нарочно": 1,
    "только": 1, "что": 1, "ведь": 1, "же": 1, "ли": 1, "так": 1, "чуть": 1, "ни": 1,
    "тоже": 1, "раз": 1, "здесь": 1, "сюда": 1, "туда": 1, "там": 1, "сейчас": 1,
    "где": 1, "куда": 1, "откуда": 1, "зачем": 1, "почему": 1, "чего": 1,
    "чему": 1, "кем": 1, "ком": 1, "сколько": 1, "никому": 1, "никого": 1,
    "ничего": 1, "ничем": 1, "кому": 1, "кого": 1, "уже": 1,
    /* уже женские формы: оборот через них идёт дальше, род не меняется */
    "сама": 1, "одна": 1, "должна": 1, "готова": 1, "уверена": 1, "согласна": 1,
    "виновата": 1, "рада": 1, "жива": 1, "мертва": 1, "сыта": 1, "вынуждена": 1,
    "привыкла": 1, "могла": 1, "первая": 1, "последняя": 1, "цела": 1, "бела": 1,
    /* предлоги: между «ты» и глаголом стоят они, а не другой человек */
    "в": 1, "во": 1, "на": 1, "с": 1, "со": 1, "за": 1, "под": 1, "из": 1, "к": 1,
    "ко": 1, "по": 1, "у": 1, "от": 1, "до": 1, "при": 1, "над": 1, "об": 1,
    "о": 1, "для": 1, "через": 1, "между": 1, "перед": 1, "без": 1, "про": 1,
    /* местоимения в косвенных падежах: подлежащее от них не меняется */
    "его": 1, "её": 1, "ее": 1, "их": 1, "ему": 1, "ей": 1, "им": 1, "меня": 1,
    "тебя": 1, "нас": 1, "вас": 1, "мне": 1, "тебе": 1, "нам": 1, "вам": 1,
    "себя": 1, "себе": 1, "этом": 1, "этот": 1, "эта": 1, "эти": 1, "того": 1,
    "тому": 1, "тем": 1, "него": 1, "неё": 1, "ним": 1, "них": 1, "свой": 1,
    "своя": 1, "своё": 1, "свои": 1, "чем": 1, "когда": 1, "пока": 1, "если": 1,
    "чтобы": 1, "потому": 1, "тут": 1, "там": 1
  };

  var FEM_STOP = {
    "он": 1, "она": 1, "оно": 1, "они": 1, "я": 1, "мы": 1, "вы": 1, "ты": 1,
    "кто": 1, "кто-то": 1, "кто-нибудь": 1
  };

  /* «это был он», «это стало ясно»: подлежащее тут само «это», и оборот
     про «ты» на нём кончается. А вот «ты это заметил» — дополнение. */
  var FEM_COPULA = {
    "был": 1, "была": 1, "было": 1, "были": 1, "будет": 1, "будут": 1, "есть": 1,
    "стал": 1, "стала": 1, "стало": 1, "стали": 1, "оказался": 1, "оказалась": 1,
    "оказалось": 1, "оказались": 1, "значит": 1
  };

  /* Глагольная форма женского рода. Сперва словарь (в нём неправильные:
     шёл → шла, мог → могла), потом правило — почти все остальные глаголы
     прошедшего времени кончаются на «-л»/«-лся» и меняются механически. */
  function femVerb(w) {
    if (FEM_VERB[w] !== undefined) return FEM_VERB[w];
    if (FEM_NOUNS[w]) return null;
    if (w.length >= 4 && /лся$/.test(w)) return w.slice(0, -3) + "лась";
    if (w.length >= 3 && /л$/.test(w)) return w.slice(0, -1) + "ла";
    return null;
  }

  function femLower(w) { return String(w).toLowerCase(); }

  function femKeepCase(src, form) {
    var c = src.charAt(0);
    if (c === c.toUpperCase() && c !== c.toLowerCase()) {
      return form.charAt(0).toUpperCase() + form.slice(1);
    }
    return form;
  }

  /* Перевод на женский род. Идёт по словам: сперва ищет оборот с «ты»,
     потом цепочку «и + глагол» — и трогает только те слова, что стоят
     внутри этого оборота. */
  function feminize(text) {
    var src = String(text);
    var re = /[А-Яа-яЁё]+/g, words = [], seps = [], m, last = 0;
    while ((m = re.exec(src)) !== null) {
      seps.push(src.slice(last, m.index));
      words.push(m[0]);
      last = m.index + m[0].length;
    }
    if (!words.length) return src;
    seps.push(src.slice(last));

    function stop(i) { return /[.!?…:;\n]/.test(seps[i] || ""); }
    function filler(w) {
      if (FEM_FILLER[w] === 1) return true;
      /* связки: «ты и зачем пришёл», «ты, а потом остался» */
      if (FEM_CONN[w] === 1) return true;
      /* наречия: «осторожно», «медленно», «ровно» */
      if (w.length >= 5 && /(о|е|ски|цки)$/.test(w)) return true;
      /* прилагательные: «ты в прошлый раз считал», «ты первый раз пришёл».
         Подлежащее от них не меняется, а существительное-подлежащее
         всё равно встанет следом и оборвёт оборот. */
      if (w.length >= 4 && /(ый|ий|ой|ая|ое|ые|ого|ому|ым|ыми|ых|ую)$/.test(w)) return true;
      /* инфинитив: «ты перестаёшь понимать, чего хотел» */
      if (w.length >= 4 && /(ть|ться)$/.test(w)) return true;
      /* глагол уже в женском роде — оборот про «ты» продолжается */
      if (/(ла|лась)$/.test(w) && !FEM_NOUNS[w]) return true;
      return false;
    }

    var mark = {};
    /* слова вроде «сам», «один», «должен» стоят рядом с глаголом и тоже
       меняют род: смотрим два-три слова после него, но только пока не
       начался новый оборот */
    function markWordsAfter(from) {
      for (var t = from + 1; t <= from + 3 && t < words.length; t++) {
        if (stop(t)) break;
        var w2 = femLower(words[t]);
        if (FEM_STOP[w2] !== undefined) break;
        if (FEM_WORD[w2]) { mark[t] = 1; continue; }
        if (femVerb(w2)) break;
        if (!filler(w2)) break;
      }
    }
    var i = 0;
    while (i < words.length) {
      if (femLower(words[i]) !== "ты") { i++; continue; }
      var verb = -1, j, w, seen = false;
      for (j = i + 1; j < words.length && j <= i + 6; j++) {
        if (stop(j)) break;
        w = femLower(words[j]);
        if (FEM_STOP[w] !== undefined) break;
        if (FEM_WORD[w]) { mark[j] = 1; continue; }
        if (femVerb(w)) { verb = j; break; }
        /* «ты видишь, что …», «ты помнишь, как …»: за глаголом в настоящем
           времени подлежащее не меняется, и оборот идёт дальше */
        if (/(шь|шься)$/.test(w)) { seen = true; continue; }
        if (w === "что" && seen) continue;
        /* «ты это заметил», «ты это описал»: «это» — дополнение при «ты»,
           оборот идёт дальше. Но если за ним сразу глагол-связка, то
           подлежащее — само «это», и мы уходим. */
        if (w === "это") {
          var nxt = femLower(words[j + 1] || "");
          if (!FEM_COPULA[nxt] && !FEM_STOP[nxt]) {
            if (femVerb(nxt)) { verb = j + 1; break; }
            continue;
          }
          break;
        }
        if (!filler(w)) break;
      }
      if (verb < 0) { i++; continue; }
      mark[verb] = 1;
      markWordsAfter(verb);
      /* цепочка «и …, и …» — та же рука, тот же оборот. Между глаголом и
         связкой могут стоять любые слова: важно, что сразу за связкой идёт
         глагол, а не другое подлежащее. */
      var at = verb;
      for (var guard = 0; guard < 8; guard++) {
        var conn = -1, t, cw;
        for (t = at + 1; t <= at + 6 && t < words.length; t++) {
          if (stop(t)) break;
          cw = femLower(words[t]);
          if (FEM_STOP[cw] !== undefined) break;
          if (FEM_CONN[cw]) { conn = t; break; }
        }
        if (conn < 0) break;
        var nx = -1, nw;
        var far = FEM_CONN_PLAIN[cw] ? 2 : 1;
        for (t = conn + 1; t <= conn + far && t < words.length; t++) {
          if (stop(t)) break;
          nw = femLower(words[t]);
          if (FEM_STOP[nw] !== undefined) break;
          if (femVerb(nw)) { nx = t; break; }
          if (FEM_WORD[nw]) { mark[t] = 1; continue; }
          if (!filler(nw)) break;
        }
        if (nx < 0) break;
        mark[nx] = 1;
        markWordsAfter(nx);
        at = nx;
      }
      i = at + 1;
    }

    var out = seps[0];
    for (var k = 0; k < words.length; k++) {
      var low = femLower(words[k]);
      var form = mark[k] ? (femVerb(low) || FEM_WORD[low]) : null;
      out += (form ? femKeepCase(words[k], form) : words[k]) + (seps[k + 1] || "");
    }
    return out;
  }

  function fem() { return !!(S && S.hero && S.hero.sex === "f"); }

  /* Текст из контента: escape + при героине перевод на женский род. */
  function txt(s) {
    var t = String(s == null ? "" : s);
    return esc(fem() ? feminize(t) : t);
  }

  /* Слово по роду: g("встал", "встала"). Для строк, которые движок пишет сам. */
  function g(m, f) { return fem() ? f : m; }

  /* Название входа в город: у него нет «ты» рядом, поэтому перевод рода
     берётся не из feminize, а из пары label/fem в самом ORIGINS. */
  function originLabel(o) { return (fem() && o.fem) ? o.fem : o.label; }

  /* Тот же перевод наружу: им пользуется tools/gender.js, чтобы проверять
     род на всём тексте игры сразу, а не по одной сцене. */
  window.feminize = feminize;

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
      phase: "day",              /* day | night | polnoch */
      node: city().start,
      kaidan: null,
      scene: null,
      prevScene: null,
      storyLight: "",            /* днём или ночью идёт сама история */
      cleared: {},
      andon: TOTAL_ANDON,
      roster: [],
      deck: [],
      gone: [],
      searched: {},
      news: "",
      day: 1,
      lastClearDay: 1,
      entered: false,            /* герой уже вошёл в город: снаряжение выдано */
      /* страх и то, что он приносит */
      fearPts: 0,
      fearStep: 1,
      breath: 0,
      breathNote: "",
      with: [],                  /* кто пошёл за тобой в дом */
      kills: 0,
      killName: "",
      killText: ""
    };
  }

  /* Срок: три дня на историю. */
  function deadlineDay() { return (S.lastClearDay || 1) + DAYS_PER_KAIDAN; }
  function daysLeft() { return Math.max(0, deadlineDay() - S.day); }

  /* Ёкаи приходят, когда срок вышел: омомори к этому времени иссякли. */
  function yokaiCome() {
    S.omomori = [];
    S.kaidan = null;
    S.scene = null;
    S.with = [];
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
      'Тебя убивают не в кайдане. Просто на улице, между двумя домами, — так забирают ' +
      'тех, кто перестал слушать.</div>' +
      '<div class="text">' + esc(heroName()) + ' больше нет. На ' + g("его", "её") + ' место ' +
      g("встал", "встала") + ' ' + g("другой", "другая") + ' — в городе снова сто. ' +
      'Омомори у нового героя свои, и счёт дней начинается заново.</div>' +
      '<button class="restart" onclick="comeAgain()">Прийти снова другим</button>' +
      '<button class="wait" onclick="newRun()">Начать всё сначала</button>';
    window.scrollTo(0, 0);
  }

  function blankHero() {
    return {
      hero: { name: "", origin: "", sex: "m", age: "zrelyy" },
      food: 0, water: 0, meds: 0,
      wounds: 0,
      maxWounds: 3,
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

  /* Сохранение из прежней сборки: дописываем то, чего в нём нет. */
  function migrate(s) {
    if (!s.hero) s.hero = { name: "", origin: "", sex: "m", age: "zrelyy" };
    if (!s.hero.sex) s.hero.sex = "m";
    if (!s.hero.age) s.hero.age = "zrelyy";
    if (!s.maxWounds) s.maxWounds = 3;
    if (typeof s.fearPts !== "number") s.fearPts = 0;
    if (typeof s.fearStep !== "number") s.fearStep = 1;
    if (typeof s.breath !== "number") s.breath = 0;
    if (!s.breathNote) s.breathNote = "";
    if (!s.with) s.with = [];
    if (typeof s.kills !== "number") s.kills = 0;
    if (!s.killName) s.killName = "";
    if (!s.killText) s.killText = "";
    if (!s.hero.name) s.hero.name = "Безымянный";
    if (s.entered === undefined) s.entered = !!(s.roster && s.roster.length);
    if (s.phase !== "day" && s.phase !== "night" && s.phase !== "polnoch") s.phase = "day";
    /* сохранение сделано посреди кайдана: он всегда идёт ночью у голоса */
    if (s.kaidan) {
      var k = K(s.kaidan);
      if (!k || !k.scenes || !k.scenes[s.scene]) {
        s.kaidan = null; s.scene = null; s.screen = "city";
      } else {
        if (s.phase !== "polnoch") s.phase = "polnoch";
        s.storyLight = k.when === "night" ? "night" : "day";
      }
    }
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!(s && s.screen && s.hero && city().nodes[s.node] && s.cleared)) return null;
      return migrate(s);
    } catch (e) { return null; }
  }

  /* ---------- общие куски ---------- */

  function phaseLabel() {
    if (S.phase === "polnoch") return "полночь";
    if (S.phase === "night") return "ночь";
    return "день";
  }

  function fearLevel() {
    var n = Math.floor(S.fearPts || 0);
    if (n < 0) n = 0;
    return n > fearMax() ? fearMax() : n;
  }

  function bar() {
    var cls = S.andon <= 10 ? "candles low" : "candles";
    var ph = S.phase === "day"
      ? '<span class="phase">день</span>'
      : '<span class="phase n">' + phaseLabel() + '</span>';
    var dl = daysLeft() <= 1
      ? '<span class="phase n">срок · ' + daysLeft() + ' дн.</span>'
      : '<span class="phase">срок · ' + daysLeft() + ' дн.</span>';
    var fear = "";
    if (S.kaidan) {
      var lvl = fearLevel();
      fear = '<span class="fear' + (lvl >= fearMax() - 1 ? " high" : "") + '">страх · ' +
        lvl + ' из ' + fearMax() + '</span>';
    }
    return '<div class="bar"><span class="' + cls + '">андоны · ' + S.andon + '</span>' +
      '<span class="phase">день ' + S.day + '</span>' + ph + dl + fear + '</div>';
  }

  function heroLine() {
    var sx = window.sexById(S.hero.sex || "m");
    var ag = window.ageById(S.hero.age || "zrelyy");
    return g("мужчина", "женщина") + ", " + esc(ag.label.toLowerCase());
  }

  function status() {
    var parts = ["еда " + S.food, "вода " + S.water, "лекарства " + S.meds];
    var w = S.wounds > 0 ? "раны " + S.wounds + " из " + maxWounds() : "без ран";
    var om = S.omomori.length ? "омомори " + S.omomori.length : "омомори нет";
    return '<div class="status">' + esc(heroName()) + " · " + heroLine() + " · " + parts.join(" · ") +
      " · " + w + " · " + om + '</div>';
  }

  function setNight(on) {
    if (on) document.body.classList.add("night");
    else document.body.classList.remove("night");
  }

  function setTense(on) {
    if (on) document.body.classList.add("tense");
    else document.body.classList.remove("tense");
  }

  function news() {
    return S.news ? '<div class="news fade">' + S.news + '</div>' : "";
  }

  /* Кто сейчас в этом месте. Люди в городе не числятся — они стоят и ходят. */
  function presence() {
    var list = window.presentAt(S, S.node, S.phase);
    if (!list || !list.length) return "";
    return '<div class="here"><div class="loc-sub">здесь ещё</div>' +
      list.map(function (p) {
        return '<div class="who"><b>' + esc(p.name) + '</b> — ' + esc(p.line) + '</div>';
      }).join("") + '</div>';
  }

  /* Кто-то уходит, кто-то приходит — счёт остаётся сотней.
     Если рядом стоял человек из этого места, уходит именно он. */
  function someoneDies() {
    var list = window.presentAt(S, S.node, S.phase);
    var pick = list && list.length ? list[S.gone.length % list.length].name : null;
    var r = pick ? window.removeFromRoster(S, pick) : null;
    if (!r) r = window.replaceOne(S);
    if (!r) return "";
    S.gone.push(r.gone);
    var how = (window.streetDeath || ["ушёл и не вернулся"])[S.gone.length % (window.streetDeath || [1]).length];
    S.news = "Город стал меньше на одного: " + esc(r.gone) + " " + how + ". " +
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
    setTense(false);
    app.innerHTML =
      '<h1>Кайданкай</h1>' +
      '<div class="sub">сто андо́нов · город Кураяма · ' + BUILD + '</div>' +
      '<div class="text fade">' + txt(window.PROLOGUE.intro) + '</div>' +
      '<div class="text fade">' + txt(window.PROLOGUE.arrivalCommon) + '</div>' +
      '<div class="text fade">' + txt(window.PROLOGUE.toast) + '</div>' +
      '<button onclick="toCreate()">Дальше</button>' +
      '<label class="file">Загрузить сохранение<input type="file" accept=".json,application/json"' +
      ' onchange="loadFile(this)"></label>' +
      '<button class="wait" onclick="hardReload()">Обновить игру</button>';
    window.scrollTo(0, 0);
  }

  function screenCreate() {
    setNight(false);
    setTense(false);
    var sex = S.hero.sex || "m";
    var age = S.hero.age || "zrelyy";
    var sexes = window.SEXES.map(function (x) {
      return '<button class="pick' + (x.id === sex ? " on" : "") + '" onclick="setSex(\'' + x.id + '\')">' +
        esc(x.label) + '<small>' + esc(x.short) + '</small></button>';
    }).join("");
    var ages = window.AGES.map(function (x) {
      return '<button class="pick' + (x.id === age ? " on" : "") + '" onclick="setAge(\'' + x.id + '\')">' +
        esc(x.label) + '<small>' + esc(x.short) + '</small></button>';
    }).join("");
    var origins = window.ORIGINS.map(function (o) {
      return '<button class="origin" onclick="setOrigin(\'' + o.id + '\')">' + esc(originLabel(o)) +
        '<small>' + esc(o.short) + '</small></button>';
    }).join("");
    app.innerHTML =
      '<div class="title">Кто ты</div>' +
      '<div class="text">Назови себя. Настоящее имя или выдуманное — здесь это не проверить.\n\n' +
      'Вспомни, кто ты: от этого зависит, как о тебе говорят и сколько ты выдержишь. ' +
      'И вспомни, как ты сюда попал — от этого зависит, что у тебя в карманах.</div>' +
      '<label class="field">имя<input id="heroName" maxlength="16" placeholder="как тебя звать" value="' +
      esc(S.hero.name || "") + '"></label>' +
      '<div class="loc-sub">пол</div>' + sexes +
      '<div class="loc-sub">возраст</div>' + ages +
      '<div class="loc-sub">как ты оказался в Кураяме</div>' + origins;
    window.scrollTo(0, 0);
  }

  function screenArrival(o) {
    setNight(false);
    setTense(false);
    var ag = window.ageById(S.hero.age);
    var sx = window.sexById(S.hero.sex);
    app.innerHTML =
      '<div class="title">' + esc(originLabel(o)) + '</div>' +
      '<div class="loc-sub">' + esc(sx.label) + ' · ' + esc(ag.label.toLowerCase()) + '</div>' +
      '<div class="text fade">' + txt(ag.line) + '</div>' +
      '<div class="text fade">' + txt(o.arrival) + '</div>' +
      '<div class="text fade">' + txt(window.PROLOGUE.toast) + '</div>' +
      '<button onclick="enterCity()">Открыть глаза</button>';
    window.scrollTo(0, 0);
  }

  /* Описание места: в полночь своё, если его нет — ночное. */
  function nodeDesc(node) {
    if (S.phase === "polnoch") return node.polnoch || node.night;
    if (S.phase === "night") return node.night;
    return node.day;
  }

  function screenCity() {
    /* рассказывать больше нечего — значит, город закрыт */
    if (remaining() === 0) { S.screen = "end"; save(); return screenEnd(); }
    var node = city().nodes[S.node];
    setNight(S.phase !== "day");
    setTense(false);

    var desc = nodeDesc(node);
    var exits = (S.phase === "day" ? node.links : node.nightLinks) || [];
    var other = (S.phase === "day" ? node.nightLinks : node.links) || [];

    /* Голос начинает говорить в полночь. До полуночи дом не показывают:
       видно только, сколько историй ещё не рассказано. */
    var midnight = S.phase === "polnoch";
    var here = midnight ? kaidans().filter(function (k) {
      return k.where === S.node && !S.cleared[k.id] && (!k.cond || k.cond(S));
    }) : [];

    var kbtns = here.map(function (k) {
      return '<button class="kaidan" onclick="startKaidan(\'' + k.id + '\')">' + txt(k.title) +
        '<small>' + esc(houseShort(k)) + ' · провал — смерть</small></button>';
    }).join("");
    if (midnight && !here.length) {
      kbtns = '<div class="hint">Здесь этой ночью голос молчит.</div>';
    }

    var ebtns = exits.map(function (id) {
      return '<button class="go" onclick="walkTo(\'' + id + '\')">' + esc(city().nodes[id].name) + '</button>';
    }).join("");

    var closed = other.filter(function (id) { return exits.indexOf(id) < 0; })
      .map(function (id) { return city().nodes[id].name; });
    var closedLine = closed.length
      ? '<div class="hint">Сейчас не открывается: ' + closed.join(", ") + '</div>'
      : "";

    var wait = S.phase === "day"
      ? '<button class="wait" onclick="waitPhase()">Дождаться ночи</button>'
      : (S.phase === "night"
        ? '<button class="wait" onclick="waitPhase()">Дождаться полуночи</button>'
        : '<button class="wait" onclick="waitPhase()">Дождаться утра</button>');

    var key = S.node + "|" + S.phase;
    var search = S.searched[key]
      ? '<div class="hint">Здесь уже обыскано.</div>'
      : '<button class="wait" onclick="searchStreet()">Обыскать улицу</button>';

    var left = remaining();

    var phaseHint = S.phase === "day"
      ? 'Кайданы начинаются в полночь: до неё улицы дневные, а голос молчит. Какой дом откроется ' +
        'этой ночью, до полуночи не знает никто в городе.'
      : (S.phase === "night"
        ? 'Стемнело. Голос начинает говорить в полночь, и до неё остался один шаг.'
        : 'Полночь. Двери открыты — там, где этой ночью ждёт история. Расскажешь — погаснет один ' +
          'андо́н на поле; не расскажешь до утра — день уйдёт из срока.');

    app.innerHTML = bar() + status() +
      '<div class="loc">' + esc(node.name) + '</div>' +
      '<div class="loc-sub">' + left + ' кайданов ещё не рассказано · в городе сто</div>' +
      '<div class="text fade">' + txt(desc) + '</div>' +
      news() +
      kbtns +
      presence() +
      ebtns +
      '<div class="hint">' + phaseHint + '</div>' +
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
    setNight(S.phase !== "day" && !S.kaidan);
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
      'Омомори сгорает один раз и уводит от верной смерти. Раны копятся: ' + maxWounds() +
      ' — и никакой амулет не поможет.</div>' +
      '<div class="loc-sub">оружие</div><ul class="plain">' + w + '</ul>' +
      '<div class="loc-sub">омомори</div><ul class="plain">' + o + '</ul>' +
      b +
      '<button class="wait" onclick="toCreate()">Изменить героя: имя, пол, возраст</button>' +
      '<button onclick="backFromScreen()">Назад</button>';
    window.scrollTo(0, 0);
  }

  function screenRoster() {
    setNight(S.phase !== "day" && !S.kaidan);
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
    setNight(S.storyLight === "night");
    setTense(false);
    var who = S.with.length
      ? '<div class="loc-sub">за тобой пошли: ' + S.with.map(esc).join(", ") +
        ' — они не знают, куда</div>'
      : '<div class="loc-sub">за тобой никто не пошёл</div>';
    app.innerHTML = bar() + status() +
      '<div class="loc">' + txt(k.title) + '</div>' +
      (k.house ? '<div class="loc-sub">дом: ' + txt(k.house) + '</div>' : "") +
      '<div class="title voice">Голос</div>' +
      '<div class="hint">Полночь. История эта — ' + (S.storyLight === "night" ? "ночная" : "дневная") +
      ': она случилась при ' + (S.storyLight === "night" ? "свете фонаря" : "дневном свете") +
      ', и голос ведёт её так же.</div>' +
      '<div class="text fade">' + txt(window.voiceFor(k)) + '</div>' +
      who +
      '<button onclick="listenOn()">Слушать дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenScene() {
    var k = K(S.kaidan);
    var sc = k.scenes[S.scene];
    setNight(S.storyLight === "night");
    var lvl = fearLevel();
    setTense(lvl >= fearMax() - 1);
    var choices = sc.c.map(function (c, i) {
      if (c.need && S.weapons.indexOf(c.need) < 0) {
        var w = findIn(weaponsList(), c.need);
        return '<button class="locked" disabled>' + txt(c.t) +
          '<small>нужно: ' + esc(w ? w.name : "оружие") + '</small></button>';
      }
      return '<button onclick="pick(' + i + ')">' + txt(c.t) + '</button>';
    }).join("");
    var tension = lvl > 0
      ? '<div class="text tension">' + esc(window.tensionLine(lvl, S.kaidan + S.scene)) + '</div>'
      : "";
    var breath = S.breath < 1
      ? '<button class="wait" onclick="breathe()">Перевести дух</button>'
      : "";
    app.innerHTML = bar() + status() +
      '<div class="title fade">' + txt(k.title) + '</div>' +
      (S.breathNote ? '<div class="text calm">' + esc(S.breathNote) + '</div>' : "") +
      '<div class="text fade">' + txt(sc.t) + '</div>' +
      tension +
      choices +
      breath;
    window.scrollTo(0, 0);
  }

  /* Ёкай забрал человека. Описан весь процесс — от первого движения
     до того, что осталось на полу. */
  function screenKill() {
    setNight(true);
    setTense(true);
    app.innerHTML = bar() + status() +
      '<div class="title">Ёкай взял своё</div>' +
      '<div class="text">Голос не сбивается ни на слово. Он говорит дальше — ровно так же, ' +
      'как говорил, и от этого хуже всего.</div>' +
      '<div class="text death fade">' + esc(S.killText) + '</div>' +
      '<div class="text">' + esc(S.killName) + ' больше нет. ' +
      'На ' + g("его", "её") + ' место уже ' + g("встал", "встала") + ' ' + g("другой", "другая") +
      ' — в городе снова сто, и ты в этом городе один из них.\n\n' +
      'Ёкай пришёл не за тобой: пока история не кончена, тебя не трогают. ' +
      'Но страх никуда не делся, и он вернётся.</div>' +
      '<button onclick="afterKill()">Слушать дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenDeath(text, final) {
    setNight(true);
    setTense(false);
    var who = esc(heroName());
    app.innerHTML = bar() +
      '<div class="title">' + (final ? "Всё" : "Провал") + '</div>' +
      '<div class="text death fade">' + txt(text) + '</div>' +
      '<div class="text">' + who + ' больше нет. На ' + g("его", "её") + ' место ' +
      g("встал", "встала") + ' ' + g("другой", "другая") + ' — в городе снова сто, ' +
      'и на поле у края города горят те же сто огней.\n\n' +
      (final
        ? 'Раны сложились в предел, и это оказалось больше, чем можно вынести.'
        : 'Кайданы, которые ты прошёл, остаются пройденными: город помнит, кто гасил его огни.') + '</div>' +
      '<button class="restart" onclick="comeAgain()">Прийти снова другим</button>' +
      '<button class="wait" onclick="newRun()">Начать всё сначала</button>';
    window.scrollTo(0, 0);
  }

  function screenClear(text) {
    setNight(S.storyLight === "night");
    setTense(false);
    app.innerHTML = bar() + status() +
      '<div class="title">Кайдан пройден</div>' +
      '<div class="text fade">' + txt(text) + '</div>' +
      news() +
      '<button onclick="backToCity()">Идти дальше</button>';
    window.scrollTo(0, 0);
  }

  function screenBurned(text) {
    setNight(S.storyLight === "night");
    var last = S.burned[S.burned.length - 1];
    var o = findIn(omomoriList(), last);
    app.innerHTML = bar() + status() +
      '<div class="title">Омомори сгорел</div>' +
      '<div class="text death fade">' + txt(text) + '</div>' +
      '<div class="text">Амулет в твоём кармане стал тёплым, потом горячим, потом его не стало. ' +
      'Осталась горсть пепла и одна рана — но ты стоишь там же, где стоял до выбора.\n\n' +
      'Сгорело: ' + esc(o ? o.name : "омомори") + '. Раны: ' + S.wounds + ' из ' + maxWounds() + '.' +
      (S.wounds >= maxWounds() - 1 ? '\n\nСледующая смерть будет последней — это не отговорить.' : '') + '</div>' +
      '<button onclick="backFromBurn()">Вернуться</button>';
    window.scrollTo(0, 0);
  }

  function screenEnd() {
    setNight(true);
    setTense(false);
    var left = kaidans().length;
    app.innerHTML = bar() + status() +
      '<div class="title">Пока всё</div>' +
      '<div class="text fade">Ты прошёл все кайданы, которые есть в этой сборке, — ' + left + ' из ста. ' +
      'На поле андо́нов погасло ' + (TOTAL_ANDON - S.andon) + ' огней.\n\n' +
      'В Кураяме стало на ' + left + ' огней темнее, и это ты погасил их, хотя не зажигал. ' +
      'Поле на краю города — сто гнёзд, выложенных чёрным камнем, — стоит теперь наполовину тёмным. ' +
      'Когда погаснет последний, придёт тот, кто ждёт этого дольше всех.</div>' +
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

  window.setSex = function (id) {
    S.hero.sex = window.sexById(id).id;
    save();
    screenCreate();
  };

  window.setAge = function (id) {
    var a = window.ageById(id);
    S.hero.age = a.id;
    S.fearStep = a.fear;
    S.maxWounds = a.wounds;
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
    if (!S.roster.length) {
      var made = window.makeRoster(S.hero.name);
      S.roster = made.roster;
      S.deck = made.deck;
    }
    /* Снаряжение выдаётся один раз: если герой вернулся сюда поменять имя,
       еда и оружие не начисляются заново. */
    if (!S.entered) {
      var o = window.originById(S._pendingOrigin || S.hero.origin);
      var a = window.ageById(S.hero.age || "zrelyy");
      S.food += o.food + (a.food || 0);
      S.water += o.water + (a.water || 0);
      S.meds += o.meds + (a.meds || 0);
      (o.weapons || []).forEach(function (w) { if (S.weapons.indexOf(w) < 0) S.weapons.push(w); });
      for (var i = 0; i < (o.omomori || 0) + (a.omomori || 0); i++) {
        var free = omomoriList().filter(function (m) { return S.omomori.indexOf(m.id) < 0; });
        if (free.length) S.omomori.push(free[Math.floor(Math.random() * free.length)].id);
      }
      S.fearStep = a.fear;
      S.maxWounds = a.wounds;
      S.entered = true;
      S.news = "Тебя посчитали. Ты — " + esc(S.hero.name) + ", " + heroLine() +
        ", и в городе снова ровно сто.";
    } else {
      S.news = "Ты остаёшься собой: " + esc(S.hero.name) + ", " + heroLine() + ".";
    }
    S.screen = "city";
    save();
    screenCity();
  };

  window.comeAgain = function () {
    var world = {
      cleared: S.cleared, andon: S.andon, roster: S.roster, deck: S.deck,
      gone: S.gone, searched: S.searched, phase: S.phase, node: S.node, day: S.day,
      kills: S.kills
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
     улицы и закрывает другие, и это не только текст. Полночь ходит
     по ночным улицам. */
  function phasePlaces(phase) {
    var night = phase !== "day";
    var seen = {}, q = [city().start], i;
    seen[city().start] = true;
    while (q.length) {
      var n = city().nodes[q.shift()];
      if (!n) continue;
      var links = (night ? n.nightLinks : n.links) || [];
      for (i = 0; i < links.length; i++) {
        if (city().nodes[links[i]] && !seen[links[i]]) { seen[links[i]] = true; q.push(links[i]); }
      }
    }
    return seen;
  }

  /* Смена времени застаёт тебя там, где ты стоял, но не всякая улица есть в
     обеих фазах: переулка-щели днём нет, лестницы вниз днём нет. Город
     выставляет тебя туда, откуда это место открывается. */
  function relocate(phase) {
    var exists = phasePlaces(phase);
    if (exists[S.node]) return "";
    var here = city().nodes[S.node] || {};
    var exits = (phase === "day" ? here.links : here.nightLinks) || [];
    var fit = exits.filter(function (id) { return city().nodes[id] && exists[id]; });
    var was = S.node;
    S.node = fit.length ? fit[Math.floor(Math.random() * fit.length)] : city().start;
    S.storyLight = "";
    return "«" + esc((city().nodes[was] || {}).name || "улица") + "» кончилась вместе с " +
      (phase === "day" ? "ночью" : "полночью") + ". Ты выходишь на «" +
      esc(city().nodes[S.node].name) + "».";
  }

  window.waitPhase = function () {
    var warn = "", note = "";
    var was = S.phase;
    if (was === "day") S.phase = "night";
    else if (was === "night") S.phase = "polnoch";
    else {
      S.phase = "day";
      S.day++;
      if (daysLeft() === 0) return yokaiCome();
      if (daysLeft() === 1) {
        warn = "Омомори в кармане стали тёплыми. До срока — один день: " +
          "если к утру ни одна история не будет рассказана, они догорят.";
      }
    }
    note = relocate(S.phase);
    if (S.phase === "polnoch") {
      note = (note ? note + " " : "") + "Полночь. В городе открылись двери, которых до этой минуты " +
        "не было видно: голос начинает говорить там, где этой ночью ждёт история.";
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
    if (loot.kind === "food") { S.food += loot.amount; line = "Ты " + g("нашёл", "нашла") + " " + loot.text + "."; }
    else if (loot.kind === "water") { S.water += loot.amount; line = "Ты " + g("нашёл", "нашла") + " " + loot.text + "."; }
    else if (loot.kind === "meds") { S.meds += loot.amount; line = "Ты " + g("нашёл", "нашла") + " " + loot.text + "."; }
    else if (loot.kind === "weapon") {
      var owned = weaponsList().filter(function (w) { return S.weapons.indexOf(w.id) < 0; });
      if (owned.length) {
        var w = owned[Math.floor(Math.random() * owned.length)];
        S.weapons.push(w.id);
        line = "Ты " + g("нашёл", "нашла") + " " + loot.text + ". Это " + w.name + ".";
      } else {
        S.food += 1;
        line = "Оружия больше не нашлось. Зато нашлась еда.";
      }
    } else if (loot.kind === "omomori") {
      var free = omomoriList().filter(function (m) { return S.omomori.indexOf(m.id) < 0; });
      if (free.length) {
        var m = free[Math.floor(Math.random() * free.length)];
        S.omomori.push(m.id);
        line = "Ты " + g("нашёл", "нашла") + " " + loot.text + ". Это " + m.name + ".";
      } else {
        S.meds += 1;
        line = "Омомори больше не попадаются. Под подкладкой нашлись таблетки.";
      }
    } else {
      line = "Ты " + g("обыскал", "обыскала") + " всё, что можно было обыскать. " +
        loot.text.charAt(0).toUpperCase() + loot.text.slice(1) + ".";
    }
    S.news = line;
    save();
    screenCity();
  };

  /* Пройти вдоль огней на поле: здесь видно, сколько историй рассказано,
     сколько нет и что стоит за краем города. */
  window.walkLights = function () {
    var out = TOTAL_ANDON - S.andon;
    var line = "Ты " + g("прошёл", "прошла") + " вдоль рядов. Горят " + S.andon + " из ста. ";
    if (out === 0) line += "Ни один ещё не погас, и все гнёзда полны.";
    else line += "Погасли " + out + " — те, что ты " + g("рассказал", "рассказала") + " сам" + g("", "а") + ".";
    line += " В дальнем конце поля, за последним рядом, стоит одно пустое гнездо: " +
      "дерево выстругано, бумага вставлена, огня нет. Его не зажигали никогда.";
    S.news = line;
    save();
    screenCity();
  };

  window.startKaidan = function (id) {
    var k = K(id);
    if (!k || S.phase !== "polnoch") return;   /* голос начинает только в полночь */
    S.kaidan = id;
    S.scene = k.start;
    S.prevScene = k.start;
    S.storyLight = k.when === "night" ? "night" : "day";
    S.fearPts = 0;
    S.breath = 0;
    S.breathNote = "";
    S.kills = 0;
    S.killName = "";
    S.killText = "";
    var list = window.presentAt(S, S.node, S.phase);
    S.with = list.slice(0, 2).map(function (p) { return p.name; });
    S.screen = "voice";
    save();
    screenVoice();
  };

  window.listenOn = function () {
    var k = K(S.kaidan);
    if (!k || !k.scenes[S.scene]) { S.screen = "city"; save(); return screenCity(); }
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
          S = migrate(s);
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

  /* Перевести дух: страх спадает, но только один раз за историю —
     голос ждёт и второго вдоха не даёт. */
  window.breathe = function () {
    S.breath = 1;
    S.fearPts = Math.max(0, (S.fearPts || 0) - 2);
    S.breathNote = "Ты " + g("остановился", "остановилась") + " и " + g("дышал", "дышала") +
      " ровно, считая до пяти. Голос ждёт — он никуда не спешит и не сбивается. " +
      "Страх отпускает на шаг, и слышно становится тише. Второй раз он не отпустит.";
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

  /* Страх растёт с каждым шагом внутрь истории: у молодого быстрее,
     у пожилого медленнее. */
  function bumpFear() {
    S.fearPts = (S.fearPts || 0) + (S.fearStep || 1);
  }

  /* Страх дошёл до предела — в дом входит ёкай. Забирает он не слушателя,
     а того, кто пошёл за ним: гибнет человек из Кураямы, и это описано
     целиком. Если рядом никого не было, он берёт одного из тех, кто
     остался снаружи: без этого история не кончится. */
  function startKill() {
    var name = S.with.length ? S.with.shift() : null;
    if (!name) {
      var alive = window.aliveNames(S);
      if (alive.length) name = alive[Math.floor(Math.random() * alive.length)];
    }
    if (!name) {                      /* забирать некого — страх держится у предела */
      S.fearPts = fearMax() - 1;
      S.screen = "scene";
      save();
      return screenScene();
    }
    S.killName = name;
    S.killText = window.yokaiKill(name, S.kills);
    S.kills++;
    var rep = window.removeFromRoster(S, name);
    S.gone.push(name);
    if (rep) {
      S.news = "Пока ты " + g("слушал", "слушала") + " историю, " + esc(name) +
        " перестал быть. Это было слышно и внутри кайдана. На его место уже встал " +
        esc(rep.came) + " — в городе снова сто.";
    } else {
      S.news = "Пока ты " + g("слушал", "слушала") + " историю, " + esc(name) + " перестал быть.";
    }
    S.fearPts = Math.max(0, fearMax() - 3);
    S.screen = "kill";
    save();
    screenKill();
  }

  window.afterKill = function () {
    S.killName = "";
    S.killText = "";
    if (S.kaidan && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) {
      S.screen = "scene";
      save();
      return screenScene();
    }
    S.screen = "city";
    save();
    screenCity();
  };

  function enter(id) {
    var k = K(S.kaidan);
    var sc = k.scenes[id];
    S.scene = id;
    S.breathNote = "";

    if (sc.end === "death") return die(sc.t);
    if (sc.end === "clear") {
      S.screen = "clear"; save(); return screenClear(sc.t);
    }
    bumpFear();
    if (fearLevel() >= fearMax()) return startKill();
    S.screen = "scene"; save(); screenScene();
  }

  function die(text) {
    if (S.omomori.length && S.wounds < maxWounds() - 1) {
      S.burned.push(S.omomori.pop());
      S.wounds++;
      S.screen = "burned";
      save();
      return screenBurned(text);
    }
    S.screen = "death";
    save();
    screenDeath(text, S.wounds >= maxWounds() - 1);
  }

  /* Истощение: после каждого пройденного кайдана нужна еда и вода. */
  function consume() {
    S.food -= 1;
    S.water -= 1;
    var lines = [];
    if (S.food < 0) { S.food = 0; S.wounds++; lines.push("Еды не осталось — ты идёшь на голоде, и это рана."); }
    if (S.water < 0) { S.water = 0; S.wounds++; lines.push("Воды не осталось — во рту сухо, и это вторая рана."); }
    if (lines.length) {
      S.news = lines.join(" ") + " Ран у тебя " + S.wounds + " из " + maxWounds() + ". " +
        (S.wounds >= maxWounds() ? "Больше не выдержать." : "Обыщи улицу, пока не стало поздно.");
    }
    return S.wounds >= maxWounds();
  }

  /* Кайдан кончился утром: время суток меняется всегда — это и есть плата
     за рассказанную историю. */
  window.backToCity = function () {
    var id = S.kaidan;
    S.kaidan = null;
    S.scene = null;
    S.storyLight = "";
    S.with = [];
    S.fearPts = 0;
    S.breath = 0;
    S.breathNote = "";
    S.kills = 0;
    S.killName = "";
    S.killText = "";
    setTense(false);

    if (id && !S.cleared[id]) {
      S.cleared[id] = true;
      S.andon = Math.max(0, S.andon - 1);
      S.news = "На поле андо́нов погас один фонарь: горят " + S.andon + " из ста." +
        (S.news ? " " + S.news : "");
      S.phase = "day";
      S.day++;
      S.lastClearDay = S.day;              /* история рассказана — срок пошёл заново */
      var moved = relocate("day");         /* дом мог стоять там, где днём нет улицы */
      S.news = "Ты " + g("вышел", "вышла") + " из дома, когда уже рассвело: это утро следующего дня. " +
        (moved ? moved + " " : "") + S.news;
      if (consume()) {
        S.screen = "death";
        save();
        return screenDeath("Ты " + g("гасил", "гасила") + " огни, пока хватало сил. " +
          "Силы кончились раньше.", true);
      }
    }
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
    if (S.screen === "kill") return screenKill();
    if (S.screen === "burned") return screenBurned("Омомори сгорел между тобой и тем, что шло за тобой.");
    if (S.screen === "clear" && K(S.kaidan) && K(S.kaidan).scenes[S.scene]) {
      return screenClear(K(S.kaidan).scenes[S.scene].t);
    }
    if (S.screen === "yokai") return screenYokai();
    if (S.screen === "death") return screenDeath("Кайдан остался непройденным.", S.wounds >= maxWounds() - 1);
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
