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
  const p = PRODUCTS[sku];
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

module.exports = { PRODUCTS, env, hmacMd5, token, skuFromOrder, telegram, checkPaid, downloadLinks, sendEmail, json };
