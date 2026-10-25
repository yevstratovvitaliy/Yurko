// Заявка з квізу → повідомлення вам у Telegram.
const { telegram, json } = require('./_lib');

const STAGE = { nakaz: 'Судовий наказ', pozov: 'Позов', vymoga: 'Вимога постачальника', check: 'Перевірка заздалегідь' };
const SERVICE = { heat: 'Опалення/ГВП', water: 'Вода', gas: 'Газ/електроенергія', house: 'Управління/ОСББ/сміття' };

const VSTATUS = { mob: 'Мобілізований/резервіст', kontrakt_boy: 'Контракт, бойові', kontrakt_tyl: 'Контракт, тил', spouse: 'Подружжя військового', demob: 'Звільнений' };
const VTYPE = { mfo: 'МФО', bank: 'Банк', kolektor: 'Колектор/фінкомпанія', ipoteka: 'Іпотека/авто' };
const VSTAGE = { none: 'Дзвонять/пишуть', refused: 'Відмовили в пільзі', court: 'Позов у суді', dvs: 'Виконавче провадження' };
const uah = (n) => (Number(n) || 0).toLocaleString('uk-UA') + ' грн';

function vijskLines(name, contact, d, q, s, u) {
  return [
    '🪖 Заявка: кредити військовим',
    `👤 ${name} · ${contact}`,
    d.ref ? `🤝 Код від побратима: ${String(d.ref).slice(0, 30)}` : null,
    `Статус: ${VSTATUS[q.status] || '—'} · служба з ${q.since || '?'}`,
    `Кредитор: ${VTYPE[q.dtype] || '—'} · кредиторів: ${q.count || '?'} · стадія: ${VSTAGE[q.stage] || '—'}`,
    `Кредит ${q.loan || '?'}: отримав ${uah(q.body)}, сплатив ${uah(q.paid)}, вимагають ${uah(q.demand)}`,
    `Зайве: ${s.upTo ? 'до ' : '≈ '}${uah(s.excess)} · тіло лишилось ${uah(s.principalLeft)}${s.overpaid ? ' · переплата ' + uah(s.overpaid) : ''}`,
    d.note ? `💬 ${String(d.note).slice(0, 500)}` : null,
    Object.keys(u).length ? `📈 ${Object.entries(u).map(([k, v]) => k + '=' + v).join(' ')}` : null
  ].filter(Boolean);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad json' }); }
  const name = String(d.name || '').slice(0, 80).trim();
  const contact = String(d.contact || '').slice(0, 80).trim();
  if (!name || contact.length < 5) return json(400, { error: 'name/contact required' });

  const q = d.quiz || {}, s = d.summary || {}, u = d.utm || {};
  if (d.kind === 'vijsk') {
    await telegram(vijskLines(name, contact, d, q, s, u).join('\n'));
    return json(200, { ok: true });
  }
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
