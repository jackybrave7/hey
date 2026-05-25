// AdminAwo.jsx — управление интеграцией с АвтоВебОфис (АВО)
import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';

const cardStyle = {
  background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 14,
  padding: '20px 22px',
  marginBottom: 18,
};
const labelStyle = {
  color: 'rgba(255,255,255,.55)', fontSize: 12, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.1)',
  color: 'white', fontSize: 14, outline: 'none',
};
const btnStyle = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'rgba(120,90,200,.4)', color: 'white', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
};
const btnGhost = { ...btnStyle, background: 'rgba(255,255,255,.07)' };
const btnDanger = { ...btnStyle, background: 'rgba(220,90,90,.35)' };

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminAwo() {
  const [settings, setSettings] = useState(null);
  const [testCourse, setTestCourse] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [chatExcludes, setChatExcludes] = useState('слушатель,запись');
  const [savingSettings, setSavingSettings] = useState(false);

  const [mappings, setMappings] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [newCourse, setNewCourse] = useState('');
  const [newChatId, setNewChatId] = useState('');

  const [log, setLog] = useState([]);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkCourse, setLinkCourse] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [customConfirm, confirmModal] = useConfirm();

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  useEffect(() => {
    Promise.all([
      api.adminGetAwoSettings(),
      api.adminGetAwoCourseChats(),
      api.adminGetGroupChats(),
      api.adminGetAwoLog(50),
    ]).then(([s, m, g, l]) => {
      setSettings(s);
      setTestMode(!!s.test_mode);
      setTestCourse(s.test_course || '');
      setChatExcludes(s.chat_excludes ?? 'слушатель,запись');
      setMappings(m);
      setGroupChats(g);
      setLog(l);
    }).catch(e => setError(e.message));
  }, []);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const s = await api.adminSetAwoSettings({
        test_mode: testMode,
        test_course: testCourse,
        chat_excludes: chatExcludes,
      });
      setSettings(s);
      notify('Сохранено');
    } catch (e) { setError(e.message); }
    setSavingSettings(false);
  }

  async function addMapping() {
    if (!newCourse.trim() || !newChatId) return setError('Заполни курс и выбери чат');
    try {
      await api.adminSetAwoCourseChat(newCourse.trim(), newChatId);
      const m = await api.adminGetAwoCourseChats();
      setMappings(m);
      setNewCourse(''); setNewChatId('');
      notify('Маппинг добавлен');
    } catch (e) { setError(e.message); }
  }

  async function removeMapping(course) {
    if (!await customConfirm(`Удалить маппинг курса «${course}»?`, { danger: true })) return;
    try {
      await api.adminDeleteAwoCourseChat(course);
      const m = await api.adminGetAwoCourseChats();
      setMappings(m);
      notify('Удалено');
    } catch (e) { setError(e.message); }
  }

  async function makeLink() {
    setGeneratedLink('');
    try {
      const r = await api.adminAwoMakeJoinLink(linkEmail, linkCourse);
      setGeneratedLink(r.url);
    } catch (e) { setError(e.message); }
  }

  function copyLink() {
    navigator.clipboard.writeText(generatedLink);
    notify('Скопировано');
  }

  async function refreshLog() {
    try {
      const l = await api.adminGetAwoLog(50);
      setLog(l);
    } catch (e) { setError(e.message); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920 }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        🎓 АВО / Школа
      </h1>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, marginBottom: 24 }}>
        Интеграция с АвтоВебОфис: автоприглашение учеников после оплаты курсов BL School
      </p>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.95)', background: 'rgba(200,50,50,.12)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          {error} <button onClick={() => setError('')} style={{ ...btnGhost, marginLeft: 8 }}>×</button>
        </div>
      )}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: 'rgba(60,170,110,.95)',
          color: 'white', padding: '10px 16px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      {/* Настройки */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          ⚙ Настройки webhook
        </h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={testMode} onChange={e => setTestMode(e.target.checked)}
            style={{ width: 18, height: 18 }}/>
          <span style={{ color: 'white', fontSize: 14 }}>
            Тестовый режим — обрабатывать только один заданный курс
          </span>
        </label>

        {testMode && (
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Тестовый курс (поле <code>goods</code> из АВО)</div>
            <input style={inputStyle} value={testCourse} onChange={e => setTestCourse(e.target.value)}
              placeholder="Например: BL School — Базовый курс"/>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>🚫 Стоп-слова для доступа к чату (через запятую)</div>
          <input style={inputStyle} value={chatExcludes} onChange={e => setChatExcludes(e.target.value)}
            placeholder="слушатель, запись"/>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Если в названии курса (<code>goods</code>) есть хоть одно из этих слов —
            ученика <strong>не добавим</strong> в чат курса (инвайт всё равно создастся).
            Регистр не важен.
          </div>
        </div>

        <button style={btnStyle} disabled={savingSettings} onClick={saveSettings}>
          {savingSettings ? 'Сохраняю…' : 'Сохранить настройки'}
        </button>

        <div style={{ marginTop: 16, color: 'rgba(255,255,255,.4)', fontSize: 12, lineHeight: 1.5 }}>
          <strong>Webhook URL:</strong> <code>{location.origin}/api/integrations/awo/webhook?token=&lt;TOKEN&gt;</code><br/>
          <strong>Токен</strong> задаётся в <code>.env</code> сервера как <code>AWO_WEBHOOK_TOKEN</code>.
        </div>
      </div>

      {/* Маппинг курс → чат */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🔗 Курс → групповой чат
        </h3>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
          После регистрации ученик автоматически добавится в указанный чат.<br/>
          Название курса можно указывать как <strong>точное</strong>, так и <strong>часть</strong> названия —
          например маппинг «Zoom Участник» подойдёт под курс «BL School — Zoom Участник, поток 5».
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 10, marginBottom: 16 }}>
          <input style={inputStyle} placeholder="Название курса в АВО"
            value={newCourse} onChange={e => setNewCourse(e.target.value)}/>
          <select style={inputStyle} value={newChatId} onChange={e => setNewChatId(e.target.value)}>
            <option value="">— Выбери чат —</option>
            {groupChats.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.member_count} чел.)</option>
            ))}
          </select>
          <button style={btnStyle} onClick={addMapping}>Добавить</button>
        </div>

        {mappings.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Маппингов пока нет.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mappings.map(m => (
              <div key={m.course} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                <div style={{ flex: 1, color: 'white', fontSize: 13 }}>
                  <strong>{m.course}</strong>
                  <span style={{ color: 'rgba(255,255,255,.4)', marginLeft: 8 }}>
                    → {m.chat_name || m.chat_id}
                  </span>
                </div>
                <button style={btnDanger} onClick={() => removeMapping(m.course)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Генератор join-ссылки */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🔗 Сгенерировать /join-ссылку
        </h3>
        <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginBottom: 14 }}>
          Для ручной отправки или тестирования (обычно ссылку шлёт бизнес-процесс АВО)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 10, marginBottom: 12 }}>
          <input style={inputStyle} type="email" placeholder="email ученика"
            value={linkEmail} onChange={e => setLinkEmail(e.target.value)}/>
          <input style={inputStyle} placeholder="курс (необязательно)"
            value={linkCourse} onChange={e => setLinkCourse(e.target.value)}/>
          <button style={btnStyle} onClick={makeLink}>Создать</button>
        </div>
        {generatedLink && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px',
            background: 'rgba(0,0,0,.3)', borderRadius: 10 }}>
            <code style={{ flex: 1, color: 'rgba(255,255,255,.85)', fontSize: 12, wordBreak: 'break-all' }}>
              {generatedLink}
            </code>
            <button style={btnGhost} onClick={copyLink}>📋</button>
          </div>
        )}
      </div>

      {/* Лог webhook'ов */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: 0 }}>
            📋 Последние webhook'и
          </h3>
          <button style={btnGhost} onClick={refreshLog}>⟳ Обновить</button>
        </div>
        {log.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13 }}>Пока ничего не приходило.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,.5)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Когда</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Телефон</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Курс</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Результат</th>
                </tr>
              </thead>
              <tbody>
                {log.map(row => (
                  <tr key={row.id_account} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '6px 8px' }}>{fmtDate(row.processed_at)}</td>
                    <td style={{ padding: '6px 8px' }}>{row.email || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{row.phone || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{row.course || '—'}</td>
                    <td style={{ padding: '6px 8px',
                      color: row.result?.startsWith('invite') || row.result?.includes('added') ? 'rgba(110,235,150,.95)'
                           : row.result?.startsWith('ignored') ? 'rgba(255,200,100,.8)' : 'rgba(255,255,255,.7)' }}>
                      {row.result}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmModal}
    </div>
  );
}
