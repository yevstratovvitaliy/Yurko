// returnUrl: сюди WayForPay повертає покупця. Перевіряємо статус і одразу показуємо посилання.
const { PRODUCTS, skuFromOrder, checkPaid, downloadLinks } = require('./_lib');

const page = (title, inner) => `<!doctype html><html lang="uk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="/assets/style.css"></head><body>
<header class="top"><div class="wrap"><a class="logo" href="/"><span>Ю</span>Юрко</a></div></header>
<main><section><div class="wrap prose">${inner}</div></section></main></body></html>`;

exports.handler = async (event) => {
  const params = new URLSearchParams(event.httpMethod === 'POST' ? event.body : (event.rawQuery || ''));
  const orderRef = params.get('orderReference');
  const html = (body) => ({ statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body });

  if (!orderRef) return html(page('Оплата', '<h1>Не бачимо замовлення</h1><p>Якщо гроші списались, напишіть нам, і ми надішлемо документи вручну.</p>'));

  let st = { paid: false };
  try { st = await checkPaid(orderRef); } catch (e) {}

  if (!st.paid) {
    return html(page('Оплата', `<h1>Оплату ще не підтверджено</h1><p>Іноді банк підтверджує платіж за кілька хвилин. Посилання прийде на email автоматично. Номер замовлення: <span class="mono">${orderRef}</span></p>`));
  }
  const p = PRODUCTS[skuFromOrder(orderRef)] || { name: 'Документи' };
  const links = downloadLinks(orderRef);
  return html(page('Дякуємо', `<p class="eyebrow">Оплату отримано</p><h1>${p.name}</h1>
    <p>Завантажте файли зараз. Ці ж посилання ми надіслали на ваш email.</p>
    <div class="shop">${links.map(l => `<div class="item"><div><h3>${l.file}</h3></div><a class="btn" href="${l.url}">Завантажити</a></div>`).join('')}</div>
    <p class="note">Потрібна допомога із заповненням? Пакет «Перевірка юристом» зарахує вартість шаблону.</p>`));
};
