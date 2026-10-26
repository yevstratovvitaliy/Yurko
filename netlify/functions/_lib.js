// Спільні утиліти для функцій Юрка
const crypto = require('crypto');

// Єдиний каталог продуктів. Ціни тут — джерело правди для оплати.
// files: імена файлів у netlify/functions/templates/
const PRODUCTS = {
  // Кредити військовим (п. 15 ст. 14 Закону про соцзахист військовослужбовців)
  'vijsk-zayava':    { name: 'Заява кредитору про застосування пільги військовослужбовця', price: 299, files: ['vijsk-zayava-kredytoru.docx', 'instrukciya-vijsk.pdf'] },
  'vijsk-kolektor':  { name: 'Вимога до колектора: документи, розрахунок, пільга', price: 249, files: ['vijsk-vymoga-kolektoru.docx', 'instrukciya-vijsk.pdf'] },
  'vijsk-nbu':       { name: 'Звернення до НБУ щодо відмови застосувати пільгу', price: 249, files: ['vijsk-zvernennya-nbu.docx', 'instrukciya-vijsk.pdf'] },
  'vijsk-vidzyv':    { name: 'Відзив на позов кредитора до військового', price: 699, files: ['vijsk-vidzyv.docx', 'instrukciya-vijsk.pdf'] },
  'vijsk-stop':      { name: 'Стоп-колектори: повідомлення про захищену категорію', price: 199, files: ['vijsk-stop-kolektory.docx', 'instrukciya-vijsk.pdf'] },
  'vijsk-druzhyna':  { name: 'Заява дружини (чоловіка) військовослужбовця про пільгу', price: 299, files: ['vijsk-zayava-druzhyny.docx', 'instrukciya-vijsk.pdf'] },
  'pack-vijsk':      { name: 'Пакет «Сам» для військових', price: 599, files: ['vijsk-zayava-kredytoru.docx', 'vijsk-zayava-druzhyny.docx', 'vijsk-stop-kolektory.docx', 'vijsk-vymoga-kolektoru.docx', 'vijsk-zvernennya-nbu.docx', 'instrukciya-vijsk.pdf'] },
  // Комуналка
  'nakaz':           { name: 'Заява про скасування судового наказу', price: 299, files: ['zayava-skasuvannya-nakazu.docx', 'instrukciya.pdf'] },
  'ponovlennya':     { name: 'Скасування наказу з поновленням строку', price: 399, files: ['zayava-skasuvannya-ponovlennya.docx', 'instrukciya.pdf'] },
  'davnist':         { name: 'Заява про застосування позовної давності', price: 299, files: ['zayava-davnist.docx', 'instrukciya.pdf'] },
  'vidzyv':          { name: 'Відзив на позов про стягнення боргу за ЖКП', price: 599, files: ['vidzyv-zhkp.docx', 'instrukciya.pdf'] },
  'zapyt':           { name: 'Запит постачальнику про розрахунок боргу', price: 149, files: ['zapyt-rozrahunok.docx'] },
  'penya':           { name: 'Вимога прибрати пеню та інфляційні', price: 199, files: ['vymoga-penya.docx'] },
  'pack-samozahyst': { name: 'Пакет «Самозахист»', price: 499, files: ['zayava-skasuvannya-nakazu.docx', 'zayava-davnist.docx', 'zapyt-rozrahunok.docx', 'instrukciya.pdf'] }
};

const env = (k, def) => process.env[k] || def;

// ---------- Персональний набір після квізу ----------
// Короткі імена для набору; набір кодується в orderReference як b-zayava.stop.kolektor
const BUNDLE_ITEMS = { zayava: 'vijsk-zayava', druzhyna: 'vijsk-druzhyna', stop: 'vijsk-stop', kolektor: 'vijsk-kolektor', nbu: 'vijsk-nbu', vidzyv: 'vijsk-vidzyv' };
const BUNDLE_DISCOUNT = 0.2;      // знижка на набір з 2+ шаблонів
const OFFER_MINUTES = 30;         // скільки діє ціна набору — перевіряється на сервері

