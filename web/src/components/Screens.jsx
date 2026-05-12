// web/src/components/Screens.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { api, socket } from '../api';
import { useAuth } from '../AuthContext';
import {
  AuthBrand, FloatingInput, PasswordInput,
  InviteBadge, ForgotPasswordPopup
} from './auth/AuthComponents';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function DotsMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{position:'relative'}}>
      <div className="topbar-dots" style={{cursor:'pointer'}} onClick={() => setOpen(o => !o)}>
        {[0,1,2].map(i => <div key={i} className="topbar-dot"/>)}
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:100,
          background:'rgba(60,50,90,0.97)', backdropFilter:'blur(16px)',
          borderRadius:14, overflow:'hidden', minWidth:220,
          boxShadow:'0 8px 32px rgba(0,0,0,.35)'
        }}>
          {items.map(({ label, icon, danger, onClick }) => (
            <div key={label} onClick={() => { setOpen(false); onClick(); }}
              style={{
                padding:'13px 18px', color: danger ? '#ff6b6b' : 'white',
                fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                transition:'background .15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{fontSize:18}}>{icon}</span>{label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ title, onBack, right, avatar, online }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        {onBack && <button className="back-btn" onClick={onBack}>‹</button>}
        {avatar && (
          <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(210,185,225,.55)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
            {avatar}
          </div>
        )}
        <span className="topbar-title">{title}</span>
        {online && <div className="online-dot" />}
        {right ?? <div className="topbar-dots">{[0,1,2].map(i=><div key={i} className="topbar-dot"/>)}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal + useConfirm
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({ message, hint, requireWord, danger, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef();
  useEffect(() => { if (requireWord) setTimeout(() => inputRef.current?.focus(), 60); }, []);
  const canConfirm = !requireWord || typed.trim().toLowerCase() === requireWord.toLowerCase();

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,
      background:'rgba(0,0,0,.52)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
        borderRadius:22,padding:'28px 26px 22px',width:'min(92vw,380px)',
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(255,255,255,.13)',
        display:'flex',flexDirection:'column',gap:18
      }}>
        <div style={{color:'white',fontSize:15,lineHeight:1.6}}>{message}</div>

        {requireWord && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13}}>
              Введите <span style={{color:'rgba(255,160,160,.85)',fontWeight:600}}>«{requireWord}»</span> для подтверждения
            </div>
            <input ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
              placeholder={requireWord}
              onKeyDown={e=>{ if(e.key==='Enter'&&canConfirm) onConfirm(); if(e.key==='Escape') onCancel(); }}
              style={{
                background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',
                borderRadius:12,padding:'10px 14px',color:'white',fontSize:14,
                fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
                transition:'border-color .15s'
              }}
              onFocus={e=>e.target.style.borderColor='rgba(255,180,180,.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.2)'}/>
          </div>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancel}
            style={{padding:'10px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
              background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.14)',
              color:'rgba(255,255,255,.8)',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.16)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.09)'}>
            Отмена
          </button>
          <button onClick={canConfirm ? onConfirm : undefined}
            style={{
              padding:'10px 22px',borderRadius:14,fontSize:14,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              background: canConfirm
                ? (danger ? 'rgba(210,50,50,.75)' : 'rgba(100,80,160,.8)')
                : 'rgba(255,255,255,.07)',
              border:'1px solid ' + (canConfirm
                ? (danger ? 'rgba(255,100,100,.4)' : 'rgba(180,140,220,.4)')
                : 'rgba(255,255,255,.1)'),
              color: canConfirm ? 'white' : 'rgba(255,255,255,.3)',
              transition:'all .2s',fontWeight: canConfirm ? 600 : 400
            }}
            onMouseEnter={e=>{ if(canConfirm) e.currentTarget.style.opacity='.85'; }}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            {requireWord ? 'Удалить' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = (message, options = {}) => new Promise(resolve => {
    resolveRef.current = resolve;
    setDialog({ message, ...options });
  });

  const handleConfirm = () => { resolveRef.current?.(true);  setDialog(null); };
  const handleCancel  = () => { resolveRef.current?.(false); setDialog(null); };

  const modal = dialog ? (
    <ConfirmModal
      message={dialog.message}
      hint={dialog.hint}
      requireWord={dialog.requireWord}
      danger={dialog.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [confirm, modal];
}

function FieldLine({ value }) {
  return (
    <div>
      <div style={{color:'white',fontSize:17,paddingBottom:4}}>{value}</div>
      <div className="divider"/>
    </div>
  );
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('ru', { day:'numeric', month:'long', year:'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// SplashScreen
// ─────────────────────────────────────────────────────────────────────────────

export function SplashScreen() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    nav(user ? '/main' : '/hey', { replace: true });
  }, [loading, user, nav]);

  // While auth is resolving — show the logo blob without any percentage counter
  return (
    <div className="screen"
      style={{justifyContent:'center',alignItems:'center',position:'relative'}}>
      <div style={{
        width:220, height:220,
        background:'radial-gradient(ellipse at 40% 38%, #B8A8CC, #A898BC 45%, #9080AA)',
        borderRadius:'62% 52% 60% 48% / 55% 62% 46% 60%',
        display:'flex', alignItems:'center', justifyContent:'center',
        animation:'blob 4s ease-in-out infinite'
      }}>
        <span style={{color:'white',fontSize:36,fontWeight:700,letterSpacing:3,fontFamily:'Comfortaa,sans-serif'}}>HEY</span>
      </div>
      <style>{`@keyframes blob{0%,100%{border-radius:62% 52% 60% 48%/55% 62% 46% 60%}50%{border-radius:52% 66% 52% 58%/66% 50% 56% 48%}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeyScreen
// ─────────────────────────────────────────────────────────────────────────────

export function HeyScreen() {
  const nav = useNavigate();
  return (
    <div className="screen" style={{justifyContent:'center',alignItems:'center',position:'relative'}}>
      <div onClick={() => nav('/login')} style={{
        width:240, height:240, borderRadius:'50%',
        border:'3px solid rgba(255,255,255,.82)',
        background:'rgba(165,148,195,.38)',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', transition:'transform .2s'
      }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.04)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <span style={{fontSize:46,fontWeight:300,color:'rgba(75,62,120,.85)',letterSpacing:5}}>HEY</span>
      </div>
      <span onClick={() => nav('/login')} style={{
        position:'absolute', bottom:52, color:'rgba(255,255,255,.5)',
        fontSize:28, cursor:'pointer', animation:'bounce 2s infinite'
      }}>⌄</span>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen
// ─────────────────────────────────────────────────────────────────────────────

export function LoginScreen() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function handleLogin() {
    setErr('');
    const pv = validatePhone(phone);
    if (!pv.ok) { setErr(pv.msg); return; }
    setLoading(true);
    try {
      const res = await api.login({ phone: pv.normalized, password });
      login(res.token, res.user);
      nav('/main');
    } catch(e) {
      setErr('Неверный телефон или пароль');
    }
    setLoading(false);
  }

  return (
    <div className="screen" style={{
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 24px', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <AuthBrand />

        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          color: 'white', marginBottom: 22,
          animation: 'authFadeUp .6s ease-out .1s both'
        }}>
          С возвращением
        </div>

        <div style={{ animation: 'authFadeUp .6s ease-out .2s both' }}>
          <FloatingInput
            id="login-phone" label="Телефон" type="tel"
            value={phone}
            onChange={e => setPhone(formatPhoneInput(e.target.value))}
            autoComplete="tel"
          />
          <PasswordInput
            id="login-pwd" label="Пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          <div style={{ textAlign: 'right', margin: '-4px 4px 18px' }}>
            <span
              onClick={() => setShowForgot(true)}
              style={{
                color: 'rgba(255,255,255,.72)', fontSize: 13,
                textDecoration: 'none', cursor: 'pointer',
                borderBottom: '1px dashed rgba(255,255,255,.4)',
                paddingBottom: 1
              }}
            >
              Забыли пароль?
            </span>
          </div>

          {err && (
            <div style={{ color: '#ffaaaa', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              {err}
            </div>
          )}

          <button className="auth-btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(255,255,255,.68)', fontSize: 14 }}>
            Нет аккаунта?{' '}
            <span
              onClick={() => nav('/register')}
              style={{ color: 'white', fontWeight: 700, cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,.5)', paddingBottom: 1 }}
            >
              Создать
            </span>
          </div>
        </div>

        {/* Value props */}
        <div style={{
          marginTop: 44, display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'authFadeUp .6s ease-out .4s both'
        }}>
          {[
            { icon: '✦', text: 'Покажи над чем работаешь' },
            { icon: '🤝', text: 'Найди соавторов и проекты' },
            { icon: '🔇', text: 'Чаты без рекламы и алгоритмов' },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              fontSize: 13, color: 'rgba(255,255,255,.62)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
              <span style={{ fontSize: 14 }}>{icon}</span>{text}
            </div>
          ))}
        </div>
      </div>

      {showForgot && (
        <ForgotPasswordPopup
          onClose={() => setShowForgot(false)}
          tgUsername={window.__HEY_TG_SUPPORT__ || 'hey_support'}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone validation helper
// ─────────────────────────────────────────────────────────────────────────────

function validatePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, msg: 'Слишком короткий номер' };
  if (digits.length > 12) return { ok: false, msg: 'Слишком длинный номер' };
  return { ok: true, normalized: '+' + (digits.startsWith('8') ? '7' + digits.slice(1) : digits) };
}

function formatPhoneInput(val) {
  const d = val.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  let r = '+7';
  if (d.length > 1) r += ' (' + d.slice(1, 4);
  if (d.length >= 4) r += ') ' + d.slice(4, 7);
  if (d.length >= 7) r += '-' + d.slice(7, 9);
  if (d.length >= 9) r += '-' + d.slice(9, 11);
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// AvatarPicker — shared between Register and MyProfile
// ─────────────────────────────────────────────────────────────────────────────

function AvatarPicker({ avatar, onChange, size = 136, disabled = false }) {
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл больше 5 МБ'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div
      onClick={() => !disabled && fileRef.current.click()}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatar ? 'transparent' : 'rgba(130,112,158,.42)',
        border: '3px solid rgba(255,255,255,.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', overflow: 'hidden', position: 'relative',
        transition: 'opacity .2s'
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '.8'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {avatar
        ? <img src={avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="avatar"/>
        : <span style={{fontSize: size * 0.32, color: 'rgba(255,255,255,.7)'}}>+</span>
      }
      {!disabled && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.35)',
          display:'flex', alignItems:'center', justifyContent:'center',
          opacity: 0, transition:'opacity .2s',
          borderRadius:'50%', fontSize:13, color:'white', textAlign:'center', padding:8
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
        >📷<br/>Сменить</div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RegisterScreen
// ─────────────────────────────────────────────────────────────────────────────

export function RegisterScreen() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [inviter, setInviter]   = useState(null);

  // Load inviter info if invite code present
  useEffect(() => {
    if (!inviteCode) return;
    api.getUserInviteInfo(inviteCode)
      .then(setInviter)
      .catch(() => {});
  }, [inviteCode]);

  async function handleRegister() {
    setErr('');
    if (!name.trim()) { setErr('Введите имя'); return; }
    const pv = validatePhone(phone);
    if (!pv.ok) { setErr(pv.msg); return; }
    if (password.length < 8) { setErr('Пароль минимум 8 символов'); return; }
    setLoading(true);
    try {
      const res = await api.register({
        name: name.trim(), phone: pv.normalized, password,
        ...(inviteCode ? { invited_by: inviteCode } : {})
      });
      login(res.token, res.user);
      nav('/welcome', { state: { isNewUser: true, userName: name.trim() } });
    } catch(e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div className="screen" style={{
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 24px', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <AuthBrand />

        {inviter && <InviteBadge name={inviter.name} avatar={inviter.avatar_url} />}

        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          color: 'white', marginBottom: 22,
          animation: 'authFadeUp .6s ease-out .15s both'
        }}>
          Создать аккаунт
        </div>

        <div style={{ animation: 'authFadeUp .6s ease-out .25s both' }}>
          <FloatingInput id="reg-name" label="Имя" value={name}
            onChange={e => setName(e.target.value)} autoComplete="name" />
          <FloatingInput id="reg-phone" label="Телефон" type="tel" value={phone}
            onChange={e => setPhone(formatPhoneInput(e.target.value))} autoComplete="tel" />
          <PasswordInput id="reg-pwd" label="Придумай пароль" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRegister()} />

          <div style={{ color: 'rgba(255,255,255,.52)', fontSize: 12, margin: '-4px 4px 18px', lineHeight: 1.5 }}>
            Минимум 8 символов. Аватар и день рождения добавишь потом в профиле.
          </div>

          {err && (
            <div style={{ color: '#ffaaaa', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{err}</div>
          )}

          <button className="auth-btn-primary" onClick={handleRegister} disabled={loading}>
            {loading ? 'Создаём…' : inviteCode ? 'Принять приглашение' : 'Создать аккаунт'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(255,255,255,.68)', fontSize: 14 }}>
            Уже есть аккаунт?{' '}
            <span
              onClick={() => nav('/login')}
              style={{ color: 'white', fontWeight: 700, cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,.5)', paddingBottom: 1 }}
            >
              Войти
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SuccessScreen (legacy — kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────

export function SuccessScreen() {
  const nav = useNavigate();
  useEffect(() => { const t = setTimeout(() => nav('/main'), 2000); return () => clearTimeout(t); }, []);
  return (
    <div className="screen" style={{justifyContent:'center',alignItems:'center',gap:16}}>
      <span style={{fontSize:44}}>🙂</span>
      <span style={{color:'white',fontSize:19}}>Профиль успешно создан!</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WelcomeScreen — shown after registration
// ─────────────────────────────────────────────────────────────────────────────

export function WelcomeScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Guard: if arrived without isNewUser flag, redirect to main
  useEffect(() => {
    if (!location.state?.isNewUser) nav('/main', { replace: true });
  }, []);

  const name = location.state?.userName || user?.name || '';
  const initial = name ? name[0].toUpperCase() : '?';

  const steps = [
    { icon: '✦', title: 'Создать свой первый момент', sub: 'Покажи над чем работаешь', action: () => nav('/main') },
    { icon: '👥', title: 'Добавить контакты',          sub: 'По номеру или импорт из телефона', action: () => nav('/contacts') },
    { icon: '🎨', title: 'Заполнить профиль',          sub: 'Аватар, имя, день рождения', action: () => nav('/profile/me') },
  ];

  return (
    <div className="screen" style={{
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 24px', overflowY: 'auto'
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Avatar circle */}
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, #a888d0, #7858b0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 42, fontWeight: 700,
          margin: '0 auto 22px',
          boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          animation: 'authFadeUp .5s ease-out both'
        }}>
          {initial}
        </div>

        <div style={{
          fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8,
          animation: 'authFadeUp .5s ease-out .1s both'
        }}>
          Привет, {name}!
        </div>
        <div style={{
          fontSize: 15, color: 'rgba(255,255,255,.72)', marginBottom: 30, lineHeight: 1.55,
          animation: 'authFadeUp .5s ease-out .15s both'
        }}>
          Ты в HEY. Что хочешь сделать первым?
        </div>

        {/* Next steps */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28,
          animation: 'authFadeUp .5s ease-out .2s both'
        }}>
          {steps.map(({ icon, title, sub, action }) => (
            <div key={title} onClick={action} style={{
              background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.18)',
              borderRadius: 16, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left',
              transition: 'all .15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(255,255,255,.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.58)' }}>{sub}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 10,
          animation: 'authFadeUp .5s ease-out .3s both'
        }}>
          <button onClick={() => nav('/main')} style={{
            flex: 1, background: 'rgba(255,255,255,.1)',
            border: '1px solid rgba(255,255,255,.22)',
            borderRadius: 26, padding: 15, color: 'white',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background .15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
          >
            Пропустить
          </button>
          <button className="auth-btn-primary" onClick={() => nav('/main')} style={{ flex: 1 }}>
            Создать момент
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

export function MyProfileScreen() {
  const nav = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatar, setAvatar]     = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Password change state
  const [showPwdModal,  setShowPwdModal]  = useState(false);
  const [oldPwd,        setOldPwd]        = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [newPwd2,       setNewPwd2]       = useState('');
  const [pwdErr,        setPwdErr]        = useState('');
  const [pwdSaving,     setPwdSaving]     = useState(false);

  async function submitPasswordChange() {
    setPwdErr('');
    if (!oldPwd || !newPwd || !newPwd2) { setPwdErr('Заполните все поля'); return; }
    if (newPwd !== newPwd2) { setPwdErr('Новые пароли не совпадают'); return; }
    if (newPwd.length < 4) { setPwdErr('Пароль минимум 4 символа'); return; }
    setPwdSaving(true);
    try {
      await api.changePassword(oldPwd, newPwd);
      setShowPwdModal(false);
      setOldPwd(''); setNewPwd(''); setNewPwd2('');
      showProfileToast('✓ Пароль изменён');
    } catch(e) {
      setPwdErr(e.message || 'Ошибка');
    }
    setPwdSaving(false);
  }

  // Moments state
  const [momentsTab,    setMomentsTab]   = useState('active');
  const [myMoments,     setMyMoments]    = useState([]);
  const [disciplines,   setDisciplines]  = useState([]);
  const [momentsLoaded, setMomentsLoaded] = useState(false);
  const [profileToast,  setProfileToast] = useState('');

  const showProfileToast = (msg) => {
    setProfileToast(msg);
    setTimeout(() => setProfileToast(''), 3000);
  };

  // Init from user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setBirthday(user.birthday || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Load moments
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [all, disc] = await Promise.all([
          api.getMyMoments('all'),
          api.getDisciplines(user.id),
        ]);
        setMyMoments(all);
        setDisciplines(disc);
      } catch {}
      setMomentsLoaded(true);
    };
    load();
  }, [user]);

  function startEdit() {
    setEditing(true);
    setSaved(false);
  }

  function cancelEdit() {
    setEditing(false);
    setPhoneErr('');
    // Reset to saved values
    setName(user.name || '');
    setPhone(user.phone || '');
    setBirthday(user.birthday || '');
    setAvatar(user.avatar || '');
  }

  async function saveProfile() {
    const pv = validatePhone(phone);
    if (!pv.ok) { setPhoneErr(pv.msg); return; }
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name: name.trim(),
        phone: pv.normalized,
        birthday: birthday || null,
        avatar: avatar || null
      });
      setUser(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  // Parse birthday for display boxes
  const bdayParts = birthday ? birthday.split('-') : ['', '', ''];
  const [bdayY, bdayM, bdayD] = bdayParts;

  return (
    <div style={{minHeight:'100vh',background:'var(--grad)',paddingBottom:80}}>

      {/* Sticky header */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'14px 20px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3}}>Профиль</div>
          {editing ? (
            <div style={{display:'flex',gap:8}}>
              <button onClick={cancelEdit} style={{background:'rgba(255,255,255,.15)',border:'none',
                borderRadius:50,padding:'7px 16px',color:'white',fontSize:13,cursor:'pointer'}}>
                Отмена
              </button>
              <button onClick={saveProfile} disabled={saving} style={{
                padding:'7px 18px',borderRadius:50,fontSize:13,fontWeight:700,cursor:'pointer',
                background: saving ? 'rgba(100,78,148,.4)' : 'rgba(120,90,200,.85)',
                border:'none',color:'white'}}>
                {saving ? '…' : 'Сохранить'}
              </button>
            </div>
          ) : (
            <button onClick={startEdit}
              style={{padding:'8px 16px',borderRadius:50,fontSize:13,fontWeight:700,cursor:'pointer',
                background:'rgba(120,90,200,.85)',border:'none',color:'white',
                boxShadow:'0 2px 12px rgba(120,80,200,.4)'}}>
              ✎ Изменить
            </button>
          )}
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'0 0 20px'}}>

      {saved && (
        <div style={{margin:'16px 20px 0',background:'rgba(46,204,113,.3)',border:'1px solid rgba(46,204,113,.5)',
          borderRadius:12,padding:'8px 14px',color:'white',fontSize:14,textAlign:'center'}}>
          ✓ Профиль сохранён
        </div>
      )}

      {/* Avatar + fields */}
      <div style={{display:'flex',gap:22,padding:'0 26px',alignItems:'flex-start'}}>
        <AvatarPicker avatar={avatar} onChange={v => { setAvatar(v); }} size={130} disabled={!editing}/>

        <div style={{flex:1,display:'flex',flexDirection:'column',gap:16,paddingTop:8}}>

          {/* Имя */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>Имя</div>
              <input className="ul-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Имя"/>
            </div>
          ) : <FieldLine value={name || '—'}/>}

          {/* Телефон */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>Телефон</div>
              <input className="ul-input" value={phone}
                onChange={e=>{ setPhone(formatPhoneInput(e.target.value)); setPhoneErr(''); }}
                placeholder="+7 (___) ___-__-__" type="tel"/>
              {phoneErr && <div style={{color:'#ffaaaa',fontSize:12,marginTop:4}}>{phoneErr}</div>}
            </div>
          ) : <FieldLine value={phone || '—'}/>}

          {/* Дата рождения */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>Дата рождения</div>
              <input className="ul-input" value={birthday}
                onChange={e=>setBirthday(e.target.value)}
                placeholder="ГГГГ-ММ-ДД" type="date"
                style={{colorScheme:'dark'}}/>
            </div>
          ) : (
            <div style={{display:'flex',gap:8}}>
              <div className="bday-box">{bdayD||'ДД'}</div>
              <div className="bday-box">{bdayM||'ММ'}</div>
              <div className="bday-box">{bdayY||'ГГГГ'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Hint when not editing */}
      {!editing && (
        <div style={{padding:'24px 26px 0',color:'rgba(255,255,255,.4)',fontSize:13}}>
          Нажмите ✎ чтобы редактировать профиль
        </div>
      )}

      {/* Shortcuts */}
      {!editing && (
        <div style={{padding:'24px 26px 0',display:'flex',flexDirection:'column',gap:10}}>
          <button onClick={() => nav('/settings')}
            style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'13px 18px',borderRadius:14,cursor:'pointer',
              background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',
              color:'white',fontSize:14,fontWeight:500,
            }}>
            <span>⚙️ Настройки</span>
            <span style={{opacity:.4}}>›</span>
          </button>
          <button onClick={() => { setShowPwdModal(true); setPwdErr(''); }}
            style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'13px 18px',borderRadius:14,cursor:'pointer',
              background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',
              color:'white',fontSize:14,fontWeight:500,
            }}>
            <span>🔑 Сменить пароль</span>
            <span style={{opacity:.4}}>›</span>
          </button>
          <button onClick={async () => {
            if (await customConfirm('Выйти из аккаунта?')) { logout(); nav('/login'); }
          }} style={{
            display:'flex',alignItems:'center',
            background:'rgba(255,90,90,.18)', border:'1px solid rgba(255,120,120,.4)',
            borderRadius:14, padding:'13px 18px', color:'rgba(255,200,200,.95)',
            fontSize:14, cursor:'pointer', transition:'background .15s',
          }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,90,90,.32)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,90,90,.18)'}>
            Выйти из аккаунта
          </button>
        </div>
      )}

      {/* Moments section */}
      {!editing && (
        <div style={{padding:'28px 20px 0'}}>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:11,textTransform:'uppercase',
            letterSpacing:.8,marginBottom:14}}>Мои моменты</div>

          {/* Tabs */}
          <div style={{display:'flex',gap:8,marginBottom:14}}>
            {[
              { key:'active',   label:`Активный` },
              { key:'archived', label:`Архив (${myMoments.filter(m=>m.status==='archived').length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setMomentsTab(tab.key)}
                style={{
                  padding:'7px 18px',borderRadius:50,fontSize:13,fontWeight:600,cursor:'pointer',
                  background: momentsTab === tab.key ? 'rgba(120,90,200,.8)' : 'rgba(255,255,255,.08)',
                  border: momentsTab === tab.key ? '1px solid rgba(180,140,255,.4)' : '1px solid rgba(255,255,255,.1)',
                  color: momentsTab === tab.key ? 'white' : 'rgba(255,255,255,.5)',
                  transition:'all .18s',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active tab */}
          {momentsTab === 'active' && (
            <div>
              {(() => {
                const active = myMoments.find(m => m.status === 'active');
                if (!active) return (
                  <div style={{background:'rgba(255,255,255,.04)',borderRadius:16,
                    padding:'24px',textAlign:'center',border:'2px dashed rgba(255,255,255,.1)'}}>
                    <div style={{fontSize:28,marginBottom:10}}>✦</div>
                    <div style={{color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600}}>
                      Нет активного момента
                    </div>
                    <div style={{color:'rgba(255,255,255,.35)',fontSize:12,marginTop:6}}>
                      Опубликуй первый момент на главном экране
                    </div>
                  </div>
                );
                return (
                  <div style={{background:'rgba(255,255,255,.06)',borderRadius:16,
                    border:'1px solid rgba(255,255,255,.1)',overflow:'hidden'}}>
                    {active.media_url && active.media_type === 'image' && (
                      <img src={active.media_url} alt=""
                        style={{width:'100%',height:140,objectFit:'cover',display:'block'}}/>
                    )}
                    <div style={{padding:'14px 16px'}}>
                      <div style={{color:'rgba(255,255,255,.85)',fontSize:14,lineHeight:1.6,
                        overflow:'hidden',display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical'}}>
                        {active.text}
                      </div>
                      {active.auto_tags?.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
                          {active.auto_tags.map(tag => (
                            <span key={tag} style={{border:'1px dashed rgba(255,255,255,.2)',
                              borderRadius:20,padding:'2px 10px',fontSize:11,
                              color:'rgba(255,255,255,.45)'}}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{display:'flex',gap:8,marginTop:14}}>
                        <div style={{flex:1,background:'rgba(255,255,255,.06)',borderRadius:12,
                          padding:'10px',textAlign:'center'}}>
                          <div style={{color:'rgba(255,255,255,.6)',fontSize:13}}>
                            👁 {active.views || 0}
                          </div>
                          <div style={{color:'rgba(255,255,255,.3)',fontSize:10,marginTop:2}}>просмотров</div>
                        </div>
                        <div style={{flex:1,background:'rgba(255,255,255,.06)',borderRadius:12,
                          padding:'10px',textAlign:'center'}}>
                          <div style={{color:'rgba(255,255,255,.6)',fontSize:13}}>
                            ✨ {active.stats?.resonate || 0}
                          </div>
                          <div style={{color:'rgba(255,255,255,.3)',fontSize:10,marginTop:2}}>резонирует</div>
                        </div>
                        <div style={{flex:1,background:'rgba(255,255,255,.06)',borderRadius:12,
                          padding:'10px',textAlign:'center'}}>
                          <div style={{color:'rgba(255,255,255,.6)',fontSize:13}}>
                            🤝 {active.stats?.talk || 0}
                          </div>
                          <div style={{color:'rgba(255,255,255,.3)',fontSize:10,marginTop:2}}>поговорить</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,marginTop:10}}>
                        <button onClick={async () => {
                          try {
                            await api.archiveMoment(active.id);
                            setMyMoments(prev => prev.map(m => m.id === active.id ? {...m, status:'archived'} : m));
                            showProfileToast('📦 Момент отправлен в архив');
                          } catch(e) { showProfileToast('Ошибка: ' + e.message); }
                        }} style={{flex:1,padding:'10px',borderRadius:12,background:'rgba(255,255,255,.08)',
                          border:'none',color:'rgba(255,255,255,.6)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                          📦 В архив
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Archive tab */}
          {momentsTab === 'archived' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {myMoments.filter(m => m.status === 'archived').length === 0 ? (
                <div style={{color:'rgba(255,255,255,.35)',fontSize:13,textAlign:'center',
                  padding:'20px 0'}}>
                  Архив пуст
                </div>
              ) : (
                myMoments.filter(m => m.status === 'archived').map(m => (
                  <div key={m.id} style={{background:'rgba(255,255,255,.05)',borderRadius:14,
                    padding:'12px 14px',border:'1px solid rgba(255,255,255,.08)',
                    display:'flex',alignItems:'center',gap:12}}>
                    {m.media_url && m.media_type === 'image' && (
                      <img src={m.media_url} alt=""
                        style={{width:48,height:48,borderRadius:10,objectFit:'cover',flexShrink:0}}/>
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:'rgba(255,255,255,.75)',fontSize:13,lineHeight:1.5,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {m.text}
                      </div>
                      <div style={{color:'rgba(255,255,255,.3)',fontSize:11,marginTop:3}}>
                        {m.archived_at
                          ? new Date(m.archived_at * 1000).toLocaleDateString('ru', {day:'numeric',month:'short'})
                          : ''}
                      </div>
                    </div>
                    <button onClick={async () => {
                      const active = myMoments.find(x => x.status === 'active');
                      if (active) {
                        showProfileToast('Сначала отправь текущий момент в архив');
                        return;
                      }
                      try {
                        const restored = await api.restoreMoment(m.id);
                        setMyMoments(prev => prev.map(x => x.id === m.id ? {...x, status:'active'} : x));
                        showProfileToast('✦ Момент восстановлен');
                      } catch(e) { showProfileToast('Ошибка: ' + e.message); }
                    }} style={{background:'rgba(120,90,200,.6)',border:'none',borderRadius:10,
                      padding:'7px 12px',color:'white',fontSize:12,fontWeight:600,cursor:'pointer',
                      flexShrink:0}}>
                      ↩ Вернуть
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Disciplines cloud */}
          {disciplines.length > 0 && (
            <div style={{marginTop:24,padding:'14px 16px',
              background:'rgba(255,255,255,.05)',borderRadius:16,
              border:'1px solid rgba(255,255,255,.08)'}}>
              <div style={{color:'rgba(255,255,255,.4)',fontSize:11,
                textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>
                Дисциплины
              </div>
              <div style={{color:'rgba(255,255,255,.7)',fontSize:14,lineHeight:1.8}}>
                Чаще всего публикует{' '}
                {disciplines.slice(0,3).map((d, i) => (
                  <span key={d.tag}>
                    {i > 0 && (i === disciplines.slice(0,3).length - 1 ? ' и ' : ', ')}
                    <strong style={{color:'rgba(200,160,255,.9)'}}>{d.tag}</strong>
                    {' '}
                    <span style={{color:'rgba(255,255,255,.35)',fontSize:12}}>({d.count})</span>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>
                {disciplines.map(d => (
                  <span key={d.tag} style={{
                    background:'rgba(120,90,200,.2)',border:'1px solid rgba(180,140,255,.2)',
                    borderRadius:20,padding:'4px 12px',fontSize:12,
                    color:'rgba(200,170,255,.8)',
                  }}>
                    {d.tag} · {d.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {profileToast && (
        <div style={{
          position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50,padding:'10px 20px',
          color:'white',fontSize:14,fontWeight:600,
          zIndex:1000,whiteSpace:'nowrap',
        }}>
          {profileToast}
        </div>
      )}

      {confirmModal}

      {/* Password change modal */}
      {showPwdModal && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.6)',
          backdropFilter:'blur(10px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget){ setShowPwdModal(false); }}}>
          <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
            borderRadius:24,width:'min(100%,420px)',
            boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(255,255,255,.1)',
            overflow:'hidden'}}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',padding:'16px 20px',
              borderBottom:'1px solid rgba(255,255,255,.08)'}}>
              <span style={{color:'white',fontSize:17,fontWeight:700,flex:1}}>🔑 Смена пароля</span>
              <button onClick={()=>setShowPwdModal(false)} style={{background:'none',border:'none',
                color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>
            {/* Fields */}
            <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
              {[
                { label:'Текущий пароль', value:oldPwd,  set:setOldPwd },
                { label:'Новый пароль',   value:newPwd,  set:setNewPwd },
                { label:'Повторите новый',value:newPwd2, set:setNewPwd2 },
              ].map(f => (
                <div key={f.label}>
                  <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:5}}>{f.label}</div>
                  <input type="password" value={f.value} onChange={e=>f.set(e.target.value)}
                    className="ul-input" placeholder="••••••••"
                    onKeyDown={e=>e.key==='Enter'&&submitPasswordChange()}/>
                </div>
              ))}
              {pwdErr && (
                <div style={{color:'rgba(255,140,140,.9)',fontSize:13,
                  background:'rgba(200,50,50,.12)',borderRadius:10,padding:'8px 12px'}}>
                  {pwdErr}
                </div>
              )}
            </div>
            {/* Footer */}
            <div style={{padding:'4px 20px 20px'}}>
              <button onClick={submitPasswordChange} disabled={pwdSaving}
                style={{width:'100%',padding:'13px',borderRadius:50,fontSize:15,fontWeight:700,
                  cursor:pwdSaving?'not-allowed':'pointer',border:'none',color:'white',
                  background:pwdSaving?'rgba(255,255,255,.1)':'rgba(120,90,200,.85)',
                  transition:'all .2s',boxShadow:pwdSaving?'none':'0 4px 20px rgba(120,80,200,.35)'}}>
                {pwdSaving ? 'Сохраняем…' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>{/* end 680 inner wrapper */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MainScreen
// ─────────────────────────────────────────────────────────────────────────────

export function MainScreen() {
  const nav = useNavigate();
  const items = [
    { label:'Контакты',        path:'/contacts' },
    { label:'Сообщения',       path:'/conversations' },
    { label:'История звонков', path:'/calls' },
    { label:'Настройки',       path:'/settings' },
  ];
  return (
    <div className="screen">
      <div className="topbar">
        <span className="topbar-title">Главная</span>
        <div onClick={() => nav('/profile/me')} style={{width:32,height:32,borderRadius:'50%',background:'white',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,
          color:'#7A6AAA',cursor:'pointer',marginRight:8}}>Я</div>
        <div className="topbar-dots">{[0,1,2].map(i=><div key={i} className="topbar-dot"/>)}</div>
      </div>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'28px 26px',display:'flex',flexDirection:'column'}}>
        {items.map(item => (
          <div key={item.label}>
            <div onClick={() => nav(item.path)} style={{color:'white',fontSize:21,padding:'24px 0',
              cursor:'pointer',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.6'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              {item.label}
            </div>
            <div className="divider"/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContactCardModal
// ─────────────────────────────────────────────────────────────────────────────

// Show emoji avatar or first letter; never render long strings / URLs as text
function AvatarDisplay({ avatar, name, size = 52, fontSize = 20, radius = '50%', style = {} }) {
  const letter = (name || '?')[0].toUpperCase();
  const isImg  = avatar && (avatar.startsWith('/') || avatar.startsWith('http') || avatar.startsWith('data:'));
  const isEmoji = avatar && avatar.length <= 4 && !isImg;
  return (
    <div style={{
      width:size, height:size, borderRadius:radius,
      background:'rgba(200,160,210,.45)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize, color:'white', fontWeight:600, flexShrink:0,
      overflow:'hidden', ...style
    }}>
      {isImg
        ? <img src={avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        : isEmoji ? avatar : letter}
    </div>
  );
}

function ContactCardModal({ contact, isBlocked, onClose, onChat, onBlock, onUnblock, onNotesChange }) {
  const [notes, setNotes]         = useState(contact.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [avatarFull, setAvatarFull] = useState(false);
  const saveTimer = useRef();

  // Determine if avatar is a real image (not emoji/letter)
  const av = contact.avatar;
  const avatarIsImg = av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));

  function handleNotesChange(val) {
    setNotes(val);
    setNotesSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await api.updateContactNotes(contact.id, val).catch(console.error);
      onNotesChange?.(contact.id, val);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 1500);
    }, 700);
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.55)',
      backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(92vw,380px)',
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(255,255,255,.13)',
        display:'flex',flexDirection:'column',overflow:'hidden'
      }}>
        {/* Avatar header */}
        <div style={{position:'relative',
          background:'linear-gradient(160deg,rgba(92,79,148,.8),rgba(140,90,160,.6))',
          padding:'32px 24px 24px',display:'flex',flexDirection:'column',alignItems:'center',gap:14
        }}>
          <div
            onClick={() => avatarIsImg && setAvatarFull(true)}
            style={{cursor: avatarIsImg ? 'zoom-in' : 'default', position:'relative'}}
            onMouseEnter={e => { if (avatarIsImg) e.currentTarget.querySelector('.av-zoom').style.opacity='1'; }}
            onMouseLeave={e => { if (avatarIsImg) e.currentTarget.querySelector('.av-zoom').style.opacity='0'; }}>
            <AvatarDisplay avatar={contact.avatar} name={contact.nickname||contact.name}
              size={96} fontSize={42}
              style={{boxShadow:'0 8px 24px rgba(0,0,0,.3)',border:'3px solid rgba(255,255,255,.25)'}}/>
            <div className="av-zoom" style={{
              position:'absolute',inset:0,borderRadius:'50%',opacity:0,transition:'opacity .2s',
              background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',
              pointerEvents:'none',fontSize:22
            }}>🔍</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{color:'white',fontSize:20,fontWeight:700}}>
              {contact.nickname || contact.name}
            </div>
            {contact.nickname && (
              <div style={{color:'rgba(255,255,255,.55)',fontSize:14,marginTop:2}}>{contact.name}</div>
            )}
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13,marginTop:4}}>{contact.phone}</div>
          </div>
          <button onClick={onClose}
            style={{position:'absolute',top:16,right:16,background:'none',border:'none',
              color:'rgba(255,255,255,.5)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        {/* Body */}
        <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:16}}>
          {/* Notes */}
          <div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:6,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Личные заметки</span>
              {notesSaved && <span style={{color:'rgba(120,220,120,.8)',fontSize:11}}>Сохранено ✓</span>}
            </div>
            <textarea value={notes} onChange={e=>handleNotesChange(e.target.value)}
              placeholder="Заметки видны только вам…"
              rows={3}
              style={{
                width:'100%',boxSizing:'border-box',
                background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                borderRadius:12,padding:'10px 13px',color:'white',fontSize:14,
                fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.5,
                transition:'border-color .15s'
              }}
              onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.15)'}/>
          </div>

          {/* Actions */}
          <div style={{display:'flex',gap:10}}>
            <button onClick={onChat}
              style={{flex:1,padding:'12px 0',background:'rgba(100,80,160,.75)',
                border:'1px solid rgba(180,140,220,.4)',borderRadius:14,
                color:'white',fontSize:14,fontWeight:600,cursor:'pointer',transition:'background .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(120,95,180,.85)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(100,80,160,.75)'}>
              ✉ Написать
            </button>
            {isBlocked ? (
              <button onClick={onUnblock}
                style={{flex:1,padding:'12px 0',background:'rgba(60,160,80,.4)',
                  border:'1px solid rgba(100,200,120,.4)',borderRadius:14,
                  color:'rgba(140,240,160,.9)',fontSize:14,cursor:'pointer',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(60,160,80,.6)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(60,160,80,.4)'}>
                ✓ Разблокировать
              </button>
            ) : (
              <button onClick={onBlock}
                style={{flex:1,padding:'12px 0',background:'rgba(180,50,50,.3)',
                  border:'1px solid rgba(220,80,80,.3)',borderRadius:14,
                  color:'rgba(255,140,140,.9)',fontSize:14,cursor:'pointer',transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(180,50,50,.5)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(180,50,50,.3)'}>
                🚫 Заблокировать
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Avatar fullscreen lightbox */}
      {avatarFull && (
        <div
          onClick={() => setAvatarFull(false)}
          style={{
            position:'fixed',inset:0,zIndex:600,
            background:'rgba(0,0,0,.88)',backdropFilter:'blur(18px)',
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'
          }}>
          <img
            src={contact.avatar}
            alt={contact.name}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth:'min(92vw,900px)',maxHeight:'88vh',
              objectFit:'contain',borderRadius:12,
              boxShadow:'0 32px 80px rgba(0,0,0,.7)',
              userSelect:'none'
            }}/>
          <button
            onClick={() => setAvatarFull(false)}
            style={{
              position:'absolute',top:20,right:20,
              background:'rgba(255,255,255,.12)',border:'1px solid rgba(255,255,255,.2)',
              borderRadius:'50%',width:44,height:44,fontSize:22,cursor:'pointer',
              color:'white',display:'flex',alignItems:'center',justifyContent:'center',
              backdropFilter:'blur(8px)',transition:'background .15s'
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.22)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImportContactsModal
// ─────────────────────────────────────────────────────────────────────────────

function ImportContactsModal({ onClose, onImported }) {
  const [stage, setStage]     = useState('pick');   // 'pick' | 'preview' | 'done'
  const [rows, setRows]       = useState([]);        // [{name, phone}]
  const [selected, setSelected] = useState(new Set());
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef               = useRef();

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const results = [];
    for (const line of lines) {
      const cols = line.split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
      // Try to detect phone column — look for a cell starting with + or containing digits 7+
      const phone = cols.find(c => /^\+?\d{7,}$/.test(c.replace(/[\s\-()]/g, '')));
      if (!phone) continue;
      // Name = first non-phone cell that has letters
      const name  = cols.find(c => c !== phone && /[a-zA-Zа-яёА-ЯЁ]/.test(c)) || '';
      results.push({ name: name || '—', phone });
    }
    return results;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const ext = file.name.split('.').pop().toLowerCase();

    try {
      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        const parsed = parseCSV(text);
        if (!parsed.length) { setError('Не удалось найти номера телефонов в файле.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
        // Dynamic import so xlsx doesn't bloat the initial bundle
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const textLines = data.map(row => row.join('\t')).join('\n');
        const parsed = parseCSV(textLines);
        if (!parsed.length) { setError('Не удалось найти номера телефонов в таблице.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else if (ext === 'vcf') {
        const text = await file.text();
        const vcards = text.split('BEGIN:VCARD').slice(1);
        const parsed = vcards.map(vc => {
          const fnMatch  = vc.match(/^FN[;:][^\r\n]*/m);
          const telMatch = vc.match(/^TEL[;:][^\r\n]*/m);
          const name  = fnMatch  ? fnMatch[0].replace(/^FN[;:][^:]*:?/, '').trim() : '—';
          const phone = telMatch ? telMatch[0].replace(/^TEL[;:][^:]*:?/, '').trim() : '';
          return phone ? { name, phone } : null;
        }).filter(Boolean);
        if (!parsed.length) { setError('Не найдено контактов в vCard-файле.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else {
        setError('Поддерживаются файлы: CSV, XLSX, XLS, VCF');
      }
    } catch(err) {
      setError('Ошибка чтения файла: ' + err.message);
    }
  }

  function toggleRow(i) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function importSelected() {
    setLoading(true);
    const toImport = rows.filter((_, i) => selected.has(i));
    let imported = 0, failed = 0;
    for (const { name, phone } of toImport) {
      try {
        const contact = await api.addContact({ phone, nickname: name !== '—' ? name : undefined });
        onImported?.(contact);
        imported++;
      } catch { failed++; }
    }
    setLoading(false);
    setRows([{ name: `✓ Добавлено: ${imported}`, phone: failed ? `✗ Не найдено: ${failed}` : '' }]);
    setStage('done');
  }

  const overlay = { position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const panel   = { background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,480px)',maxHeight:'80vh',display:'flex',
    flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.55)',
    border:'1px solid rgba(255,255,255,.13)' };
  const hdr     = { padding:'22px 24px 16px',borderBottom:'1px solid rgba(255,255,255,.1)',
    display:'flex',alignItems:'center',gap:12 };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={hdr}>
          <span style={{fontSize:22}}>📥</span>
          <div>
            <div style={{color:'white',fontSize:17,fontWeight:700}}>Импорт контактов</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13}}>CSV · XLSX · VCF (vCard)</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',
            color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        {stage === 'pick' && (
          <div style={{padding:28,display:'flex',flexDirection:'column',gap:20,alignItems:'center'}}>
            {/* Google Contacts hint */}
            <div style={{background:'rgba(255,255,255,.06)',borderRadius:16,padding:'16px 20px',
              color:'rgba(255,255,255,.55)',fontSize:13,lineHeight:1.7,width:'100%',boxSizing:'border-box'}}>
              <b style={{color:'rgba(255,255,255,.8)'}}>Google Контакты:</b><br/>
              Перейдите на <span style={{color:'rgba(160,140,220,.9)'}}>contacts.google.com</span> →
              Экспорт → Формат Google CSV → скачайте файл и загрузите сюда.
            </div>

            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods,.vcf,.txt"
              onChange={handleFile} style={{display:'none'}}/>
            <button onClick={() => fileRef.current?.click()}
              style={{padding:'14px 36px',borderRadius:50,background:'rgba(140,100,200,.75)',
                border:'none',color:'white',fontSize:15,fontWeight:600,cursor:'pointer',
                boxShadow:'0 4px 20px rgba(120,80,180,.35)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              Выбрать файл
            </button>

            {error && <div style={{color:'rgba(255,140,140,.85)',fontSize:13,textAlign:'center'}}>{error}</div>}
          </div>
        )}

        {stage === 'preview' && (
          <>
            <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(255,255,255,.08)',
              display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:'rgba(255,255,255,.5)',fontSize:13}}>
                Найдено: {rows.length} контактов. Выбрано: {selected.size}
              </span>
              <button onClick={() => {
                selected.size === rows.length
                  ? setSelected(new Set())
                  : setSelected(new Set(rows.map((_,i)=>i)));
              }} style={{marginLeft:'auto',background:'rgba(255,255,255,.08)',border:'none',
                borderRadius:10,padding:'6px 12px',color:'rgba(255,255,255,.7)',
                fontSize:12,cursor:'pointer'}}>
                {selected.size === rows.length ? 'Снять всё' : 'Выбрать всё'}
              </button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {rows.map((r,i) => (
                <div key={i} onClick={() => toggleRow(i)}
                  style={{display:'flex',alignItems:'center',gap:12,
                    padding:'11px 20px',cursor:'pointer',
                    background: selected.has(i) ? 'rgba(140,100,200,.1)' : 'transparent',
                    borderBottom:'1px solid rgba(255,255,255,.06)',transition:'background .12s'}}>
                  <div style={{width:20,height:20,borderRadius:6,flexShrink:0,
                    background: selected.has(i) ? 'rgba(140,100,200,.8)' : 'rgba(255,255,255,.12)',
                    border:'1px solid rgba(255,255,255,.2)',display:'flex',
                    alignItems:'center',justifyContent:'center',fontSize:13,color:'white'}}>
                    {selected.has(i) ? '✓' : ''}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:'white',fontSize:14,fontWeight:500,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                    <div style={{color:'rgba(255,255,255,.45)',fontSize:12}}>{r.phone}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'16px 20px',borderTop:'1px solid rgba(255,255,255,.08)',
              display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setStage('pick')}
                style={{padding:'11px 22px',borderRadius:14,background:'rgba(255,255,255,.09)',
                  border:'1px solid rgba(255,255,255,.15)',color:'rgba(255,255,255,.8)',
                  fontSize:14,cursor:'pointer'}}>
                Назад
              </button>
              <button onClick={importSelected} disabled={selected.size===0||loading}
                style={{padding:'11px 24px',borderRadius:14,
                  background: selected.size>0&&!loading ? 'rgba(120,90,200,.8)' : 'rgba(255,255,255,.07)',
                  border:'none',color: selected.size>0&&!loading ? 'white' : 'rgba(255,255,255,.3)',
                  fontSize:14,fontWeight:600,cursor: selected.size>0&&!loading ? 'pointer' : 'not-allowed',
                  transition:'all .2s'}}>
                {loading ? 'Добавление…' : `Добавить ${selected.size}`}
              </button>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div style={{padding:'40px 28px',display:'flex',flexDirection:'column',
            alignItems:'center',gap:20,textAlign:'center'}}>
            <div style={{fontSize:52}}>✅</div>
            <div style={{color:'white',fontSize:16,fontWeight:600}}>{rows[0]?.name}</div>
            {rows[0]?.phone && <div style={{color:'rgba(255,160,160,.8)',fontSize:14}}>{rows[0].phone}</div>}
            <button onClick={onClose}
              style={{padding:'12px 36px',borderRadius:50,background:'rgba(120,90,200,.75)',
                border:'none',color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteModal
// ─────────────────────────────────────────────────────────────────────────────

function InviteModal({ onClose }) {
  const [info, setInfo]   = useState(null);   // { code, referral_count }
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getInvite().then(setInfo).catch(console.error);
  }, []);

  const inviteLink = info
    ? `${location.origin}/join/${info.code}`
    : '…';

  const inviteText = info
    ? `Привет! Я пользуюсь HEY Messenger — быстрый и стильный мессенджер. Вступай по моей ссылке: ${inviteLink}`
    : '';

  function copy() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waHref  = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
  const tgHref  = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Вступай в HEY Messenger — самый стильный мессенджер!')}`;

  const referralCount = info?.referral_count ?? 0;
  const goal = 3;
  const pct  = Math.min(referralCount / goal * 100, 100);

  const overlay = { position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const panel   = { background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,420px)',
    boxShadow:'0 24px 64px rgba(0,0,0,.55)',
    border:'1px solid rgba(255,255,255,.13)',overflow:'hidden' };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{padding:'22px 24px 18px',display:'flex',alignItems:'center',gap:12,
          borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <span style={{fontSize:22}}>🎉</span>
          <div>
            <div style={{color:'white',fontSize:17,fontWeight:700}}>Пригласить друга</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13}}>3 друга = Премиум на 3 месяца</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',
            color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'22px 24px',display:'flex',flexDirection:'column',gap:20}}>
          {/* Invite link */}
          <div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:8,
              textTransform:'uppercase',letterSpacing:.5}}>Ваша персональная ссылка</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(255,255,255,.07)',borderRadius:12,
                padding:'11px 14px',color:'rgba(200,180,255,.9)',fontSize:13,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                border:'1px solid rgba(255,255,255,.12)',userSelect:'all'}}>
                {inviteLink}
              </div>
              <button onClick={copy}
                style={{padding:'11px 16px',borderRadius:12,whiteSpace:'nowrap',
                  background: copied ? 'rgba(60,180,100,.7)' : 'rgba(120,90,200,.7)',
                  border:'none',color:'white',fontSize:13,fontWeight:600,cursor:'pointer',
                  transition:'background .2s',flexShrink:0}}>
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:10,
              textTransform:'uppercase',letterSpacing:.5}}>Поделиться</div>
            <div style={{display:'flex',gap:10}}>
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  padding:'13px 0',borderRadius:14,textDecoration:'none',
                  background:'rgba(37,211,102,.18)',border:'1px solid rgba(37,211,102,.3)',
                  color:'rgba(100,240,140,.9)',fontSize:14,fontWeight:600,
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(37,211,102,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(37,211,102,.18)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
              <a href={tgHref} target="_blank" rel="noopener noreferrer"
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  padding:'13px 0',borderRadius:14,textDecoration:'none',
                  background:'rgba(39,169,244,.18)',border:'1px solid rgba(39,169,244,.3)',
                  color:'rgba(100,200,255,.9)',fontSize:14,fontWeight:600,
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(39,169,244,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(39,169,244,.18)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>
          </div>

          {/* Referral progress */}
          <div style={{background:'rgba(255,255,255,.05)',borderRadius:16,padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{color:'white',fontSize:14,fontWeight:600}}>Прогресс до Премиума</span>
              <span style={{color: referralCount >= goal ? 'rgba(100,240,140,.9)' : 'rgba(200,170,255,.8)',
                fontSize:14,fontWeight:700}}>
                {referralCount} / {goal}
              </span>
            </div>
            <div style={{height:8,background:'rgba(255,255,255,.1)',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,transition:'width .5s ease',
                background: pct >= 100
                  ? 'linear-gradient(90deg, rgba(60,200,100,.8), rgba(100,240,140,.9))'
                  : 'linear-gradient(90deg, rgba(120,80,200,.8), rgba(180,120,255,.9))',
                borderRadius:4}}/>
            </div>
            <div style={{color:'rgba(255,255,255,.4)',fontSize:12,marginTop:8}}>
              {referralCount >= goal
                ? '🎉 Вы получите Премиум аккаунт на 3 месяца!'
                : `Пригласите ещё ${goal - referralCount} ${goal - referralCount === 1 ? 'друга' : 'друзей'} — получите Премиум на 3 месяца`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContactsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function ContactsScreen() {
  const nav = useNavigate();
  const [contacts,      setContacts]      = useState([]);
  const [blocked,       setBlocked]       = useState([]);  // [{id, ...}] — только id для фильтрации
  const [phone,         setPhone]         = useState('');
  const [card,          setCard]          = useState(null); // contact object
  const [showImport,    setShowImport]    = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [customConfirm, confirmModal]     = useConfirm();

  useEffect(() => {
    api.getContacts().then(setContacts).catch(console.error);
    api.getBlocked().then(setBlocked).catch(console.error);
  }, []);

  async function addContact() {
    if (!phone.trim()) return;
    const pv = validatePhone(phone);
    if (!pv.ok) { alert(pv.msg); return; }
    try {
      const c = await api.addContact({ phone: pv.normalized });
      setContacts(prev => [...prev, c]);
      setPhone('');
    } catch(e) { alert(e.message); }
  }

  async function openChat(contactId) {
    setCard(null);
    try {
      const conv = await api.openConversation(contactId);
      nav(`/chat/${conv.id}`);
    } catch(e) { alert(e.message); }
  }

  async function handleBlock(contact) {
    if (!await customConfirm(`Заблокировать ${contact.nickname || contact.name}? Они не смогут отправлять вам сообщения.`, { danger: true })) return;
    await api.blockUser(contact.id).catch(console.error);
    setBlocked(prev => [...prev, { id: contact.id, name: contact.name, phone: contact.phone, avatar: contact.avatar }]);
    setCard(null);
  }

  async function handleUnblock(userId) {
    await api.unblockUser(userId).catch(console.error);
    setBlocked(prev => prev.filter(b => b.id !== userId));
    setCard(null);
  }

  function handleNotesChange(contactId, notes) {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes } : c));
  }

  const isBlockedId = (id) => blocked.some(b => b.id === id);
  // Показываем только незаблокированных
  const visibleContacts = contacts.filter(c => !isBlockedId(c.id));

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--grad)',
      paddingBottom:80,
      display:'flex',flexDirection:'column',
    }}>
      {/* Sticky header — full-width bg, content limited to 680 */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
        flexShrink:0,
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'16px 20px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3}}>
            👥 Контакты
          </div>
          <DotsMenu items={[
            { label: 'Импорт контактов', icon: '📥', onClick: () => setShowImport(true) },
            { label: 'Пригласить друга',  icon: '🎉', onClick: () => setShowInvite(true) },
          ]}/>
        </div>
      </div>

      {/* Content limited to 680 */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',flex:1,display:'flex',flexDirection:'column'}}>
      {/* Add by phone */}
      <div style={{padding:'12px 20px',display:'flex',gap:8,flexShrink:0}}>
        <input className="glass-input" placeholder="Добавить по номеру телефона"
          value={phone} onChange={e=>setPhone(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addContact()} style={{flex:1}}/>
        <button className="pill" onClick={addContact} style={{padding:'13px 20px',fontSize:20}}>+</button>
      </div>

      {/* List */}
      <div style={{flex:1}}>
        {visibleContacts.length === 0 && (
          <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:60,fontSize:15}}>
            Контакты не найдены.<br/>Добавьте первый по номеру телефона.
          </div>
        )}
        {visibleContacts.map(c => (
          <div key={c.id}
            style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',
              cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.06)',transition:'background .12s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            {/* Avatar */}
            <div onClick={() => setCard(c)}
              style={{cursor:'pointer',transition:'transform .15s',flexShrink:0}}
              onMouseEnter={e=>e.currentTarget.style.transform='scale(1.06)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name}/>
            </div>
            {/* Name → opens chat */}
            <div style={{flex:1,minWidth:0}} onClick={() => openChat(c.id)}>
              <div style={{color:'white',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                {c.nickname || c.name}
                {c.online ? <div className="online-dot"/> : null}
              </div>
              <div style={{color:'rgba(255,255,255,.45)',fontSize:13}}>{c.phone}</div>
              {c.notes && <div style={{color:'rgba(255,255,255,.3)',fontSize:12,marginTop:2,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes}</div>}
            </div>
            {/* Open card */}
            <button onClick={() => setCard(c)}
              style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',
                fontSize:20,cursor:'pointer',padding:'4px 8px',lineHeight:1,
                transition:'color .15s'}}
              onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,.7)'}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.3)'}>
              ›
            </button>
          </div>
        ))}
      </div>

      {/* Contact card modal */}
      {card && (
        <ContactCardModal
          contact={card}
          isBlocked={isBlockedId(card.id)}
          onClose={() => setCard(null)}
          onChat={() => openChat(card.id)}
          onBlock={() => handleBlock(card)}
          onUnblock={() => handleUnblock(card.id)}
          onNotesChange={handleNotesChange}
        />
      )}

      {showImport && (
        <ImportContactsModal
          onClose={() => setShowImport(false)}
          onImported={contact => setContacts(prev =>
            prev.some(c => c.id === contact.id) ? prev : [...prev, contact]
          )}
        />
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} />
      )}

      {confirmModal}
      </div>{/* end 680 wrapper */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConversationsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function ConversationsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);

  const reload = () => api.getConversations().then(setConvs).catch(console.error);

  useEffect(() => { reload(); }, []);
  useEffect(() => socket.on('message:new', ({ message }) => {
    setConvs(prev => {
      const exists = prev.find(c => c.id === message.conversationId);
      if (!exists) { reload(); return prev; }
      return prev
        .map(c => c.id === message.conversationId
          ? { ...c,
              last_text: message.text || null,
              last_at: message.created_at,
              last_sender_id: message.sender_id,
              unread_count: message.sender_id === user?.id ? c.unread_count : c.unread_count + 1 }
          : c)
        .sort((a, b) => b.last_at - a.last_at);
    });
  }), [user?.id]);

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--grad)',
      paddingBottom:80,
    }}>
      {/* Sticky header — full-width bg, content limited to 680 */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
        flexShrink:0,
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'16px 20px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3}}>
            💬 Чаты
          </div>
          <button onClick={() => nav('/groups/new')}
            style={{
              padding:'8px 16px',borderRadius:50,fontSize:13,fontWeight:700,cursor:'pointer',
              background:'rgba(120,90,200,.85)',border:'none',color:'white',
              boxShadow:'0 2px 12px rgba(120,80,200,.4)',transition:'all .18s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.9)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.85)'}>
            + Группа
          </button>
        </div>
      </div>

      {/* List — content limited to 680 */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%'}}>
      <div style={{flex:1}}>
        {convs.length === 0 && (
          <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:60,fontSize:15,padding:'0 20px'}}>
            Нет активных диалогов.<br/>Перейди в Контакты, чтобы начать переписку.
          </div>
        )}
        {convs.map(c => (
          <div key={c.id} onClick={() => {
            setConvs(prev => prev.map(x => x.id === c.id ? { ...x, unread_count: 0 } : x));
            nav(`/chat/${c.id}`);
          }}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',
              cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.06)',transition:'background .12s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            {c.type === 'group' ? (
              <div style={{width:52,height:52,borderRadius:14,flexShrink:0,
                background:'rgba(200,160,210,.35)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:26}}>
                {c.icon || '👥'}
              </div>
            ) : (
              <AvatarDisplay avatar={c.avatar} name={c.name} size={52}/>
            )}
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'white',fontSize:15,fontWeight:600}}>{c.name||'Диалог'}</div>
              <div style={{color:'rgba(255,255,255,.45)',fontSize:13,
                whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {c.last_sender_id===user?.id ? 'Вы: ' : ''}{c.last_text||'…'}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
              {c.last_at && (
                <div style={{color:'rgba(255,255,255,.35)',fontSize:11}}>
                  {fmtTime(c.last_at)}
                </div>
              )}
              {c.unread_count > 0 && (
                <div style={{
                  minWidth:20,height:20,borderRadius:10,padding:'0 6px',
                  background:'rgba(140,100,200,.9)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,color:'white',fontWeight:700
                }}>
                  {c.unread_count > 99 ? '99+' : c.unread_count}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>{/* end 680 wrapper */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatScreen — full real-time chat
// ─────────────────────────────────────────────────────────────────────────────
// MediaViewerModal
// ─────────────────────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s]+/g;

const HEY_EMOJI = [
  'smiling','happy','winking','sad','angry','surprised',
  'wow','dead','discouraged','dissatisfied','chilly','silent',
  'suspicious','tricky smile','no comments','congrats','cute hearts','heart kiss',
  'cool','love','sleepy','nervous','starstruck','haha',
];

const HEY_EMOJI_SET = new Set(HEY_EMOJI);
const EMOJI_RE = new RegExp('\\[(' + HEY_EMOJI.map(n => n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\]', 'g');

function renderText(text) {
  // Split by emoji shortcodes AND urls
  const TOKEN = /(https?:\/\/[^\s]+)|\[([^\]]+)\]/g;
  const result = [];
  let last = 0, i = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[1]) {
      // URL
      result.push(
        <a key={i++} href={m[1]} target="_blank" rel="noopener noreferrer"
          style={{color:'inherit',textDecoration:'underline',wordBreak:'break-all'}}
          onClick={e => e.stopPropagation()}>{m[1]}</a>
      );
    } else if (m[2] && HEY_EMOJI_SET.has(m[2])) {
      // Custom emoji
      result.push(
        <img key={i++} src={`/emoji/${encodeURIComponent(m[2])}.svg`} alt={m[2]}
          style={{width:24,height:24,verticalAlign:'middle',display:'inline-block',
            filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
      );
    } else {
      result.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

function MediaViewerModal({ convId, onClose }) {
  const [tab,    setTab]    = useState('images');
  const [media,  setMedia]  = useState([]);
  const [links,  setLinks]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [light,  setLight]  = useState(null);

  useEffect(() => {
    api.getMedia(convId).then(msgs => {
      setMedia(msgs.filter(m => m.attachment?.type === 'image'));
      setLoading(false);
    }).catch(console.error);
    api.searchMessages(convId, 'http').then(msgs => {
      const found = [];
      msgs.forEach(m => {
        const urls = m.text?.match(URL_RE) || [];
        urls.forEach(url => found.push({ url, sender: m.sender_name, time: m.created_at }));
      });
      setLinks(found);
    }).catch(console.error);
  }, [convId]);

  const overlay = { position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const modal = { width:'min(94vw,480px)',maxHeight:'80vh',background:'rgba(45,36,80,.97)',
    borderRadius:20,display:'flex',flexDirection:'column',overflow:'hidden',
    boxShadow:'0 16px 48px rgba(0,0,0,.5)' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',padding:'16px 20px 0'}}>
          <span style={{flex:1,color:'white',fontSize:17,fontWeight:600}}>Медиа и ссылки</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',fontSize:22,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:0,padding:'12px 20px 0',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          {[['images','Медиа'],['links','Ссылки']].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              background:'none',border:'none',padding:'8px 18px',cursor:'pointer',fontSize:14,
              color: tab===id ? 'white' : 'rgba(255,255,255,.45)',
              borderBottom: tab===id ? '2px solid rgba(180,140,220,.9)' : '2px solid transparent',
              marginBottom:-1,transition:'color .15s'}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {loading && <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:40}}>Загрузка…</div>}
          {!loading && tab==='images' && (
            media.length === 0
              ? <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:40}}>Нет медиафайлов</div>
              : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                  {media.map(m => {
                    const src = m.attachment.url;
                    if (!src) return null;
                    return (
                      <img key={m.id} src={src} alt="" onClick={()=>setLight(src)}
                        style={{width:'100%',aspectRatio:'1',objectFit:'cover',
                          borderRadius:8,cursor:'zoom-in'}}/>
                    );
                  })}
                </div>
          )}
          {!loading && tab==='links' && (
            links.length === 0
              ? <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:40}}>Нет ссылок</div>
              : links.map((l,i)=>(
                  <div key={i} style={{padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      style={{color:'rgba(160,130,220,.9)',fontSize:13,wordBreak:'break-all',textDecoration:'none'}}>
                      {l.url}
                    </a>
                    <div style={{color:'rgba(255,255,255,.35)',fontSize:11,marginTop:3}}>
                      {l.sender} · {fmtTime(l.time)}
                    </div>
                  </div>
                ))
          )}
        </div>
      </div>
      {light && (
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.92)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setLight(null)}>
          <img src={light} alt="" onClick={e=>e.stopPropagation()}
            style={{maxWidth:'90vw',maxHeight:'80vh',borderRadius:12,objectFit:'contain'}}/>
          <a href={light} download onClick={e=>e.stopPropagation()}
            style={{marginTop:16,background:'rgba(255,255,255,.15)',borderRadius:10,
              padding:'8px 20px',color:'white',textDecoration:'none',fontSize:14}}>
            ⬇ Скачать
          </a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupCreateScreen
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_ICONS = ['👥','🚀','🎮','💼','🏠','❤️','🎵','📚','🌍','⚡','🔥','🎯'];

export function GroupCreateScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [name,     setName]     = useState('');
  const [icon,     setIcon]     = useState('👥');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { api.getContacts().then(setContacts).catch(console.error); }, []);

  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create() {
    if (!name.trim()) { alert('Введите название группы'); return; }
    if (selected.size === 0) { alert('Добавьте хотя бы одного участника'); return; }
    setSaving(true);
    try {
      const { id } = await api.createGroup({ name: name.trim(), icon, memberIds: [...selected] });
      nav(`/chat/${id}`, { replace: true });
    } catch(e) { alert(e.message); setSaving(false); }
  }

  return (
    <div className="screen">
      <TopBar title="Новая группа" onBack={() => nav(-1)}/>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20}}>
        {/* Icon picker */}
        <div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:10}}>Иконка группы</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {GROUP_ICONS.map(e => (
              <button key={e} onClick={()=>setIcon(e)}
                style={{width:44,height:44,fontSize:24,border:'none',cursor:'pointer',borderRadius:12,
                  background: icon===e ? 'rgba(140,100,200,.7)' : 'rgba(255,255,255,.12)',
                  transition:'background .15s'}}>
                {e}
              </button>
            ))}
          </div>
        </div>
        {/* Name */}
        <div>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:8}}>Название группы</div>
          <input className="glass-input" value={name} onChange={e=>setName(e.target.value)}
            placeholder="Например: Команда, Семья…" style={{width:'100%'}}/>
        </div>
      </div>
      {/* Contacts list */}
      <div style={{flex:1,overflowY:'auto'}}>
        <div style={{padding:'0 24px 8px',color:'rgba(255,255,255,.5)',fontSize:13}}>
          Участники ({selected.size} выбрано)
        </div>
        {contacts.map(c => (
          <div key={c.id} onClick={()=>toggle(c.id)}
            style={{display:'flex',alignItems:'center',gap:12,padding:'12px 24px',
              cursor:'pointer',transition:'background .12s',
              background: selected.has(c.id) ? 'rgba(140,100,200,.2)' : 'transparent'}}
            onMouseEnter={e=>{ if(!selected.has(c.id)) e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.background = selected.has(c.id)?'rgba(140,100,200,.2)':'transparent'; }}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(200,160,210,.45)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:18,color:'white',fontWeight:600,flexShrink:0}}>
              {(c.nickname||c.name)[0].toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'white',fontSize:15}}>{c.nickname||c.name}</div>
              <div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>{c.phone}</div>
            </div>
            <div style={{width:24,height:24,borderRadius:'50%',border:'2px solid rgba(180,140,220,.6)',
              background: selected.has(c.id) ? 'rgba(140,100,200,.8)' : 'transparent',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'white',fontSize:14,transition:'background .15s'}}>
              {selected.has(c.id) && '✓'}
            </div>
          </div>
        ))}
      </div>
      {selected.size > 0 && (
        <div style={{padding:'12px 24px 24px'}}>
          <button className="pill" onClick={create} disabled={saving} style={{width:'100%',opacity:saving?.7:1}}>
            {saving ? 'Создание…' : `Создать группу (${selected.size + 1} участников)`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupSettingsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function GroupSettingsScreen() {
  const nav = useNavigate();
  const { convId } = useParams();
  const { user } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();
  const [info,    setInfo]    = useState({ name:'', icon:'👥', admin_id: null });
  const [members, setMembers] = useState([]);
  const [contacts,setContacts]= useState([]);
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState('');
  const [icon,    setIcon]    = useState('👥');

  const isAdmin = info.admin_id === user?.id;

  useEffect(() => {
    api.getConversations().then(convs => {
      const c = convs.find(c => c.id === convId);
      if (c) { setInfo(c); setName(c.name || ''); setIcon(c.icon || '👥'); }
    });
    api.getGroupMembers(convId).then(setMembers);
    api.getContacts().then(setContacts);
  }, [convId]);

  async function saveInfo() {
    await api.updateGroup(convId, { name, icon });
    setInfo(p => ({ ...p, name, icon }));
    setEditing(false);
  }

  async function addMember(userId) {
    await api.addGroupMember(convId, userId);
    api.getGroupMembers(convId).then(setMembers);
  }

  async function removeMember(userId) {
    if (!await customConfirm('Удалить участника из группы?', { danger: true, requireWord: 'удалить' })) return;
    await api.removeGroupMember(convId, userId);
    setMembers(prev => prev.filter(m => m.id !== userId));
  }

  async function leaveGroup() {
    if (!await customConfirm('Покинуть группу? Вы потеряете доступ к переписке.')) return;
    await api.removeGroupMember(convId, user.id);
    nav('/conversations', { replace: true });
  }

  const nonMembers = contacts.filter(c => !members.find(m => m.id === c.id));

  return (
    <div className="screen">
      <TopBar title="Настройки группы" onBack={() => nav(-1)}/>
      <div style={{flex:1,overflowY:'auto',maxWidth:680,margin:'0 auto',width:'100%',padding:'20px 24px'}}>
        {/* Group header */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
          <div style={{width:64,height:64,borderRadius:20,background:'rgba(140,100,200,.5)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>
            {info.icon || '👥'}
          </div>
          <div>
            <div style={{color:'white',fontSize:19,fontWeight:600}}>{info.name}</div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13}}>{members.length} участников</div>
          </div>
          {isAdmin && <button onClick={()=>setEditing(true)}
            style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,.5)',fontSize:20,cursor:'pointer'}}>✏️</button>}
        </div>

        {/* Edit form */}
        {editing && isAdmin && (
          <div style={{background:'rgba(255,255,255,.08)',borderRadius:16,padding:16,marginBottom:20,display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {GROUP_ICONS.map(e => (
                <button key={e} onClick={()=>setIcon(e)}
                  style={{width:38,height:38,fontSize:20,border:'none',cursor:'pointer',borderRadius:10,
                    background: icon===e ? 'rgba(140,100,200,.7)' : 'rgba(255,255,255,.1)'}}>
                  {e}
                </button>
              ))}
            </div>
            <input className="glass-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Название"/>
            <div style={{display:'flex',gap:8}}>
              <button className="pill" onClick={saveInfo} style={{flex:1,padding:'10px 0'}}>Сохранить</button>
              <button onClick={()=>setEditing(false)}
                style={{flex:1,padding:'10px 0',background:'rgba(255,255,255,.1)',border:'none',
                  borderRadius:24,color:'white',cursor:'pointer'}}>Отмена</button>
            </div>
          </div>
        )}

        {/* Members */}
        <div style={{color:'rgba(255,255,255,.5)',fontSize:13,marginBottom:10}}>Участники</div>
        {members.map(m => (
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
            borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(200,160,210,.45)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white'}}>
              {m.name[0].toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{color:'white',fontSize:14}}>{m.name}
                {m.id === info.admin_id && <span style={{fontSize:11,color:'rgba(180,140,220,.8)',marginLeft:6}}>админ</span>}
              </div>
            </div>
            {isAdmin && m.id !== user.id && (
              <button onClick={()=>removeMember(m.id)}
                style={{background:'none',border:'none',color:'rgba(255,80,80,.7)',fontSize:18,cursor:'pointer'}}>✕</button>
            )}
          </div>
        ))}

        {/* Add members (admin only) */}
        {isAdmin && nonMembers.length > 0 && (
          <>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13,margin:'16px 0 10px'}}>Добавить участников</div>
            {nonMembers.map(c => (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                borderBottom:'1px solid rgba(255,255,255,.07)'}}>
                <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(200,160,210,.3)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white'}}>
                  {(c.nickname||c.name)[0].toUpperCase()}
                </div>
                <div style={{flex:1,color:'rgba(255,255,255,.7)',fontSize:14}}>{c.nickname||c.name}</div>
                <button onClick={()=>addMember(c.id)}
                  style={{background:'rgba(140,100,200,.5)',border:'none',borderRadius:10,
                    padding:'6px 14px',color:'white',fontSize:13,cursor:'pointer'}}>+</button>
              </div>
            ))}
          </>
        )}

        {/* Leave */}
        <button onClick={leaveGroup}
          style={{marginTop:32,width:'100%',padding:'12px 0',background:'rgba(220,60,60,.2)',
            border:'1px solid rgba(220,60,60,.3)',borderRadius:16,color:'rgba(255,120,120,.9)',
            fontSize:15,cursor:'pointer'}}>
          Покинуть группу
        </button>
      </div>
      {confirmModal}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ChatScreen() {
  const nav = useNavigate();
  const { convId } = useParams();
  const { user } = useAuth();

  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [typing,      setTyping]      = useState(null);
  const [partner,     setPartner]     = useState({ name:'Диалог', online:false, id:null, isGroup:false, icon:null, admin_id:null, avatar:null });
  const [editingMsg,  setEditingMsg]  = useState(null);
  const [msgMenu,     setMsgMenu]     = useState(null);
  const [imgPreview,  setImgPreview]  = useState(null);
  const [lightbox,    setLightbox]    = useState(null);
  const [showMedia,   setShowMedia]   = useState(false);
  const [searchMode,  setSearchMode]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults,setSearchResults] = useState(null); // null = not searched
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hoveredMsg,   setHoveredMsg]   = useState(null);
  const [reactionPicker,setReactionPicker] = useState(null); // { msgId, x, y }
  const [customConfirm, confirmModal] = useConfirm();
  const bottomRef          = useRef();
  const typingTimer        = useRef();
  const textareaRef        = useRef();
  const fileInputRef       = useRef();
  const searchRef          = useRef();
  const scrollRef          = useRef();
  const savedScrollHeight  = useRef(0);   // set before prepend, cleared after layout
  const skipBottomScroll   = useRef(false); // true while restoring scroll after prepend

  // Close context menu on outside click
  useEffect(() => {
    if (!msgMenu) return;
    const close = () => setMsgMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [msgMenu]);

  // Close reaction picker on outside click
  useEffect(() => {
    if (!reactionPicker) return;
    const close = (e) => {
      if (!e.target.closest('[data-reaction-picker]')) setReactionPicker(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [reactionPicker]);


  // Mark all currently unread incoming messages as read (only if tab is focused)
  function markVisibleAsRead(msgs) {
    if (!document.hasFocus()) return;
    msgs.forEach(m => {
      if (m.sender_id !== user.id && m.status !== 'read')
        socket.markRead(m.id, convId);
    });
  }

  // When tab regains focus — mark all loaded unread messages as read
  useEffect(() => {
    function onFocus() {
      setMessages(prev => { markVisibleAsRead(prev); return prev; });
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [convId, user?.id]);

  // Load history + partner info
  useEffect(() => {
    setHasMore(true);
    setLoadingMore(false);
    api.getMessages(convId).then(msgs => {
      setMessages(msgs);
      if (msgs.length < 50) setHasMore(false);
      markVisibleAsRead(msgs);
    }).catch(console.error);
    api.getConversations().then(convs => {
      const c = convs.find(c => c.id === convId);
      if (!c) return;
      if (c.type === 'group') {
        setPartner({ name: c.name||'Группа', online:false, id:null,
          isGroup:true, icon:c.icon||'👥', admin_id:c.admin_id });
      } else {
        setPartner(p => ({ ...p, name: c.name||'Диалог', id: c.partner_id||null,
          isGroup:false, avatar: c.avatar||null }));
      }
    }).catch(console.error);
  }, [convId]);

  // Load older messages (prepend)
  async function loadOlder() {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    savedScrollHeight.current = scrollRef.current?.scrollHeight ?? 0;
    skipBottomScroll.current = true;
    try {
      const older = await api.getMessages(convId, oldest);
      if (older.length < 50) setHasMore(false);
      if (older.length) {
        setMessages(prev => [...older, ...prev]);
      } else {
        skipBottomScroll.current = false;
      }
    } catch {
      skipBottomScroll.current = false;
    } finally {
      setLoadingMore(false);
    }
  }

  // Restore scroll position after prepend (runs synchronously before paint)
  useLayoutEffect(() => {
    if (savedScrollHeight.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - savedScrollHeight.current;
      savedScrollHeight.current = 0;
    }
  }, [messages]);

  // Scroll to bottom — skip when we just prepended older messages
  useEffect(() => {
    if (skipBottomScroll.current) { skipBottomScroll.current = false; return; }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Real-time events
  useEffect(() => {
    const u1 = socket.on('message:new', ({ message }) => {
      if (message.conversationId !== convId) return;
      setMessages(prev => {
        // Replace optimistic temp message with real one
        if (message.tempId) {
          const idx = prev.findIndex(m => m.id === message.tempId);
          if (idx !== -1) return prev.map(m => m.id === message.tempId ? { ...message } : m);
        }
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Mark read only if tab is focused (user actually sees the message)
      if (message.sender_id !== user?.id && document.hasFocus()) {
        socket.markRead(message.id, convId);
      }
    });
    const u2 = socket.on('typing:start', msg => {
      if (msg.conversationId === convId) setTyping(msg.userName);
    });
    const u3 = socket.on('typing:stop', msg => {
      if (msg.conversationId === convId) setTyping(null);
    });
    const u4 = socket.on('message:status', ({ id, status }) => {
      setMessages(prev => prev.map(m => m.id===id ? { ...m, status } : m));
    });
    const u5 = socket.on('presence:change', ({ userId, online }) => {
      setPartner(p => p.id === userId ? { ...p, online } : p);
    });
    const u6 = socket.on('chat:cleared', ({ conversationId }) => {
      if (conversationId === convId) setMessages([]);
    });
    const u7 = socket.on('message:edited', ({ message }) => {
      if (message.conversation_id === convId)
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, text: message.text, edited_at: message.edited_at } : m));
    });
    const u8 = socket.on('message:deleted', ({ messageId, conversationId: cid }) => {
      if (cid === convId) setMessages(prev => prev.filter(m => m.id !== messageId));
    });
    const u9 = socket.on('reaction:update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [convId, user?.id]);

  function handleInput(e) {
    setText(e.target.value);
    socket.startTyping(convId);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.stopTyping(convId), 1500);
  }

  async function compressImage(file) {
    const MAX_SIDE = 1280, QUALITY = 0.82;
    const MAX_RAW = 10 * 1024 * 1024;
    if (!file.type.startsWith('image/')) throw new Error('Не изображение');
    if (file.size > MAX_RAW) throw new Error('Файл слишком большой (макс. 10 МБ)');
    // GIF — не сжимаем (потеряем анимацию), отдаём как есть
    if (file.type === 'image/gif') {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width: w, height: h } = img;
          if (w > MAX_SIDE || h > MAX_SIDE) {
            const r = Math.min(MAX_SIDE / w, MAX_SIDE / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', QUALITY));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setImgPreview({ dataUrl, uploading: false });
    } catch(err) { alert(err.message); }
  }

  async function send() {
    const t = text.trim();

    if (imgPreview) {
      if (imgPreview.uploading) return;
      setImgPreview(p => ({ ...p, uploading: true }));
      let attachment;
      try {
        const { url } = await api.uploadImage(imgPreview.dataUrl);
        attachment = { type: 'image', url };
      } catch (err) {
        alert(err.message);
        setImgPreview(p => ({ ...p, uploading: false }));
        return;
      }
      const tempId = 'tmp-' + Date.now();
      setMessages(prev => [...prev, {
        id: tempId, text: t || null, attachment, sender_id: user.id,
        sender_name: user.name, status: 'sent',
        created_at: Math.floor(Date.now() / 1000)
      }]);
      socket.sendMessage(convId, t || '', tempId, attachment);
      setImgPreview(null);
      setText('');
      return;
    }

    if (!t) return;

    if (editingMsg) {
      api.editMessage(convId, editingMsg.id, t)
        .then(updated => setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text, edited_at: updated.edited_at } : m)))
        .catch(e => alert(e.message));
      setEditingMsg(null);
      setText('');
      return;
    }

    const tempId = 'tmp-' + Date.now();
    setMessages(prev => [...prev, {
      id: tempId, text: t, sender_id: user.id,
      sender_name: user.name, status:'sent',
      created_at: Math.floor(Date.now()/1000)
    }]);
    socket.sendMessage(convId, t, tempId);
    setText('');
    socket.stopTyping(convId);
  }

  function startEdit(msg) {
    setEditingMsg(msg);
    setText(msg.text);
    setMsgMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingMsg(null);
    setText('');
  }

  async function deleteMsg(msg) {
    setMsgMenu(null);
    await api.deleteMessage(convId, msg.id);
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  }

  function openMsgMenu(e, msg) {
    e.preventDefault();
    const MENU_W = 200, MENU_H = 100;
    const x = e.clientX + MENU_W > window.innerWidth  ? e.clientX - MENU_W : e.clientX;
    const y = e.clientY + MENU_H > window.innerHeight ? e.clientY - MENU_H : e.clientY;
    setMsgMenu({ x, y, msg });
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    if (e.key === 'Escape' && editingMsg) cancelEdit();
  }

  function insertEmoji(name) {
    setText(t => t + `[${name}]`);
    setShowEmoji(false);
    textareaRef.current?.focus();
  }

  function toggleReaction(msgId, emoji) {
    socket.send('reaction:toggle', { messageId: msgId, conversationId: convId, emoji });
    setReactionPicker(null);
  }

  const statusIcon = (s) => {
    if (s === 'read')      return <span style={{opacity:1,color:'rgba(160,230,255,1)'}}>✓✓</span>;
    if (s === 'delivered') return <span style={{opacity:.55}}>✓</span>;
    return <span style={{opacity:.4}}>✓</span>;
  };

  async function handleClearChat() {
    if (!await customConfirm('Удалить всё содержимое чата? Это действие невозможно отменить.', {
      danger: true, requireWord: 'удалить'
    })) return;
    await api.clearMessages(convId);
    setMessages([]);
  }

  function handleExportChat() {
    const lines = messages.map(m => {
      const time = new Date(m.created_at * 1000).toLocaleString('ru');
      const name = m.sender_id === user.id ? 'Вы' : (partner.name || m.sender_name);
      return `[${time}] ${name}: ${m.text || ''}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chat_${partner.name || convId}_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleSearch(q) {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const results = await api.searchMessages(convId, q).catch(() => []);
    setSearchResults(results);
  }

  function closeSearch() {
    setSearchMode(false);
    setSearchQuery('');
    setSearchResults(null);
  }

  const chatMenuItems = [
    { label: 'Поиск в чате',            icon: '🔍', danger: false, onClick: () => { setSearchMode(true); setTimeout(()=>searchRef.current?.focus(),50); } },
    { label: 'Медиа и ссылки',          icon: '🖼️', danger: false, onClick: () => setShowMedia(true) },
    ...(partner.isGroup ? [
      { label: 'Настройки группы',      icon: '⚙️', danger: false, onClick: () => nav(`/groups/${convId}/settings`) },
    ] : [
      { label: 'Экспортировать чат',    icon: '📥', danger: false, onClick: handleExportChat },
    ]),
    { label: 'Удалить содержимое чата', icon: '🗑️', danger: true,  onClick: handleClearChat },
  ];

  // Group messages by date
  const grouped = messages.reduce((acc, m) => {
    const day = new Date(m.created_at*1000).toDateString();
    if (!acc.length || acc[acc.length-1].day !== day)
      acc.push({ day, label: fmtDate(m.created_at), messages:[] });
    acc[acc.length-1].messages.push(m);
    return acc;
  }, []);

  return (
    <div className="screen" style={{height:'100dvh',overflow:'hidden'}}>
      {/* TopBar */}
      <div className="topbar">
        <div className="topbar-inner">
          <button className="back-btn" onClick={() => nav(-1)}>‹</button>
          {partner.isGroup ? (
            <div style={{width:36,height:36,borderRadius:'12px',flexShrink:0,
              background:'rgba(140,100,200,.5)',display:'flex',alignItems:'center',
              justifyContent:'center',fontSize:20}}>
              {partner.icon||'👥'}
            </div>
          ) : (
            <AvatarDisplay avatar={partner.avatar} name={partner.name} size={36}/>
          )}
          <div style={{flex:1,marginLeft:8,minWidth:0}}>
            <div className="topbar-title" style={{flex:'unset'}}>{partner.name}</div>
            {partner.isGroup && <div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>группа</div>}
          </div>
          {partner.online && <div className="online-dot"/>}
          <DotsMenu items={chatMenuItems}/>
        </div>
      </div>

      {/* Search bar */}
      {searchMode && (
        <div style={{background:'rgba(60,45,90,.8)',flexShrink:0}}>
          <div style={{maxWidth:680,margin:'0 auto',display:'flex',alignItems:'center',gap:8,padding:'8px 14px'}}>
            <input ref={searchRef} value={searchQuery}
              onChange={e=>handleSearch(e.target.value)}
              placeholder="Поиск в переписке…"
              style={{flex:1,background:'rgba(255,255,255,.15)',border:'none',outline:'none',
                borderRadius:20,padding:'8px 14px',color:'white',fontSize:14,fontFamily:'inherit'}}/>
            <button onClick={closeSearch}
              style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',fontSize:20,cursor:'pointer'}}>✕</button>
          </div>
        </div>
      )}

      {/* Search results */}
      {searchMode && searchResults !== null && (
        <div style={{flex:1,overflowY:'auto',padding:'8px 16px',display:'flex',flexDirection:'column',gap:6}}>
          {searchResults.length === 0
            ? <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:40}}>Ничего не найдено</div>
            : searchResults.map(m => (
                <div key={m.id} style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 14px'}}>
                  <div style={{color:'rgba(255,255,255,.5)',fontSize:11,marginBottom:4}}>
                    {m.sender_name} · {fmtTime(m.created_at)}
                  </div>
                  <div style={{color:'white',fontSize:14}}
                    dangerouslySetInnerHTML={{__html: m.text?.replace(
                      new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),
                      s=>`<mark style="background:rgba(200,160,80,.5);border-radius:3px">${s}</mark>`
                    )}}/>
                </div>
              ))
          }
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef}
        onScroll={e => { if (e.target.scrollTop < 120 && hasMore && !loadingMore) loadOlder(); }}
        style={{flex:1,overflowY:'auto',display: searchMode && searchResults !== null ? 'none' : 'block'}}>
      <div style={{maxWidth:680,margin:'0 auto',padding:'14px 16px 8px',display:'flex',flexDirection:'column',gap:8}}>
        {loadingMore && (
          <div style={{textAlign:'center',padding:'6px 0',color:'rgba(255,255,255,.4)',fontSize:13,flexShrink:0}}>
            Загрузка…
          </div>
        )}
        {grouped.map(group => (
          <div key={group.day}>
            <div style={{display:'flex',justifyContent:'center',margin:'8px 0'}}>
              <div style={{background:'rgba(100,72,140,.38)',borderRadius:14,padding:'4px 14px',
                color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:600}}>
                {group.label}
              </div>
            </div>
            {group.messages.map(m => {
              const isOut = m.sender_id === user?.id;
              const hasReactions = m.reactions && Object.keys(m.reactions).length > 0;
              const isHovered = hoveredMsg === m.id;
              return (
                <div key={m.id}
                  style={{display:'flex', alignItems:'flex-end', gap:4,
                    justifyContent: isOut ? 'flex-end':'flex-start',
                    marginBottom: hasReactions ? 8 : 2}}
                  onMouseEnter={() => setHoveredMsg(m.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                  onContextMenu={isOut ? (e) => openMsgMenu(e, m) : undefined}>

                  {/* Reaction button — left side for incoming */}
                  {!isOut && (
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setReactionPicker(p => p?.msgId === m.id ? null : { msgId: m.id, x: rect.right + 6, y: rect.top });
                      }}
                      style={{background: isHovered ? 'rgba(100,78,148,.55)' : 'transparent',
                        border:'none', borderRadius:'50%', width:28, height:28, cursor:'pointer',
                        flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                        padding:4, transition:'background .15s', marginBottom:6,
                        opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none'}}>
                      <img src="/emoji/smiling.svg" alt="react"
                        style={{width:16, height:16, filter:'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'}}/>
                    </button>
                  )}

                  <div style={{display:'flex', flexDirection:'column',
                    alignItems: isOut ? 'flex-end' : 'flex-start', maxWidth:'80%'}}>
                    <div style={{
                      background: editingMsg?.id === m.id
                        ? 'rgba(160,120,210,.85)'
                        : isOut ? 'rgba(110,80,155,.70)' : 'rgba(255,255,255,.90)',
                      borderRadius: isOut ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                      padding:'10px 13px 6px',
                      color: isOut ? 'white' : '#2a2040',
                      fontSize:14, lineHeight:'1.5',
                      transition:'background .2s'
                    }}>
                      {partner.isGroup && !isOut && (
                        <div style={{fontSize:11,fontWeight:700,color:'rgba(200,160,240,.8)',marginBottom:4}}>
                          {m.sender_name}
                        </div>
                      )}
                      {m.attachment?.type === 'image' && (() => {
                        const src = m.attachment.url;
                        if (!src) return (
                          <div style={{padding:'10px 0',fontSize:13,opacity:.5}}>
                            🖼 Изображение недоступно
                          </div>
                        );
                        return (
                          <img src={src} alt=""
                            onClick={() => setLightbox(src)}
                            style={{maxWidth:'100%',maxHeight:300,borderRadius:10,
                              display:'block',marginBottom: m.text ? 6 : 2,
                              cursor:'zoom-in'}}/>
                        );
                      })()}
                      {m.text && <div style={{wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{renderText(m.text)}</div>}
                      <div style={{fontSize:11,opacity:.6,textAlign:'right',marginTop:3,display:'flex',justifyContent:'flex-end',gap:4}}>
                        {m.edited_at && <span>изм.</span>}
                        <span>{fmtTime(m.created_at)}</span>
                        {isOut && statusIcon(m.status)}
                      </div>
                    </div>

                    {/* Reaction chips */}
                    {hasReactions && (
                      <div style={{display:'flex', flexWrap:'wrap', gap:4, marginTop:5}}>
                        {Object.entries(m.reactions).map(([emoji, userIds]) => {
                          const iReacted = userIds.includes(user?.id);
                          return (
                            <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                              title={emoji}
                              style={{
                                background: iReacted ? 'rgba(130,100,190,.6)' : 'rgba(255,255,255,.18)',
                                border: iReacted ? '1px solid rgba(170,130,220,.75)' : '1px solid rgba(255,255,255,.12)',
                                borderRadius:14, padding:'2px 8px', cursor:'pointer',
                                display:'flex', alignItems:'center', gap:4, fontSize:12,
                                color:'white', transition:'background .15s'
                              }}>
                              <img src={`/emoji/${encodeURIComponent(emoji)}.svg`} alt={emoji}
                                style={{width:16, height:16,
                                  filter:'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'}}/>
                              <span style={{fontWeight:600}}>{userIds.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reaction button — right side for outgoing */}
                  {isOut && (
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setReactionPicker(p => p?.msgId === m.id ? null : { msgId: m.id, x: rect.left - 210, y: rect.top });
                      }}
                      style={{background: isHovered ? 'rgba(100,78,148,.55)' : 'transparent',
                        border:'none', borderRadius:'50%', width:28, height:28, cursor:'pointer',
                        flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                        padding:4, transition:'background .15s', marginBottom:6,
                        opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none'}}>
                      <img src="/emoji/smiling.svg" alt="react"
                        style={{width:16, height:16, filter:'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'}}/>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {typing && (
          <div style={{display:'flex',gap:4,alignItems:'center',padding:'4px 8px'}}>
            <div style={{color:'rgba(255,255,255,.6)',fontSize:13}}>{typing} печатает</div>
            <div style={{display:'flex',gap:3}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:6,height:6,borderRadius:'50%',
                  background:'rgba(255,255,255,.5)',animation:`typing 1.2s ${i*.2}s infinite`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>{/* end maxWidth inner */}
      </div>{/* end scroll area */}

      {/* Image preview bar */}
      {imgPreview && (
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',
          background:'rgba(100,78,148,.45)',flexShrink:0}}>
          <img src={imgPreview.dataUrl} alt=""
            style={{height:56,width:56,objectFit:'cover',borderRadius:8,flexShrink:0}}/>
          <span style={{flex:1,color:'rgba(255,255,255,.7)',fontSize:13}}>
            {imgPreview.uploading ? 'Отправка…' : 'Добавьте подпись или нажмите ➤'}
          </span>
          <button onClick={() => setImgPreview(null)} disabled={imgPreview.uploading}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',
              fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
      )}

      {/* Edit banner */}
      {editingMsg && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 16px',
          background:'rgba(100,78,148,.5)',flexShrink:0}}>
          <span style={{fontSize:16}}>✏️</span>
          <span style={{flex:1,color:'rgba(255,255,255,.8)',fontSize:13,
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {editingMsg.text}
          </span>
          <button onClick={cancelEdit}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',
              fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>
      )}

      {/* Emoji keyboard */}
      {showEmoji && (
        <div style={{background:'rgba(100,78,148,.78)',padding:'10px 12px',flexShrink:0}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:4}}>
            {HEY_EMOJI.map(name => (
              <button key={name} onClick={() => insertEmoji(name)} title={name}
                style={{background:'none',border:'none',cursor:'pointer',
                  padding:6,borderRadius:10,transition:'background .1s',
                  display:'flex',alignItems:'center',justifyContent:'center'}}
                onMouseEnter={ev=>ev.currentTarget.style.background='rgba(255,255,255,.15)'}
                onMouseLeave={ev=>ev.currentTarget.style.background='none'}>
                <img src={`/emoji/${encodeURIComponent(name)}.svg`} alt={name}
                  style={{width:32,height:32,pointerEvents:'none',
                    filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div style={{flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 14px 14px',maxWidth:680,margin:'0 auto'}}>
        <div style={{
          flex:1, borderRadius:26,
          display:'flex', alignItems:'center', padding:'10px 14px', gap:8,
          backgroundImage:'url(/input-bg.jpg)',
          backgroundSize:'cover',
          backgroundPosition:'center',
          border:'1px solid rgba(255,255,255,0.5)',
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 18px rgba(0,0,0,0.15)',
        }}>
          <textarea ref={textareaRef} value={text} onChange={handleInput} onKeyDown={handleKey}
            placeholder="Написать сообщение..."
            rows={1}
            style={{flex:1,background:'none',border:'none',outline:'none',color:'white',
              fontFamily:'inherit',fontSize:14,resize:'none',lineHeight:'1.4',
              maxHeight:100,overflow:'auto'}}/>
          <button onClick={() => setShowEmoji(s=>!s)} title="Смайлики"
            style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,
              padding:0,opacity: showEmoji ? 1 : 0.75,transition:'opacity .15s'}}>
            <img src="/emoji/smiling.svg" alt="emoji"
              style={{width:22,height:22,display:'block',pointerEvents:'none'}}/>
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Прикрепить изображение"
            style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,
              padding:0,opacity:.8,transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='1'}
            onMouseLeave={e=>e.currentTarget.style.opacity='.8'}>
            <img src="/emoji/paperclip.svg" alt="attach"
              style={{width:22,height:22,display:'block',pointerEvents:'none',
                filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            style={{display:'none'}} onChange={handleFileSelect}/>
        </div>
        <button onClick={send}
          style={{width:44,height:44,background:'rgba(100,78,148,.75)',border:'none',
            borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',
            justifyContent:'center',flexShrink:0,fontSize:20,color:'white',
            transition:'background .15s'}}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(130,100,180,.9)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(100,78,148,.75)'}>
          ➤
        </button>
      </div>{/* end maxWidth input wrapper */}
      </div>{/* end input bar outer */}

      {/* Reaction emoji picker */}
      {reactionPicker && (() => {
        const PICKER_W = 210, PICKER_H = 165;
        const vw = window.innerWidth;
        const x = Math.min(Math.max(reactionPicker.x, 8), vw - PICKER_W - 8);
        const y = reactionPicker.y - PICKER_H - 8 < 8
          ? reactionPicker.y + 36
          : reactionPicker.y - PICKER_H - 8;
        // Find which emoji (if any) the current user already put on this message
        const pickerMsg = messages.find(m => m.id === reactionPicker.msgId);
        const myReaction = pickerMsg?.reactions
          ? Object.entries(pickerMsg.reactions).find(([, uids]) => uids.includes(user?.id))?.[0]
          : null;
        return (
          <div data-reaction-picker
            style={{position:'fixed', left:x, top:y, zIndex:300,
              background:'rgba(48,38,78,.97)', backdropFilter:'blur(16px)',
              borderRadius:16, padding:'8px 6px',
              boxShadow:'0 8px 32px rgba(0,0,0,.5)',
              display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:2}}>
            {HEY_EMOJI.map(name => {
              const isActive = myReaction === name;
              return (
                <button key={name} onClick={() => toggleReaction(reactionPicker.msgId, name)}
                  title={name}
                  style={{
                    background: isActive ? 'rgba(140,100,200,.55)' : 'none',
                    border: isActive ? '1px solid rgba(180,140,230,.7)' : '1px solid transparent',
                    cursor:'pointer', padding:5, borderRadius:10, transition:'background .1s',
                    display:'flex', alignItems:'center', justifyContent:'center'}}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='rgba(255,255,255,.18)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background = isActive ? 'rgba(140,100,200,.55)' : 'none'; }}>
                  <img src={`/emoji/${encodeURIComponent(name)}.svg`} alt={name}
                    style={{width:26, height:26, pointerEvents:'none',
                      filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Message context menu */}
      {msgMenu && (
        <div onMouseDown={e => e.stopPropagation()}
          style={{
            position:'fixed', left: msgMenu.x, top: msgMenu.y, zIndex:200,
            background:'rgba(60,50,90,0.97)', backdropFilter:'blur(16px)',
            borderRadius:14, overflow:'hidden', minWidth:190,
            boxShadow:'0 8px 32px rgba(0,0,0,.4)'
          }}>
          {(() => {
            const canEdit = (Date.now()/1000 - msgMenu.msg.created_at) < 3*60*60 && !!msgMenu.msg.text;
            return [
              canEdit && { label:'Редактировать', icon:'✏️', danger:false, action:() => startEdit(msgMenu.msg) },
              { label:'Удалить', icon:'🗑️', danger:true, action:() => deleteMsg(msgMenu.msg) },
            ].filter(Boolean).map(({ label, icon, danger, action }) => (
              <div key={label} onClick={action}
                style={{padding:'13px 18px',color:danger?'#ff6b6b':'white',fontSize:15,
                  cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{fontSize:18}}>{icon}</span>{label}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Media viewer */}
      {showMedia && (
        <MediaViewerModal convId={convId} onClose={()=>setShowMedia(false)}/>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.88)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            backdropFilter:'blur(8px)'}}>
          <img src={lightbox} alt=""
            onClick={e => e.stopPropagation()}
            style={{maxWidth:'90vw',maxHeight:'80vh',borderRadius:14,
              boxShadow:'0 8px 48px rgba(0,0,0,.6)',objectFit:'contain'}}/>
          <div style={{display:'flex',gap:12,marginTop:20}} onClick={e=>e.stopPropagation()}>
            <a href={lightbox} download
              style={{background:'rgba(255,255,255,.15)',backdropFilter:'blur(6px)',
                borderRadius:12,padding:'10px 24px',color:'white',fontSize:14,
                textDecoration:'none',border:'1px solid rgba(255,255,255,.2)'}}>
              ⬇ Скачать
            </a>
            <button onClick={() => setLightbox(null)}
              style={{background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',
                borderRadius:12,padding:'10px 24px',color:'white',fontSize:14,cursor:'pointer'}}>
              Закрыть
            </button>
          </div>
        </div>
      )}

<style>{`@keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
      {confirmModal}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CallsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function CallsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);

  useEffect(() => { api.getCalls().then(setCalls).catch(console.error); }, []);

  return (
    <div className="screen">
      <TopBar title="История звонков" onBack={() => nav(-1)}/>
      <div style={{flex:1,overflowY:'auto',maxWidth:680,margin:'0 auto',width:'100%',padding:'0 18px'}}>
        {calls.length === 0 && (
          <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:60,fontSize:15}}>
            История звонков пуста
          </div>
        )}
        {calls.map(c => {
          const isOut = c.caller_id === user?.id;
          const other = isOut
            ? { name: c.callee_name, avatar: c.callee_avatar }
            : { name: c.caller_name, avatar: c.caller_avatar };
          const missed = c.status === 'missed';
          return (
            <div key={c.id}
              style={{display:'flex',alignItems:'center',gap:13,padding:'15px 0',
                borderBottom:'1px solid rgba(170,130,190,.3)',cursor:'pointer'}}
              onClick={() => nav(`/calls/${c.id}`, { state: { call: c } })}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(200,160,210,.45)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                {other.avatar || (other.name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{color:'white',fontSize:15,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
                  {other.name}
                  <span style={{color: missed ? '#e74c3c' : '#2ecc71', fontSize:17}}>
                    {isOut ? '↗' : '↙'}
                  </span>
                </div>
                <div style={{color:'rgba(255,255,255,.5)',fontSize:13,marginTop:3}}>
                  {fmtDate(c.created_at)}, {fmtTime(c.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CallDetailScreen
// ─────────────────────────────────────────────────────────────────────────────

export function CallDetailScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation();
  const c = state?.call;

  useEffect(() => { if (!c) nav('/calls', { replace: true }); }, []);
  if (!c) return null;

  const isOut  = c.caller_id === user?.id;
  const other  = isOut ? { name: c.callee_name } : { name: c.caller_name };
  const missed = c.status === 'missed';
  const statusLabel = missed ? 'Пропущенный' : c.status === 'declined' ? 'Отклонённый' : 'Принятый';
  const typeLabel   = c.type === 'video' ? '📹 Видеозвонок' : '📞 Голосовой';

  function fmtDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m} мин ${s} с` : `${s} с`;
  }

  async function openChat() {
    const partnerId = isOut ? c.callee_id : c.caller_id;
    try {
      const conv = await api.openConversation(partnerId);
      nav(`/chat/${conv.id}`);
    } catch(e) { alert(e.message); }
  }

  const row = (label, value) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
      <span style={{color:'rgba(255,255,255,.5)',fontSize:14}}>{label}</span>
      <span style={{color:'white',fontSize:14,fontWeight:500}}>{value}</span>
    </div>
  );

  return (
    <div className="screen">
      <TopBar title="Детали звонка" onBack={() => nav(-1)}/>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',flex:1,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'36px 0 24px'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(200,160,210,.45)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,marginBottom:14}}>
          {(other.name||'?')[0].toUpperCase()}
        </div>
        <div style={{color:'white',fontSize:20,fontWeight:600}}>{other.name}</div>
        <div style={{color: missed ? '#e74c3c' : '#2ecc71', fontSize:13,marginTop:6}}>
          {isOut ? '↗ Исходящий' : '↙ Входящий'} · {statusLabel}
        </div>
      </div>

      <div style={{padding:'0 24px',flex:1}}>
        {row('Тип', typeLabel)}
        {row('Дата', `${fmtDate(c.created_at)}, ${fmtTime(c.created_at)}`)}
        {row('Длительность', fmtDuration(c.duration))}
      </div>

      <div style={{padding:'24px'}}>
        <button className="pill" onClick={openChat} style={{width:'100%'}}>
          Написать сообщение
        </button>
      </div>
      </div>{/* /maxWidth wrapper */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackModal — обратная связь с разработчиком
// ─────────────────────────────────────────────────────────────────────────────

const FEEDBACK_TYPES = [
  { id: 'bug',       label: '🐛 Ошибка' },
  { id: 'idea',      label: '💡 Идея' },
  { id: 'complaint', label: '😤 Жалоба' },
  { id: 'other',     label: '✉️ Другое' },
];

function FeedbackModal({ onClose }) {
  const [type,    setType]    = useState('idea');
  const [text,    setText]    = useState('');
  const [status,  setStatus]  = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'

  async function send() {
    if (!text.trim()) return;
    setStatus('sending');
    try {
      await api.sendFeedback({ type, text: text.trim() });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:600,
    background:'rgba(0,0,0,.6)',backdropFilter:'blur(12px)',
    display:'flex',alignItems:'center',justifyContent:'center'
  };
  const panel = {
    background:'rgba(30,22,58,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,440px)',
    boxShadow:'0 28px 72px rgba(0,0,0,.6)',
    border:'1px solid rgba(255,255,255,.11)',overflow:'hidden'
  };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,
          padding:'20px 22px 16px',borderBottom:'1px solid rgba(255,255,255,.09)'}}>
          <span style={{fontSize:20}}>✉️</span>
          <div style={{flex:1}}>
            <div style={{color:'white',fontSize:17,fontWeight:700}}>Написать разработчику</div>
            <div style={{color:'rgba(255,255,255,.38)',fontSize:12,marginTop:2}}>Жалобы и пожелания</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1,padding:4}}>✕</button>
        </div>

        {status === 'sent' ? (
          <div style={{padding:'48px 28px',display:'flex',flexDirection:'column',
            alignItems:'center',gap:16,textAlign:'center'}}>
            <div style={{fontSize:52}}>🎉</div>
            <div style={{color:'white',fontSize:17,fontWeight:600}}>Сообщение отправлено!</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13,lineHeight:1.6}}>
              Спасибо за обратную связь.<br/>Мы обязательно рассмотрим ваше сообщение.
            </div>
            <button onClick={onClose}
              style={{marginTop:8,padding:'12px 36px',borderRadius:50,
                background:'rgba(120,90,200,.75)',border:'none',
                color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Закрыть
            </button>
          </div>
        ) : (
          <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:18}}>
            {/* Type selector */}
            <div>
              <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginBottom:10,
                textTransform:'uppercase',letterSpacing:.5}}>Тип обращения</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {FEEDBACK_TYPES.map(t => (
                  <button key={t.id} onClick={() => setType(t.id)}
                    style={{
                      padding:'8px 14px',borderRadius:20,fontSize:13,cursor:'pointer',
                      border:'1px solid ' + (type===t.id ? 'rgba(180,140,220,.6)' : 'rgba(255,255,255,.15)'),
                      background: type===t.id ? 'rgba(120,90,200,.55)' : 'rgba(255,255,255,.07)',
                      color: type===t.id ? 'white' : 'rgba(255,255,255,.6)',
                      transition:'all .15s',fontWeight: type===t.id ? 600 : 400
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div>
              <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginBottom:8,
                textTransform:'uppercase',letterSpacing:.5}}>Сообщение</div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Опишите вашу идею, проблему или пожелание…"
                rows={5}
                style={{
                  width:'100%',boxSizing:'border-box',
                  background:'rgba(255,255,255,.07)',
                  border:'1px solid rgba(255,255,255,.14)',
                  borderRadius:14,padding:'12px 14px',
                  color:'white',fontSize:14,fontFamily:'inherit',
                  resize:'vertical',outline:'none',lineHeight:1.6,
                  transition:'border-color .15s',minHeight:100
                }}
                onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.14)'}
              />
              <div style={{color:'rgba(255,255,255,.25)',fontSize:11,marginTop:4,textAlign:'right'}}>
                {text.length} симв.
              </div>
            </div>

            {status === 'error' && (
              <div style={{color:'rgba(255,140,140,.8)',fontSize:13,
                background:'rgba(200,50,50,.12)',borderRadius:10,padding:'10px 14px'}}>
                Не удалось отправить. Проверьте соединение и попробуйте снова.
              </div>
            )}

            {/* Actions */}
            <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingBottom:4}}>
              <button onClick={onClose}
                style={{padding:'11px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
                  background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.14)',
                  color:'rgba(255,255,255,.75)'}}>
                Отмена
              </button>
              <button onClick={send}
                disabled={!text.trim() || status==='sending'}
                style={{
                  padding:'11px 28px',borderRadius:14,fontSize:14,fontWeight:600,
                  cursor: text.trim() && status!=='sending' ? 'pointer' : 'not-allowed',
                  background: text.trim() && status!=='sending'
                    ? 'rgba(120,90,200,.8)' : 'rgba(255,255,255,.07)',
                  border:'none',
                  color: text.trim() && status!=='sending' ? 'white' : 'rgba(255,255,255,.3)',
                  transition:'all .2s'
                }}>
                {status === 'sending' ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlacklistModal — попап «Чёрный список» из Настроек
// ─────────────────────────────────────────────────────────────────────────────

function BlacklistModal({ onClose }) {
  const [blocked,  setBlocked]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [customConfirm, confirmModal] = useConfirm();

  useEffect(() => {
    api.getBlocked().then(list => { setBlocked(list); setLoading(false); }).catch(console.error);
  }, []);

  async function handleUnblock(u) {
    if (!await customConfirm(
      `Разблокировать ${u.name}?\nОни смогут снова писать вам сообщения.`
    )) return;
    await api.unblockUser(u.id).catch(console.error);
    setBlocked(prev => prev.filter(b => b.id !== u.id));
  }

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:600,
      background:'rgba(0,0,0,.6)',backdropFilter:'blur(12px)',
      display:'flex',alignItems:'center',justifyContent:'center'
    }} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:'rgba(30,22,58,.98)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(94vw,440px)',maxHeight:'78vh',
        display:'flex',flexDirection:'column',
        boxShadow:'0 28px 72px rgba(0,0,0,.6)',
        border:'1px solid rgba(255,255,255,.11)',overflow:'hidden'
      }}>
        {/* Header */}
        <div style={{
          display:'flex',alignItems:'center',gap:12,
          padding:'20px 22px 16px',
          borderBottom:'1px solid rgba(255,255,255,.09)',flexShrink:0
        }}>
          <span style={{fontSize:20}}>🚫</span>
          <span style={{color:'white',fontSize:17,fontWeight:700,flex:1}}>Чёрный список</span>
          <button onClick={onClose} style={{
            background:'none',border:'none',color:'rgba(255,255,255,.4)',
            fontSize:22,cursor:'pointer',lineHeight:1,padding:4
          }}>✕</button>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:'auto'}}>
          {loading && (
            <div style={{color:'rgba(255,255,255,.3)',fontSize:14,textAlign:'center',padding:'40px 20px'}}>
              Загрузка…
            </div>
          )}
          {!loading && blocked.length === 0 && (
            <div style={{color:'rgba(255,255,255,.35)',fontSize:14,textAlign:'center',padding:'48px 20px',lineHeight:1.6}}>
              Чёрный список пуст.<br/>
              <span style={{fontSize:12,opacity:.6}}>Заблокированные пользователи появятся здесь.</span>
            </div>
          )}
          {blocked.map((b, i) => (
            <div key={b.id} style={{
              display:'flex',alignItems:'center',gap:12,
              padding:'14px 22px',
              borderBottom: i < blocked.length-1 ? '1px solid rgba(255,255,255,.07)' : 'none',
              transition:'background .12s'
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <AvatarDisplay avatar={b.avatar} name={b.name} size={46} fontSize={18}
                style={{background:'rgba(160,60,60,.4)',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'rgba(255,200,200,.9)',fontSize:15,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</div>
                <div style={{color:'rgba(255,255,255,.35)',fontSize:12,marginTop:2}}>{b.phone}</div>
              </div>
              <button onClick={() => handleUnblock(b)} style={{
                flexShrink:0,padding:'8px 16px',borderRadius:12,fontSize:13,cursor:'pointer',
                background:'rgba(50,150,75,.25)',border:'1px solid rgba(70,190,100,.3)',
                color:'rgba(110,220,140,.9)',transition:'background .15s',whiteSpace:'nowrap'
              }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(50,150,75,.45)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(50,150,75,.25)'}>
                Разблокировать
              </button>
            </div>
          ))}
        </div>
      </div>
      {confirmModal}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();
  const [open,          setOpen]         = useState(null);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [notifPerm,  setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  function toggle(id) { setOpen(o => o === id ? null : id); }

  async function requestNotifications() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  }

  const sections = [
    {
      id: 'notifications', label: 'Оповещения',
      content: (
        <div style={{paddingBottom:16,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{color:'rgba(255,255,255,.55)',fontSize:13}}>
            Получайте уведомления о новых сообщениях, когда приложение свёрнуто.
          </div>
          {notifPerm === 'unsupported' && (
            <div style={{color:'rgba(255,200,100,.7)',fontSize:13}}>Браузер не поддерживает уведомления</div>
          )}
          {notifPerm === 'granted' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'#2ecc71'}}/>
              <span style={{color:'white',fontSize:14}}>Уведомления включены</span>
            </div>
          )}
          {notifPerm === 'denied' && (
            <div style={{color:'rgba(255,120,120,.8)',fontSize:13}}>
              Уведомления заблокированы — разрешите их в настройках браузера.
            </div>
          )}
          {notifPerm === 'default' && (
            <button onClick={requestNotifications}
              style={{alignSelf:'flex-start',background:'rgba(100,78,148,.75)',border:'none',
                borderRadius:12,padding:'10px 20px',color:'white',fontSize:14,cursor:'pointer'}}>
              Включить уведомления
            </button>
          )}
        </div>
      )
    },
    {
      id: 'display', label: 'Экран',
      content: (
        <div style={{paddingBottom:16,color:'rgba(255,255,255,.4)',fontSize:13}}>
          Настройки темы и размера шрифта. Скоро.
        </div>
      )
    },
    {
      id: 'data', label: 'Данные',
      content: (
        <div style={{paddingBottom:16,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{color:'rgba(255,255,255,.55)',fontSize:13}}>Аккаунт: {user?.phone}</div>
          <button onClick={async () => { if(await customConfirm('Очистить все локальные данные и выйти из аккаунта?', { danger: true, requireWord: 'удалить' })) { localStorage.clear(); logout(); nav('/login'); } }}
            style={{alignSelf:'flex-start',background:'rgba(220,60,60,.2)',
              border:'1px solid rgba(220,60,60,.3)',borderRadius:12,padding:'10px 20px',
              color:'rgba(255,120,120,.9)',fontSize:14,cursor:'pointer'}}>
            Очистить данные и выйти
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="screen">
      <TopBar title="Настройки" onBack={() => nav(-1)}/>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'8px 26px',display:'flex',flexDirection:'column'}}>
        {sections.map(s => (
          <div key={s.id}>
            <div onClick={() => toggle(s.id)}
              style={{color:'white',fontSize:19,padding:'20px 0',cursor:'pointer',
                display:'flex',justifyContent:'space-between',alignItems:'center'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              {s.label}
              <span style={{color:'rgba(255,255,255,.4)',fontSize:18,
                display:'inline-block',transition:'transform .2s',
                transform: open===s.id ? 'rotate(90deg)' : 'rotate(0deg)'}}>›</span>
            </div>
            {open === s.id && s.content}
            <div className="divider"/>
          </div>
        ))}

        {/* Чёрный список — открывает попап */}
        <div onClick={() => setShowBlacklist(true)}
          style={{color:'white',fontSize:19,padding:'20px 0',cursor:'pointer',
            display:'flex',justifyContent:'space-between',alignItems:'center'}}
          onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          Чёрный список
          <span style={{color:'rgba(255,255,255,.4)',fontSize:18}}>›</span>
        </div>
        <div className="divider"/>

        {/* Написать разработчику */}
        <div onClick={() => setShowFeedback(true)}
          style={{color:'white',fontSize:19,padding:'20px 0',cursor:'pointer',
            display:'flex',justifyContent:'space-between',alignItems:'center'}}
          onMouseEnter={e=>e.currentTarget.style.opacity='.7'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          Написать разработчику
          <span style={{color:'rgba(255,255,255,.4)',fontSize:18}}>›</span>
        </div>
        <div className="divider"/>

        <div onClick={logout}
          style={{color:'rgba(255,160,160,.8)',fontSize:18,padding:'24px 0',cursor:'pointer',marginTop:8}}>
          Выйти из аккаунта
        </div>
      </div>

      {showBlacklist && <BlacklistModal onClose={() => setShowBlacklist(false)} />}
      {showFeedback  && <FeedbackModal  onClose={() => setShowFeedback(false)}  />}
      {confirmModal}
    </div>
  );
}
