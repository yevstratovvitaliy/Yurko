/* Юрко · розрахунок позовної давності та строків по комунальних боргах
 *
 * Правова модель (станом на жовтень 2026):
 *  - Загальна позовна давність 3 роки (ст. 257 ЦК).
 *  - З 02.04.2020 по 03.09.2025 включно перебіг давності фактично не відбувався:
 *    спершу «карантинне» продовження (п. 12 ПП ЦК), далі «воєнне» зупинення (п. 19 ПП ЦК).
 *  - З 04.09.2025 (Закон № 4434-IX) перебіг продовжується з урахуванням часу,
 *    що минув до зупинення (ч. 3 ст. 263 ЦК).
 *  - Борг, прострочений у період паузи, починає рахуватися з 04.09.2025.
 *  - Строк на заяву про скасування судового наказу — 15 днів з дня вручення копії (ст. 170 ЦПК).
 *  - З 24.02.2022 до припинення воєнного стану заборонено нараховувати населенню пеню,
 *    штрафи, інфляційні та 3% річних на борг за ЖКП.
 *
 * Модуль не залежить від DOM: працює і в браузері, і в Node (для тестів).
 */
(function (root) {
  'use strict';

  var PAUSE_START = d(2020, 4, 2);   // перший день, коли давність перестала спливати
  var RESUME      = d(2025, 9, 4);   // перший день, коли давність пішла знову
  var WAR_START   = d(2022, 2, 24);  // заборона пені/інфляційних/3% річних
  var PAY_DAY     = 20;              // типовий строк оплати: до 20 числа наступного місяця

  function d(y, m, day) { return new Date(Date.UTC(y, m - 1, day)); }
  function addDays(date, n) { return new Date(date.getTime() + n * 86400000); }
  function addYears(date, n) {
    var r = new Date(date.getTime());
    r.setUTCFullYear(r.getUTCFullYear() + n);
    // 29 лютого → 28 лютого
    if (r.getUTCDate() !== date.getUTCDate()) r.setUTCDate(0);
    return r;
  }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function fmt(date) {
    var dd = String(date.getUTCDate()).padStart(2, '0');
    var mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return dd + '.' + mm + '.' + date.getUTCFullYear();
  }
  var MONTHS = ['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'];
  function monthLabel(y, m) { return MONTHS[m - 1] + ' ' + y; }

  var PAUSE_LEN = daysBetween(PAUSE_START, RESUME); // днів паузи

  /* Перший день прострочення за розрахунковий місяць (y, m) */
  function breachDate(y, m) {
    var due = d(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, PAY_DAY);
    return addDays(due, 1);
  }

  /* Останній день позовної давності для вимоги, прострочення якої почалось у день B */
  function lastDay(B) {
    var plain = addDays(addYears(B, 3), -1);
    if (B < PAUSE_START) return addDays(plain, PAUSE_LEN);
    if (B < RESUME) return addDays(addYears(RESUME, 3), -1);
    return plain;
  }

  /*
   * input: {
   *   from: {y, m}, to: {y, m},         // період боргу (розрахункові місяці)
   *   checkDate: Date,                  // дата, на яку перевіряємо (подання заяви кредитором або сьогодні)
   *   stage: 'nakaz'|'pozov'|'vymoga'|'check',
   *   nakazReceived: Date|null,         // коли вручили копію судового наказу
   *   acknowledged: 'yes'|'no'|'unknown', // чи визнавали борг письмово / реструктуризація
   *   penalties: 'yes'|'no'|'unknown',  // чи є пеня, інфляційні, 3% річних
   *   today: Date
   * }
   */
  function analyze(input) {
    var today = input.today || new Date();
    var check = input.checkDate || today;
    var months = [];
    var y = input.from.y, m = input.from.m;
    var guard = 0;
    while ((y < input.to.y || (y === input.to.y && m <= input.to.m)) && guard++ < 600) {
      var B = breachDate(y, m);
      var last = lastDay(B);
      months.push({
        y: y, m: m, label: monthLabel(y, m),
        breach: B, last: last,
        expired: check > last,
        notYetDue: B > today,
        inWar: B >= WAR_START
      });
      m++; if (m > 12) { m = 1; y++; }
    }

    var expired = months.filter(function (x) { return x.expired && !x.notYetDue; });
    var live = months.filter(function (x) { return !x.expired && !x.notYetDue; });

    // найближча дата, коли наступний місяць «вийде» за давність
    var nextToExpire = live.length ? live.reduce(function (a, b) { return a.last < b.last ? a : b; }) : null;

    var res = {
      months: months,
      expiredCount: expired.length,
      liveCount: live.length,
      expiredRange: expired.length ? [expired[0].label, expired[expired.length - 1].label] : null,
      nextToExpire: nextToExpire ? { label: nextToExpire.label, date: fmt(addDays(nextToExpire.last, 1)) } : null,
      acknowledgedRisk: input.acknowledged !== 'no',
      warPenalty: input.penalties !== 'no' && months.some(function (x) { return x.inWar; }),
      nakaz: null,
      flags: []
    };

    if (input.stage === 'nakaz' && input.nakazReceived) {
      var deadline = addDays(input.nakazReceived, 15);
      var left = daysBetween(today, deadline);
      res.nakaz = {
        deadline: fmt(deadline),
        daysLeft: left,
        missed: left < 0
      };
    }

    if (res.expiredCount > 0 && res.acknowledgedRisk) {
      res.flags.push('Письмове визнання боргу або реструктуризація перериває давність (ст. 264 ЦК). Документи треба переглянути, перш ніж посилатися на давність.');
    }
    if (res.expiredCount > 0) {
      res.flags.push('Суд застосовує давність лише за заявою боржника (ст. 267 ЦК). Без вашої заяви борг стягнуть повністю.');
    }
    return res;
  }

  var api = {
    analyze: analyze, breachDate: breachDate, lastDay: lastDay, fmt: fmt,
    PAUSE_START: PAUSE_START, RESUME: RESUME, WAR_START: WAR_START
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Davnist = api;
})(this);
