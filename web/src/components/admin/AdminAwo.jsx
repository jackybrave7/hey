// AdminAwo.jsx — настройки одной школы (tenant'а) АВО-интеграции.
// URL: /admin/awo                 → дефолтный tnt_default (back-compat)
//      /admin/awo/:tenantId       → конкретный tenant
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { useConfirm } from '../Screens';
import AwoGuide from './AwoGuide';

// Тёмные карточки + высоко-контрастный текст — фон админки имеет светлые
// области градиента, поэтому используем не прозрачно-белые, а тёмные подложки.
const cardStyle = {
  background: 'rgba(20,12,40,.65)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 14,
  padding: '20px 22px',
  marginBottom: 18,
  backdropFilter: 'blur(8px)',
};
const labelStyle = {
  color: 'rgba(230,225,250,.85)', fontSize: 12, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.18)',
  color: 'white', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};
const btnStyle = {
  padding: '9px 16px', borderRadius: 10, border: 'none',
  background: 'rgba(140,110,220,.7)', color: 'white', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnGhost = { ...btnStyle, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' };
const btnDanger = { ...btnStyle, background: 'rgba(220,90,90,.55)', border: '1px solid rgba(255,160,160,.4)' };
const mutedText = { color: 'rgba(220,215,240,.78)' };  // вторичный текст с хорошим контрастом
const hintText  = { color: 'rgba(220,215,240,.6)' };   // подсказки — легче, но читаемо

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminAwo() {
  const params = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user: me } = useAuth();
  const isAdmin = !!me?.is_admin;
  const tenantId = params.tenantId || 'tnt_default';
  const basePath = location.pathname.startsWith('/integrations') ? '/integrations/awo' : '/admin/awo';

  const [tenants, setTenants] = useState([]); // для переключателя
  const [settings, setSettings] = useState(null);
  const [testCourse, setTestCourse] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [chatExcludes, setChatExcludes] = useState('слушатель,запись');
  const [savingSettings, setSavingSettings] = useState(false);

  // School account binding
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [accountSearching, setAccountSearching] = useState(false);
  const [bindingAccount, setBindingAccount] = useState(false);
  // Для не-админа: контакты юзера — можно привязать кого-то из них как
  // школьный аккаунт. Загружаются один раз при открытии страницы.
  const [contacts, setContacts] = useState([]);

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
  const [showGuide, setShowGuide] = useState(false);
  const [customConfirm, confirmModal] = useConfirm();

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  useEffect(() => {
    Promise.all([
      api.adminGetAwoSettings(tenantId),
      api.adminGetAwoCourseChats(tenantId),
      api.adminGetGroupChats(),
      api.adminGetAwoLog(50, tenantId),
      api.adminListAwoTenants(),
    ]).then(([s, m, g, l, ts]) => {
      setSettings(s);
      setTestMode(!!s.test_mode);
      setTestCourse(s.test_course || '');
      setChatExcludes(s.chat_excludes ?? 'слушатель,запись');
      setMappings(m);
      setGroupChats(g);
      setLog(l);
      setTenants(ts || []);
    }).catch(e => setError(e.message));
    // Контакты юзера — для не-админа, чтобы можно было привязать одного из них
    api.getContacts().then(setContacts).catch(() => {});
  }, [tenantId]);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const s = await api.adminSetAwoSettings({
        test_mode: testMode,
        test_course: testCourse,
        chat_excludes: chatExcludes,
      }, tenantId);
      setSettings(s);
      notify('Сохранено');
    } catch (e) { setError(e.message); }
    setSavingSettings(false);
  }

  async function addMapping() {
    if (!newCourse.trim() || !newChatId) return setError('Заполни курс и выбери чат');
    try {
      await api.adminSetAwoCourseChat(newCourse.trim(), newChatId, tenantId);
      const m = await api.adminGetAwoCourseChats(tenantId);
      setMappings(m);
      setNewCourse(''); setNewChatId('');
      notify('Маппинг добавлен');
    } catch (e) { setError(e.message); }
  }

  async function removeMapping(course) {
    if (!await customConfirm(`Удалить маппинг курса «${course}»?`, { danger: true })) return;
    try {
      await api.adminDeleteAwoCourseChat(course, tenantId);
      const m = await api.adminGetAwoCourseChats(tenantId);
      setMappings(m);
      notify('Удалено');
    } catch (e) { setError(e.message); }
  }

  async function makeLink() {
    setGeneratedLink('');
    try {
      const r = await api.adminAwoMakeJoinLink(linkEmail, linkCourse, tenantId);
      setGeneratedLink(r.url);
    } catch (e) { setError(e.message); }
  }

  async function rotateToken() {
    if (!await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:6}}>Пересоздать webhook-токен?</div>
        <div style={{color:'rgba(225,220,245,.7)',fontSize:13,lineHeight:1.55}}>
          Старый токен сразу перестанет работать. Не забудь обновить webhook URL в АВО.
        </div>
      </>,
      { confirmLabel: 'Пересоздать', danger: true }
    )) return;
    try {
      const t = await api.adminRotateAwoToken(tenantId);
      setSettings(prev => ({ ...prev, webhook_token: t.awo_webhook_token }));
      notify('Токен обновлён');
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

  async function searchUsers(q) {
    if (!isAdmin) return; // не-админ не использует search, защита от случайных вызовов
    setAccountSearch(q);
    if (q.trim().length < 2) { setAccountResults([]); return; }
    setAccountSearching(true);
    try {
      const list = await api.adminGetUsers({ search: q });
      // Не показываем заблокированных и системных юзеров кроме SCHOOL_USER_ID-дефолта
      setAccountResults((list || []).filter(u => !u.is_blocked).slice(0, 10));
    } catch (e) { setError(e.message); }
    setAccountSearching(false);
  }

  async function bindSchoolAccount(userId, userName) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:6}}>
          Привязать «{userName}» как официальный школьный аккаунт?
        </div>
        <div style={{color:'rgba(225,220,245,.85)',fontSize:13,lineHeight:1.55}}>
          От его имени будут отправляться приветствия в чаты курсов и приглашения
          из АВО. Можно сменить в любой момент.
        </div>
      </>,
      { confirmLabel: 'Привязать' }
    );
    if (!ok) return;
    setBindingAccount(true);
    try {
      const s = await api.adminSetAwoSettings({ school_account_id: userId }, tenantId);
      setSettings(s);
      setAccountSearch(''); setAccountResults([]);
      notify('Школьный аккаунт обновлён');
    } catch (e) { setError(e.message); }
    setBindingAccount(false);
  }

  async function unbindSchoolAccount() {
    if (!await customConfirm(
      'Отвязать школьный аккаунт? Вернётся системный дефолтный аккаунт.',
      { confirmLabel: 'Отвязать' }
    )) return;
    setBindingAccount(true);
    try {
      // Передаём пустую строку — сервер сбросит на дефолт
      const s = await api.adminSetAwoSettings({ school_account_id: '' }, tenantId);
      setSettings(s);
      notify('Сброшено на системный аккаунт');
    } catch (e) { setError(e.message); }
    setBindingAccount(false);
  }

  const currentTenant = tenants.find(t => t.id === tenantId);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920 }}>
      {/* Header with tenant switcher + back to list */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <Link to={basePath}
          style={{ color: 'rgba(180,140,255,.95)', fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ← Все школы
        </Link>
        {tenants.length > 1 && (
          <select value={tenantId}
            onChange={e => nav(basePath + '/' + e.target.value)}
            style={{
              ...inputStyle, width: 'auto', padding: '6px 12px', fontSize: 13,
              cursor: 'pointer',
            }}>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.id === 'tnt_default' ? ' (основная)' : ''}</option>
            ))}
          </select>
        )}
        <button onClick={() => setShowGuide(true)}
          style={{
            marginLeft: 'auto',
            padding: '7px 14px', borderRadius: 10,
            background: 'rgba(120,90,200,.25)',
            border: '1px solid rgba(180,140,220,.4)',
            color: 'rgba(220,200,255,.95)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>📖 Руководство</button>
      </div>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        🎓 {currentTenant?.name || 'Школа'}
      </h1>
      <p style={{ color: 'rgba(225,220,245,.85)', fontSize: 14, marginBottom: 24 }}>
        Интеграция с АвтоВебОфис: автоприглашение учеников после оплаты курсов.
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

      {/* Официальный школьный аккаунт */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          🎓 Официальный аккаунт школы
        </h3>
        <p style={{ color: 'rgba(225,220,245,.82)', fontSize: 13, marginBottom: 16, lineHeight:1.55 }}>
          От имени этого аккаунта школа общается с учениками в HEY: появляется в контактах
          у новых учеников после регистрации по /join-ссылке и отправляет приветствия
          «🎓 X присоединился к курсу» в чатах курсов.
        </p>

        {/* Current */}
        {settings?.school_account ? (
          <div style={{ display:'flex', alignItems:'center', gap:12,
            padding:'12px 14px', background:'rgba(120,90,200,.14)',
            border:'1px solid rgba(180,140,220,.3)', borderRadius:12, marginBottom:14 }}>
            {settings.school_account.avatar && /^https?:|^\//.test(settings.school_account.avatar) ? (
              <img src={settings.school_account.avatar} alt=""
                style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover' }}/>
            ) : (
              <div style={{ width:44, height:44, borderRadius:'50%',
                background:'rgba(120,90,200,.5)', color:'white',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:18, fontWeight:700 }}>
                {(settings.school_account.name || '?')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'white', fontSize:15, fontWeight:600,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {settings.school_account.name}
              </div>
              <div style={{ color:'rgba(225,220,245,.82)', fontSize:12, marginTop:2 }}>
                {settings.school_account.is_default
                  ? 'системный дефолтный аккаунт'
                  : (settings.school_account.phone || 'привязанный пользователь')}
              </div>
            </div>
            {!settings.school_account.is_default && (
              <button style={btnGhost} onClick={unbindSchoolAccount} disabled={bindingAccount}>
                Отвязать
              </button>
            )}
          </div>
        ) : (
          <div style={{ color:'rgba(255,200,100,.85)', fontSize:13, marginBottom:14 }}>
            Аккаунт не настроен — используется системный дефолт.
          </div>
        )}

        {/* Для не-админа: своя кнопка + фильтр контактов */}
        {!isAdmin ? (
          <>
            <button onClick={() => bindSchoolAccount(me.id, me.name)}
              disabled={bindingAccount || settings?.school_account?.id === me.id}
              style={{
                padding: '10px 16px', borderRadius: 10, border: 'none',
                background: settings?.school_account?.id === me.id
                  ? 'rgba(120,200,140,.18)'
                  : 'rgba(140,110,220,.85)',
                color: settings?.school_account?.id === me.id
                  ? 'rgba(140,240,180,.95)'
                  : 'white',
                fontSize: 13, fontWeight: 600,
                cursor: bindingAccount || settings?.school_account?.id === me.id ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 12,
              }}>
              {settings?.school_account?.id === me.id
                ? '✓ Привязан ваш аккаунт'
                : '🎓 Привязать ваш аккаунт как школьный'}
            </button>
            {contacts.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div style={labelStyle}>Или кто-то из ваших контактов</div>
                <input style={inputStyle} value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                  placeholder="Имя или телефон контакта"/>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Search & pick — только для админа */}
            <div style={{ marginBottom: 6 }}>
              <div style={labelStyle}>Привязать другого пользователя</div>
              <input style={inputStyle} value={accountSearch}
                onChange={e => searchUsers(e.target.value)}
                placeholder="Имя или телефон (минимум 2 символа)"/>
            </div>
            {accountSearching && (
              <div style={{ color:'rgba(225,220,245,.75)', fontSize:12, marginTop:6 }}>Поиск…</div>
            )}
          </>
        )}
        {/* Список контактов с подходящим именем/телефоном — для не-админа */}
        {!isAdmin && (() => {
          const q = accountSearch.trim().toLowerCase();
          const filtered = contacts.filter(c => {
            if (c.is_blocked || c.is_deleted || c.is_system) return false;
            if (c.id === me?.id) return false;
            if (!q) return true;
            return (c.name || '').toLowerCase().includes(q)
                || (c.phone || '').includes(q)
                || (c.nickname || '').toLowerCase().includes(q);
          }).slice(0, 8);
          if (!filtered.length) return null;
          return (
            <div style={{ marginTop: 8, display:'flex', flexDirection:'column', gap:6,
              maxHeight: 240, overflowY:'auto',
              background:'rgba(0,0,0,.18)', borderRadius:10, padding:6 }}>
              {filtered.map(u => (
                <button key={u.id} onClick={() => bindSchoolAccount(u.id, u.nickname || u.name)}
                  disabled={bindingAccount || u.id === settings?.school_account?.id}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                    background: u.id === settings?.school_account?.id ? 'rgba(120,200,140,.15)' : 'rgba(255,255,255,.04)',
                    border:'1px solid rgba(255,255,255,.08)', borderRadius:8,
                    color:'white', fontSize:13, cursor: bindingAccount ? 'wait' : 'pointer',
                    textAlign:'left', fontFamily:'inherit', width:'100%',
                    opacity: u.id === settings?.school_account?.id ? 0.65 : 1,
                  }}>
                  {u.avatar && /^https?:|^\//.test(u.avatar) ? (
                    <img src={u.avatar} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }}/>
                  ) : (
                    <div style={{ width:28, height:28, borderRadius:'50%',
                      background:'rgba(120,90,200,.5)', display:'flex',
                      alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                      {(u.nickname||u.name||'?')[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {u.nickname || u.name}
                    </div>
                    <div style={{ color:'rgba(225,220,245,.55)', fontSize:11 }}>{u.phone}</div>
                  </div>
                  {u.id === settings?.school_account?.id && (
                    <span style={{ color:'rgba(110,235,150,.95)', fontSize:11 }}>текущий</span>
                  )}
                </button>
              ))}
            </div>
          );
        })()}
        {isAdmin && accountResults.length > 0 && (
          <div style={{ marginTop: 8, display:'flex', flexDirection:'column', gap:6,
            maxHeight: 240, overflowY:'auto',
            background:'rgba(0,0,0,.18)', borderRadius:10, padding:6 }}>
            {accountResults.map(u => (
              <button key={u.id} onClick={() => bindSchoolAccount(u.id, u.name)}
                disabled={bindingAccount || u.id === settings?.school_account?.id}
                style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                  background: u.id === settings?.school_account?.id ? 'rgba(120,200,140,.15)' : 'rgba(255,255,255,.04)',
                  border:'1px solid rgba(255,255,255,.08)', borderRadius:8,
                  color:'white', fontSize:13, cursor: bindingAccount ? 'wait' : 'pointer',
                  textAlign:'left', fontFamily:'inherit', width:'100%',
                  opacity: u.id === settings?.school_account?.id ? 0.65 : 1,
                }}>
                {u.avatar && /^https?:|^\//.test(u.avatar) ? (
                  <img src={u.avatar} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }}/>
                ) : (
                  <div style={{ width:28, height:28, borderRadius:'50%',
                    background:'rgba(120,90,200,.5)', display:'flex',
                    alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>
                    {(u.name||'?')[0].toUpperCase()}
                  </div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {u.name} {u.is_super ? '✦' : ''}
                  </div>
                  <div style={{ color:'rgba(225,220,245,.75)', fontSize:11 }}>{u.phone}</div>
                </div>
                {u.id === settings?.school_account?.id && (
                  <span style={{ color:'rgba(110,235,150,.95)', fontSize:11 }}>текущий</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

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
            <div style={labelStyle}>Тестовый курс (поле <code style={{background:'rgba(0,0,0,.45)',padding:'1px 5px',borderRadius:4,color:'rgba(200,220,255,1)',fontSize:11.5}}>goods</code> из АВО)</div>
            <input style={inputStyle} value={testCourse} onChange={e => setTestCourse(e.target.value)}
              placeholder="Например: BL School — Базовый курс"/>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>🚫 Стоп-слова для доступа к чату (через запятую)</div>
          <input style={inputStyle} value={chatExcludes} onChange={e => setChatExcludes(e.target.value)}
            placeholder="слушатель, запись"/>
          <div style={{ color: 'rgba(225,220,245,.75)', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            Если в названии курса (<code style={{background:'rgba(0,0,0,.45)',padding:'1px 5px',borderRadius:4,color:'rgba(200,220,255,1)',fontSize:11.5}}>goods</code>) есть хоть одно из этих слов —
            ученика <strong>не добавим</strong> в чат курса (инвайт всё равно создастся).
            Регистр не важен.
          </div>
        </div>

        <button style={btnStyle} disabled={savingSettings} onClick={saveSettings}>
          {savingSettings ? 'Сохраняю…' : 'Сохранить настройки'}
        </button>

        {/* Webhook URL: реальный, с встроенными токеном и tenant_id */}
        {settings?.webhook_token && (() => {
          const webhookUrl = `${window.location.origin}/api/integrations/awo/webhook/${tenantId}?token=${settings.webhook_token}`;
          return (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ ...labelStyle, marginBottom: 8 }}>📨 Webhook URL для АВО</div>
              <div style={{
                background: 'rgba(0,0,0,.45)', borderRadius: 10,
                border: '1px solid rgba(255,255,255,.12)',
                padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <code style={{ flex: 1, color: 'rgba(200,220,255,1)', fontSize: 11.5,
                  wordBreak: 'break-all',
                  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }}>
                  {webhookUrl}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(webhookUrl); notify('URL скопирован'); }}
                  style={{ ...btnGhost, padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                  📋 Копировать
                </button>
              </div>
              <div style={{ marginTop: 8, color: 'rgba(225,220,245,.7)', fontSize: 12, lineHeight: 1.5 }}>
                Вставь этот URL в настройки бизнес-процесса АВО («Отправить запрос на URL»).{' '}
                <button onClick={rotateToken}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,180,180,.85)',
                    fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                    textDecoration: 'underline' }}>
                  Пересоздать токен
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Маппинг курс → чат */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🔗 Курс → групповой чат
        </h3>
        <p style={{ color: 'rgba(225,220,245,.75)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
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
          <div style={{ color: 'rgba(220,215,240,.65)', fontSize: 13 }}>Маппингов пока нет.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mappings.map(m => (
              <div key={m.course} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                <div style={{ flex: 1, color: 'white', fontSize: 13 }}>
                  <strong>{m.course}</strong>
                  <span style={{ color: 'rgba(225,220,245,.75)', marginLeft: 8 }}>
                    → {m.chat_name || m.chat_id}
                  </span>
                </div>
                <button style={btnDanger} onClick={() => removeMapping(m.course)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Виджет HEY для ЛК АВО */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          📦 Виджет HEY в ЛК АВО
        </h3>
        <p style={{ color: 'rgba(225,220,245,.85)', fontSize: 13, marginBottom: 12, lineHeight: 1.55 }}>
          Плавающий фиолетовый пузырь со счётчиком непрочитанных в углу личного
          кабинета ученика. Если в браузере есть сессия HEY и email совпадает —
          показывает реальный счётчик; иначе нейтральное «Открыть HEY».
        </p>
        <div style={{ ...labelStyle, marginTop: 4 }}>Сниппет для поля «Редактирование скриптов» в АВО</div>
        <div style={{
          position: 'relative', background: 'rgba(0,0,0,.45)',
          border: '1px solid rgba(255,255,255,.12)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 10,
        }}>
          <pre style={{
            margin: 0, color: 'rgba(200,220,255,1)', fontSize: 12.5,
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.55,
          }}>{`<script>window.HEY_USER_EMAIL = "{email}";</script>
<script src="${window.location.origin}/widget.js"></script>`}</pre>
          <button onClick={() => {
            const snippet = `<script>window.HEY_USER_EMAIL = "{email}";</script>\n<script src="${window.location.origin}/widget.js"></script>`;
            navigator.clipboard.writeText(snippet);
            notify('Сниппет скопирован');
          }} style={{ ...btnGhost, position: 'absolute', top: 8, right: 8, padding: '6px 12px', fontSize: 12 }}>
            📋 Копировать
          </button>
        </div>
        <div style={{ color: 'rgba(225,220,245,.78)', fontSize: 12, lineHeight: 1.6 }}>
          <strong style={{ color: 'white' }}>Куда вставлять:</strong> Настройки АВО → «Редактирование
          скриптов (javascript) для кабинета ученика». Переменную{' '}
          <code style={{ background: 'rgba(0,0,0,.45)', padding: '1px 5px', borderRadius: 4,
            color: 'rgba(200,220,255,1)', fontSize: 11.5 }}>{'{email}'}</code>{' '}
          АВО подставит автоматически. Виджет грузится с твоего домена{' '}
          <code style={{ background: 'rgba(0,0,0,.45)', padding: '1px 5px', borderRadius: 4,
            color: 'rgba(200,220,255,1)', fontSize: 11.5 }}>{window.location.origin}/widget.js</code>.
        </div>
      </div>

      {/* Генератор join-ссылки */}
      <div style={cardStyle}>
        <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          🔗 Сгенерировать /join-ссылку
        </h3>
        <p style={{ color: 'rgba(225,220,245,.75)', fontSize: 12, marginBottom: 14 }}>
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
          <div style={{ color: 'rgba(220,215,240,.65)', fontSize: 13 }}>Пока ничего не приходило.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
              <thead>
                <tr style={{ color: 'rgba(225,220,245,.82)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
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
      {showGuide && <AwoGuide onClose={() => setShowGuide(false)}/>}
    </div>
  );
}