function bundlePrice(items) {
  const sum = items.reduce((a, k) => a + PRODUCTS[BUNDLE_ITEMS[k]].price, 0);
  if (items.length < 2) return { sum, price: sum };
  return { sum, price: Math.round(sum * (1 - BUNDLE_DISCOUNT) / 10) * 10 - 1 };
}
function parseBundle(sku) {
  if (!/^b-[a-z.]+$/.test(String(sku))) return null;
  const items = [...new Set(sku.slice(2).split('.'))];
  if (!items.length || items.length > 6 || !items.every(k => BUNDLE_ITEMS[k])) return null;
  return items.sort();
}
// Повертає продукт для звичайного SKU або для набору b-...
function resolveProduct(sku) {
  if (PRODUCTS[sku]) return PRODUCTS[sku];
  const items = parseBundle(sku);
  if (!items) return null;
  const files = [...new Set(items.flatMap(k => PRODUCTS[BUNDLE_ITEMS[k]].files))];
  return { name: 'Ваш набір: ' + items.map(k => PRODUCTS[BUNDLE_ITEMS[k]].name).join('; '), price: bundlePrice(items).price, files, items };
}
function offerSig(sku, exp) {
  return crypto.createHmac('sha256', env('DOWNLOAD_SECRET', '')).update('offer|' + sku + '|' + exp).digest('hex').slice(0, 32);
}
// Тіло запиту від WayForPay може прийти як JSON, як форма або в base64 (Netlify)
function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  try { const j = JSON.parse(raw); if (j && typeof j === 'object') return j; } catch (e) {}
  const out = Object.fromEntries(new URLSearchParams(raw));
  const keys = Object.keys(out);
  if (keys.length === 1 && out[keys[0]] === '') { try { return JSON.parse(keys[0]); } catch (e) {} }
  return out;
}

function hmacMd5(str) {
  return crypto.createHmac('md5', env('WFP_SECRET_KEY', '')).update(str, 'utf8').digest('hex');
}
function token(orderRef, file) {
  return crypto.createHmac('sha256', env('DOWNLOAD_SECRET', '')).update(orderRef + '|' + file).digest('hex').slice(0, 32);
}
function skuFromOrder(orderRef) {
  // формат: YURKO_<sku>_<timestamp>_<rand>
  const parts = String(orderRef).split('_');
  return parts.length >= 4 ? parts.slice(1, -2).join('_') : null;
}

// Повертає true, лише якщо Telegram прийняв повідомлення.
async function telegram(text) {
  const tok = env('TG_BOT_TOKEN'), chat = env('TG_CHAT_ID');
  if (!tok || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true })
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok === true;
  } catch (e) { return false; }
}

async function checkPaid(orderRef) {
  const merchantAccount = env('WFP_MERCHANT');
  const body = {
    transactionType: 'CHECK_STATUS', merchantAccount, orderReference: orderRef,
    merchantSignature: hmacMd5([merchantAccount, orderRef].join(';')), apiVersion: 1
  };
  const r = await fetch('https://api.wayforpay.com/api', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  return { paid: j.transactionStatus === 'Approved', email: j.email, data: j };
}

function downloadLinks(orderRef) {
  const sku = skuFromOrder(orderRef);
  const p = resolveProduct(sku);
  if (!p) return [];
  const base = env('SITE_URL', '');
  return p.files.map(f => ({
    file: f,
    url: `${base}/.netlify/functions/download?o=${encodeURIComponent(orderRef)}&f=${encodeURIComponent(f)}&t=${token(orderRef, f)}`
  }));
}

async function sendEmail(to, subject, html) {
  const key = env('RESEND_API_KEY');
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: env('EMAIL_FROM', 'Юрко <noreply@example.com>'), to, subject, html })
  }).catch(() => {});
}

const json = (status, obj) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

module.exports = { PRODUCTS, BUNDLE_ITEMS, OFFER_MINUTES, bundlePrice, parseBundle, resolveProduct, offerSig, parseBody, env, hmacMd5, token, skuFromOrder, telegram, checkPaid, downloadLinks, sendEmail, json };
