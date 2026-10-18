// web/src/components/screens/authScreens.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import {
  AuthBrand, FloatingInput, PasswordInput,
  InviteBadge, ForgotPasswordPopup
} from '../auth/AuthComponents';
import { heyToast } from './shared';

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

  const features = [
    {
      icon: '✦',
      title: 'Моменты',
      desc: 'Делись тем, что тебя занимает прямо сейчас. Находи людей на одной волне.',
    },
    {
      icon: '💬',
      title: 'Чаты без шума',
      desc: 'Личные и групповые беседы. Только те, кому доверяешь — без ботов и спама.',
    },
    {
      icon: '🤝',
      title: 'Живые контакты',
      desc: 'Добавляй по инвайту. Сохраняй заметки о людях. Строй настоящий круг.',
    },
    {
      icon: '✨',
      title: 'Super-режим',
      desc: 'До 3 активных моментов, приоритет в ленте и аналитика просмотров.',
    },
  ];

  return (
    <div className="screen" style={{
      justifyContent:'flex-start', alignItems:'center',
      padding:'0', flexDirection:'column', overflowY:'auto',
    }}>
      <style>{`
        @keyframes heyFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .hey-feat-card { transition: transform .18s, background .18s; }
        .hey-feat-card:hover { transform: translateY(-3px); background: rgba(255,255,255,.11) !important; }
        .hey-cta-login {
          width:100%; background:#7858b0; border:none; border-radius:26px;
          padding:15px; color:white; font-size:15px; font-weight:700;
          cursor:pointer; font-family:inherit; transition:all .15s;
          box-shadow:0 8px 24px rgba(120,88,176,.45);
        }
        .hey-cta-login:hover { background:#8868c0; transform:translateY(-1px); box-shadow:0 12px 32px rgba(120,88,176,.55); }
        .hey-cta-reg {
          width:100%; background:rgba(255,255,255,.11); border:1px solid rgba(255,255,255,.28);
          border-radius:26px; padding:15px; color:white; font-size:15px; font-weight:600;
          cursor:pointer; font-family:inherit; transition:background .15s;
        }
        .hey-cta-reg:hover { background:rgba(255,255,255,.2); }
      `}</style>

      {/* Hero */}
      <div style={{
        width:'100%', display:'flex', flexDirection:'column', alignItems:'center',
        padding:'56px 24px 32px',
      }}>
        {/* Logo — same style as LoginScreen AuthBrand */}
        <div style={{
          animation:'heyFadeUp .5s ease-out both',
          textAlign:'center', marginBottom:32,
        }}>
          <div style={{
            fontSize:62, fontWeight:700, letterSpacing:-2,
            display:'flex', alignItems:'center', justifyContent:'center', gap:14,
            marginBottom:10,
            background:'linear-gradient(135deg,#ffffff 0%,#e8d8ff 100%)',
            WebkitBackgroundClip:'text', backgroundClip:'text',
            WebkitTextFillColor:'transparent',
            fontFamily:'Comfortaa,sans-serif',
            lineHeight:1,
          }}>
            <span style={{
              background:'linear-gradient(135deg,#ffffff,#c8a8ff)',
              WebkitBackgroundClip:'text', backgroundClip:'text',
              WebkitTextFillColor:'transparent',
            }}>✦</span>
            HEY
          </div>
          <div style={{fontSize:15, color:'rgba(255,255,255,.7)', fontWeight:400, letterSpacing:.3}}>
            Мессенджер для тех, кто творит
          </div>
        </div>

        <div style={{
          fontSize:13, color:'rgba(255,255,255,.45)', textAlign:'center',
          lineHeight:1.7, maxWidth:260,
          animation:'heyFadeUp .5s ease-out .12s both',
        }}>
          Моменты · Чаты · Контакты без лишнего шума
        </div>
      </div>

      {/* Feature cards */}
      <div style={{
        width:'100%', maxWidth:480, padding:'0 16px',
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:10,
        animation:'heyFadeUp .55s ease-out .42s both',
      }}>
        {features.map((f, i) => (
          <div key={i} className="hey-feat-card" style={{
            background:'rgba(255,255,255,.07)',
            border:'1px solid rgba(255,255,255,.12)',
            borderRadius:18, padding:'16px 14px',
          }}>
            <div style={{fontSize:26, marginBottom:8, lineHeight:1}}>{f.icon}</div>
            <div style={{
              color:'white', fontWeight:700, fontSize:14,
              marginBottom:5,
            }}>{f.title}</div>
            <div style={{
              color:'rgba(255,255,255,.48)', fontSize:12, lineHeight:1.55,
            }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{
        width:'100%', maxWidth:480, padding:'20px 16px 40px',
        display:'flex', flexDirection:'column', gap:12,
        animation:'heyFadeUp .55s ease-out .56s both',
      }}>
        <button className="hey-cta-login" onClick={() => nav('/login')}>
          Войти
        </button>
        <button className="hey-cta-reg" onClick={() => nav('/register')}>
          Создать аккаунт
        </button>
        <div style={{
          textAlign:'center', fontSize:12, color:'rgba(255,255,255,.25)',
          marginTop:4, lineHeight:1.5,
        }}>
          Вход только по инвайту от участника сообщества
        </div>
      </div>
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
            <div style={{
              background: 'rgba(220,60,60,.18)', border: '1px solid rgba(255,120,120,.35)',
              borderRadius: 12, padding: '10px 16px', marginBottom: 12,
              color: 'white', fontSize: 13, textAlign: 'center', lineHeight: 1.4
            }}>{err}</div>
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

// onChange(previewUrl, file) — previewUrl for display, file for upload on save
function AvatarPicker({ avatar, onChange, size = 136, disabled = false }) {
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Файл больше 10 МБ'); return; }
    const localUrl = URL.createObjectURL(file);
    onChange(localUrl, file);
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

  // Школьный инвайт (от АВО) — кладётся в sessionStorage страницей /join
  const [schoolInvite, setSchoolInvite] = useState(() => {
    try {
      const raw = sessionStorage.getItem('hey_school_invite');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [inviter, setInviter]   = useState(null);

  const hasInvite = !!inviteCode || !!schoolInvite;

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
        ...(inviteCode    ? { inviteUserId: inviteCode } : {}),
        ...(schoolInvite  ? { schoolInviteCode: schoolInvite.code, email: schoolInvite.email } : {}),
      });
      // Чистим sessionStorage после успеха
      if (schoolInvite) sessionStorage.removeItem('hey_school_invite');
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

        {schoolInvite && (
          <div style={{
            background:'rgba(120,90,200,.2)', border:'1px solid rgba(180,140,220,.4)',
            borderRadius:14, padding:'12px 16px', marginBottom:18,
            display:'flex', alignItems:'center', gap:10,
            animation: 'authFadeUp .6s ease-out .1s both',
          }}>
            <span style={{fontSize:22}}>🎓</span>
            <div style={{fontSize:13, color:'rgba(235,225,255,.95)'}}>
              <div style={{fontWeight:700, color:'white'}}>{schoolInvite.schoolName} приглашает</div>
              {schoolInvite.course && <div style={{opacity:.75, marginTop:2}}>Курс «{schoolInvite.course}»</div>}
              <div style={{opacity:.65, marginTop:2, fontSize:12}}>{schoolInvite.email}</div>
            </div>
          </div>
        )}

        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          color: 'white', marginBottom: 22,
          animation: 'authFadeUp .6s ease-out .15s both'
        }}>
          {hasInvite ? 'Создать аккаунт' : 'Только по приглашению'}
        </div>

        {/* Без инвайта — показываем приглашение в waitlist */}
        {!hasInvite && (
          <InviteOnlyBlock onSwitchToLogin={() => nav('/login')}/>
        )}

        {/* С инвайтом — обычная форма регистрации */}
        {hasInvite && (
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
            <div style={{
              background: 'rgba(220,60,60,.18)', border: '1px solid rgba(255,120,120,.35)',
              borderRadius: 12, padding: '10px 16px', marginBottom: 12,
              color: 'white', fontSize: 13, textAlign: 'center', lineHeight: 1.4
            }}>{err}</div>
          )}

          <button className="auth-btn-primary" onClick={handleRegister} disabled={loading}>
            {loading ? 'Создаём…' : (inviteCode || schoolInvite) ? 'Принять приглашение' : 'Создать аккаунт'}
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
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteOnlyBlock — экран без инвайта: объяснение + waitlist
// ─────────────────────────────────────────────────────────────────────────────

function InviteOnlyBlock({ onSwitchToLogin }) {
  const [email, setEmail]   = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState('');

  async function submit() {
    setErr('');
    if (!email.trim()) { setErr('Введите email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setErr('Похоже, email с опечаткой');
      return;
    }
    setSending(true);
    try {
      await api.joinWaitlist(email.trim());
      setDone(true);
    } catch (e) { setErr(e.message || 'Не удалось сохранить'); }
    setSending(false);
  }

  return (
    <div style={{ animation: 'authFadeUp .6s ease-out .25s both' }}>
      {/* Объяснение */}
      <div style={{
        background:'rgba(120,90,200,.15)',
        border:'1px solid rgba(180,140,220,.3)',
        borderRadius:16,padding:'16px 18px',marginBottom:20,
        color:'rgba(235,225,255,.92)',fontSize:14,lineHeight:1.55,
      }}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:22,flexShrink:0}}>🎟</span>
          <div>
            <div style={{fontWeight:700,color:'white',marginBottom:6}}>
              Сейчас вход только по приглашению
            </div>
            <div style={{color:'rgba(255,255,255,.7)',fontSize:13}}>
              Попроси у знакомого, который уже в HEY, ссылку-приглашение —
              откроется страница регистрации с его именем.
            </div>
          </div>
        </div>
      </div>

      {/* Waitlist */}
      {!done ? (
        <>
          <div style={{
            color:'rgba(255,255,255,.65)',fontSize:13,marginBottom:10,lineHeight:1.5,
          }}>
            Хочешь узнать когда регистрация откроется без приглашения? Оставь email — напишем.
          </div>
          <FloatingInput id="wl-email" label="Твой email" type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()} autoComplete="email" />

          {err && (
            <div style={{
              background:'rgba(220,60,60,.18)',border:'1px solid rgba(255,120,120,.35)',
              borderRadius:12,padding:'10px 16px',marginBottom:12,
              color:'white',fontSize:13,textAlign:'center',lineHeight:1.4,
            }}>{err}</div>
          )}

          <button className="auth-btn-primary" onClick={submit} disabled={sending}>
            {sending ? 'Отправка…' : 'Хочу получить уведомление'}
          </button>
        </>
      ) : (
        <div style={{
          background:'rgba(46,204,113,.15)',
          border:'1px solid rgba(46,204,113,.35)',
          borderRadius:16,padding:'18px 20px',
          color:'rgba(180,255,200,.95)',fontSize:14,textAlign:'center',lineHeight:1.55,
        }}>
          <div style={{fontSize:28,marginBottom:8}}>✓</div>
          <div style={{fontWeight:700,marginBottom:4,color:'white'}}>Email добавлен</div>
          <div style={{color:'rgba(255,255,255,.7)',fontSize:13}}>
            Напишем когда регистрация откроется.
          </div>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:22, color:'rgba(255,255,255,.68)', fontSize:14 }}>
        Уже есть аккаунт?{' '}
        <span onClick={onSwitchToLogin}
          style={{ color:'white', fontWeight:700, cursor:'pointer',
            borderBottom:'1px solid rgba(255,255,255,.5)', paddingBottom:1 }}>
          Войти
        </span>
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
  const [tourDone, setTourDone] = useState(() => localStorage.getItem('hey_tour_seen') === '1');

  // Guard: if arrived without isNewUser flag, redirect to main
  useEffect(() => {
    if (!location.state?.isNewUser) nav('/main', { replace: true });
  }, []);

  function finishTour() {
    localStorage.setItem('hey_tour_seen', '1');
    setTourDone(true);
  }

  // Сначала — гид по ключевым концепциям
  if (!tourDone) {
    return <OnboardingTour onDone={finishTour}/>;
  }

  const name = location.state?.userName || user?.name || '';
  const initial = name ? name[0].toUpperCase() : '?';

  const steps = [
    { icon: '✦', title: 'Создать свой первый момент', sub: 'Покажи над чем работаешь', action: () => nav('/main') },
    { icon: '👥', title: 'Добавить контакты',          sub: 'По номеру или импорт из телефона', action: () => nav('/contacts') },
    { icon: '🎨', title: 'Заполнить профиль',          sub: 'Аватар, имя, день рождения', action: () => nav('/me') },
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
