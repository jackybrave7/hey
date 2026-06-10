// web/src/lib/phoneFormat.js
export function validatePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, msg: 'Слишком короткий номер' };
  if (digits.length > 15) return { ok: false, msg: 'Слишком длинный номер' };
  // 11 цифр с лидирующей «8» — это российский формат, конвертируем в +7.
  // В остальных случаях просто складываем «+» — поддерживаем международные
  // номера (E.164: 10–15 цифр).
  let normalized;
  if (digits.length === 11 && digits.startsWith('8')) {
    normalized = '+7' + digits.slice(1);
  } else {
    normalized = '+' + digits;
  }
  return { ok: true, normalized };
}

// Визуальное форматирование телефона: «+CC group group group».
// Алгоритм такой, что caret сохраняется при правке — onChange-обёртка
// считает «сколько цифр до курсора было» и после reformat ставит
// курсор после той же по счёту цифры.
//   • +1, +7 — country code 1 цифра (US/CA/RU/KZ).
//   • +20…+99 — 2 цифры по умолчанию.
//   • После CC — пробел и группы по 3 цифры.
// Максимум цифр в номере по country-code. Если CC неизвестен —
// fallback на 15 (предел E.164). Список покрывает самые ходовые
// направления, чтобы пользователь физически не мог напечатать
// «лишние» цифры.
const PHONE_MAX_BY_CC = {
  '1':  11,  // US / Canada
  '7':  11,  // RU / KZ
  '20': 12,  // EG
  '27': 11,  // ZA
  '30': 12,  // GR
  '31': 11,  // NL
  '32': 11,  // BE
  '33': 11,  // FR
  '34': 11,  // ES
  '36': 11,  // HU
  '39': 12,  // IT
  '40': 11,  // RO
  '41': 11,  // CH
  '43': 12,  // AT
  '44': 12,  // UK
  '45': 10,  // DK
  '46': 11,  // SE
  '47': 10,  // NO
  '48': 11,  // PL
  '49': 13,  // DE
  '51': 11,  // PE
  '52': 12,  // MX
  '53': 10,  // CU
  '54': 12,  // AR
  '55': 13,  // BR
  '56': 11,  // CL
  '57': 12,  // CO
  '58': 12,  // VE
  '60': 12,  // MY
  '61': 11,  // AU
  '62': 13,  // ID
  '63': 12,  // PH
  '64': 11,  // NZ
  '65': 10,  // SG
  '66': 11,  // TH
  '81': 12,  // JP
  '82': 12,  // KR
  '84': 12,  // VN
  '86': 13,  // CN
  '90': 12,  // TR
  '91': 12,  // IN
  '92': 12,  // PK
  '93': 11,  // AF
  '94': 11,  // LK
  '95': 11,  // MM
  '98': 12,  // IR
  '371': 11, // LV
  '372': 11, // EE
  '375': 12, // BY
  '380': 12, // UA
  '381': 12, // RS
  '420': 12, // CZ
  '421': 12, // SK
  '972': 12, // IL
  '994': 12, // AZ
  '995': 12, // GE
  '996': 12, // KG
  '998': 12, // UZ
};

function maxDigitsForCC(digits) {
  // Пытаемся подобрать самый длинный матч из 1/2/3 цифр.
  for (const len of [3, 2, 1]) {
    const cc = digits.slice(0, len);
    if (PHONE_MAX_BY_CC[cc]) return PHONE_MAX_BY_CC[cc];
  }
  return 15;
}

export function formatPhoneInput(val) {
  // Оставляем только цифры (и ведущий +). Лимит — по стране, дефолт 15
  // (E.164). +7 / +1 → 11 цифр; +49 → 13 и т.д. — список выше.
  const hasLeadPlus = (val || '').trimStart().startsWith('+');
  let digits = (val || '').replace(/\D/g, '');
  if (digits.length) {
    const cap = maxDigitsForCC(digits);
    digits = digits.slice(0, cap);
  } else {
    digits = digits.slice(0, 15);
  }
  if (!digits) return hasLeadPlus ? '+' : '';
  const first = digits[0];
  const ccLen = (first === '1' || first === '7') ? 1 : Math.min(2, digits.length);
  const cc   = digits.slice(0, ccLen);
  const rest = digits.slice(ccLen);
  // Группировка: последние 4 цифры разбиваем 2+2, остальное — тройками с начала.
  // Пример +7 999 111 11 11 вместо +7 999 111 111 1.
  const groups = [];
  if (rest.length <= 4) {
    if (rest.length > 0) groups.push(rest);
  } else {
    const head = rest.slice(0, rest.length - 4);
    const tail = rest.slice(-4);
    for (let i = 0; i < head.length; i += 3) groups.push(head.slice(i, i + 3));
    groups.push(tail.slice(0, 2), tail.slice(2, 4));
  }
  return '+' + cc + (groups.length ? ' ' + groups.join(' ') : '');
}

// Утилита для caret-preserving onChange: считает позицию N-й цифры
// в форматированной строке (вернёт позицию ПОСЛЕ этой цифры).
export function caretAfterNthDigit(str, n) {
  let pos = 0, d = 0;
  while (pos < str.length && d < n) {
    if (/\d/.test(str[pos])) d++;
    pos++;
  }
  return pos;
}
