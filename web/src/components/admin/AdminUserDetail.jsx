// AdminUserDetail.jsx — detailed user view with actions
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ width: 180, color: 'rgba(255,255,255,.4)', fontSize: 13, flexShrink: 0 }}>{label}</div>
      <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 13 }}>{value ?? '—'}</div>
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

  async function handleResetPassword() {
    if (!confirm('Сбросить пароль пользователю?')) return;
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
    if (!confirm('Назначить администратором?')) return;
    try {
      await api.adminMakeAdmin(id);
      await reload();
      showMsg('Пользователь назначен администратором');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleRevokeAdmin() {
    if (!confirm('Снять права администратора?')) return;
    try {
      await api.adminRevokeAdmin(id);
      await reload();
      showMsg('Права администратора сняты');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleMakeSuper() {
    if (!confirm('Назначить статус Супер?')) return;
    try {
      await api.adminMakeSuper(id);
      await reload();
      showMsg('Статус Супер назначен');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function handleRevokeSuper() {
    if (!confirm('Снять статус Супер?')) return;
    try {
      await api.adminRevokeSuper(id);
      await reload();
      showMsg('Статус Супер снят');
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  if (loading) return <div style={{ padding: 32, color: 'rgba(255,255,255,.4)' }}>Загрузка…</div>;
  if (error)   return <div style={{ padding: 32, color: 'rgba(255,140,140,.9)' }}>Ошибка: {error}</div>;
  if (!user)   return <div style={{ padding: 32, color: 'rgba(255,255,255,.4)' }}>Не найдено</div>;

  const isSelf = me?.id === user.id;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700 }}>
      <button onClick={() => nav(-1)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
          fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
        ← Назад
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(120,90,200,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, color: 'white', fontWeight: 700,
        }}>
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0 }}>
            {user.name}
            {user.is_admin && <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(180,140,255,.8)',
              background: 'rgba(120,90,200,.2)', borderRadius: 6, padding: '2px 8px' }}>admin</span>}
            {user.is_super && <span style={{ marginLeft: 8, fontSize: 13, color: 'rgba(255,200,80,.9)',
              background: 'rgba(255,180,50,.12)', borderRadius: 6, padding: '2px 8px' }}>⭐ super</span>}
          </h1>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>{user.phone}</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14,
        padding: '4px 20px', marginBottom: 24, border: '1px solid rgba(255,255,255,.08)' }}>
        <Row label="ID" value={user.id} />
        <Row label="Зарегистрирован" value={fmtDate(user.created_at)} />
        <Row label="Всего моментов" value={user.total_moments} />
        <Row label="Получено реакций" value={user.total_reactions_received} />
        <Row label="Статус" value={
          user.is_blocked
            ? `Заблокирован ${fmtDate(user.blocked_at)}`
            : (user.online ? 'Онлайн' : `Был(а) ${fmtDate(user.last_seen)}`)
        } />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button onClick={handleResetPassword}
          style={btnStyle('rgba(255,255,255,.1)')}>
          🔑 Сбросить пароль
        </button>

        {!isSelf && (
          user.is_blocked ? (
            <button onClick={handleUnblock} style={btnStyle('rgba(60,180,100,.25)')}>
              ✓ Разблокировать
            </button>
          ) : (
            <button onClick={() => setShowBlockForm(v => !v)} style={btnStyle('rgba(200,80,50,.3)')}>
              🚫 Заблокировать
            </button>
          )
        )}

        {!isSelf && (
          user.is_admin ? (
            <button onClick={handleRevokeAdmin} style={btnStyle('rgba(255,200,50,.2)')}>
              👑 Снять admin
            </button>
          ) : (
            <button onClick={handleMakeAdmin} style={btnStyle('rgba(120,90,200,.3)')}>
              👑 Назначить admin
            </button>
          )
        )}

        {user.is_super ? (
          <button onClick={handleRevokeSuper} style={btnStyle('rgba(255,180,50,.2)')}>
            ⭐ Снять Super
          </button>
        ) : (
          <button onClick={handleMakeSuper} style={btnStyle('rgba(80,160,255,.25)')}>
            ⭐ Назначить Super
          </button>
        )}
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
            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: '9px 13px',
              color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowBlockForm(false); setBlockReason(''); }}
              style={btnStyle('rgba(255,255,255,.08)')}>Отмена</button>
            <button onClick={handleBlock} style={btnStyle('rgba(200,50,50,.8)')}>
              Заблокировать
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function btnStyle(bg) {
  return {
    padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: 'none', background: bg,
    color: 'rgba(255,255,255,.85)', transition: 'opacity .15s',
  };
}
