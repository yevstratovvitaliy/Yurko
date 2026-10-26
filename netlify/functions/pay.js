// Створює підписаний запит на оплату WayForPay. Браузер сам відправляє форму на secure.wayforpay.com.
const crypto = require('crypto');
const { resolveProduct, parseBundle, offerSig, env, hmacMd5, json, telegram } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  // Оплата не налаштована — кажемо прямо, а не відправляємо людину на сторінку помилки WayForPay
  if (!env('WFP_MERCHANT') || !env('WFP_SECRET_KEY') || !env('SITE_URL')) {
    console.error('PAY NOT CONFIGURED: потрібні WFP_MERCHANT, WFP_SECRET_KEY, SITE_URL');
    return json(503, { error: 'not configured' });
  }
  let sku = String(body.sku || '');
  const items = parseBundle(sku);
  if (items) {
    sku = 'b-' + items.join('.');
    // ціна набору діє лише до exp і лише з підписом, виданим offer.js
    if (!(Number(body.exp) > Date.now()) || offerSig(sku, Number(body.exp)) !== body.sig) {
      return json(410, { error: 'offer expired' });
    }
  }
  const p = resolveProduct(sku);
  if (!p) return json(400, { error: 'Невідомий продукт' });

  const site = env('SITE_URL');
  const merchantAccount = env('WFP_MERCHANT');
  const merchantDomainName = env('WFP_DOMAIN', new URL(site).hostname);
  const orderReference = `YURKO_${sku}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = p.price;

  const signature = hmacMd5([
    merchantAccount, merchantDomainName, orderReference, orderDate, amount, 'UAH',
    p.name, 1, amount
  ].join(';'));

  await telegram(`🛒 Почав оплату: ${p.name} — ${amount} грн\n${orderReference}`);

  return json(200, {
    url: 'https://secure.wayforpay.com/pay',
    fields: {
      merchantAccount, merchantDomainName, merchantTransactionSecureType: 'AUTO',
      merchantSignature: signature, language: 'UA',
      orderReference, orderDate: String(orderDate), amount: String(amount), currency: 'UAH',
      productName: [p.name], productPrice: [String(amount)], productCount: ['1'],
      returnUrl: `${site}/.netlify/functions/return`,
      serviceUrl: `${site}/.netlify/functions/wfp-callback`
    }
  });
};
