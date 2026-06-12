// Список самописных эмодзи HEY. Используется в чате и в композере моментов.
// SVG лежит в /public/emoji/{name}.svg.
// Подсказки эмоций (title при hover / а11y) держим тут же, чтобы все экраны
// показывали одинаковую формулировку.

export const HEY_EMOJI = [
  'cool', 'ok', 'handshake', 'heart', 'fire',
  'smiling', 'sad',
  'LOL', 'laughing',
  'happy', 'winking',
  'crying', 'angry', 'discouraged', 'dissatisfied',
  'surprised', 'wow', 'dead', 'silent', 'no comments', 'chilly',
  'suspicious', 'tricky smile', 'misunderstood',
  'cute hearts', 'heart kiss', 'broken heart',
];

// Старые имена в уже отправленных сообщениях — рендерим, но не показываем в пикере.
export const HEY_EMOJI_LEGACY = [
  'thumbs up', 'ok hand', 'love', 'haha', 'congrats',
  'sleepy', 'nervous', 'starstruck',
];

/** Файл SVG для имени (переименования в новом наборе) */
export const HEY_EMOJI_FILE_ALIASES = {
  'ok hand': 'ok',
  'love': 'heart',
  'haha': 'laughing',
};

export const HEY_EMOJI_ALL = [...HEY_EMOJI, ...HEY_EMOJI_LEGACY];
export const HEY_EMOJI_SET = new Set(
  HEY_EMOJI_ALL.map(n => n.toLowerCase()),
);

export const HEY_EMOJI_TOKEN_RE = new RegExp(
  '\\[(' + HEY_EMOJI_ALL.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\]',
  'gi',
);

export function resolveEmojiName(raw) {
  const lower = String(raw || '').toLowerCase();
  return HEY_EMOJI_ALL.find(n => n.toLowerCase() === lower) || null;
}

export function isHeyEmoji(name) {
  return HEY_EMOJI_SET.has(String(name || '').toLowerCase());
}

export function emojiFileName(name) {
  const resolved = resolveEmojiName(name) || name;
  return HEY_EMOJI_FILE_ALIASES[resolved] || resolved;
}

// Подсказки по эмоциям (для title="…" при наведении).
export const HEY_EMOJI_LABEL = {
  'ok':              'Ок',
  'heart':           'Люблю',
  'LOL':             'LOL',
  'laughing':        'Смешно',
  'crying':          'Плачу',
  'misunderstood':   'Не понял',
  'broken heart':    'Разбитое сердце',
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
  'cute hearts':     'Сердечки',
  'heart kiss':      'Целую',
  'cool':            'Круто',
  'thumbs up':       'Во!',
  'handshake':       'Рукопожатие',
  'fire':            'Огонь',
  'ok hand':         'Ок',
  'love':            'Люблю',
  'haha':            'Смешно',
  'congrats':        'Поздравляю',
  'sleepy':          'Засыпаю',
  'nervous':         'Нервничаю',
  'starstruck':      'Восторг',
};

export function emojiLabel(name) {
  const resolved = resolveEmojiName(name) || name;
  return HEY_EMOJI_LABEL[resolved] || resolved;
}

// Версия SVG-набора. Дописывается к URL'ам как ?v=N — клиенты
// насильно перетянут эмодзи когда мы редактируем SVG в /public/emoji.
export const HEY_EMOJI_VERSION = '12';

export function emojiUrl(name) {
  const file = emojiFileName(name);
  return `/emoji/${encodeURIComponent(file)}.svg?v=${HEY_EMOJI_VERSION}`;
}
