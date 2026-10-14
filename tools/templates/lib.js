// Спільні будівельні блоки для шаблонів Юрка (docx-js)
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle
} = require('docx');

const FONT = 'Times New Roman';
const SIZE = 28;       // 14 pt
const HINT_SIZE = 22;  // 11 pt
const HINT_COLOR = '1F4E9C';
const BLANK = '____________________';

// Сегменти рядка:
//   'текст'            звичайний текст
//   { b: 'текст' }     жирний
//   { f: 'пояснення' } поле для заповнення: лінія + (пояснення курсивом)
//   { h: 'пояснення' } лише пояснення курсивом у дужках
//   { fs: 'пояснення', w: 10 } коротке поле
function runs(parts) {
  const out = [];
  [].concat(parts).forEach(p => {
    if (typeof p === 'string') out.push(new TextRun({ text: p }));
    else if (p.b) out.push(new TextRun({ text: p.b, bold: true }));
    else if (p.f !== undefined || p.fs !== undefined) {
      const hint = p.f !== undefined ? p.f : p.fs;
      out.push(new TextRun({ text: p.fs !== undefined ? '_'.repeat(p.w || 10) : BLANK }));
      if (hint) out.push(new TextRun({ text: ' (' + hint + ')', italics: true, color: HINT_COLOR, size: HINT_SIZE }));
    } else if (p.h) out.push(new TextRun({ text: '(' + p.h + ')', italics: true, color: HINT_COLOR, size: HINT_SIZE }));
  });
  return out;
}

const P = (parts, o = {}) => new Paragraph({
  children: runs(parts),
  alignment: o.align || AlignmentType.JUSTIFIED,
  indent: o.noIndent ? undefined : { firstLine: o.firstLine === undefined ? 709 : o.firstLine },
  spacing: { after: o.after === undefined ? 120 : o.after, before: o.before || 0, line: 276 },
  numbering: o.num ? { reference: o.num, level: 0 } : undefined,
  keepNext: o.keepNext
});

// Блок «шапки» праворуч
const H = (parts, o = {}) => new Paragraph({
  children: runs(parts),
  indent: { left: 4536 },
  spacing: { after: o.after === undefined ? 40 : o.after, line: 252 }
});

const TITLE = (text, sub) => [
  new Paragraph({ children: [new TextRun({ text, bold: true, size: 30 })], alignment: AlignmentType.CENTER, spacing: { before: 360, after: sub ? 40 : 240 } }),
  ...(sub ? [new Paragraph({ children: [new TextRun({ text: sub, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } })] : [])
];

const SUB = (text) => new Paragraph({ children: [new TextRun({ text, bold: true })], spacing: { before: 200, after: 120 }, keepNext: true });

const NOTE = (text) => new Paragraph({
  children: [new TextRun({ text, italics: true, color: HINT_COLOR, size: HINT_SIZE })],
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: HINT_COLOR, space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: HINT_COLOR, space: 4 } },
  spacing: { after: 240 }
});

const SIGN = () => [
  new Paragraph({ children: [], spacing: { after: 240 } }),
  new Paragraph({
    children: runs([{ fs: 'дата подання', w: 12 }, '          ', { fs: 'підпис', w: 12 }, '          ', { fs: 'ваше прізвище та ініціали', w: 18 }]),
    spacing: { before: 240 }
  })
];

const numbering = {
  config: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map(ref => ({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 709, hanging: 360 } } } }]
  })).concat([{
    reference: 'bul',
    levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 709, hanging: 360 } } } }]
  }])
};

const FIRST_NOTE = 'Як користуватися шаблоном: на місці ліній ____ впишіть свої дані. Пояснення курсивом у дужках (синім) підказують, що саме вписати і де це знайти. Перед поданням видаліть усі пояснення разом із дужками і цей абзац. Пункти, які не стосуються вашої ситуації, теж видаліть.';

async function save(file, children) {
  const doc = new Document({
    creator: 'Юрко',
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    numbering,
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
      children
    }]
  });
  fs.writeFileSync(file, await Packer.toBuffer(doc));
}

// Стандартна шапка для заяв у суд
function courtHeader(o) {
  const out = [
    H([{ b: 'До ' }, { f: 'повна назва суду, який видав наказ або розглядає справу. Вона є у верхній частині наказу чи ухвали, наприклад: Дарницький районний суд міста Києва' }]),
    H(['Адреса суду: ', { f: 'є на сайті суду або в ухвалі' }], { after: 160 }),
    H([{ b: o.meRole + ': ' }, { f: 'прізвище, імʼя, по батькові повністю' }]),
    H(['РНОКПП: ', { fs: 'ідентифікаційний код, 10 цифр', w: 12 }]),
    H(['адреса: ', { f: 'зареєстроване місце проживання, як у паспорті або витягу з реєстру' }]),
    H(['тел.: ', { fs: '', w: 14 }, ', e-mail: ', { fs: 'якщо є', w: 14 }]),
    H(['Електронний кабінет в ЄСІТС: ', { fs: 'є або немає', w: 6 }], { after: 160 }),
    H([{ b: o.otherRole + ': ' }, { f: 'повна назва постачальника, як у наказі чи позові, наприклад: КП «Київтеплоенерго»' }]),
    H(['код ЄДРПОУ: ', { fs: 'є в наказі чи позові', w: 10 }]),
    H(['адреса: ', { f: 'з наказу чи позову' }], { after: 160 })
  ];
  if (o.caseNo !== false) out.push(H([{ b: 'Справа № ' }, { fs: 'номер з наказу чи ухвали, вигляду 753/12345/26', w: 14 }], { after: 0 }));
  return out;
}

module.exports = { P, H, TITLE, SUB, NOTE, SIGN, save, courtHeader, FIRST_NOTE, AlignmentType };
