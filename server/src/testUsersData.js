// Генератор тестовых пользователей для админ-режима тестирования.
// Имена, профессии, био, аватары + разнообразные моменты:
// тексты с разными настроениями, фото, видео и аудио.

const FEMALE_NAMES_RU = [
  'Анна', 'Елена', 'Мария', 'Ольга', 'Татьяна', 'Светлана', 'Наталья',
  'Юлия', 'Ирина', 'Екатерина', 'Дарья', 'Алина', 'Полина', 'Виктория',
  'Анастасия', 'Ксения', 'Маргарита', 'София', 'Алиса', 'Вера',
];
const MALE_NAMES_RU = [
  'Александр', 'Дмитрий', 'Сергей', 'Андрей', 'Иван', 'Михаил', 'Николай',
  'Владимир', 'Антон', 'Артём', 'Павел', 'Денис', 'Максим', 'Кирилл',
  'Григорий', 'Илья', 'Тимур', 'Роман', 'Олег', 'Степан',
];
const SURNAMES_RU = [
  'Иванов', 'Петров', 'Смирнов', 'Кузнецов', 'Соколов', 'Попов',
  'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Петрова', 'Иванова',
  'Соколова', 'Михайлова', 'Фёдорова', 'Орлова', 'Романова', 'Волкова',
  'Алексеева', 'Лебедева',
];
const FEMALE_NAMES_EN = [
  'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte',
  'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Marie', 'Hannah',
  'Lena', 'Greta', 'Yuki', 'Aiko',
];
const MALE_NAMES_EN = [
  'Liam', 'Noah', 'Ethan', 'Lucas', 'Mason', 'Logan', 'James',
  'Benjamin', 'Daniel', 'Hugo', 'Hans', 'Felix', 'Marco', 'Hiro',
  'Kenji', 'Akira',
];
const SURNAMES_EN = [
  'Johnson', 'Williams', 'Brown', 'Davis', 'Wilson', 'Anderson',
  'Taylor', 'Martin', 'Schmidt', 'Müller', 'Rossi', 'Tanaka',
  'Yamamoto', 'Garcia', 'Bauer', 'Klein',
];

// Темы/профессии — определяют bio и тематику постов
const THEMES = [
  { key:'artist',      profession:'художник', bioTemplates:[
    'Художник. Работаю с маслом и пастелью. Студия в центре города.',
    'Современная живопись, абстракция. Открыт к коллаборациям.',
    'Иллюстратор детских книг. Люблю акварель и кофе.',
  ]},
  { key:'musician',    profession:'музыкант', bioTemplates:[
    'Гитарист, играю в инди-группе. Концерты по выходным.',
    'Композитор и саунд-дизайнер. Делаю музыку для кино.',
    'Скрипачка симфонического оркестра. Преподаю детям.',
  ]},
  { key:'filmmaker',   profession:'режиссёр', bioTemplates:[
    'Режиссёр короткометражек. Снимаю про маленьких людей в большом городе.',
    'Документалист, путешествую с камерой по бывшему СССР.',
    'Видеограф свадеб и портретов. Свет — моя страсть.',
  ]},
  { key:'actor',       profession:'актёр', bioTemplates:[
    'Актриса театра. Играю классику и современную драму.',
    'Театральный артист, антрепризы и сериалы.',
    'Студент актёрского факультета. Ищу свой почерк.',
  ]},
  { key:'poet',        profession:'поэт', bioTemplates:[
    'Пишу стихи и тексты для песен. Каждую неделю — новое.',
    'Поэт и переводчик. Люблю молчать о важном.',
    'Куратор поэтических вечеров в маленьком кафе.',
  ]},
  { key:'photographer',profession:'фотограф', bioTemplates:[
    'Фотограф улиц и людей. Чёрно-белое — мой язык.',
    'Свадебная и семейная съёмка. Без позирования.',
    'Travel-фотограф. В этом году снимала на Камчатке.',
  ]},
  { key:'dancer',      profession:'танцор', bioTemplates:[
    'Танцовщик современного балета. Премьеры в этом сезоне.',
    'Преподаватель сальсы и бачаты. Группы для взрослых.',
    'Контемп и импровизация. Перформансы в галереях.',
  ]},
  { key:'writer',      profession:'писатель', bioTemplates:[
    'Пишу рассказы и эссе. Первая книга выйдет осенью.',
    'Сценарист телесериалов. Люблю кошек и сложные диалоги.',
    'Колумнист онлайн-журнала о городской жизни.',
  ]},
  { key:'sculptor',    profession:'скульптор', bioTemplates:[
    'Скульптор. Работаю с камнем и металлом, реже — с глиной.',
    'Делаю керамику ручной лепки. Маленькие тиражи.',
  ]},
  { key:'designer',    profession:'дизайнер', bioTemplates:[
    'Графический дизайнер. Айдентика, плакаты, типографика.',
    'UX/UI-дизайнер мобильных приложений. Чёрный цвет и сетки.',
    'Иллюстрация и motion-дизайн. Делаю гифки и микро-анимации.',
  ]},
];

