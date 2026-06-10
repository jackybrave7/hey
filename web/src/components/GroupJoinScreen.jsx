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
      background: 'rgba(95, 64, 128,.5)', color:'#F9F0F0',
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
      .then(r => {
        // Если юзер уже состоит в этой группе — landing бессмысленен,
        // ведём сразу в чат. Replace, чтобы кнопка «Назад» в браузере
        // не возвращала на /gjoin.
        if (r.already_member && r.group?.id) {
          nav('/chat/' + r.group.id, { replace: true });
          return;
        }
        setInfo(r); setState('ok');
      })
      .catch(e => { setState('invalid'); setError(e.message); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrap = {
    minHeight: '100vh', background: 'var(--grad, linear-gradient(135deg,#1a0d3a,#0e0820))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  const card = {
    maxWidth: 460, width: '100%', background: 'rgba(20,12,40,.72)',
    border: '1px solid rgba(249,240,240,.14)', borderRadius: 18, padding: '32px 28px',
    color:'#F9F0F0', textAlign: 'center', backdropFilter: 'blur(20px)',
    boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  };

  async function handleAccept() {
    setBusy(true);
    try {
      const r = await api.groupInviteAccept(token);
      nav('/chat/' + r.conversationId);
    } catch (e) { setError(e.message); setBusy(false); }
  }

  function handleRegister() {
    sessionStorage.setItem('hey_group_invite', JSON.stringify({
      token,
      groupName:     info?.group?.name,
      inviterName:   info?.inviter?.name,
      inviterAvatar: info?.inviter?.avatar || null,
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
          <p style={{ color: 'rgba(230,225,250,.85)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
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
              border: '2px solid rgba(249,240,240,.18)' }}/>
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 18, fontSize: 36,
              background: 'rgba(95, 64, 128,.3)', border: '2px solid rgba(249,240,240,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{group.icon || '👥'}</div>
          )}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          {group.name}
        </h1>
        <div style={{ color: 'rgba(230,225,250,.8)', fontSize: 13, marginBottom: 20 }}>
          {group.member_count} участник{group.member_count % 10 === 1 && group.member_count % 100 !== 11 ? '' : 'а/ов'}
        </div>

        {/* Inviter */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', background: 'rgba(249,240,240,.06)',
          borderRadius: 50, marginBottom: 22,
        }}>
          <MiniAvatar avatar={inviter.avatar} name={inviter.name} size={28}/>
          <span style={{ fontSize: 13, color: 'rgba(249,240,240,.85)' }}>
            {inviter.name} приглашает тебя
          </span>
        </div>

        {error && (
          <div style={{ color: '#ff8080', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        {user ? (
          <button onClick={handleAccept} disabled={busy} style={{
            width: '100%', padding: '14px 28px', borderRadius: 12, border: 'none',
            background: 'rgba(140,110,220,.7)', color:'#F9F0F0', fontSize: 15, fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? '…' : 'Войти в группу'}
          </button>
        ) : (
          <>
            <button onClick={handleRegister} style={{
              width: '100%', padding: '14px 28px', borderRadius: 12, border: 'none',
              background: 'rgba(140,110,220,.7)', color:'#F9F0F0', fontSize: 15, fontWeight: 700,
              cursor: 'pointer', marginBottom: 10,
            }}>
              Зарегистрироваться и войти
            </button>
            <div style={{ marginTop: 4, color: 'rgba(230,225,250,.7)', fontSize: 13 }}>
              Уже есть аккаунт? <Link to={`/login?gjoin=${encodeURIComponent(token)}`} style={{ color: 'rgba(200,170,255,1)', fontWeight: 600 }}>Войти</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
