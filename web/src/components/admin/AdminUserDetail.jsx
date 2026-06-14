// AdminUserDetail.jsx — detailed user view with actions
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { useConfirm } from '../shared/Confirm';
import { openUserCard } from '../Screens';
import Icon from '../Icon';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(249,240,240,.06)' }}>
      <div style={{ width: 180, color: 'rgba(249,240,240,.4)', fontSize: 13, flexShrink: 0 }}>{label}</div>
      <div style={{ color: 'rgba(249,240,240,.85)', fontSize: 13 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user: me } = useAuth();

  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [customConfirm, confirmModal] = useConfirm();
  const [showSuperModal, setShowSuperModal] = useState(false);

  function showMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function reload() {
    try {
      const u = await api.adminGetUser(id);
      setUser(u);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { reload(); }, [id]);

  // Esc — назад к списку пользователей.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      nav('/admin/users');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  async function handleResetPassword() {
    if (!await customConfirm('Сбросить пароль пользователю?')) return;
    try {
      const res = await api.adminResetPassword(id);
      showMsg(`Новый пароль: ${res.newPassword}`);
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleBlock() {
    try {
      await api.adminBlockUser(id, blockReason);
      setShowBlockForm(false);
      setBlockReason('');
      await reload();
      showMsg('Пользователь заблокирован');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleUnblock() {
    try {
      await api.adminUnblockUser(id);
      await reload();
      showMsg('Пользователь разблокирован');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleMakeAdmin() {
    if (!await customConfirm('Назначить администратором?')) return;
    try {
      await api.adminMakeAdmin(id);
      await reload();
      showMsg('Пользователь назначен администратором');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleRevokeAdmin() {
    if (!await customConfirm('Снять права администратора?', { danger: true })) return;
    try {
      await api.adminRevokeAdmin(id);
      await reload();
      showMsg('Права администратора сняты');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function applySuper(mode, expiresAt) {
    try {
      await api.adminSetSuperExpiry(id, { mode, expires_at: expiresAt });
      await reload();
      setShowSuperModal(false);
      showMsg(
        mode === 'unlimited' ? 'Super: без ограничения' :
        mode === 'revoke'    ? 'Super снят' :
        'Super установлен до ' + new Date(expiresAt * 1000).toLocaleDateString('ru')
      );
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleDeleteUser() {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,fontSize:16,marginBottom:10}}>
          Полностью удалить пользователя «{user.name}» ({user.phone})?
        </div>
        <div style={{color:'rgba(249,240,240,.65)',fontSize:13,lineHeight:1.6}}>
          Это действие необратимо. Данные будут анонимизированы:<br/>
          — имя заменится на «Удалённый пользователь»<br/>
          — телефон, email, аватар, био — очистятся<br/>
          — моменты и сообщения останутся, но без авторства
        </div>
      </>,
      { requireWord: 'УДАЛИТЬ', danger: true }
    );
    if (!ok) return;
    try {
      await api.adminDeleteUser(id);
      showMsg('Пользователь удалён');
      setTimeout(() => nav('/admin/users'), 800);
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleHardDeleteUser() {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:8,color:'rgba(255,160,160,.95)'}}>
          💣 ПОЛНОЕ удаление аккаунта
        </div>
        <div style={{color:'rgba(249,240,240,.65)',fontSize:13,lineHeight:1.6}}>
          Будут стёрты <strong>безвозвратно</strong>:<br/>
          — строка пользователя в БД<br/>
          — все его моменты (БД + файлы в S3)<br/>
          — аватарка в S3<br/>
          — контакты, реакции, push-подписки, presence<br/>
          — заявки на бизнес-доступ, жалобы от него и на него<br/>
          Сообщения в чатах заменятся на «[сообщение удалено]»,
          чтобы не порвать переписку у других участников.<br/><br/>
          Восстановить нельзя.
        </div>
      </>,
      { requireWord: 'СТЕРЕТЬ', danger: true, confirmLabel: '💣 Стереть' }
    );
    if (!ok) return;
    try {
      await api.adminHardDeleteUser(id);
      showMsg('Пользователь стёрт полностью');
      setTimeout(() => nav('/admin/users'), 800);
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  if (loading) return <div style={{ padding: 32, color: 'rgba(249,240,240,.4)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 32, color: 'rgba(255,140,140,.9)' }}>Ошибка: {error}</div>;
  if (!user)   return <div style={{ padding: 32, color: 'rgba(249,240,240,.4)' }}>Не найдено</div>;

  const isSelf = me?.id === user.id;
  const iAmSuperAdmin = !!me?.is_super_admin;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700 }}>
      <button onClick={() => nav(-1)}
        style={{ background: 'none', border: 'none', color: 'rgba(249,240,240,.4)',
          fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← Назад
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(95, 64, 128,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 30, color:'#F9F0F0', fontWeight: 700,
          overflow: 'hidden',
          border: '1px solid rgba(249,240,240,.12)',
          flexShrink: 0,
        }}>
          {user.avatar && (user.avatar.startsWith('/') || user.avatar.startsWith('http') || user.avatar.startsWith('data:'))
            ? <img src={user.avatar} alt=""
                onError={e => { e.currentTarget.style.display = 'none'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            : user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 style={{ color:'#F9F0F0', fontSize: 22, fontWeight: 800, margin: 0 }}>
            {user.name}
            {user.is_super_admin && <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(255,220,140,.95)',
              background: 'rgba(200,140,40,.22)', borderRadius: 6, padding: '2px 8px' }}>суперадмин</span>}
            {user.is_admin && !user.is_super_admin && <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(180,140,255,.8)',
              background: 'rgba(95, 64, 128,.2)', borderRadius: 6, padding: '2px 8px' }}>admin</span>}
            {user.is_super && <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(255,200,80,.9)',
              background: 'rgba(255,180,50,.12)', borderRadius: 6, padding: '2px 8px' }}>⭐ super</span>}
          </h1>
          <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 14 }}>{user.phone}</div>
          {/* Открыть стандартную карточку юзера поп-апом — видна так же,
              как её видят другие пользователи приложения. */}
          <button onClick={() => openUserCard(user.id)}
            style={{
              marginTop: 10, padding: '7px 14px', borderRadius: 50,
              background: 'rgba(95, 64, 128,.28)', border: '1px solid rgba(180,140,255,.35)',
              color: 'rgba(220,200,255,.95)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            👤 Открыть карточку
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(249,240,240,.04)', borderRadius: 14,
        padding: '4px 20px', marginBottom: 24, border: '1px solid rgba(249,240,240,.08)' }}>
        <Row label="ID" value={user.id} />
        <Row label="Зарегистрирован" value={fmtDate(user.created_at)} />
        <Row label="Всего моментов" value={user.total_moments} />
        <Row label="Получено реакций" value={user.total_reactions_received} />
        <Row label="Пригласил" value={
          (user.invited_total || 0) === 0
            ? <span style={{color:'rgba(249,240,240,.4)'}}>никого</span>
            : <>
                <strong style={{color:'rgba(220,200,255,.95)'}}>{user.invited_total}</strong>
                <span style={{color:'rgba(249,240,240,.55)',fontSize:12,marginLeft:6}}>
                  всего · {user.invited_confirmed || 0} написали первое сообщение
                </span>
              </>
        }/>
        {user.referral_by && (
          <Row label="Кто пригласил" value={
            user.invited_by_name
              ? <a href={`/admin/users/${user.referral_by}`} style={{color:'rgba(180,140,255,.95)',textDecoration:'none'}}>
                  {user.invited_by_name}
                </a>
              : <code style={{color:'rgba(249,240,240,.55)',fontSize:12}}>{user.referral_by}</code>
          }/>
        )}
        <Row label="Статус" value={
          user.is_blocked
            ? `Заблокирован ${fmtDate(user.blocked_at)}`
            : (user.online ? 'Онлайн' : `Был(а) ${fmtDate(user.last_seen)}`)
        } />
        <Row label="Push-уведомления" value={
          user.push_enabled
            ? <span style={{ color:'rgba(110,235,150,.95)', fontWeight:600 }}>
                включены · {user.push_devices} {user.push_devices === 1 ? 'устройство' : 'устройств'}
              </span>
            : <span style={{ color:'rgba(249,240,240,.4)' }}>не подключены</span>
        } />
        <Row label="✦ Super" value={
          !user.is_super
            ? <span style={{color:'rgba(249,240,240,.4)'}}>нет</span>
            : user.super_expires_at == null
              ? <span style={{color:'rgba(255,220,120,.95)',fontWeight:600}}>без ограничения</span>
              : <span>
                  до <strong style={{color:'rgba(255,220,120,.95)'}}>{fmtDate(user.super_expires_at)}</strong>
                  {' '}
                  <span style={{color:'rgba(249,240,240,.4)',fontSize:12}}>
                    ({Math.ceil((user.super_expires_at - Date.now()/1000) / 86400)} дн.)
                  </span>
                </span>
        } />
      </div>

      {/* Список приглашённых — показываем только если есть */}
      {user.invitees && user.invitees.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
            Привёл в HEY ({user.invitees.length})
          </div>
          <div style={{ background: 'rgba(249,240,240,.04)', borderRadius: 14,
            border: '1px solid rgba(249,240,240,.08)', overflow: 'hidden' }}>
            {user.invitees.map((inv, i) => (
              <div key={inv.id}
                onClick={() => nav(`/admin/users/${inv.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < user.invitees.length - 1 ? '1px solid rgba(249,240,240,.05)' : 'none',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(249,240,240,.04)'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(95, 64, 128,.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color:'#F9F0F0', fontWeight: 700, flexShrink: 0,
                  overflow: 'hidden', border: '1px solid rgba(249,240,240,.1)',
                }}>
                  {inv.avatar && (inv.avatar.startsWith('http') || inv.avatar.startsWith('/') || inv.avatar.startsWith('data:'))
                    ? <img src={inv.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : (inv.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color:'#F9F0F0', fontSize: 14, fontWeight: 500,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {inv.name}
                    {inv.is_blocked && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,100,100,.9)',
                        background: 'rgba(200,50,50,.18)', borderRadius: 4, padding: '1px 5px' }}>
                        blocked
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 11, marginTop: 1 }}>
                    {inv.phone} · {fmtDate(inv.invited_at)}
                  </div>
                </div>
                {inv.confirmed_at ? (
                  <span title={`Написал первое сообщение ${fmtDate(inv.confirmed_at)}`}
                    style={{ fontSize: 11, color: 'rgba(110,235,150,.95)', fontWeight: 600,
                      background: 'rgba(60,180,100,.14)', padding: '3px 8px', borderRadius: 8 }}>
                    ✓ активен
                  </span>
                ) : (
                  <span title="Зарегистрировался, но ещё не написал первое сообщение"
                    style={{ fontSize: 11, color: 'rgba(255,200,120,.85)', fontWeight: 500,
                      background: 'rgba(255,200,120,.1)', padding: '3px 8px', borderRadius: 8 }}>
                    ожидаем
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button onClick={handleResetPassword}
          style={btnStyle('rgba(249,240,240,.1)')}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6}}><Icon name="lock" size={14} /> Сбросить пароль</span>
        </button>

        {!isSelf && (
          user.is_blocked ? (
            <button onClick={handleUnblock} style={btnStyle('rgba(60,180,100,.25)')}>
              ✓ Разблокировать
            </button>
          ) : (
            <button onClick={() => setShowBlockForm(v => !v)} style={btnStyle('rgba(200,80,50,.3)')}>
              <span style={{display:'inline-flex',alignItems:'center',gap:6}}><Icon name="ban" size={14} /> Заблокировать</span>
            </button>
          )
        )}

        {iAmSuperAdmin && !isSelf && (
          user.is_admin ? (
            !user.is_super_admin ? (
              <button onClick={handleRevokeAdmin} style={btnStyle('rgba(255,200,50,.2)')}>
                👑 Снять admin
              </button>
            ) : null
          ) : (
            <button onClick={handleMakeAdmin} style={btnStyle('rgba(95, 64, 128,.3)')}>
              👑 Назначить admin
            </button>
          )
        )}

        <button onClick={() => setShowSuperModal(true)} style={btnStyle('rgba(255,180,50,.22)')}>
          ✦ {user.is_super ? 'Изменить срок Super' : 'Назначить Super'}
        </button>
      </div>

      {/* Block reason form */}
      {showBlockForm && (
        <div style={{ background: 'rgba(200,50,50,.12)', border: '1px solid rgba(255,80,80,.2)',
          borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ color: 'rgba(255,120,120,.9)', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            Причина блокировки (необязательно)
          </div>
          <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
            placeholder="Укажи причину…"
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(249,240,240,.08)',
              border: '1px solid rgba(249,240,240,.14)', borderRadius: 10, padding: '9px 13px',
              color:'#F9F0F0', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowBlockForm(false); setBlockReason(''); }}
              style={btnStyle('rgba(249,240,240,.08)')}>Отмена</button>
            <button onClick={handleBlock} style={btnStyle('rgba(200,50,50,.8)')}>
              Заблокировать
            </button>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {!isSelf && !user.is_admin && (
        <div style={{
          marginTop: 32, padding: 16,
          background: 'rgba(200,50,50,.08)',
          border: '1px solid rgba(255,80,80,.25)',
          borderRadius: 14,
        }}>
          <div style={{ color: 'rgba(255,140,140,.95)', fontSize: 13, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>
            ⚠ Опасная зона
          </div>
          <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 12, marginBottom: 12 }}>
            Полное удаление аккаунта. Данные пользователя будут анонимизированы и не восстанавливаются.
          </div>
          <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
            <button onClick={handleDeleteUser}
              style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: '1px solid rgba(255,80,80,.4)',
                background: 'rgba(200,50,50,.18)', color: 'rgba(255,140,140,.95)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,50,50,.32)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(200,50,50,.18)'}>
              🗑 Удалить (мягко)
            </button>
            <button onClick={handleHardDeleteUser}
              style={{
                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', border: '1px solid rgba(255,80,80,.6)',
                background: 'rgba(200,50,50,.45)', color:'#F9F0F0',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,50,50,.65)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(200,50,50,.45)'}>
              💣 Стереть полностью
            </button>
          </div>
          <div style={{ color:'rgba(249,240,240,.45)', fontSize:11, marginTop:10, lineHeight:1.5 }}>
            <strong>Мягко</strong> — анонимизирует, оставляет данные в БД.{' '}
            <strong>Полностью</strong> — удаляет аккаунт, все его моменты, медиа из S3,
            аватарку, контакты, реакции, push-подписки. Сообщения в чатах
            заменяются на «[сообщение удалено]».
          </div>
          {user.is_admin && (
            <div style={{ color: 'rgba(255,180,80,.85)', fontSize: 12, marginTop: 8 }}>
              ⚠ Сначала снимите права администратора.
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(249,240,240,.15)',
          borderRadius: 50, padding: '10px 20px', color:'#F9F0F0', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
      {confirmModal}
      {showSuperModal && (
        <SuperManageModal
          user={user}
          onClose={() => setShowSuperModal(false)}
          onApply={applySuper}
        />
      )}
    </div>
  );
}

function btnStyle(bg) {
  return {
    padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none', background: bg,
    color: 'rgba(249,240,240,.85)', transition: 'opacity .15s',
  };
}

// Модалка управления Super: 3 режима — без ограничения / до даты / снять
function SuperManageModal({ user, onClose, onApply }) {
  const initialMode = !user.is_super ? 'set'
    : user.super_expires_at == null ? 'unlimited'
    : 'set';
  const initialDate = user.super_expires_at
    ? new Date(user.super_expires_at * 1000).toISOString().slice(0, 10)
    : new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);

  const [mode, setMode] = useState(initialMode);
  const [dateStr, setDateStr] = useState(initialDate);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    if (mode === 'set') {
      // Парсим YYYY-MM-DD как локальный конец дня (23:59:59)
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 23, 59, 59);
      await onApply('set', Math.floor(dt.getTime() / 1000));
    } else {
      await onApply(mode, null);
    }
    setBusy(false);
  }

  const opt = (key, label, sub) => (
    <label key={key} style={{
      display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',
      borderRadius:12,cursor:'pointer',marginBottom:8,
      background: mode === key ? 'rgba(95, 64, 128,.22)' : 'rgba(249,240,240,.04)',
      border: '1px solid ' + (mode === key ? 'rgba(180,140,255,.45)' : 'rgba(249,240,240,.08)'),
      transition: 'all .12s',
    }}>
      <input type="radio" name="super-mode" checked={mode === key}
        onChange={() => setMode(key)}
        style={{ marginTop: 3, accentColor: 'rgb(180,140,255)' }}/>
      <div style={{ flex: 1 }}>
        <div style={{ color:'#F9F0F0', fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>
          {sub}
        </div>
      </div>
    </label>
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(22,15,50,.98)', borderRadius: 18,
        border: '1px solid rgba(249,240,240,.14)',
        width: 'min(96vw, 460px)', padding: '22px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1, color:'#F9F0F0', fontSize: 18, fontWeight: 800 }}>
            ✦ Управление Super
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(249,240,240,.5)',
            fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0,
          }}>✕</button>
        </div>

        <div style={{ color: 'rgba(225,220,245,.78)', fontSize: 13,
          marginBottom: 16, lineHeight: 1.5 }}>
          Пользователь: <strong style={{color:'#F9F0F0'}}>{user.name}</strong>
        </div>

        {opt('unlimited', 'Без ограничения', 'Статус Super остаётся пока админ его не снимет.')}

        {opt('set', 'До даты', 'Статус автоматически снимется в указанный день.')}
        {mode === 'set' && (
          <div style={{ marginTop: -2, marginBottom: 12, paddingLeft: 36 }}>
            {/* Быстрые пресеты — выставляют дату относительно текущей */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                { d: 30,  l: '+30 дн' },
                { d: 90,  l: '+3 мес' },
                { d: 180, l: '+6 мес' },
                { d: 365, l: '+1 год' },
              ].map(p => {
                const dt = new Date();
                dt.setDate(dt.getDate() + p.d);
                const iso = dt.toISOString().slice(0, 10);
                const active = dateStr === iso;
                return (
                  <button key={p.d} onClick={() => setDateStr(iso)}
                    style={{
                      padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: active ? 'rgba(140,110,220,.7)' : 'rgba(249,240,240,.06)',
                      border: '1px solid ' + (active ? 'rgba(180,140,255,.5)' : 'rgba(249,240,240,.14)'),
                      color: active ? '#F9F0F0' : 'rgba(225,220,245,.9)',
                    }}>
                    {p.l}
                  </button>
                );
              })}
            </div>
            <input type="date" value={dateStr}
              onChange={e => setDateStr(e.target.value)}
              min={new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10)}
              style={{
                background: 'rgba(0,0,0,.4)', border: '1px solid rgba(249,240,240,.18)',
                borderRadius: 8, padding: '8px 12px', color:'#F9F0F0', fontSize: 14,
                fontFamily: 'inherit', outline: 'none',
                colorScheme: 'dark',
              }}/>
            <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 11, marginTop: 6 }}>
              {(() => {
                const [y, m, d] = dateStr.split('-').map(Number);
                if (!y) return '';
                const ms = new Date(y, m - 1, d, 23, 59, 59).getTime() - Date.now();
                const days = Math.ceil(ms / 86400000);
                return days > 0 ? `≈ ${days} дн. от сегодня` : 'дата в прошлом';
              })()}
            </div>
          </div>
        )}

        {opt('revoke', 'Снять Super', 'Полностью убрать статус. Можно вернуть позже.')}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} disabled={busy} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(249,240,240,.18)',
            background: 'rgba(249,240,240,.06)', color: 'rgba(249,240,240,.85)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Отмена</button>
          <button onClick={save} disabled={busy} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: 'none',
            background: 'rgba(140,110,220,.85)', color:'#F9F0F0',
            fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(95, 64, 128,.3)',
          }}>
            {busy ? '…' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  );
}
