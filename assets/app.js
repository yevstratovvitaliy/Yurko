/* Юрко · квіз «Чи можуть з вас це стягнути?» + форма заявки + покупка шаблонів */
(function () {
  'use strict';

  var TG_CONTACT = '@askyurko_bot';
  var MONTHS = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

  function $(s, el) { return (el || document).querySelector(s); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
    return c;
  }
  function utm() {
    var out = {};
    try {
      var p = new URLSearchParams(location.search);
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(function (k) { if (p.get(k)) out[k] = p.get(k); });
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

  /* ---------- Квіз ---------- */
  var root = $('#quiz');
  if (root) initQuiz(root);

  function initQuiz(root) {
    var today = new Date();
    var todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    var A = { stage: null, service: null, from: '2017-01', to: '', received: '', acknowledged: null, penalties: null };
    var y = today.getFullYear(), m = today.getMonth(); // поточний місяць не рахуємо
    A.to = (m === 0 ? (y - 1) + '-12' : y + '-' + String(m).padStart(2, '0'));

    var steps = [
      { id: 'stage', q: 'Що у вас зараз на руках?', opts: [
        ['nakaz', 'Судовий наказ про стягнення боргу'],
        ['pozov', 'Позовна заява або виклик до суду'],
        ['vymoga', 'Вимога чи попередження від постачальника'],
        ['check', 'Нічого, хочу перевірити борг заздалегідь']] },
      { id: 'service', q: 'За яку послугу вимагають гроші?', opts: [
        ['heat', 'Опалення або гаряча вода'], ['water', 'Водопостачання і водовідведення'],
        ['gas', 'Газ або електроенергія'], ['house', 'Управління будинком, ОСББ, вивіз сміття']] },
      { id: 'period', q: 'За який період рахують борг?', hint: 'Подивіться у наказі, позові або квитанції. Якщо точно не знаєте, вкажіть приблизно.' },
      { id: 'received', q: 'Коли вам вручили копію наказу?', hint: 'Дата на конверті, у розписці або в Електронному суді. На заяву про скасування закон дає 15 днів.', only: function () { return A.stage === 'nakaz'; } },
      { id: 'acknowledged', q: 'Ви підписували з постачальником договір про реструктуризацію або письмово визнавали борг?', hint: 'Йдеться саме про документ щодо старого боргу. Звичайна оплата поточних рахунків не рахується.', opts: [
        ['no', 'Ні, нічого не підписував'], ['yes', 'Так, підписував'], ['unknown', 'Не памʼятаю']] },
      { id: 'penalties', q: 'У сумі є пеня, інфляційні або 3% річних?', opts: [
        ['yes', 'Так, є'], ['no', 'Ні, тільки сам борг'], ['unknown', 'Не знаю, як це перевірити']] }
    ];

    var i = 0;
    function active() { return steps.filter(function (s) { return !s.only || s.only(); }); }

    function render() {
      var list = active();
      var s = list[i];
      root.innerHTML = '';
      var prog = el('div', { class: 'progress', 'aria-hidden': 'true' });
      list.forEach(function (_, k) { prog.appendChild(el('i', { class: k <= i ? 'on' : '' })); });
      root.appendChild(prog);

      var box = el('div', { class: 'q' });
      box.appendChild(el('p', { class: 'eyebrow' }, 'Питання ' + (i + 1) + ' з ' + list.length));
      box.appendChild(el('h3', { class: 'qt', id: 'qt' }, s.q));
      if (s.hint) box.appendChild(el('p', { class: 'hint' }, s.hint));

      if (s.opts) {
        var opts = el('div', { class: 'opts', role: 'group', 'aria-labelledby': 'qt' });
        s.opts.forEach(function (o) {
          var b = el('button', { type: 'button', class: 'opt', 'aria-pressed': String(A[s.id] === o[0]) }, '<span class="dot"></span><span>' + o[1] + '</span>');
          b.addEventListener('click', function () { A[s.id] = o[0]; track('QuizAnswer', { step: s.id }); next(); });
          opts.appendChild(b);
        });
        box.appendChild(opts);
      } else if (s.id === 'period') {
        var row = el('div', { class: 'row' });
        row.innerHTML =
          '<label for="q-from">З місяця<input id="q-from" type="month" min="2005-01" value="' + A.from + '"></label>' +
          '<label for="q-to">По місяць<input id="q-to" type="month" min="2005-01" value="' + A.to + '"></label>';
        box.appendChild(row);
      } else if (s.id === 'received') {
        var r2 = el('div', { class: 'row' });
        r2.innerHTML = '<label for="q-rec">Дата вручення<input id="q-rec" type="date" value="' + (A.received || '') + '"></label>';
        box.appendChild(r2);
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
          if (s.id === 'period') {
            A.from = $('#q-from').value; A.to = $('#q-to').value;
            if (!A.from || !A.to || A.from > A.to) { warn(box, 'Перевірте період: місяць «з» має бути раніше за «по».'); return; }
          }
          if (s.id === 'received') {
            A.received = $('#q-rec').value;
            if (!A.received) { warn(box, 'Вкажіть дату. Якщо не памʼятаєте точно, поставте приблизну.'); return; }
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
      if (i < active().length - 1) { i++; render(); }
      else result();
    }

    function ym(s) { var p = s.split('-'); return { y: +p[0], m: +p[1] }; }
    function dt(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }

    function result() {
      track('QuizComplete');
      var rec = A.stage === 'nakaz' && A.received ? dt(A.received) : null;
      var R = window.Davnist.analyze({
        from: ym(A.from), to: ym(A.to),
        stage: A.stage, nakazReceived: rec,
        checkDate: rec || todayUTC, today: todayUTC,
        acknowledged: A.acknowledged, penalties: A.penalties
      });

      root.innerHTML = '';
      var res = el('div', { class: 'res' });
      res.appendChild(el('p', { class: 'eyebrow' }, 'Ваш попередній розбір'));

      // 1. Строк на скасування наказу
      if (R.nakaz) {
        var c = el('div', { class: 'card' });
        if (!R.nakaz.missed) {
          c.innerHTML = '<span class="chip ' + (R.nakaz.daysLeft <= 5 ? 'warn' : 'info') + '">Строк іде</span>' +
            '<div class="big mono">' + R.nakaz.daysLeft + ' ' + plural(R.nakaz.daysLeft, 'день', 'дні', 'днів') + '</div>' +
            '<p>Заяву про скасування наказу треба подати до <b class="mono">' + R.nakaz.deadline + '</b> включно. Якщо заява подана вчасно і правильно, суд скасовує наказ без розгляду суті боргу.</p>';
        } else {
          c.innerHTML = '<span class="chip warn">Строк минув</span>' +
            '<div class="big mono">' + R.nakaz.deadline + '</div>' +
            '<p>15 днів уже сплили. Можна просити суд поновити строк, але лише з поважною причиною: не отримували копію, лікарня, служба, виїзд. Тут без перевірки юристом не обійтись.</p>';
        }
        res.appendChild(c);
      }

      // 2. Давність
      var d = el('div', { class: 'card' });
      if (R.expiredCount > 0) {
        d.innerHTML = '<span class="chip ok">Є місяці поза давністю</span>' +
          '<div class="big">' + R.expiredCount + ' ' + plural(R.expiredCount, 'місяць', 'місяці', 'місяців') + '</div>' +
          '<p>З ' + R.expiredRange[0] + ' по ' + R.expiredRange[1] + ' строк давності вже минув. Ці суми можна не платити, якщо заявити про давність у суді.</p>';
      } else {
        d.innerHTML = '<span class="chip info">Давність ще не минула</span>' +
          '<p>Через паузу на карантин і воєнний стан (з 02.04.2020 по 03.09.2025) строки давності сплили лише для боргів до весни 2018 року. Ваш період у межах давності, тому захист будується на перевірці розрахунку і нарахувань.</p>';
      }
      d.appendChild(strip(R));
      if (R.nextToExpire && R.expiredCount > 0) d.appendChild(el('p', { class: 'note' }, 'Наступний місяць (' + R.nextToExpire.label + ') вийде за давність ' + R.nextToExpire.date + '.'));
      res.appendChild(d);

      // 3. Пеня під час воєнного стану
      if (R.warPenalty) {
        var p = el('div', { class: 'card' });
        p.innerHTML = '<span class="chip ok">Можна зменшити суму</span>' +
          '<p>З 24 лютого 2022 року до кінця воєнного стану постачальникам заборонено нараховувати населенню пеню, штрафи, інфляційні та 3% річних на борг за комуналку. Якщо вони є в сумі за цей період, їх можна вимагати прибрати.</p>';
        res.appendChild(p);
      }

      if (R.flags.length) {
        var f = el('ul', { class: 'flags' });
        R.flags.forEach(function (t) { f.appendChild(el('li', null, t)); });
        res.appendChild(f);
      }

      res.appendChild(el('p', { class: 'note' }, 'Розрахунок орієнтовний: виходимо з того, що рахунок треба оплатити до 20 числа наступного місяця. Точну дату визначає ваш договір.'));
      res.appendChild(leadForm(R));

      var again = el('button', { type: 'button', class: 'btn ghost' }, 'Пройти ще раз');
      again.addEventListener('click', function () { i = 0; render(); });
      res.appendChild(again);

      root.appendChild(res);
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function strip(R) {
      var wrap = el('div', { class: 'yrs', 'aria-label': 'Помісячна карта боргу' });
      var byYear = {};
      R.months.forEach(function (x) { (byYear[x.y] = byYear[x.y] || []).push(x); });
      Object.keys(byYear).forEach(function (yr) {
        var row = el('div', { class: 'yr' });
        row.appendChild(el('span', null, yr));
        var s = el('div', { class: 'strip' });
        var map = {}; byYear[yr].forEach(function (x) { map[x.m] = x; });
        for (var k = 1; k <= 12; k++) {
          var x = map[k];
          var cls = !x ? '' : (x.expired ? 'x' : (x.inWar && A.penalties !== 'no' ? 'w' : 'live'));
          var ii = el('i', { class: cls, title: x ? (x.label + (x.expired ? ': поза давністю' : ': давність до ' + window.Davnist.fmt(x.last))) : '' });
          if (!x) ii.style.visibility = 'hidden';
          s.appendChild(ii);
        }
        row.appendChild(s);
        wrap.appendChild(row);
      });
      var legend = el('div', { class: 'legend' },
        '<span><b style="background:var(--ok)"></b>поза давністю</span>' +
        '<span><b style="background:var(--warn);opacity:.55"></b>воєнний стан, без пені</span>' +
        '<span><b style="background:var(--line)"></b>у межах давності</span>');
      var box = el('div', { style: 'display:grid;gap:10px;margin-top:6px' });
      box.appendChild(wrap); box.appendChild(legend);
      return box;
    }

    function leadForm(R) {
      var box = el('div', { class: 'card' });
      box.innerHTML = '<h3>Отримати повний розбір від юриста</h3>' +
        '<p class="note">Перевіримо розрахунок, скажемо, який документ подати і до якої дати. Перша відповідь безкоштовна.</p>';
      var f = el('form', { class: 'form', novalidate: '' });
      f.innerHTML =
        '<div class="row"><label for="l-name">Імʼя<input id="l-name" name="name" autocomplete="given-name" required></label>' +
        '<label for="l-contact">Telegram або телефон<input id="l-contact" name="contact" required placeholder="@username або +380…"></label></div>' +
        '<label for="l-note" style="display:grid;gap:6px;font-size:14px;color:var(--muted)">Що ще важливо знати (необовʼязково)<textarea id="l-note" name="note" rows="2"></textarea></label>' +
        '<button class="btn" type="submit">Надіслати юристу</button>' +
        '<p class="note">Надсилаючи, ви погоджуєтесь з <a href="oferta.html#privacy">політикою конфіденційності</a>.</p>';
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('#l-name', f).value.trim(), contact = $('#l-contact', f).value.trim();
        var old = $('.msg', f); if (old) old.remove();
        if (!name || contact.length < 5) { f.appendChild(el('p', { class: 'msg warn', role: 'alert' }, 'Вкажіть імʼя і контакт, щоб юрист міг відповісти.')); return; }
        var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Надсилаю…';
        postJSON('/.netlify/functions/lead', {
          name: name, contact: contact, note: $('#l-note', f).value.trim(),
          quiz: A, summary: { expired: R.expiredCount, live: R.liveCount, nakaz: R.nakaz, warPenalty: R.warPenalty },
          utm: utm(), page: location.pathname
        }).then(function () {
          track('Lead');
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
  }

  /* ---------- Покупка шаблонів ---------- */
  document.querySelectorAll('[data-buy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var sku = b.getAttribute('data-buy');
      var host = b.closest('.item, .plan') || b.parentNode;
      var old = host.querySelector('.msg'); if (old) old.remove();
      b.disabled = true;
      track('InitiateCheckout', { content_ids: [sku] });
      postJSON('/.netlify/functions/pay', { sku: sku, utm: utm() })
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
        .catch(function () {
          b.disabled = false;
          var m = el('p', { class: 'msg warn', role: 'alert' }, 'Оплата зараз недоступна. У превʼю-версії це очікувано: оплата через WayForPay запрацює після деплою.');
          m.style.gridColumn = '1 / -1';
          host.appendChild(m);
        });
    });
  });
})();
