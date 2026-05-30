// Список самописных эмодзи HEY. Используется в чате и в композере моментов.
// SVG лежит в /public/emoji/{name}.svg.
// Подсказки эмоций (title при hover / а11y) держим тут же, чтобы все экраны
// показывали одинаковую формулировку.

export const HEY_EMOJI = [
  'smiling','happy','winking','sad','angry','surprised',
  'wow','dead','discouraged','dissatisfied','chilly','silent',
  'suspicious','tricky smile','no comments','congrats','cute hearts','heart kiss',
  'cool','love','sleepy','nervous','starstruck','haha',
  'thumbs up', // 👍 «Класс»
];

export const HEY_EMOJI_SET = new Set(HEY_EMOJI);

// Подсказки по эмоциям (для title="…" при наведении).
// Ключи совпадают с именами SVG; не каждый эмодзи нуждается в переводе —
// для пропущенных берём само имя.
export const HEY_EMOJI_LABEL = {
  'smiling':         'Улыбка',
  'happy':           'Радость',
  'winking':         'Подмигиваю',
  'sad':             'Грустно',
  'angry':           'Злюсь',
  'surprised':       'Удивлён',
  'wow':             'Вау',
  'dead':            'Не могу',
  'discouraged':     'Расстроен',
  'dissatisfied':    'Недоволен',
  'chilly':          'Холодок',
  'silent':          'Без слов',
  'suspicious':      'Подозрительно',
  'tricky smile':    'Хитрая улыбка',
  'no comments':     'Без комментариев',
  'congrats':        'Поздравляю',
  'cute hearts':     'Сердечки',
  'heart kiss':      'Целую',
  'cool':            'Круто',
  'love':            'Люблю',
  'sleepy':          'Засыпаю',
  'nervous':         'Нервничаю',
  'starstruck':      'Восторг',
  'haha':            'Смешно',
  'thumbs up':       'Класс',
};

export function emojiLabel(name) {
  return HEY_EMOJI_LABEL[name] || name;
}
