// AdminGuide.jsx — руководство по админ-панели (только для администраторов).
import { useState, useMemo, useRef, useEffect } from 'react';

const GUIDE_VERSION = '2026-06-10 · v1';

const SECTIONS = [
  {
    id: 'overview',
    icon: '⚙',
    title: 'Админ-панель HEY',
    body: [
      'Панель доступна по адресу `/admin` — только пользователям с флагом администратора.',
      'Слева — навигация по разделам, справа — содержимое. На мобильном меню открывается кнопкой ☰.',
    ],
  },
  {
    id: 'sections',
    icon: '📋',
    title: 'Разделы админки',
    body: [
      '· **Дашборд** — общая статистика пользователей, моментов, реакций, сообщений, открытых жалоб.',
      '· **Пользователи** — поиск, блокировка, сброс пароля, выдача Super, удаление.',
      '· **Группы** — просмотр и управление групповыми чатами.',
      '· **Моменты** — модерация, удаление с указанием причины.',
      '· **Жалобы** — обработка жалоб от пользователей (принять меры или отклонить).',
      '· **Обращения** — обратная связь от пользователей (баги, идеи, жалобы).',
      '· **Заявки на регистрацию** — waitlist до выдачи инвайта.',
      '· **HEY-заведующий** — публикация моментов и рассылок от системного аккаунта.',
      '· **S3 галерея** — просмотр загруженных медиафайлов.',
      '· **АВО / Школы** — интеграция с АвтоВебОфис: тенанты, маппинг курсов на чаты, webhook-логи.',
      '· **Бизнес-заявки** — одобрение доступа к интеграциям для бизнес-пользователей.',
      '· **Тестовые юзеры** — создание тестовых аккаунтов.',
      '· **Логи** — журнал действий администраторов.',
      '· **Настройки** — глобальные параметры приложения.',
    ],
  },
  {
    id: 'moderation',
    icon: '🚩',
    title: 'Модерация и жалобы',
    body: [
      'Жалобы на моменты и пользователей попадают в раздел **Жалобы**. Можно открыть карточку автора или сам момент прямо из жалобы.',
      'При удалении момента админом все открытые жалобы на него автоматически закрываются.',
      'Блокировка пользователя скрывает его контент; разблокировка — через карточку пользователя.',
    ],
  },
  {
    id: 'awo',
    icon: '🎓',
    title: 'АВО и школы',
    body: [
      'Раздел **АВО / Школы** — мультитенантная интеграция с АвтоВебОфис.',
      'Для каждой школы (тенанта) настраиваются webhook, маппинг курсов на групповые чаты, стоп-слова.',
      'Подробная пошаговая настройка — кнопка «Руководство» внутри раздела АВО.',
    ],
  },
];

function plainText(body) {
  return body.join(' ').replace(/\*\*/g, '').replace(/`/g, '');
}

function renderParagraph(text, highlightQuery) {
  if (!text) return null;
  const parts = [];
  let rest = text;
  let lastIdx = 0;
  const boldRe = /\*\*([^*]+?)\*\*/g;
  let m;
  while ((m = boldRe.exec(rest))) {
    if (m.index > lastIdx) parts.push({ type: 'text', value: rest.slice(lastIdx, m.index) });
    parts.push({ type: 'bold', value: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < rest.length) parts.push({ type: 'text', value: rest.slice(lastIdx) });

  function highlight(s) {
    if (!highlightQuery || !s) return s;
    const q = highlightQuery.trim().toLowerCase();
    if (!q) return s;
    const lower = s.toLowerCase();
    const out = [];
    let i = 0;
    while (i < s.length) {
      const idx = lower.indexOf(q, i);
      if (idx === -1) { out.push(s.slice(i)); break; }
      if (idx > i) out.push(s.slice(i, idx));
      out.push(<mark key={i} style={{ background: 'rgba(255,200,80,.55)', color: 'inherit', borderRadius: 3, padding: '0 2px' }}>{s.slice(idx, idx + q.length)}</mark>);
      i = idx + q.length;
    }
    return out;
  }

  return parts.map((p, i) =>
    p.type === 'bold'
      ? <strong key={i} style={{ color:'#F9F0F0' }}>{highlight(p.value)}</strong>
      : <span key={i}>{highlight(p.value)}</span>
  );
}

export default function AdminGuide() {
  const initialHash = typeof window !== 'undefined'
    ? window.location.hash.replace(/^#/, '')
    : '';
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(initialHash || 'overview');
  const inputRef = useRef(null);

  useEffect(() => {
    if (initialHash) {
      setTimeout(() => {
        const el = document.getElementById('admin-guide-' + initialHash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [initialHash]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      plainText(s.body).toLowerCase().includes(q)
    );
  }, [query]);

  const isOpen = (id) => query.trim() ? true : openId === id;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ color:'#F9F0F0', fontSize: 22, fontWeight: 800, letterSpacing: -.3 }}>
            📖 Руководство администратора
          </div>
          <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 12, marginTop: 4 }}>
            Последнее обновление · {GUIDE_VERSION}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="🔍 Поиск по руководству…"
        style={{
          width: '100%', maxWidth: 480, boxSizing: 'border-box',
          background: 'rgba(249,240,240,.08)',
          border: '1px solid rgba(249,240,240,.14)',
          borderRadius: 12, padding: '10px 14px',
          color:'#F9F0F0', fontSize: 14, outline: 'none',
          fontFamily: 'inherit', marginBottom: 20,
        }}
        onFocus={e => e.target.style.borderColor = 'rgba(180,140,220,.6)'}
        onBlur={e => e.target.style.borderColor = 'rgba(249,240,240,.14)'}/>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        {filtered.length === 0 && (
          <div style={{ color: 'rgba(249,240,240,.4)', textAlign: 'center', padding: 40, fontSize: 14 }}>
            По запросу «{query}» ничего не найдено
          </div>
        )}
        {filtered.map(section => {
          const open = isOpen(section.id);
          return (
            <div key={section.id} id={'admin-guide-' + section.id}
              style={{
                background: 'rgba(249,240,240,.05)',
                border: '1px solid rgba(249,240,240,.08)',
                borderRadius: 14,
                overflow: 'hidden',
              }}>
              <button
                onClick={() => !query.trim() && setOpenId(open ? null : section.id)}
                disabled={!!query.trim()}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: 'transparent', border: 'none',
                  cursor: query.trim() ? 'default' : 'pointer',
                  color:'#F9F0F0', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{section.icon}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>
                  {renderParagraph(section.title, query)}
                </span>
                {!query.trim() && (
                  <span style={{
                    fontSize: 14, color: 'rgba(249,240,240,.4)',
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform .2s',
                  }}>›</span>
                )}
              </button>
              {open && (
                <div style={{
                  padding: '0 16px 16px 50px',
                  color: 'rgba(249,240,240,.78)',
                  fontSize: 14, lineHeight: 1.65,
                }}>
                  {section.body.map((line, i) => (
                    line === ''
                      ? <div key={i} style={{ height: 8 }}/>
                      : <div key={i} style={{ marginBottom: 7 }}>
                          {renderParagraph(line, query)}
                        </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
