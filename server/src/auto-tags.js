// server/src/auto-tags.js
// Автоматическое определение тегов по тексту и типу медиа

function detectTags(text, mediaType, hasEmbeddedVideo = false) {
  const tags = [];
  const t = (text || '').toLowerCase();

  if (/спектакл|премьер|театр|сцен|режиссёр|режиссер|пьес|постановк/.test(t))
    tags.push('🎭 Театр');
  if (/картин|холст|масл|акварел|рисую|пишу карти|живопис|акрил/.test(t))
    tags.push('🎨 Живопись');
  if (/график|иллюстраци|скетч|карандаш/.test(t))
    tags.push('✏️ Графика');
  if (/трек|альбом|музык|записал|записываю|студи|саундтрек|композици|ep |мелоди/.test(t) || mediaType === 'audio')
    tags.push('🎵 Музыка');
  if (/съёмк|съемк|снимаю|снимаем|кино|фильм|короткий метр|видеоклип/.test(t) || mediaType === 'video' || hasEmbeddedVideo)
    tags.push('🎬 Видео');
  if (/фотограф|фотосессия|снял|снимаю фото|кадр/.test(t))
    tags.push('📷 Фото');
  if (/стих|роман|поэм|рассказ|написал текст|новелл/.test(t))
    tags.push('✍️ Текст');
  if (/настроени|пауз|жду вдохновени|перерыв|задумался|между проектами/.test(t))
    tags.push('🌧 Настроение');
  if (/ищу|поиск|ищем|нужен|нужна|сотрудни|коллабор|партнёр|партнер/.test(t))
    tags.push('🤝 Поиск');

  return tags;
}

// Выбор emoji-персонажа для карточек без медиа
function detectMoodEmoji(text, isSearch) {
  if (isSearch) return 'starstruck';
  const t = (text || '').toLowerCase();
  if (/жду вдохновени|пауз|перерыв|задумался|устал/.test(t)) return 'sleepy';
  if (/ищу|поиск|нужен/.test(t)) return 'starstruck';
  if (/влюбл|мечтаю|вдохновени/.test(t)) return 'dreamy';
  if (/спокойн|тихо|просто/.test(t)) return 'calm';
  if (/рад|здорово|отлично|горю|запускаю|выпустил/.test(t)) return 'excited';
  // Fallback by tag
  return 'calm';
}

module.exports = { detectTags, detectMoodEmoji };
