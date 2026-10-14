// Створює підписаний запит на оплату WayForPay. Браузер сам відправляє форму на secure.wayforpay.com.
const crypto = require('crypto');
const { PRODUCTS, env, hmacMd5, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const p = PRODUCTS[body.sku];
  if (!p) return json(400, { error: 'Невідомий продукт' });

  const site = env('SITE_URL');
  const merchantAccount = env('WFP_MERCHANT');
  const merchantDomainName = env('WFP_DOMAIN', new URL(site).hostname);
  const orderReference = `YURKO_${body.sku}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = p.price;

  const signature = hmacMd5([
    merchantAccount, merchantDomainName, orderReference, orderDate, amount, 'UAH',
    p.name, 1, amount
  ].join(';'));

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
