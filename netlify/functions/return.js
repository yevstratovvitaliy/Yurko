// returnUrl: сюди WayForPay повертає покупця. Перевіряємо статус і одразу показуємо посилання.
const { resolveProduct, parseBody, skuFromOrder, checkPaid, downloadLinks } = require('./_lib');

const page = (title, inner) => `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="/assets/style.css"></head><body>
<header class="top"><div class="wrap"><a class="logo" href="/"><span>Ю</span>Юрко</a></div></header>
<main><section><div class="wrap prose">${inner}</div></section></main></body></html>`;

exports.handler = async (event) => {
  // WayForPay повертає покупця POST-формою; Netlify може передати тіло в base64
  const body = event.httpMethod === 'POST' ? parseBody(event) : {};
  const q = event.queryStringParameters || {};
  const orderRef = body.orderReference || q.orderReference;
  console.log('RETURN', event.httpMethod, 'keys:', Object.keys(body).join(','), 'order:', orderRef || '—', 'status:', body.transactionStatus || '—');
  const html = (body) => ({ statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body });

  if (!orderRef) return html(page('Оплата', '<h1>Не бачимо замовлення</h1><p>Якщо гроші списались, напишіть нам у Telegram <a href="https://t.me/askyurko_bot">@askyurko_bot</a>, і ми надішлемо документи вручну.</p>'));

  let st = { paid: false };
  try { st = await checkPaid(orderRef); } catch (e) {}

  if (!st.paid && ['Declined', 'Expired', 'Refunded', 'Voided'].includes(st.data && st.data.transactionStatus || body.transactionStatus)) {
    return html(page('Оплата', `<h1>Оплата не пройшла</h1><p>Банк відхилив платіж або час на оплату минув. Гроші не списано. Спробуйте ще раз або напишіть нам у Telegram: <a href="https://t.me/askyurko_bot">@askyurko_bot</a>.</p><p><a class="btn" href="/magazyn.html">Повернутися до шаблонів</a></p>`));
  }
  if (!st.paid) {
    return html(page('Оплата', `<h1>Оплату ще не підтверджено</h1><p>Іноді банк підтверджує платіж за кілька хвилин. Посилання прийде на email автоматично. Номер замовлення: <span class="mono">${orderRef}</span></p>`));
  }
  const p = resolveProduct(skuFromOrder(orderRef)) || { name: 'Документи' };
  const links = downloadLinks(orderRef);
  return html(page('Дякуємо', `<p class="eyebrow">Оплату отримано</p><h1>${p.name}</h1>
    <p>Завантажте файли зараз. Ці ж посилання ми надіслали на ваш email.</p>
    <div class="shop">${links.map(l => `<div class="item"><div><h3>${l.file}</h3></div><a class="btn" href="${l.url}">Завантажити</a></div>`).join('')}</div>
    <p class="note">Потрібна допомога із заповненням? Пакет «Перевірка юристом» зарахує вартість шаблону.</p>`));
};
