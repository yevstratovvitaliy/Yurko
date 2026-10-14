// Віддає оплачений файл за підписаним посиланням.
const fs = require('fs');
const path = require('path');
const { PRODUCTS, token, skuFromOrder } = require('./_lib');

const TYPES = { '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf' };

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const { o, f, t } = q;
  const p = PRODUCTS[skuFromOrder(o)];
  if (!o || !f || !t || !p || !p.files.includes(f) || token(o, f) !== t) {
    return { statusCode: 403, body: 'Посилання недійсне' };
  }
  const file = path.join(__dirname, 'templates', path.basename(f));
  if (!fs.existsSync(file)) return { statusCode: 404, body: 'Файл ще не завантажено на сервер' };
  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${f}"`
    },
    body: fs.readFileSync(file).toString('base64')
  };
};
