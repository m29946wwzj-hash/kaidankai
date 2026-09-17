/* Ресурсы, омомори, оружие и то, что можно найти на улице. */

window.RES_NAMES = {
  food: "еда",
  water: "вода",
  meds: "лекарства"
};

/* Омомори — амулеты. Каждый сгорает один раз и уводит от смерти:
   игрок возвращается на шаг назад, а погубивший его выбор исчезает. */

window.OMOMORI = [
  { id: "yakuyoke", name: "Омомори от бед", note: "выцветший шёлк, стежки разошлись по краю" },
  { id: "kenko", name: "Омомори здоровья", note: "тяжёлый, будто внутри не бумага, а камень" },
  { id: "michiyuki", name: "Омомори дороги", note: "пахнет пылью и почему-то домом" },
  { id: "kachi", name: "Омомори победы", note: "на обороте чьим-то ногтем процарапано «живи»" },
  { id: "enmusubi", name: "Омомори связи", note: "две нитки, завязанные на чужую память" },
  { id: "kamado", name: "Омомори очага", note: "тёплый, хотя вокруг холодно" },
  { id: "mizu", name: "Омомори от воды", note: "вода с него скатывается, не оставляя следа" },
  { id: "yami", name: "Омомори от тьмы", note: "чёрный, без единой буквы — такие не продают" }
];

/* Оружие. Открывает в кайданах варианты, до которых без него не дотянуться. */

window.WEAPONS = [
  { id: "knife", name: "нож с обломанным концом" },
  { id: "pipe", name: "обрезок трубы" },
  { id: "axe", name: "топорик для щепы" },
  { id: "screwdriver", name: "длинная отвёртка" },
  { id: "chain", name: "цепь в тряпке" },
  { id: "knuckles", name: "кастет из гайки" }
];

/* Что попадается при обыске улицы. weight — относительная частота. */

window.LOOT = [
  { kind: "food", amount: 1, weight: 22, text: "половина сухаря в чужом кармане" },
  { kind: "food", amount: 2, weight: 8, text: "жестянка с чем-то съедобным, срок стёрт" },
  { kind: "water", amount: 1, weight: 22, text: "бутыль, на треть полная" },
  { kind: "water", amount: 2, weight: 8, text: "две бутыли в брошенной сумке" },
  { kind: "meds", amount: 1, weight: 14, text: "блистер таблеток, половина выдавлена" },
  { kind: "weapon", amount: 1, weight: 12, text: "что-то тяжёлое под мокрой листвой" },
  { kind: "omomori", amount: 1, weight: 6, text: "омомори, зашитый в подкладку" },
  { kind: "nothing", amount: 0, weight: 8, text: "ничего. Улица пуста и прибрана, как перед приходом" }
];

window.pickLoot = function () {
  var total = 0, i;
  for (i = 0; i < window.LOOT.length; i++) total += window.LOOT[i].weight;
  var r = Math.random() * total;
  for (i = 0; i < window.LOOT.length; i++) {
    r -= window.LOOT[i].weight;
    if (r <= 0) return window.LOOT[i];
  }
  return window.LOOT[window.LOOT.length - 1];
};
