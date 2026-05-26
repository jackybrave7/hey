// GroupJoinScreen.jsx — landing-страница для /gjoin/:token
// Если юзер залогинен → кнопка «Войти в группу» (POST /group-invite/:token/accept)
// Если не залогинен → кнопка «Зарегистрироваться и войти» (→ /register с token в sessionStorage)
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

// Простой аватар-кружок (фото или инициал)
function MiniAvatar({ avatar, name, size = 28 }) {
  const isImg = avatar && /^https?:/.test(avatar);
  if (isImg) return <img src={avatar} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}/>;
  const letter = (name || '?')[0]?.toUpperCase() || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(120,90,200,.5)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 700,
    }}>{letter}</div>
  );
}

export default function GroupJoinScreen() {
  const { token } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [state, setState]   = useState('loading'); // loading | ok | invalid
  const [info, setInfo]     = useState(null);      // { group, inviter }
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); setError('Нет токена'); return; }
    api.groupInvitePreview(token)
      .then(r => { setInfo(r); setState('ok'); })
      .catch(e => { setState('invalid'); setError(e.message); });
  }, [token]);

  const wrap = {
    minHeight: '100vh', background: 'var(--grad, linear-gradient(135deg,#1a0d3a,#0e0820))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  const card = {
    maxWidth: 460, width: '100%', background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, padding: '32px 28px',
    color: 'white', textAlign: 'center', backdropFilter: 'blur(20px)',
  };

  async function handleAccept() {
    setBusy(true);
    try {
      const r = await api.groupInviteAccept(token);
      nav('/chats/' + r.conversationId);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  function handleRegister() {
    sessionStorage.setItem('hey_group_invite', JSON.stringify({
      token,
      groupName: info?.group?.name,
      inviterName: info?.inviter?.name,
    }));
    nav('/register');
  }

  if (state === 'loading') {
    return <div style={wrap}><div style={card}><div style={{ fontSize: 16, opacity: .7 }}>Проверяем приглашение…</div></div></div>;
  }

  if (state === 'invalid') {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Ссылка недействительна</h1>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 20 }}>
            {error || 'Возможно, ссылка устарела или приглашающий больше не админ группы.'}
          </p>
          <Link to="/" style={{ color: 'rgba(180,150,250,.95)', fontSize: 14 }}>← На главную</Link>
        </div>
      </div>
    );
  }

  const { group, inviter } = info;

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Group icon/avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          {group.icon && /^https?:/.test(group.icon) ? (
            <img src={group.icon} alt="" style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover',
              border: '2px solid rgba(255,255,255,.18)' }}/>
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 18, fontSize: 36,
              background: 'rgba(120,90,200,.3)', border: '2px solid rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{group.icon || '👥'}</div>
          )}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          {group.name}
        </h1>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 20 }}>
          {group.member_count} участник{group.member_count % 10 === 1 && group.member_count % 100 !== 11 ? '' : 'а/ов'}
        </div>

        {/* Inviter */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', background: 'rgba(255,255,255,.06)',
          borderRadius: 50, marginBottom: 22,
        }}>
          <MiniAvatar avatar={inviter.avatar} name={inviter.name} size={28}/>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>
            {inviter.name} приглашает тебя
          </span>
        </div>

        {error && (
          <div style={{ color: '#ff8080', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        {user ? (
          <button onClick={handleAccept} disabled={busy} style={{
            width: '100%', padding: '14px 28px', borderRadius: 12, border: 'none',
            background: 'rgba(140,110,220,.7)', color: 'white', fontSize: 15, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? '…' : 'Войти в группу'}
          </button>
        ) : (
          <>
            <button onClick={handleRegister} style={{
              width: '100%', padding: '14px 28px', borderRadius: 12, border: 'none',
              background: 'rgba(140,110,220,.7)', color: 'white', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', marginBottom: 10,
            }}>
              Зарегистрироваться и войти
            </button>
            <div style={{ marginTop: 4, color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
              Уже есть аккаунт? <Link to={`/login?gjoin=${encodeURIComponent(token)}`} style={{ color: 'rgba(180,150,250,.95)' }}>Войти</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
