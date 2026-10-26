/* Юрко · квіз для військових «Скільки з вас вимагають зайвого?»
   Правова модель (перевіряти після змін законодавства):
   - п. 15 ст. 14 Закону «Про соціальний і правовий захист військовослужбовців та членів їх сімей»:
     відсотки за користування кредитом, пеня і штрафи не нараховуються.
   - Мобілізовані і резервісти: з дня призову до звільнення (роз'яснення МОУ, 18.02.2026).
   - Контракт: з першого дня участі в бойових діях / заходах з оборони; тил без участі — не поширюється (МОУ).
   - Подружжя військового — має право (МОУ).
   - Сплачене під час служби, зараховане у відсотки/пеню, зараховується в тіло (КЦС ВС 18.01.2023 № 642/548/21),
     незаконно утримані відсотки повертаються (КЦС ВС 12.05.2022 № 336/512/18).
   - Після звільнення: судова практика неоднорідна (КЦС ВС 24.02.2022 № 591/4698/20 vs роз'яснення МОУ).
   - Винятки: кредити на житло, авто, енергообладнання, якщо відсотки компенсує держава чи інша програма.
   Розрахунок орієнтовний: не знаємо ставок і графіка, тому показуємо або точну межу (кредит узято під час служби),
   або верхню межу («до»), якщо кредит узято до призову. */