// Аватары: randomuser.me — реальные портретные фото
function avatarForIndex(idx, gender) {
  const n = idx % 100;
  const g = gender === 'female' ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${g}/${n}.jpg`;
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

// Допустимые ключи настроения (см. web/src/components/moments/MoodEmoji.jsx)
const MOODS = ['sleepy', 'starstruck', 'dreamy', 'calm', 'excited'];

// Аудио-пул: открытые сэмплы SoundHelix
const AUDIO_POOL = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
];

// Видео-пул: сэмплы из публичного бакета Google
const VIDEO_POOL = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
];

// Картинки: используем Picsum с фиксированными ID (вместо seed, который иногда
// рейт-лимитится). Picsum имеет ~1000 курированных фото; каждый id всегда
// возвращает одну и ту же картинку. Подобраны живые ID с разными цветами/композициями.
// Изначально картинки шли напрямую с picsum.photos, но Yandex.Browser и
// другие приватные браузеры блокируют сторонние CDN. Скачиваем картинки
// на сервер скриптом server/scripts/download-test-images.js и отдаём как
// локальную статику /test-images/{id}.jpg — никаких блокировок.
const PICSUM = (id) => `/api/test-images/${id}.jpg`;

// Курированные picsum ID — разные пейзажи, объекты, портреты, абстракции.
// Распределены по темам ради смысла, но любой ID гарантированно рендерится.
const IMAGE_POOLS = {
  artist:       [102, 103, 145, 167, 175, 250, 367],
  musician:     [145, 250, 277, 326, 428, 549, 626],
  filmmaker:    [1015, 1018, 1019, 1036, 1043, 1058],
  actor:        [177, 219, 338, 433, 491, 627, 823],
  poet:         [24, 365, 411, 459, 466, 538, 590],
  photographer: [29, 110, 122, 152, 200, 218, 1015],
  dancer:       [177, 219, 338, 1003, 1012, 1027, 1074],
  writer:       [24, 365, 459, 538, 590, 866, 916],
  sculptor:     [177, 219, 250, 326, 367, 472, 663],
  designer:     [180, 250, 367, 428, 549, 626, 866],
};
const IMAGE_POOL_UNIVERSAL = [100, 200, 300, 400, 500, 600, 700, 800, 900];

// Детерминированный выбор картинки из тематического пула по seed-строке.
function pickImage(theme, seed) {
  const pool = IMAGE_POOLS[theme] || IMAGE_POOL_UNIVERSAL;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % pool.length;
  return PICSUM(pool[idx]);
}

// Тематические подборки моментов по профессии: текст + опц. медиа + mood
// type: 'image' | 'video' | 'audio' | undefined (text-only)
const MOMENTS_BY_THEME = {
  artist: [
    { text:'Сегодня впервые попробовал работать с акрилом — пугает и завораживает одновременно.', mood:'starstruck', type:'image', seed:'paint-acrylic-1' },
    { text:'Незаконченный холст ждёт меня с утра. Может, сегодня услышу его.', mood:'dreamy', type:'image', seed:'canvas-studio-2' },
    { text:'Маленькая выставка в крошечной галерее. Если вы рядом — заходите.', mood:'excited' },
    { text:'Утренний кофе и тишина студии — лучшее начало дня.', mood:'calm', type:'image', seed:'coffee-studio-3' },
    { text:'Заказал у мастера новые кисти. Это как новая ручка перед сочинением.', mood:'starstruck' },
    { text:'Поработала над цветом. Кажется, наконец-то поняла, что хочу сказать.', mood:'calm', type:'image', seed:'colors-palette-4' },
  ],
  musician: [
    { text:'Демо новой песни. Сырое, но мне дорого.', mood:'excited', type:'audio', audio: AUDIO_POOL[0] },
    { text:'Концерт в субботу. Если вы в городе — приходите, будет душевно.', mood:'excited', type:'image', seed:'concert-stage-5' },
    { text:'Записал гитарную партию с одного дубля. Бывает же.', mood:'starstruck', type:'audio', audio: AUDIO_POOL[1] },
    { text:'Закончил композицию для короткометражки. Три месяца, четыре переписывания. Стоило того.', mood:'dreamy', type:'audio', audio: AUDIO_POOL[2] },
    { text:'Репетиция в полупустом зале — особое настроение.', mood:'calm', type:'image', seed:'rehearsal-room-6' },
    { text:'Когда нашёл аккорд, который ждал — мир ненадолго замирает.', mood:'starstruck' },
    { text:'Эскиз новой темы — пока только пианино.', mood:'dreamy', type:'audio', audio: AUDIO_POOL[3] },
  ],
  filmmaker: [
    { text:'Сегодня снимали закат над морем. Камера села быстрее меня.', mood:'excited', type:'image', seed:'sunset-sea-7' },
    { text:'Первый монтаж готов. Завтра буду переделывать всё.', mood:'sleepy', type:'video', video: VIDEO_POOL[0] },
    { text:'Найден нужный кадр. Не зря неделю ловили этот свет.', mood:'starstruck', type:'image', seed:'film-light-8' },
    { text:'Нашёл в архиве кадры 2018 года. Какой я был наивный — и как же это было искренне.', mood:'dreamy', type:'video', video: VIDEO_POOL[1] },
    { text:'Документалистика — это про умение ждать. Сегодня просто сидел и смотрел.', mood:'calm' },
    { text:'Сцена с дождём вышла лучше, чем я надеялся.', mood:'starstruck', type:'video', video: VIDEO_POOL[2] },
  ],
  actor: [
    { text:'Готовлюсь к премьере. Текст уже в голове, осталось научиться чувствовать сцену под ногами.', mood:'excited' },
    { text:'Сегодня роль легла. Бывает раз в полгода.', mood:'starstruck', type:'image', seed:'theater-stage-9' },
    { text:'После репетиции — тишина гримёрки и горячий чай.', mood:'calm', type:'image', seed:'dressing-room-10' },
    { text:'Учу монолог в метро. Соседи смотрят странно, но мне всё равно.', mood:'excited' },
    { text:'Премьера прошла. Зал тёплый, ноги ватные.', mood:'dreamy', type:'image', seed:'curtain-applause-11' },
    { text:'Сегодня поняла, чего хочет персонаж. Это было неожиданно.', mood:'starstruck' },
  ],
  poet: [
    { text:'Сегодня услышал такой смех в маршрутке, что захотелось всё перечеркнуть и начать писать заново.', mood:'dreamy' },
    { text:'Новый стих — пока только две строчки, но они правильные.', mood:'starstruck', type:'image', seed:'notebook-pen-12' },
    { text:'Поэтический вечер в четверг. Маленькое кафе, тёплый свет, шесть голосов.', mood:'excited', type:'image', seed:'cafe-evening-13' },
    { text:'Перевожу с польского. Каждое слово — переговоры.', mood:'calm' },
    { text:'Утро. Тетрадь. Кофе остыл, а стих — нашёлся.', mood:'dreamy', type:'image', seed:'morning-tea-14' },
    { text:'Читаю вслух — сразу слышно, где соврал.', mood:'starstruck' },
  ],
  photographer: [
    { text:'Поймал момент, ради которого ходил по улице три часа.', mood:'starstruck', type:'image', seed:'street-bw-15' },
    { text:'Чёрно-белая плёнка из прошлой поездки. Каждый кадр — другой ветер.', mood:'dreamy', type:'image', seed:'film-bw-16' },
    { text:'Свадьба в дождь оказалась честнее всех солнечных съёмок.', mood:'excited', type:'image', seed:'wedding-rain-17' },
    { text:'Камчатка отдала кадр. Не сразу, но отдала.', mood:'starstruck', type:'image', seed:'kamchatka-landscape-18' },
    { text:'Сегодня снимала бабушку соседку. Получились самые честные портреты в этом году.', mood:'calm', type:'image', seed:'portrait-grandma-19' },
    { text:'Купил новый объектив. Кажется, увижу мир иначе.', mood:'excited' },
  ],
  dancer: [
    { text:'Прорепетировали финальную сцену. Ноги не чувствую, но улыбка не сходит.', mood:'excited', type:'video', video: VIDEO_POOL[3] },
    { text:'Импровизация в галерее — публика подключается, и ты уже не один.', mood:'starstruck', type:'image', seed:'dance-gallery-20' },
    { text:'Учу новую связку. Тело пока сопротивляется.', mood:'sleepy' },
    { text:'Сальса по средам — приходи, если хочешь почувствовать пятницу в среду.', mood:'excited', type:'image', seed:'salsa-night-21' },
    { text:'Премьера через неделю. Сон стал привилегией.', mood:'sleepy', type:'video', video: VIDEO_POOL[4] },
    { text:'Контемп — это разговор без слов. И сегодня было о чём.', mood:'dreamy' },
  ],
  writer: [
    { text:'Сижу над сценарием, и каждый раз чувство, что главная сцена ещё не написана.', mood:'sleepy' },
    { text:'Первый черновик допилен. Завтра — резать половину.', mood:'calm', type:'image', seed:'manuscript-desk-22' },
    { text:'Рассказ принят в журнал. Маленький, но мой.', mood:'starstruck' },
    { text:'Прочитал три книги за неделю. Кажется, я снова в форме.', mood:'excited', type:'image', seed:'books-stack-23' },
    { text:'Кот лёг на клавиатуру — наверное, знает, что я переписываю эту главу пятый раз.', mood:'sleepy', type:'image', seed:'cat-keyboard-24' },
    { text:'Колонка вышла. Перечитал и не возненавидел — это уже победа.', mood:'calm' },
  ],
  sculptor: [
    { text:'Заканчиваю крупную работу. Камень упрям, но я упрямее.', mood:'excited', type:'image', seed:'sculpture-stone-25' },
    { text:'Керамика из печи. Половина треснула, половина живёт.', mood:'calm', type:'image', seed:'ceramics-kiln-26' },
    { text:'Новая серия чаш. Маленькие, неровные, любимые.', mood:'dreamy', type:'image', seed:'pottery-bowls-27' },
    { text:'Сегодня впервые работала с бронзой. Это другой язык.', mood:'starstruck' },
    { text:'Мастерская засыпана пылью. И это лучший знак, что неделя удалась.', mood:'sleepy', type:'image', seed:'workshop-dust-28' },
  ],
  designer: [
    { text:'Финальный вариант айдентики принят. Шесть итераций — и наконец.', mood:'excited', type:'image', seed:'branding-final-29' },
    { text:'Сетка ожила. Иногда дизайн — это просто терпение.', mood:'calm', type:'image', seed:'grid-poster-30' },
    { text:'Сделал motion для нового приложения. Двенадцать секунд счастья.', mood:'starstruck', type:'video', video: VIDEO_POOL[5] },
    { text:'Чёрный, белый, ничего лишнего. Заказчик согласился — праздник.', mood:'excited', type:'image', seed:'bw-typography-31' },
    { text:'Иллюстрация дописана. Завтра — гиф.', mood:'dreamy', type:'image', seed:'illustration-32' },
    { text:'Иногда лучший дизайн — это удалить половину.', mood:'calm' },
  ],
};

// Универсальные тексты (для тех тем, где у юзера разнообразие)
const UNIVERSAL_MOMENTS = [
  { text:'Утро. Кофе. Тишина. Идеально.', mood:'calm', type:'image', seed:'morning-coffee-univ-1' },
  { text:'Гулял по городу два часа без цели — и нашёл больше идей, чем за неделю работы.', mood:'dreamy' },
  { text:'Дочитал книгу, которая ждала меня полгода. Стоила того.', mood:'starstruck', type:'image', seed:'book-univ-2' },
  { text:'Сегодня просто хороший день. Без причины.', mood:'excited' },
  { text:'Дождь за окном — лучший фон для работы.', mood:'calm', type:'image', seed:'rain-window-univ-3' },
  { text:'Случайно встретил старого друга. Поговорили час, как будто и не расставались.', mood:'starstruck' },
  { text:'Маленькая голосовая записка — то, что я не успел сказать словами.', mood:'dreamy', type:'audio', audio: AUDIO_POOL[4] },
  { text:'Прислали смешное видео — пересматриваю третий раз.', mood:'excited', type:'video', video: VIDEO_POOL[6] },
];

function generateTestUsers(count = 100) {
  const rng = mulberry32(42);
  const out = [];
  for (let i = 0; i < count; i++) {
    const useRu      = rng() < 0.65;
    const useFemale  = rng() < 0.5;
    const firstNames = useRu
      ? (useFemale ? FEMALE_NAMES_RU : MALE_NAMES_RU)
      : (useFemale ? FEMALE_NAMES_EN : MALE_NAMES_EN);
    const surnames = useRu ? SURNAMES_RU : SURNAMES_EN;
    const firstName = pick(firstNames, rng);
    const surname   = pick(surnames,   rng);
    const baseName = `${firstName} ${surname}`;
    const displayName = `${baseName} (тестовый)`;
    const theme = THEMES[i % THEMES.length];
    const bio = pick(theme.bioTemplates, rng);

    // 1-3 момента на юзера: смешиваем тематические + универсальные
    const themedPool = MOMENTS_BY_THEME[theme.key] || [];
    const mCount = 1 + Math.floor(rng() * 3); // 1..3
    const moments = [];
    const seen = new Set();
    for (let k = 0; k < mCount; k++) {
      // 75% — тематический момент, 25% — универсальный
      const usePool = (rng() < 0.75 && themedPool.length) ? themedPool : UNIVERSAL_MOMENTS;
      let attempt = 0;
      while (attempt++ < 8) {
        const m = pick(usePool, rng);
        const key = (m.text || '').slice(0, 24);
        if (!seen.has(key)) {
          seen.add(key);
          // Резолвим image URL по теме+seed → стабильная картинка из пула
          const resolved = { ...m };
          if (m.type === 'image' && m.seed) {
            resolved.url = pickImage(theme.key, m.seed);
          }
          moments.push(resolved);
          break;
        }
      }
    }

    out.push({
      id: `test-user-${String(i).padStart(3, '0')}`,
      name: displayName,
      avatar: avatarForIndex(i, useFemale ? 'female' : 'male'),
      bio,
      headline: theme.profession,
      is_super: rng() < 0.4 ? 1 : 0,
      moments,
    });
  }
  return out;
}

module.exports = { generateTestUsers };
