// web/src/components/auth/AuthScreens.jsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import HeyLogo from '../HeyLogo';
import Icon from '../Icon';
import OnboardingTour from '../OnboardingTour';
import {
  AuthBrand, FloatingInput, PasswordInput,
  InviteBadge, ForgotPasswordPopup
} from './AuthComponents';
import { NoVpnRuNote } from './NoVpnRuNote';
import { validatePhone, formatPhoneInput, caretAfterNthDigit } from '../../lib/phoneFormat';
import { AvatarDisplay } from '../shared/AvatarDisplay';


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
        <HeyLogo size={88} color="#F9F0F0" title="HEY" />
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
        .hey-feat-card:hover { transform: translateY(-3px); background: rgba(249,240,240,.2) !important; }
        .hey-cta-login {
          width:100%; background:#5F4080; border:none; border-radius:26px;
          padding:15px; color:#F9F0F0; font-size:15px; font-weight:700;
          cursor:pointer; font-family:inherit; transition:all .15s;
          box-shadow:0 8px 24px rgba(95, 64, 128,.45);
        }
        .hey-cta-login:hover { background:#735494; transform:translateY(-1px); box-shadow:0 12px 32px rgba(95, 64, 128,.55); }
        .hey-cta-reg {
          width:100%; background:rgba(249,240,240,.18); border:1.5px solid rgba(249,240,240,.45);
          border-radius:26px; padding:15px; color:#F9F0F0; font-size:15px; font-weight:700;
          cursor:pointer; font-family:inherit; transition:background .15s;
        }
        .hey-cta-reg:hover { background:rgba(249,240,240,.28); }
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
            background:'linear-gradient(135deg,#F9F0F0 0%,#e8d8ff 100%)',
            WebkitBackgroundClip:'text', backgroundClip:'text',
            WebkitTextFillColor:'transparent',
            fontFamily:'Comfortaa,sans-serif',
            lineHeight:1,
          }}>
            <HeyLogo size={56} color="#F9F0F0" title="HEY" />
            HEY
          </div>
          <div style={{fontSize:15, color:'rgba(249,240,240,.9)', fontWeight:500, letterSpacing:.3}}>
            Мессенджер для тех, кто творит
          </div>
        </div>

        <div style={{
          fontSize:13, color:'rgba(249,240,240,.84)', textAlign:'center',
          lineHeight:1.7, maxWidth:260,
          animation:'heyFadeUp .5s ease-out .12s both',
        }}>
          Моменты · Чаты · Контакты без лишнего шума
        </div>
        <div style={{
          marginTop: 14, textAlign: 'center',
          animation: 'heyFadeUp .5s ease-out .18s both',
        }}>
          <NoVpnRuNote />
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
            background:'rgba(249,240,240,.14)',
            border:'1px solid rgba(249,240,240,.28)',
            borderRadius:18, padding:'16px 14px',
          }}>
            <div style={{fontSize:26, marginBottom:8, lineHeight:1}}>{f.icon}</div>
            <div style={{
              color:'#F9F0F0', fontWeight:700, fontSize:14,
              marginBottom:5,
            }}>{f.title}</div>
            <div style={{
              color:'rgba(249,240,240,.88)', fontSize:12, lineHeight:1.55,
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
          textAlign:'center', fontSize:12, color:'rgba(249,240,240,.78)',
          marginTop:4, lineHeight:1.5,
        }}>
          Вход только по инвайту от участника сообщества
        </div>
        <div style={{
          textAlign:'center', fontSize:12, color:'rgba(249,240,240,.72)',
          marginTop:8, lineHeight:1.5,
        }}>
          <a href="/terms" style={{ color:'#F9F0F0', textDecoration:'underline' }}>Соглашение</a>
          {' · '}
          <a href="/privacy" style={{ color:'#F9F0F0', textDecoration:'underline' }}>Персональные данные</a>
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
  const [searchParams] = useSearchParams();
  const gjoinToken = searchParams.get('gjoin');
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
      // Если аккаунт был в grace-периоде самоудаления — серверный /login
      // отдаёт restored:true и возвращает все поля. Покажем подтверждение.
      if (res.restored) {
        try {
          window.dispatchEvent(new CustomEvent('hey:toast', {
            detail: { message: '🎉 Аккаунт восстановлен после самоудаления', type: 'success' },
          }));
        } catch {}
      }
      // Если пришли с /gjoin/:token — возвращаемся туда, чтобы юзер нажал «Войти в группу»
      if (gjoinToken) nav('/gjoin/' + gjoinToken);
      else nav('/main');
    } catch(e) {
      if (e.code === 'GRACE_PHONE_TAKEN') {
        setErr(e.message);
      } else {
        setErr('Неверный телефон или пароль');
      }
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

        <div style={{ textAlign: 'center', marginBottom: 16, animation: 'authFadeUp .6s ease-out .08s both' }}>
          <NoVpnRuNote />
        </div>

        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          color:'#F9F0F0', marginBottom: 22,
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
                color: 'rgba(249,240,240,.9)', fontSize: 13,
                textDecoration: 'none', cursor: 'pointer',
                borderBottom: '1px dashed rgba(249,240,240,.55)',
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
              color:'#F9F0F0', fontSize: 13, textAlign: 'center', lineHeight: 1.4
            }}>{err}</div>
          )}

          <button className="auth-btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(249,240,240,.88)', fontSize: 14 }}>
            Нет аккаунта?{' '}
            <span
              onClick={() => nav('/register')}
              style={{ color:'#F9F0F0', fontWeight: 700, cursor: 'pointer',
                borderBottom: '1px solid rgba(249,240,240,.5)', paddingBottom: 1 }}
            >
              Создать
            </span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 14, color: 'rgba(249,240,240,.72)', fontSize: 12, lineHeight: 1.5 }}>
            <a href="/terms" style={{ color:'#F9F0F0', textDecoration:'underline' }}>Соглашение</a>
            {' · '}
            <a href="/privacy" style={{ color:'#F9F0F0', textDecoration:'underline' }}>Персональные данные</a>
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
              fontSize: 13, color: 'rgba(249,240,240,.86)',
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
          tgUsername={window.__HEY_TG_SUPPORT__ || 'hey_messenger_support_bot'}
        />
      )}
    </div>
  );
}

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
  // Group invite — кладётся в sessionStorage страницей /gjoin
  const [groupInvite, setGroupInvite] = useState(() => {
    try {
      const raw = sessionStorage.getItem('hey_group_invite');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [name, setName]         = useState(() => schoolInvite?.prefillName || '');
  // Префилл: предзаполненный из АВО prefillPhone (после оплаты)
  // — приоритет; иначе ставим «+7 » по умолчанию (большинство юзеров
  // из РФ). Сразу прогоняем через formatPhoneInput чтобы RF-номер
  // из АВО уже лёг как +7 9XX XXX XX XX.
  const [phone, setPhone]       = useState(() =>
    schoolInvite?.prefillPhone ? formatPhoneInput(schoolInvite.prefillPhone) : '+7 ');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [inviter, setInviter]   = useState(null);
  // Шаг подтверждения номера: SMS у нас нет, поэтому перед фактической
  // регистрацией показываем крупный поп-ап с номером и просим
  // подтвердить — поменять потом будет нельзя.
  const [confirmPhone, setConfirmPhone] = useState(null); // { display, normalized } | null
  // Ref на input телефона — нужен чтобы восстанавливать caret после
  // реформата (иначе курсор «прыгает» в конец строки при правке).
  const phoneInputRef = useRef(null);

  function handlePhoneChange(e) {
    const input = e.target;
    const newVal = input.value;
    const selStart = input.selectionStart ?? newVal.length;
    // 1. Считаем сколько ЦИФР до курсора в новой (ещё неотформатированной) строке.
    let digitsBefore = 0;
    for (let i = 0; i < selStart; i++) {
      if (/\d/.test(newVal[i])) digitsBefore++;
    }
    // 2. Реформатим.
    const formatted = formatPhoneInput(newVal);
    setPhone(formatted);
    // 3. Восстанавливаем caret: позиция после N-й цифры в новой строке.
    requestAnimationFrame(() => {
      const el = phoneInputRef.current;
      if (!el) return;
      const caretPos = caretAfterNthDigit(formatted, digitsBefore);
      try { el.setSelectionRange(caretPos, caretPos); } catch {}
    });
  }

  const hasInvite = !!inviteCode || !!schoolInvite || !!groupInvite;
  // Пометка для UI: показать ученику, что данные предзаполнены из оплаты
  const hasPrefill = !!(schoolInvite?.prefillName || schoolInvite?.prefillPhone);

  // Load inviter info if invite code present
  useEffect(() => {
    if (!inviteCode) return;
    api.getUserInviteInfo(inviteCode)
      .then(setInviter)
      .catch(() => {});
  }, [inviteCode]);

  // Первый шаг — валидация формы и открытие модалки с большим номером.
  function startRegister() {
    setErr('');
    if (!name.trim()) { setErr('Введите имя'); return; }
    const pv = validatePhone(phone);
    if (!pv.ok) { setErr(pv.msg); return; }
    if (password.length < 8) { setErr('Пароль минимум 8 символов'); return; }
    if (!legalAccepted) { setErr('Нужно принять пользовательское соглашение и политику персональных данных'); return; }
    setConfirmPhone({ display: phone.trim() || pv.normalized, normalized: pv.normalized });
  }

  // Второй шаг — после подтверждения телефона реально регистрируем.
  async function handleRegister() {
    setLoading(true);
    setErr('');
    try {
      const res = await api.register({
        name: name.trim(), phone: confirmPhone.normalized, password,
        ...(inviteCode    ? { inviteUserId: inviteCode } : {}),
        ...(schoolInvite  ? { schoolInviteCode: schoolInvite.code, email: schoolInvite.email } : {}),
        ...(groupInvite   ? { groupInviteToken: groupInvite.token } : {}),
      });
      // Чистим sessionStorage после успеха
      if (schoolInvite) sessionStorage.removeItem('hey_school_invite');
      if (groupInvite)  sessionStorage.removeItem('hey_group_invite');
      // Новый аккаунт на этом устройстве — старый флаг «тур видел»
      // от предыдущего юзера сбрасываем, чтобы презентация показалась снова.
      localStorage.removeItem('hey_tour_seen');
      login(res.token, res.user);
      nav('/welcome', { state: { isNewUser: true, userName: name.trim() } });
    } catch(e) {
      setErr(e.message);
      setConfirmPhone(null); // вернёмся к форме, чтобы поправить
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

        {inviter && <InviteBadge name={inviter.name} avatar={inviter.avatar_url} />}

        {schoolInvite && (
          <div style={{
            background:'rgba(95, 64, 128,.2)', border:'1px solid rgba(180,140,220,.4)',
            borderRadius:14, padding:'12px 16px', marginBottom:18,
            display:'flex', alignItems:'center', gap:10,
            animation: 'authFadeUp .6s ease-out .1s both',
          }}>
            <span style={{fontSize:22}}>🎓</span>
            <div style={{fontSize:13, color:'rgba(235,225,255,.95)'}}>
              <div style={{fontWeight:700, color:'#F9F0F0'}}>{schoolInvite.schoolName} приглашает</div>
              {schoolInvite.course && <div style={{opacity:.75, marginTop:2}}>Курс «{schoolInvite.course}»</div>}
              <div style={{opacity:.65, marginTop:2, fontSize:12}}>{schoolInvite.email}</div>
              {hasPrefill && (
                <div style={{opacity:.7, marginTop:6, fontSize:12, lineHeight:1.4}}>
                  Имя и телефон подставлены из оплаты — проверь и при необходимости поправь ниже.
                </div>
              )}
            </div>
          </div>
        )}

        {groupInvite && (
          <div style={{
            background:'rgba(95, 64, 128,.2)', border:'1px solid rgba(180,140,220,.4)',
            borderRadius:14, padding:'12px 16px', marginBottom:18,
            display:'flex', alignItems:'center', gap:10,
            animation: 'authFadeUp .6s ease-out .1s both',
          }}>
            <Icon name="users" size={20}/>
            <div style={{fontSize:13, color:'rgba(235,225,255,.95)'}}>
              <div style={{fontWeight:700, color:'#F9F0F0'}}>Приглашение в группу</div>
              <div style={{opacity:.85, marginTop:2}}>«{groupInvite.groupName}»</div>
              {groupInvite.inviterName && (
                <div style={{opacity:.75, marginTop:4, fontSize:12,
                  display:'flex', alignItems:'center', gap:6}}>
                  <AvatarDisplay
                    avatar={groupInvite.inviterAvatar}
                    name={groupInvite.inviterName}
                    size={18} fontSize={9}/>
                  <span>от {groupInvite.inviterName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{
          fontSize: 22, fontWeight: 700, textAlign: 'center',
          color:'#F9F0F0', marginBottom: 22,
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
          <FloatingInput id="reg-phone" label="Телефон (с кодом страны, например +49 …)" type="tel" value={phone}
            inputMode="tel" inputRef={phoneInputRef}
            onChange={handlePhoneChange} autoComplete="tel" />
          <PasswordInput id="reg-pwd" label="Придумай пароль" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startRegister()} />

          <div style={{ color: 'rgba(249,240,240,.82)', fontSize: 12, margin: '-4px 4px 18px', lineHeight: 1.5 }}>
            Минимум 8 символов. Аватар и день рождения добавишь потом в профиле.
          </div>

          <label style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            color: 'rgba(249,240,240,.88)', fontSize: 12, lineHeight: 1.55,
            margin: '0 4px 14px', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={e => setLegalAccepted(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#5F4080', flexShrink: 0 }}
            />
            <span>
              Я принимаю{' '}
              <a href="/terms" target="_blank" rel="noreferrer"
                style={{ color: '#F9F0F0', fontWeight: 700, textDecoration: 'underline' }}>
                Пользовательское соглашение
              </a>
              {', ознакомлен(а) с '}
              <a href="/privacy" target="_blank" rel="noreferrer"
                style={{ color: '#F9F0F0', fontWeight: 700, textDecoration: 'underline' }}>
                Политикой обработки персональных данных
              </a>
              {' '}и даю согласие на обработку персональных данных
            </span>
          </label>

          {err && (
            <div style={{
              background: 'rgba(220,60,60,.18)', border: '1px solid rgba(255,120,120,.35)',
              borderRadius: 12, padding: '10px 16px', marginBottom: 12,
              color:'#F9F0F0', fontSize: 13, textAlign: 'center', lineHeight: 1.4
            }}>{err}</div>
          )}

          <button className="auth-btn-primary" onClick={startRegister} disabled={loading}>
            {loading ? 'Создаём…' : (inviteCode || schoolInvite) ? 'Принять приглашение' : 'Создать аккаунт'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 22, color: 'rgba(249,240,240,.88)', fontSize: 14 }}>
            Уже есть аккаунт?{' '}
            <span
              onClick={() => nav('/login')}
              style={{ color:'#F9F0F0', fontWeight: 700, cursor: 'pointer',
                borderBottom: '1px solid rgba(249,240,240,.5)', paddingBottom: 1 }}
            >
              Войти
            </span>
          </div>
        </div>
        )}
      </div>

      {/* Confirm-phone modal: SMS у нас нет, поэтому показываем крупно
          номер пользователя ещё раз и просим подтвердить — после этого
          поменять его не получится без поддержки. */}
      {confirmPhone && createPortal(
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) setConfirmPhone(null); }}
          style={{ position:'fixed', inset:0, zIndex:10000,
            background:'rgba(0,0,0,.7)', backdropFilter:'blur(12px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{
            background:'rgba(22,15,50,.98)', borderRadius:22,
            width:'min(94vw, 420px)', padding:'28px 26px 24px',
            boxShadow:'0 20px 60px rgba(0,0,0,.55)',
            border:'1px solid rgba(249,240,240,.12)',
          }}>
            <div style={{ textAlign:'center', marginBottom: 18 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
              <div style={{ color:'#F9F0F0', fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                Подтверди свой номер
              </div>
              <div style={{ color:'rgba(249,240,240,.86)', fontSize: 13, lineHeight: 1.5 }}>
                Это твой логин для входа. Изменить его потом нельзя — без поддержки и без потери прогресса.
              </div>
            </div>

            <div style={{
              background:'rgba(95, 64, 128,.18)', border:'1px solid rgba(180,140,220,.4)',
              borderRadius: 16, padding:'20px 18px', marginBottom: 18, textAlign:'center',
            }}>
              <div style={{ color:'rgba(220,200,255,.9)', fontSize: 11,
                textTransform:'uppercase', letterSpacing: .8, marginBottom: 6 }}>
                Твой телефон
              </div>
              <div style={{
                color:'#F9F0F0', fontSize: 26, fontWeight: 800, letterSpacing: .5,
                wordBreak:'break-all', fontFamily:'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
              }}>
                {/* Форматированный «+7 999 111 11 11» вместо +799911111111
                    — глазами проверять группы цифр гораздо удобнее. */}
                {formatPhoneInput(confirmPhone.normalized)}
              </div>
            </div>

            {err && (
              <div style={{
                background:'rgba(220,60,60,.18)', border:'1px solid rgba(255,120,120,.35)',
                borderRadius: 12, padding:'10px 14px', marginBottom: 14,
                color:'#F9F0F0', fontSize: 13, textAlign:'center', lineHeight: 1.4,
              }}>{err}</div>
            )}

            <div style={{ display:'flex', gap: 10 }}>
              <button onClick={() => setConfirmPhone(null)} disabled={loading}
                style={{ flex:1, padding:'13px', borderRadius:14,
                  background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.14)',
                  color:'rgba(249,240,240,.92)', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'wait' : 'pointer', fontFamily:'inherit' }}>
                Изменить
              </button>
              <button onClick={handleRegister} disabled={loading} autoFocus
                style={{ flex: 1.4, padding:'13px', borderRadius:14,
                  background:'rgba(140,110,220,.95)', border:'1px solid rgba(180,140,220,.4)',
                  color:'#F9F0F0', fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer', fontFamily:'inherit',
                  opacity: loading ? .7 : 1 }}>
                {loading ? 'Создаём…' : 'Всё верно — продолжить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

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
        background:'rgba(95, 64, 128,.15)',
        border:'1px solid rgba(180,140,220,.3)',
        borderRadius:16,padding:'16px 18px',marginBottom:20,
        color:'rgba(235,225,255,.92)',fontSize:14,lineHeight:1.55,
      }}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:22,flexShrink:0}}>🎟</span>
          <div>
            <div style={{fontWeight:700,color:'#F9F0F0',marginBottom:6}}>
              Сейчас вход только по приглашению
            </div>
            <div style={{color:'rgba(249,240,240,.88)',fontSize:13}}>
              Попроси у знакомого, который уже в HEY, ссылку-приглашение —
              откроется страница регистрации с его именем.
            </div>
          </div>
        </div>
      </div>

      {/* Блок «У вас онлайн-школа на АвтоВебОфис?» временно скрыт:
          через for-schools-лендинг любой посетитель попадал на /register
          (с invite=system_hey_official), обходя ограничение «только по
          приглашению». Вернуть, когда будет отдельная гейтированная
          форма заявки на школьную интеграцию. */}

      {/* Waitlist */}
      {!done ? (
        <>
          <div style={{
            color:'rgba(249,240,240,.86)',fontSize:13,marginBottom:10,lineHeight:1.5,
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
              color:'#F9F0F0',fontSize:13,textAlign:'center',lineHeight:1.4,
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
          <div style={{fontWeight:700,marginBottom:4,color:'#F9F0F0'}}>Email добавлен</div>
          <div style={{color:'rgba(249,240,240,.88)',fontSize:13}}>
            Напишем когда регистрация откроется.
          </div>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:22, color:'rgba(249,240,240,.88)', fontSize:14 }}>
        Уже есть аккаунт?{' '}
        <span onClick={onSwitchToLogin}
          style={{ color:'#F9F0F0', fontWeight:700, cursor:'pointer',
            borderBottom:'1px solid rgba(249,240,240,.5)', paddingBottom:1 }}>
          Войти
        </span>
      </div>
    </div>
  );
}

export function PasswordResetScreen() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [pwd,   setPwd]   = useState('');
  const [pwd2,  setPwd2]  = useState('');
  const [busy,  setBusy]  = useState(false);
  const [done,  setDone]  = useState(false);
  const [err,   setErr]   = useState('');

  async function submit() {
    setErr('');
    if (!token) { setErr('Нет токена в ссылке'); return; }
    if (pwd.length < 8) { setErr('Пароль минимум 8 символов'); return; }
    if (pwd !== pwd2)   { setErr('Пароли не совпадают'); return; }
    setBusy(true);
    try {
      await api.passwordResetConfirm(token, pwd);
      setDone(true);
    } catch (e) { setErr(e.message || 'Ошибка'); }
    setBusy(false);
  }

  return (
    <div className="screen" style={{
      justifyContent:'center', alignItems:'center', padding:'40px 24px',
    }}>
      <div style={{ width:'100%', maxWidth: 380 }}>
        <AuthBrand />
        <div style={{ fontSize: 22, fontWeight: 700, textAlign:'center',
          color:'#F9F0F0', marginBottom: 22 }}>
          Новый пароль
        </div>

        {done ? (
          <>
            <div style={{
              background:'rgba(60,170,110,.18)', border:'1px solid rgba(110,235,150,.35)',
              borderRadius: 14, padding:'14px 16px', color:'rgba(220,255,220,.95)',
              fontSize: 14, lineHeight: 1.6, textAlign:'center', marginBottom: 18,
            }}>
              ✓ Пароль обновлён. Можно войти с новым паролем.
            </div>
            <button className="auth-btn-primary" onClick={() => nav('/login')}>
              Войти
            </button>
          </>
        ) : (
          <>
            <PasswordInput id="rst-pwd"  label="Новый пароль"
              value={pwd}  onChange={(e) => setPwd(e.target.value)}/>
            <PasswordInput id="rst-pwd2" label="Повтори пароль"
              value={pwd2} onChange={(e) => setPwd2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}/>
            <div style={{ color:'rgba(249,240,240,.82)', fontSize:12, margin:'-4px 4px 18px' }}>
              Минимум 8 символов. После смены войди со своим телефоном и новым паролем.
            </div>
            {err && (
              <div style={{
                background:'rgba(220,60,60,.18)', border:'1px solid rgba(255,120,120,.35)',
                borderRadius: 12, padding:'10px 16px', marginBottom: 12,
                color:'#F9F0F0', fontSize: 13, textAlign:'center', lineHeight: 1.4,
              }}>{err}</div>
            )}
            <button className="auth-btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Сохраняем…' : 'Установить пароль'}
            </button>
          </>
        )}
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
      <span style={{color:'#F9F0F0',fontSize:19}}>Профиль успешно создан!</span>
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
          background: 'linear-gradient(135deg, #a888d0, #5F4080)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color:'#F9F0F0', fontSize: 42, fontWeight: 700,
          margin: '0 auto 22px',
          boxShadow: '0 8px 24px rgba(0,0,0,.25)',
          animation: 'authFadeUp .5s ease-out both'
        }}>
          {initial}
        </div>

        <div style={{
          fontSize: 30, fontWeight: 700, color:'#F9F0F0', marginBottom: 8,
          animation: 'authFadeUp .5s ease-out .1s both'
        }}>
          Привет, {name}!
        </div>
        <div style={{
          fontSize: 15, color: 'rgba(249,240,240,.9)', marginBottom: 30, lineHeight: 1.55,
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
              background: 'rgba(249,240,240,.16)',
              border: '1px solid rgba(249,240,240,.3)',
              borderRadius: 16, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left',
              transition: 'all .15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,240,240,.24)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,240,240,.16)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(249,240,240,.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0
              }}>
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color:'#F9F0F0', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'rgba(249,240,240,.86)' }}>{sub}</div>
              </div>
              <div style={{ color: 'rgba(249,240,240,.72)', fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 10,
          animation: 'authFadeUp .5s ease-out .3s both'
        }}>
          <button onClick={() => nav('/main')} style={{
            flex: 1, background: 'rgba(249,240,240,.16)',
            border: '1px solid rgba(249,240,240,.38)',
            borderRadius: 26, padding: 15, color:'#F9F0F0',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background .15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,240,240,.24)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,240,240,.16)'}
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
