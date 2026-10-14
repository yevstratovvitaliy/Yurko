// Заявка з квізу → повідомлення вам у Telegram.
const { telegram, json } = require('./_lib');

const STAGE = { nakaz: 'Судовий наказ', pozov: 'Позов', vymoga: 'Вимога постачальника', check: 'Перевірка заздалегідь' };
const SERVICE = { heat: 'Опалення/ГВП', water: 'Вода', gas: 'Газ/електроенергія', house: 'Управління/ОСББ/сміття' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad json' }); }
  const name = String(d.name || '').slice(0, 80).trim();
  const contact = String(d.contact || '').slice(0, 80).trim();
  if (!name || contact.length < 5) return json(400, { error: 'name/contact required' });

  const q = d.quiz || {}, s = d.summary || {}, u = d.utm || {};
  const lines = [
    '🆕 Заявка з сайту Юрко',
    `👤 ${name} · ${contact}`,
    `Ситуація: ${STAGE[q.stage] || '—'} · ${SERVICE[q.service] || '—'}`,
    `Період: ${q.from || '?'} – ${q.to || '?'}`,
    s.nakaz ? `Наказ: строк до ${s.nakaz.deadline} (${s.nakaz.missed ? 'МИНУВ' : 'лишилось ' + s.nakaz.daysLeft + ' дн.'})` : null,
    `Поза давністю: ${s.expired || 0} міс. · Пеня у воєнний стан: ${s.warPenalty ? 'так' : 'ні'}`,
    `Визнавав борг: ${q.acknowledged || '—'}`,
    d.note ? `💬 ${String(d.note).slice(0, 500)}` : null,
    Object.keys(u).length ? `📈 ${Object.entries(u).map(([k, v]) => k + '=' + v).join(' ')}` : null
  ].filter(Boolean);

  await telegram(lines.join('\n'));
  return json(200, { ok: true });
};
