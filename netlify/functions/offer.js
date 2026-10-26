// Фіксує ціну персонального набору на OFFER_MINUTES хвилин і підписує її.
// Таймер на сайті показує реальний строк: після нього pay.js відмовить у ціні набору.
const { PRODUCTS, BUNDLE_ITEMS, OFFER_MINUTES, bundlePrice, parseBundle, offerSig, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) {}
  const items = parseBundle('b-' + [].concat(d.items || []).join('.'));
  if (!items) return json(400, { error: 'bad items' });
  const sku = 'b-' + items.join('.');
  const { sum, price } = bundlePrice(items);
  const exp = Date.now() + OFFER_MINUTES * 60 * 1000;
  return json(200, {
    sku, sum, price, exp, sig: offerSig(sku, exp),
    items: items.map(k => ({ key: k, name: PRODUCTS[BUNDLE_ITEMS[k]].name, price: PRODUCTS[BUNDLE_ITEMS[k]].price }))
  });
};
