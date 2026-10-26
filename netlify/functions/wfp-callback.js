// serviceUrl: WayForPay повідомляє сервер про результат оплати.
// Перевіряємо підпис, надсилаємо покупцю посилання на email, а вам — сповіщення в Telegram.
const { resolveProduct, parseBody, hmacMd5, skuFromOrder, telegram, downloadLinks, sendEmail } = require('./_lib');

exports.handler = async (event) => {
  const d = parseBody(event);

  const expected = hmacMd5([
    d.merchantAccount, d.orderReference, d.amount, d.currency,
    d.authCode, d.cardPan, d.transactionStatus, d.reasonCode
  ].join(';'));

  if (!d.orderReference || expected !== d.merchantSignature) {
    return { statusCode: 400, body: 'bad signature' };
  }

  if (d.transactionStatus === 'Approved') {
    const sku = skuFromOrder(d.orderReference);
    const p = resolveProduct(sku) || { name: sku };
    const links = downloadLinks(d.orderReference);
    await sendEmail(d.email, `Ваші документи: ${p.name}`,
      `<p>Дякуємо за покупку.</p><p>Посилання на завантаження:</p><ul>${links.map(l => `<li><a href="${l.url}">${l.file}</a></li>`).join('')}</ul>` +
      `<p>Якщо виникнуть питання, просто дайте відповідь на цей лист.</p><p>Юрко</p>`);
    await telegram(`💳 Оплата ${d.amount} грн\n${p.name}\n${d.email || ''} ${d.phone || ''}\n${d.orderReference}`);
  }

  const time = Math.floor(Date.now() / 1000);
  const status = 'accept';
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderReference: d.orderReference, status, time, signature: hmacMd5([d.orderReference, status, time].join(';')) })
  };
};