(function () {
  'use strict';

  var root = document.getElementById('vquiz');
  if (!root) return;

  var TG_CONTACT = '@askyurko_bot';

  function $(s, el) { return (el || document).querySelector(s); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  var MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
  function monthLabel(ym) { var p = String(ym).split('-'); return MONTHS_GEN[+p[1] - 1] + ' ' + p[0] + ' року'; }
  function money(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' грн';
  }
  function num(v) {
    var n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : NaN;
  }
  function utm() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ref'].forEach(function (k) { if (p.get(k)) out[k] = p.get(k); });
    } catch (e) {}
    return out;
  }
  function track(name, data) {
    try { if (window.fbq) window.fbq('track', name, data || {}); } catch (e) {}
    try { if (window.gtag) window.gtag('event', name, data || {}); } catch (e) {}
  }
  function postJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json().catch(function () { return {}; }); });
  }

  var today = new Date();
  var thisMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var MONTHS_NOM = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  // Два прості списки замість <input type="month">: на телефонах він незручний
  function monthYear(id, label, value, minYear) {
    var p = String(value || '').split('-'), y = +p[0], m = +p[1];
    var maxY = today.getFullYear();
    var ms = '<option value="">місяць</option>' + MONTHS_NOM.map(function (n, k) { return '<option value="' + String(k + 1).padStart(2, '0') + '"' + (k + 1 === m ? ' selected' : '') + '>' + n + '</option>'; }).join('');
    var ys = '<option value="">рік</option>';
    for (var yy = maxY; yy >= minYear; yy--) ys += '<option value="' + yy + '"' + (yy === y ? ' selected' : '') + '>' + yy + '</option>';
    return '<fieldset class="my"><legend>' + label + '</legend><div class="row">' +
      '<label for="' + id + '-m">Місяць<select id="' + id + '-m">' + ms + '</select></label>' +
      '<label for="' + id + '-y">Рік<select id="' + id + '-y">' + ys + '</select></label></div></fieldset>';
  }
  function readMY(id) {
    var m = $('#' + id + '-m').value, y = $('#' + id + '-y').value;
    return m && y ? y + '-' + m : '';
  }

  var refFromUrl = (utm().ref || '').toUpperCase();

  var A = { status: null, since: '2022-03', dtype: null, loan: '2021-06', body: '', paid: '', demand: '', count: null, stage: null };

  var steps = [
    { id: 'status', q: 'Хто звертається?', opts: [
      ['mob', 'Мобілізований або резервіст, служу зараз'],
      ['kontrakt_boy', 'Контракт, брав участь у бойових діях чи заходах з оборони'],
      ['kontrakt_tyl', 'Контракт, служу в тилу, участі в бойових не брав'],
      ['spouse', 'Дружина або чоловік військового'],
      ['demob', 'Вже звільнився зі служби']] },
    { id: 'since', q: 'Коли почалась служба?', hint: 'Для мобілізованих — місяць призову. Для контрактників — перший місяць участі в бойових діях. Для подружжя — дата призову чоловіка чи дружини.' },
    { id: 'dtype', q: 'Хто вимагає гроші?', opts: [
      ['mfo', 'МФО або онлайн-кредит'],
      ['bank', 'Банк: споживчий кредит або кредитка'],
      ['kolektor', 'Колектор чи фінкомпанія, якій продали борг'],
      ['ipoteka', 'Іпотека або автокредит'],
      ['many', 'Багато різних кредиторів: МФО, банки, колектори']] },
    { id: 'money', q: 'Цифри по одному кредиту', hint: 'Візьміть найбільший. Якщо точно не знаєте, вкажіть приблизно: розрахунок однаково покаже порядок суми.' },
    { id: 'count', only: function () { return A.dtype !== 'many'; }, q: 'Скільки всього кредиторів вимагають гроші?', opts: [
      ['1', 'Один'], ['2-3', 'Два-три'], ['4+', 'Чотири і більше']] },
    { id: 'stage', q: 'Що вже відбувається?', opts: [
      ['none', 'Дзвонять і пишуть, але в суд не йшли'],
      ['refused', 'Я просив застосувати пільгу, а мені відмовили'],
      ['court', 'Кредитор подав до суду'],
      ['dvs', 'Відкрито виконавче провадження, арештовано рахунки']] }
  ];

  var i = 0;
  function active() { return steps.filter(function (x) { return !x.only || x.only(); }); }

  function render() {
    var list = active();
    var s = list[i];
    root.innerHTML = '';
    var prog = el('div', { class: 'progress', 'aria-hidden': 'true' });
    list.forEach(function (_, k) { prog.appendChild(el('i', { class: k <= i ? 'on' : '' })); });
    root.appendChild(prog);

    var box = el('div', { class: 'q' });
    box.appendChild(el('p', { class: 'eyebrow' }, 'Питання ' + (i + 1) + ' з ' + list.length));
    box.appendChild(el('h3', { class: 'qt', id: 'vqt' }, s.q));
    if (s.hint) box.appendChild(el('p', { class: 'hint' }, s.hint));

    if (s.opts) {
      var opts = el('div', { class: 'opts', role: 'group', 'aria-labelledby': 'vqt' });
      s.opts.forEach(function (o) {
        var b = el('button', { type: 'button', class: 'opt', 'aria-pressed': String(A[s.id] === o[0]) }, '<span class="dot"></span><span>' + o[1] + '</span>');
        b.addEventListener('click', function () { A[s.id] = o[0]; track('QuizAnswer', { quiz: 'vijsk', step: s.id }); next(); });
        opts.appendChild(b);
      });
      box.appendChild(opts);
    } else if (s.id === 'since') {
      var r = el('div');
      r.innerHTML = monthYear('v-since', 'Місяць і рік початку служби', A.since, 2014);
      box.appendChild(r);
    } else if (s.id === 'money') {
      var m = el('div', { class: 'form' });
      m.innerHTML =
        monthYear('v-loan', 'Коли взяли кредит', A.loan, 2005) + '<div class="row">' +
          '<label for="v-body">Скільки отримали на руки, грн<input id="v-body" inputmode="decimal" placeholder="6000" value="' + A.body + '"></label>' +
        '</div>' +
        '<div class="row">' +
          '<label for="v-paid">Скільки вже сплатили, грн<input id="v-paid" inputmode="decimal" placeholder="0" value="' + A.paid + '"></label>' +
          '<label for="v-demand">Скільки вимагають зараз, грн<input id="v-demand" inputmode="decimal" placeholder="22000" value="' + A.demand + '"></label>' +
        '</div>';
      box.appendChild(m);
    }
    root.appendChild(box);

    var nav = el('div', { class: 'qnav' });
    var back = el('button', { type: 'button', class: 'btn ghost' }, 'Назад');
    back.disabled = i === 0;
    back.addEventListener('click', function () { if (i > 0) { i--; render(); } });
    nav.appendChild(back);
    if (!s.opts) {
      var fwd = el('button', { type: 'button', class: 'btn' }, 'Далі');
      fwd.addEventListener('click', function () {
        if (s.id === 'since') {
          A.since = readMY('v-since');
          if (A.since && A.since > thisMonth) { warn(box, 'Дата не може бути в майбутньому.'); return; }
          if (!A.since) { warn(box, 'Вкажіть місяць початку служби. Якщо не памʼятаєте точно, поставте приблизний.'); return; }
        }
        if (s.id === 'money') {
          A.loan = readMY('v-loan'); A.body = $('#v-body').value; A.paid = $('#v-paid').value || '0'; A.demand = $('#v-demand').value;
          if (!A.loan || isNaN(num(A.body)) || num(A.body) <= 0 || isNaN(num(A.demand))) {
            warn(box, 'Заповніть дату кредиту, суму, яку отримали, і суму, яку вимагають. Можна приблизно.'); return;
          }
          if (isNaN(num(A.paid))) { warn(box, 'Сплачену суму вкажіть числом, або 0.'); return; }
        }
        next();
      });
      nav.appendChild(fwd);
    }
    root.appendChild(nav);
  }

  function warn(box, text) {
    var old = $('.msg', box); if (old) old.remove();
    box.appendChild(el('p', { class: 'msg warn', role: 'alert' }, text));
  }

  function next() {
    if (A.dtype === 'many') A.count = '4+';
    if (i < active().length - 1) { i++; render(); } else result();
  }

  function analyze() {
    var body = num(A.body), paid = num(A.paid) || 0, demand = num(A.demand);
    var inService = A.loan >= A.since;            // кредит узято вже під час служби
    var principalLeft = Math.max(0, body - paid);  // мінімум тіла, що лишився
    var excess = Math.max(0, demand - principalLeft);
    var overpaid = inService ? Math.max(0, paid - body) : 0;
    return {
      body: body, paid: paid, demand: demand,
      inService: inService, principalLeft: principalLeft, excess: excess, overpaid: overpaid,
      eligible: A.status === 'kontrakt_tyl' ? 'no' : (A.status === 'demob' ? 'partial' : 'yes'),
      exception: A.dtype === 'ipoteka'
    };
  }

  function docsList() {
    var d = ['Військовий квиток або посвідчення офіцера (копія)', 'Довідка форми 5 про проходження служби (у кадровому органі частини)'];
    if (A.status === 'mob' || A.status === 'demob' || A.status === 'spouse') d.push('Витяг з наказу про зарахування до списків частини, якщо у довідці не вказано вид служби');
    if (A.status === 'kontrakt_boy' || A.status === 'kontrakt_tyl') d.push('Витяг з наказу і довідка про участь у бойових діях (форма 12 або додатки 1, 4, 6 до Порядку № 413)');
    if (A.status === 'spouse') d.push('Свідоцтво про шлюб');
    if (A.status === 'demob') d.push('Наказ або довідка про звільнення зі служби (дата звільнення)');
    d.push('Кредитний договір і будь-які листи чи вимоги кредитора');
    return d;
  }

  function result() {
    track('QuizComplete', { quiz: 'vijsk' });
    var R = analyze();
    root.innerHTML = '';
    var res = el('div', { class: 'res' });
    res.appendChild(el('p', { class: 'eyebrow' }, 'Ваш попередній розрахунок'));

    // 1. Чи діє пільга
    var c1 = el('div', { class: 'card' });
    if (R.eligible === 'no') {
      c1.innerHTML = '<span class="chip warn">Пільга під питанням</span>' +
        '<p>За роз\'ясненням Міноборони, пільга не діє для контрактників, які служили лише в тилу і не брали участі в бойових діях чи заходах з оборони. Якщо у вас був хоч один день такої участі і є довідка, пільга діє з цього дня. Це варто перевірити.</p>';
    } else if (R.eligible === 'partial') {
      c1.innerHTML = '<span class="chip info">Пільга за період служби</span>' +
        '<p>Відсотки, пеня і штрафи, нараховані за час служби, можна оскаржити і після звільнення. Чи діє пільга далі, до кінця особливого періоду, суди вирішують по-різному.</p>';
    } else {
      c1.innerHTML = '<span class="chip ok">Пільга діє</span>' +
        '<p>' + (A.status === 'spouse' ? 'Подружжя військового має право на пільгу і може подати документи самостійно. ' : '') +
        'З ' + monthLabel(A.since) + ' кредитор не мав права нараховувати вам відсотки за користування кредитом, пеню і штрафи (п. 15 ст. 14 Закону «Про соціальний і правовий захист військовослужбовців»).</p>';
    }
    if (R.exception) c1.appendChild(el('p', { class: 'note' }, 'Для іпотеки і автокредитів є винятки, особливо якщо відсотки компенсує держава чи інша програма. Тут потрібна перевірка договору.'));
    res.appendChild(c1);

    // 2. Сума
    var c2 = el('div', { class: 'card' });
    if (R.excess > 0) {
      c2.innerHTML = '<span class="chip ok">Можна зменшити суму</span>' +
        '<div class="big mono">' + (R.inService ? '≈ ' : 'до ') + money(R.excess) + '</div>' +
        '<p>Стільки у вимозі кредитора понад тіло кредиту, що лишилось. ' +
        (R.inService
          ? 'Кредит узято вже під час служби, тож усе це — відсотки, пеня і штрафи, які не мали нараховуватись.'
          : 'Кредит узято до служби: відсотки, нараховані до ' + monthLabel(A.since) + ', законні, тому точна сума буде меншою. Її рахує юрист за розрахунком кредитора.') +
        '</p>';
    } else {
      c2.innerHTML = '<span class="chip info">Сума близька до тіла</span>' +
        '<p>Вимога не перевищує тіла кредиту, яке лишилось. Перевірте, чи кредитор правильно зарахував ваші платежі: усе, що він списав у відсотки під час служби, має піти в погашення тіла.</p>';
    }
    if (R.overpaid > 0) c2.appendChild(el('p', { class: 'note' }, 'Ви вже сплатили на ' + money(R.overpaid) + ' більше, ніж отримали. Ці гроші можна вимагати зарахувати або повернути (КЦС ВС, справа № 336/512/18).'));
    c2.appendChild(el('p', { class: 'note' }, 'Тіло кредиту пільга не списує: орієнтовно лишається сплатити ' + money(R.principalLeft) + '.'));
    res.appendChild(c2);
    var planSlot = el('div'); res.appendChild(planSlot);

    // 2а. Пеня під час воєнного стану — для всіх (п. 18 ПП ЦК)
    var c18 = el('div', { class: 'card' });
    c18.innerHTML = '<span class="chip ok">' + (R.eligible === 'no' ? 'Пеню можна зняти навіть без пільги' : 'Ще один аргумент') + '</span>' +
      '<p>З 24 лютого 2022 року і до кінця воєнного стану пеня, штрафи, інфляційні і 3% річних за прострочення кредиту не стягуються з жодного позичальника, не лише з військових (п. 18 Прикінцевих положень Цивільного кодексу). Саме ця норма найчастіше зменшує суми в судах.</p>';
    res.appendChild(c18);

    // 3. Стадія
    var flags = [];
    if (A.stage === 'refused') flags.push('Кредитор відмовив. Верховний Суд вказав, що для пільги достатньо звернення і документів про службу, змінювати договір не потрібно (справа № 336/512/18). Відмову варто оскаржити.');
    if (A.stage === 'court') flags.push('Позов уже в суді. Строк на відзив вказаний в ухвалі про відкриття провадження, зазвичай 15 днів. Не пропустіть його.');
    if (A.stage === 'dvs') flags.push('Відкрито виконавче провадження. Тут діяти треба швидко і краще одразу з адвокатом.');
    if (A.dtype === 'many') flags.push('Кредиторів багато, і всі різні: МФО, банки, колектори. Заяву треба подати кожному окремо, а відповідають вони по-різному. Найкраще працює пакет «під ключ»: юрист веде всіх одночасно, а ви бачите статус по кожному.');
    if (A.dtype === 'kolektor') flags.push('Борг купив колектор. Він отримав права первісного кредитора і не більше: вимагайте договір відступлення і розрахунок.');
    if (A.count === '2-3' || A.count === '4+') flags.push('Кредиторів кілька: заяву треба подати кожному окремо, і кожен відповідає по-своєму. Тут економить час пакет «під ключ».');
    if (flags.length) {
      var f = el('ul', { class: 'flags' });
      flags.forEach(function (t) { f.appendChild(el('li', null, t)); });
      res.appendChild(f);
    }

    // 4. Документи
    var c4 = el('div', { class: 'card' });
    c4.innerHTML = '<h3>Що зібрати</h3>';
    var ul = el('ul', { style: 'margin:0;padding-left:20px;display:grid;gap:6px' });
    docsList().forEach(function (t) { ul.appendChild(el('li', null, t)); });
    c4.appendChild(ul);
    res.appendChild(c4);

    // 5. Персональний план і набір — показуємо одразу під сумою
    planSlot.replaceWith(planCard());

    res.appendChild(el('p', { class: 'note' }, 'Розрахунок орієнтовний: ми не бачимо ставок, графіка і того, як кредитор зараховував платежі. Точну суму юрист рахує за розрахунком кредитора.'));
    res.appendChild(leadForm(R));

    var again = el('button', { type: 'button', class: 'btn ghost' }, 'Пройти ще раз');
    again.addEventListener('click', function () { i = 0; render(); });
    res.appendChild(again);

    root.appendChild(res);
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Персональний план ----------
  var T = {
    stop:     { name: 'Стоп-колектори', price: 199, why: 'Зупиняє дзвінки вам і рідним. Надсилайте першим, разом із довідкою з частини.' },
    zayava:   { name: 'Заява кредитору про пільгу', price: 299, why: 'Головний документ: не нараховувати відсотки, пеню і штрафи з дня призову, перерахувати борг, сплачене — в тіло кредиту.' },
    druzhyna: { name: 'Заява дружини (чоловіка) військового', price: 299, why: 'Головний документ для кредиту, оформленого на вас: ті самі вимоги, документи про службу чоловіка (дружини).' },
    kolektor: { name: 'Вимога до колектора', price: 249, why: 'Борг купили: хай спершу доведуть право вимоги і покажуть розрахунок. Без цього платити не обовʼязково.' },
    nbu:      { name: 'Звернення до НБУ', price: 249, why: 'Кредитор уже відмовив — наступний крок: скарга до Нацбанку з копією вашої заяви.' },
    vidzyv:   { name: 'Відзив на позов', price: 699, why: 'Позов уже в суді: відзив з власним розрахунком. Строк — в ухвалі суду, зазвичай 15 днів.' }
  };
  var PACK = ['druzhyna', 'kolektor', 'nbu', 'stop', 'zayava'];

  function recommend() {
    if (A.stage === 'dvs') return [];
    var out = [];
    var serving = A.status === 'mob' || A.status === 'kontrakt_boy' || A.status === 'kontrakt_tyl';
    if (serving) out.push('stop');
    out.push(A.status === 'spouse' ? 'druzhyna' : 'zayava');
    if (A.dtype === 'kolektor' || A.dtype === 'many') out.push('kolektor');
    if (A.stage === 'refused') out.push('nbu');
    if (A.stage === 'court') out.push('vidzyv');
    return out;
  }
  function bundlePrice(items) {
    var sum = items.reduce(function (a, k) { return a + T[k].price; }, 0);
    return { sum: sum, price: items.length < 2 ? sum : Math.round(sum * 0.8 / 10) * 10 - 1 };
  }

  function planCard() {
    var items = recommend();
    var c = el('div', { class: 'card plan-card' });
    if (!items.length) {
      c.innerHTML = '<h3>Ваш план</h3><p>Відкрито виконавче провадження, тут шаблоном не обійтись: потрібен адвокат, який подасть заяви виконавцю і в суд. Залиште заявку нижче, і юрист скаже, що робити першим. Пакет «Суд» — від 8\u00a0000 грн.</p>';
      return c;
    }
    c.innerHTML = '<span class="chip info">Для вашої ситуації</span><h3>Ваш план: що надіслати і кому</h3>';
    var ol = el('ol', { class: 'steps-list' });
    items.forEach(function (k) {
      ol.appendChild(el('li', null, '<b>' + T[k].name + '</b> <span class="mono note">' + T[k].price + ' грн</span><br><span class="note">' + T[k].why + '</span>'));
    });
    c.appendChild(ol);

    var box = el('div', { class: 'offer' });
    c.appendChild(box);
    var bp = bundlePrice(items);
    var inPack = items.every(function (k) { return PACK.indexOf(k) >= 0; });

    if (items.length === 1) {
      box.innerHTML = '<button class="btn" type="button" data-buy="vijsk-' + (items[0] === 'zayava' ? 'zayava' : items[0]) + '">Купити за ' + bp.sum + ' грн</button>';
      bindBuy(box);
    } else if (inPack && bp.price >= 599) {
      // повний пакет дешевший або так само: чесно пропонуємо його
      box.innerHTML = '<p>Окремо: <s class="mono">' + bp.sum + ' грн</s></p>' +
        '<p><b>Пакет «Сам» — 599 грн</b>: усе з вашого плану і ще ' + (PACK.length - items.length) + ' ' + (PACK.length - items.length === 1 ? 'шаблон' : 'шаблони') + ' на випадок, якщо кредитор відмовить чи продасть борг.</p>' +
        '<button class="btn" type="button" data-buy="pack-vijsk">Купити пакет за 599 грн</button>';
      bindBuy(box);
    } else {
      box.innerHTML = '<p>Окремо: <s class="mono">' + bp.sum + ' грн</s> · <b>Набором: <span class="mono">' + bp.price + ' грн</span></b> (−20%)</p><p class="note timer" aria-live="polite">Фіксую ціну набору…</p>';
      postJSON('/.netlify/functions/offer', { items: items })
        .then(function (o) {
          var btn = el('button', { type: 'button', class: 'btn' }, 'Купити набір за ' + o.price + ' грн');
          box.appendChild(btn);
          btn.addEventListener('click', function () { checkout(btn, o.sku, { exp: o.exp, sig: o.sig }); });
          var t = $('.timer', box);
          (function tick() {
            var left = Math.max(0, o.exp - Date.now());
            if (!left) {
              t.textContent = 'Ціна набору завершилась. Шаблони можна купити окремо в магазині або пройти розрахунок ще раз.';
              btn.remove();
              box.appendChild(el('a', { class: 'btn ghost', href: 'magazyn.html#vijsk' }, 'До шаблонів'));
              return;
            }
            var m = Math.floor(left / 60000), sec = Math.floor(left / 1000) % 60;
            t.innerHTML = 'Ціна набору діє ще <b class="mono">' + m + ':' + String(sec).padStart(2, '0') + '</b>';
            setTimeout(tick, 1000);
          })();
        })
        .catch(function () {
          $('.timer', box).textContent = 'Набір зараз недоступний — шаблони можна купити окремо.';
          box.appendChild(el('a', { class: 'btn ghost', href: 'magazyn.html#vijsk' }, 'До шаблонів'));
        });
    }
    c.appendChild(el('p', { class: 'note' }, A.stage === 'court'
      ? 'Не хочете розбиратися самі? Адвокат веде справу в суді без вашої участі — від 4\u00a0000 грн за позов до 50\u00a0000 грн. <a href="poslugy.html#vijsk">Детальніше</a>'
      : 'Не хочете розбиратися самі? Юрист зробить усе це за вас «під ключ» — 2\u00a0400 грн, до 5 кредиторів. <a href="poslugy.html#vijsk">Детальніше</a>'));
    return c;
  }

  function checkout(b, sku, extra) {
    b.disabled = true;
    track('InitiateCheckout', { content_ids: [sku] });
    var body = { sku: sku, utm: utm() };
    for (var k in extra || {}) body[k] = extra[k];
    fetch('/.netlify/functions/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || r.status); e.status = r.status; throw e; } return j; }); })
      .then(function (r) {
        var form = el('form', { method: 'POST', action: r.url, 'accept-charset': 'utf-8' });
        Object.keys(r.fields).forEach(function (k) {
          [].concat(r.fields[k]).forEach(function (v) {
            var inp = el('input', { type: 'hidden', name: Array.isArray(r.fields[k]) ? k + '[]' : k });
            inp.value = v; form.appendChild(inp);
          });
        });
        document.body.appendChild(form); form.submit();
      })
      .catch(function (e) {
        b.disabled = false;
        var msg = e.status === 410 ? 'Час дії ціни набору минув. Пройдіть розрахунок ще раз або купіть шаблони окремо.'
          : 'Оплата тимчасово недоступна. Напишіть нам у Telegram: ' + TG_CONTACT + ', і ми надішлемо документи вручну.';
        b.parentNode.appendChild(el('p', { class: 'msg warn', role: 'alert' }, msg));
      });
  }

  // Кнопки оплати, додані після завантаження сторінки (app.js вішає обробники лише на ті, що є одразу)
  function bindBuy(scope) {
    scope.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () { checkout(b, b.getAttribute('data-buy')); });
    });
  }

  function leadForm(R) {
    var box = el('div', { class: 'card' });
    box.innerHTML = '<h3>Отримати розбір від юриста</h3>' +
      '<p class="note">Перевіримо документи і розрахунок кредитора, скажемо, що подати і кому. Перша відповідь безкоштовна.</p>';
    var f = el('form', { class: 'form', novalidate: '' });
    f.innerHTML =
      '<div class="row"><label for="vl-name">Імʼя<input id="vl-name" name="name" autocomplete="given-name" required></label>' +
      '<label for="vl-contact">Telegram або телефон<input id="vl-contact" name="contact" required placeholder="@username або +380…"></label></div>' +
      '<div class="row"><label for="vl-ref">Код від побратима (якщо є)<input id="vl-ref" name="ref" autocomplete="off" placeholder="ЮРКО-…" value="' + refFromUrl.replace(/[^A-ZА-ЯІЇЄҐ0-9-]/gi, '') + '"></label></div>' +
      '<label for="vl-note" style="display:grid;gap:6px;font-size:14px;color:var(--muted)">Що ще важливо знати (необовʼязково)<textarea id="vl-note" name="note" rows="2"></textarea></label>' +
      '<button class="btn" type="submit">Надіслати юристу</button>' +
      '<p class="note">Надсилаючи, ви погоджуєтесь з <a href="oferta.html#privacy">політикою конфіденційності</a>.</p>';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#vl-name', f).value.trim(), contact = $('#vl-contact', f).value.trim();
      var old = $('.msg', f); if (old) old.remove();
      if (!name || contact.length < 5) { f.appendChild(el('p', { class: 'msg warn', role: 'alert' }, 'Вкажіть імʼя і контакт, щоб юрист міг відповісти.')); return; }
      var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Надсилаю…';
      postJSON('/.netlify/functions/lead', {
        kind: 'vijsk', name: name, contact: contact,
        ref: $('#vl-ref', f).value.trim().slice(0, 30),
        note: $('#vl-note', f).value.trim(),
        quiz: A, summary: { plan: recommend(), excess: Math.round(R.excess), upTo: !R.inService, principalLeft: Math.round(R.principalLeft), overpaid: Math.round(R.overpaid), eligible: R.eligible },
        utm: utm(), page: location.pathname
      }).then(function () {
        track('Lead', { quiz: 'vijsk' });
        f.innerHTML = '<p class="msg ok" role="status">Заявку отримано. Юрист напише вам протягом робочого дня.</p>';
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Надіслати юристу';
        f.appendChild(el('p', { class: 'msg warn', role: 'alert' }, 'Заявка не відправилась. Напишіть нам напряму в Telegram: ' + TG_CONTACT + '.'));
      });
    });
    box.appendChild(f);
    return box;
  }

  render();
})();
