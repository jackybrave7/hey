// web/src/components/Screens.jsx
import { useState, useEffect, useLayoutEffect, useRef, useMemo, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { api, socket } from '../api';
import { uploadMedia, previewUrl, uploadAvatar, uploadAudioBlob, uploadFile } from '../lib/uploadMedia';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../lib/push';
import SuperLimitPopup from './super/SuperLimitPopup';
import { useAuth } from '../AuthContext';
import {
  AuthBrand, FloatingInput, PasswordInput,
  InviteBadge, ForgotPasswordPopup
} from './auth/AuthComponents';
import MomentDetailPopup, { TextWithLinks } from './moments/MomentDetailPopup';
import MomentCard from './moments/MomentCard';
import OnboardingTour from './OnboardingTour';
import MoodEmoji from './moments/MoodEmoji';
import Icon from './Icon';
import SuperStatusCard from './super/SuperStatusCard';
import AchievementBadges from './super/AchievementBadges';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function DotsMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef();
  const menuRef = useRef();

  // Закрытие по клику вне (и кнопки, и портального меню)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Закрытие на ESC / при скролле страницы
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  }

  return (
    <>
      <div ref={btnRef} className="topbar-dots" style={{cursor:'pointer'}} onClick={toggle}>
        {[0,1,2].map(i => <div key={i} className="topbar-dot"/>)}
      </div>
      {open && createPortal(
        <div ref={menuRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position:'fixed', top: pos.top, right: pos.right, zIndex: 9999,
            background:'rgba(28,18,58,0.98)', backdropFilter:'blur(20px)',
            borderRadius:14, overflow:'hidden', minWidth:230,
            boxShadow:'0 12px 40px rgba(0,0,0,.55)',
            border:'1px solid rgba(255,255,255,.1)',
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
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,color: danger ? '#ff6b6b' : 'rgba(255,255,255,.85)'}}>{typeof icon === 'string' ? <span style={{fontSize:17}}>{icon}</span> : icon}</span>{label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
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
// ─────────────────────────────────────────────────────────────────────────────
// Toast (in-app уведомления) — заменяет native alert()
// Использование: heyToast('Сохранено') или heyToast('Ошибка', 'error')
// ─────────────────────────────────────────────────────────────────────────────

export function heyToast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('hey:toast', { detail: { message, type } }));
}

export function ToastContainer() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onToast(e) {
      const id = Math.random().toString(36).slice(2, 9);
      const t  = { id, message: e.detail.message, type: e.detail.type || 'info' };
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 3500);
    }
    window.addEventListener('hey:toast', onToast);
    return () => window.removeEventListener('hey:toast', onToast);
  }, []);
  if (!items.length) return null;
  const colors = {
    info:    { bg:'rgba(28,18,58,.98)',  border:'rgba(180,140,220,.3)', text:'rgba(235,225,255,.95)' },
    success: { bg:'rgba(20,40,30,.98)',  border:'rgba(80,200,140,.4)',  text:'rgba(180,255,210,.98)' },
    error:   { bg:'rgba(50,20,28,.98)',  border:'rgba(255,100,100,.4)', text:'rgba(255,180,180,.98)' },
    warning: { bg:'rgba(50,40,18,.98)',  border:'rgba(255,180,80,.4)',  text:'rgba(255,220,150,.98)' },
  };
  return createPortal(
    <div style={{
      position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)',
      zIndex:99999, display:'flex', flexDirection:'column', gap:8, alignItems:'center',
      pointerEvents:'none',
    }}>
      {items.map(t => {
        const c = colors[t.type] || colors.info;
        return (
          <div key={t.id}
            style={{
              background:c.bg, border:`1px solid ${c.border}`,
              borderRadius:14, padding:'12px 20px',
              color:c.text, fontSize:14, fontWeight:500,
              boxShadow:'0 8px 32px rgba(0,0,0,.45)', backdropFilter:'blur(20px)',
              maxWidth:'min(92vw, 420px)', lineHeight:1.45,
              animation:'heyToastIn .25s ease-out',
              pointerEvents:'auto',
            }}>
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes heyToastIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ConfirmModal + useConfirm
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmModal({ message, hint, requireWord, promptInput, promptPlaceholder, danger, confirmLabel, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef();
  useEffect(() => { if (requireWord || promptInput) setTimeout(() => inputRef.current?.focus(), 60); }, []);
  const canConfirm = !requireWord || typed.trim().toLowerCase() === requireWord.toLowerCase();
  const submit = () => {
    if (!canConfirm) return;
    onConfirm(promptInput ? typed.trim() : true);
  };

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
              onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape') onCancel(); }}
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

        {promptInput && !requireWord && (
          <textarea ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
            placeholder={promptPlaceholder || 'Введите текст…'}
            rows={3}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submit(); } if(e.key==='Escape') onCancel(); }}
            style={{
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.18)',
              borderRadius:12,padding:'10px 14px',color:'white',fontSize:14,
              fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
              resize:'vertical',transition:'border-color .15s',lineHeight:1.5,
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.6)'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.18)'}/>
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
          <button onClick={submit}
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
            {confirmLabel || (requireWord ? 'Удалить' : 'Подтвердить')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = (message, options = {}) => new Promise(resolve => {
    resolveRef.current = resolve;
    setDialog({ message, ...options });
  });

  // Стилизованный аналог window.prompt — возвращает строку или null если отмена
  const promptText = (message, options = {}) => new Promise(resolve => {
    resolveRef.current = resolve;
    setDialog({ message, promptInput: true, ...options });
  });

  const handleConfirm = (val) => {
    // Для promptInput val — строка; для обычного confirm — true
    resolveRef.current?.(val === undefined ? true : val);
    setDialog(null);
  };
  const handleCancel  = () => {
    // Для promptInput возвращаем null (как у window.prompt), для confirm — false
    resolveRef.current?.(dialog?.promptInput ? null : false);
    setDialog(null);
  };

  const modal = dialog ? (
    <ConfirmModal
      message={dialog.message}
      hint={dialog.hint}
      requireWord={dialog.requireWord}
      promptInput={dialog.promptInput}
      promptPlaceholder={dialog.promptPlaceholder}
      confirmLabel={dialog.confirmLabel}
      danger={dialog.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [confirm, modal, promptText];
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

// Короткая форма «был X назад» для шапки чата
function fmtLastSeenShort(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts * 1000) / 60000);
  if (diff < 1)   return 'только что';
  if (diff < 60)  return `${diff} мин. назад`;
  const h = Math.floor(diff / 60);
  if (h < 24)     return `${h} ч. назад`;
  const days = Math.floor(h / 24);
  if (days < 7)   return `${days} дн. назад`;
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'short' });
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
      // Если пришли с /gjoin/:token — возвращаемся туда, чтобы юзер нажал «Войти в группу»
      if (gjoinToken) nav('/gjoin/' + gjoinToken);
      else nav('/main');
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
    if (file.size > 10 * 1024 * 1024) { heyToast('Файл больше 10 МБ', 'error'); return; }
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
        ><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}><Icon name="camera" size={20}/>Сменить</div></div>
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
  // Group invite — кладётся в sessionStorage страницей /gjoin
  const [groupInvite, setGroupInvite] = useState(() => {
    try {
      const raw = sessionStorage.getItem('hey_group_invite');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [name, setName]         = useState(() => schoolInvite?.prefillName || '');
  const [phone, setPhone]       = useState(() => schoolInvite?.prefillPhone || '');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [inviter, setInviter]   = useState(null);

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
        ...(groupInvite   ? { groupInviteToken: groupInvite.token } : {}),
      });
      // Чистим sessionStorage после успеха
      if (schoolInvite) sessionStorage.removeItem('hey_school_invite');
      if (groupInvite)  sessionStorage.removeItem('hey_group_invite');
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
            background:'rgba(120,90,200,.2)', border:'1px solid rgba(180,140,220,.4)',
            borderRadius:14, padding:'12px 16px', marginBottom:18,
            display:'flex', alignItems:'center', gap:10,
            animation: 'authFadeUp .6s ease-out .1s both',
          }}>
            <Icon name="users" size={20}/>
            <div style={{fontSize:13, color:'rgba(235,225,255,.95)'}}>
              <div style={{fontWeight:700, color:'white'}}>Приглашение в группу</div>
              <div style={{opacity:.85, marginTop:2}}>«{groupInvite.groupName}»</div>
              {groupInvite.inviterName && (
                <div style={{opacity:.65, marginTop:2, fontSize:12}}>от {groupInvite.inviterName}</div>
              )}
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

// ─────────────────────────────────────────────────────────────────────────────
// MyProfileScreen
// ─────────────────────────────────────────────────────────────────────────────

export function MyProfileScreen() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [birthday, setBirthday] = useState('');
  const [email,    setEmail]    = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [avatar, setAvatar]     = useState('');
  const [avatarFile, setAvatarFile] = useState(null); // pending File to upload on save
  const [bio, setBio]           = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Invite link
  const [inviteCopied, setInviteCopied] = useState(false);

  // Confirm dialog
  const [customConfirm, confirmModal] = useConfirm();

  // Archive popup
  const [archiveSelected, setArchiveSelected] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false); // модалка со списком архивных моментов
  // Active moment popup
  const [activePopupIdx, setActivePopupIdx] = useState(null);

  // Saved moments (Поговорить)
  const [savedMoments, setSavedMoments]     = useState([]);
  const [savedLoading, setSavedLoading]     = useState(false);
  const [savedLoaded,  setSavedLoaded]      = useState(false);
  const [savedOpen,    setSavedOpen]        = useState(false);
  const [savedSelected, setSavedSelected]  = useState(null);

  function toggleSaved() {
    setSavedOpen(v => {
      if (!v && !savedLoaded) {
        setSavedLoading(true);
        api.getSavedMoments().then(items => {
          setSavedMoments(items);
          setSavedLoading(false);
          setSavedLoaded(true);
        }).catch(() => setSavedLoading(false));
      }
      return !v;
    });
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

  // ── Archive actions ────────────────────────────────────────────────────────
  async function restoreFromArchive(m) {
    const maxActive = user?.is_super ? 3 : 1;
    const curActive = myMoments.filter(x => x.status === 'active').length;
    if (curActive >= maxActive) {
      showProfileToast(maxActive === 1
        ? 'Сначала отправь активный момент в архив'
        : `Достигнут лимит (${maxActive} активных)`);
      return;
    }
    try {
      await api.restoreMoment(m.id);
      setMyMoments(prev => prev.map(x => x.id === m.id ? { ...x, status: 'active' } : x));
      showProfileToast('✦ Момент восстановлен');
    } catch(e) { showProfileToast('Ошибка: ' + e.message); }
  }

  async function deleteForever(m) {
    if (!await customConfirm('Удалить момент навсегда? Это действие нельзя отменить.', { danger: true })) return;
    try {
      await api.deleteMoment(m.id);
      setMyMoments(prev => prev.filter(x => x.id !== m.id));
      showProfileToast('Момент удалён');
    } catch(e) { showProfileToast('Ошибка: ' + e.message); }
  }

  // Init from user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setBirthday(user.birthday || '');
      setAvatar(user.avatar || '');
      setBio(user.bio || '');
      setEmail(user.email || '');
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
    setEmailErr('');
    // Reset to saved values
    setName(user.name || '');
    setPhone(user.phone || '');
    setBirthday(user.birthday || '');
    setAvatar(user.avatar || '');
    setAvatarFile(null);
    setBio(user.bio || '');
    setEmail(user.email || '');
  }

  async function saveProfile() {
    if (!name.trim()) return;
    // Email — опциональный, но если введён должен быть валидный
    const trimmedEmail = (email || '').trim();
    if (trimmedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
        setEmailErr('Неверный формат email');
        return;
      }
    }
    // Проверяем лимит ссылок ДО запроса (повторно проверится на сервере)
    const urls = (bio || '').match(/https?:\/\/\S+/gi) || [];
    const maxLinks = user?.is_super ? 5 : 1;
    if (urls.length > maxLinks) {
      heyToast(user?.is_super
        ? `В описании можно до ${maxLinks} ссылок (у тебя ${urls.length}). Лишние нужно убрать.`
        : `В описании можно только 1 ссылку (у тебя ${urls.length}). В ✦ Super — до 5. Лишние нужно убрать.`, 'error');
      return;
    }
    setSaving(true);
    try {
      // Upload avatar to S3 if a new file was selected
      let finalAvatar = avatar || null;
      if (avatarFile) {
        finalAvatar = await uploadAvatar(avatarFile, { getPresignUrl: api.getPresignUrl });
        setAvatarFile(null);
      }
      // Телефон НЕ отправляем — он закреплён за аккаунтом и не меняется в профиле
      const updated = await api.updateMe({
        name: name.trim(),
        birthday: birthday || null,
        avatar: finalAvatar,
        bio: bio.trim() || null,
        email: trimmedEmail || null,
      });
      setUser(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { heyToast(e.message, 'error'); }
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
        <AvatarPicker avatar={avatar} onChange={(url, file) => { setAvatar(url); setAvatarFile(file); }} size={130} disabled={!editing}/>

        <div style={{flex:1,display:'flex',flexDirection:'column',gap:16,paddingTop:8}}>

          {/* Имя */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>Имя</div>
              <input className="ul-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Имя"/>
            </div>
          ) : <FieldLine value={name || '—'}/>}

          {/* Телефон — нельзя менять после регистрации */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>
                Телефон <span style={{opacity:.6,fontSize:11}}>(нельзя изменить)</span>
              </div>
              <input className="ul-input" value={user?.phone || ''} readOnly disabled
                type="tel"
                style={{opacity:.7, cursor:'not-allowed'}}/>
              <div style={{color:'rgba(255,255,255,.4)',fontSize:11,marginTop:4,lineHeight:1.4}}>
                Телефон используется для входа и остаётся как при регистрации.
                Для смены — напиши в Telegram-бот поддержки.
              </div>
            </div>
          ) : <FieldLine value={user?.phone || '—'}/>}

          {/* Email — опциональный */}
          {editing ? (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:4}}>
                Email <span style={{opacity:.6,fontSize:11}}>(необязательно)</span>
              </div>
              <input className="ul-input" value={email}
                onChange={e=>{ setEmail(e.target.value); setEmailErr(''); }}
                placeholder="you@example.com" type="email"/>
              {emailErr && <div style={{color:'#ffaaaa',fontSize:12,marginTop:4}}>{emailErr}</div>}
              <div style={{color:'rgba(255,255,255,.4)',fontSize:11,marginTop:4,lineHeight:1.4}}>
                Нужен для интеграции со школьными курсами (BL School и т.п.).
                Видишь только ты.
              </div>
            </div>
          ) : (user?.email ? <FieldLine value={user.email}/> : null)}

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

      {/* Bio — full-width row below avatar block */}
      <div style={{padding:'16px 26px 0'}}>
        {editing ? (() => {
          const urls = (bio || '').match(/https?:\/\/\S+/gi) || [];
          const maxLinks = user?.is_super ? 5 : 1;
          const overLimit = urls.length > maxLinks;
          return (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:12,marginBottom:6,display:'flex',justifyContent:'space-between'}}>
                <span>О себе</span>
                <span style={{color: bio.length > 180 ? 'rgba(255,180,100,.8)' : 'rgba(255,255,255,.25)'}}>{bio.length}/200</span>
              </div>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 200))}
                placeholder="Расскажи о себе — пару строк о том, чем занимаешься…"
                rows={3}
                style={{
                  width:'100%', boxSizing:'border-box',
                  background:'rgba(255,255,255,.08)',
                  border: overLimit ? '1px solid rgba(255,120,120,.6)' : '1px solid rgba(255,255,255,.15)',
                  borderRadius:12, padding:'10px 13px', color:'white', fontSize:14,
                  fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.6,
                  transition:'border-color .15s',
                }}
                onFocus={e=>{ if(!overLimit) e.target.style.borderColor='rgba(180,140,220,.6)'; }}
                onBlur={e=>{ if(!overLimit) e.target.style.borderColor='rgba(255,255,255,.15)'; }}
              />
              <div style={{
                marginTop:6,fontSize:11,
                color: overLimit ? 'rgba(255,140,140,.95)' : 'rgba(255,255,255,.4)',
                display:'flex',alignItems:'center',gap:6,
              }}>
                <span>🔗</span>
                {overLimit ? (
                  <span>
                    <strong>Слишком много ссылок: {urls.length} из {maxLinks}.</strong>
                    {' '}Лишние нужно убрать.
                  </span>
                ) : (
                  <span>
                    Ссылок: <strong style={{color:'rgba(200,170,255,.85)'}}>{urls.length} из {maxLinks}</strong>
                    {!user?.is_super && <> · в ✦ Super — до 5</>}
                  </span>
                )}
              </div>
            </div>
          );
        })() : user?.bio ? (
          <div style={{
            background:'rgba(255,255,255,.05)', borderRadius:14,
            border:'1px solid rgba(255,255,255,.08)', padding:'12px 16px',
            color:'rgba(255,255,255,.75)', fontSize:14, lineHeight:1.6,
            wordBreak:'break-word', whiteSpace:'pre-wrap',
          }}>
            <BioWithLinks text={user.bio}/>
          </div>
        ) : null}
      </div>

      {/* Hint when not editing */}
      {!editing && (
        <div style={{padding:'12px 26px 0',color:'rgba(255,255,255,.4)',fontSize:13}}>
          Нажмите ✎ чтобы редактировать профиль
        </div>
      )}

      {/* Achievement badges остаются вверху рядом с инфо */}
      {!editing && (
        <div style={{padding:'16px 26px 0'}}>
          <AchievementBadges achievements={user?.achievements} />
        </div>
      )}

      {/* Shortcuts */}
      {!editing && (
        <div style={{padding:'16px 26px 0',display:'flex',flexDirection:'column',gap:10}}>
          {/* Invite link block */}
          <div style={{
            background:'rgba(120,90,200,.12)', border:'1px solid rgba(180,140,220,.25)',
            borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:12,
          }}>
            <span style={{fontSize:22}}>🔗</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'white',fontSize:14,fontWeight:600}}>Пригласить в HEY</div>
              <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginTop:2}}>
                Друг зарегистрируется и увидит тебя в контактах
              </div>
            </div>
            <button onClick={() => {
              const link = `${location.origin}/register?invite=${user?.id}`;
              navigator.clipboard.writeText(link).then(() => {
                setInviteCopied(true);
                setTimeout(() => setInviteCopied(false), 2500);
              });
            }} style={{
              flexShrink:0, padding:'7px 14px', borderRadius:50, fontSize:12, fontWeight:700,
              background: inviteCopied ? 'rgba(46,204,113,.35)' : 'rgba(120,90,200,.7)',
              border: inviteCopied ? '1px solid rgba(46,204,113,.5)' : '1px solid rgba(180,140,220,.4)',
              color:'white', cursor:'pointer', transition:'all .18s',
            }}>
              {inviteCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>

          {/* Поговорить — сохранённые моменты */}
          <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(255,255,255,.08)'}}>
            <button onClick={toggleSaved} style={{
              width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'13px 18px',background:'rgba(255,255,255,.06)',border:'none',
              color:'white',fontSize:14,fontWeight:600,cursor:'pointer',
            }}>
              <span>🤝 Поговорить</span>
              <span style={{opacity:.4,fontSize:12,transition:'transform .2s',
                transform: savedOpen ? 'rotate(90deg)' : 'none'}}>›</span>
            </button>
            {savedOpen && (
              <div style={{background:'rgba(255,255,255,.03)',padding:'12px 14px'}}>
                {savedLoading ? (
                  <div style={{textAlign:'center',padding:'20px 0',
                    color:'rgba(255,255,255,.3)',fontSize:13}}>Загрузка…</div>
                ) : savedMoments.length === 0 ? (
                  <div style={{textAlign:'center',padding:'24px 0'}}>
                    <div style={{fontSize:32,marginBottom:8}}>🤝</div>
                    <div style={{color:'rgba(255,255,255,.4)',fontSize:13}}>
                      Отмечай моменты реакцией 🤝 — они появятся здесь
                    </div>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {savedMoments.map(m => (
                      <div key={m.id} onClick={() => setSavedSelected(m)}
                        style={{
                          borderRadius:10,overflow:'hidden',cursor:'pointer',
                          background:'#1a0a30',aspectRatio:'3/4',position:'relative',
                        }}>
                        {m.media_url && m.media_type==='image'
                          ? <img src={m.media_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',
                              objectPosition: m.media_position || '50% 50%'}}/>
                          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
                              justifyContent:'center',fontSize:28,
                              background:'linear-gradient(135deg,#1e0a40,#3a1060)'}}>✦</div>
                        }
                        <div style={{position:'absolute',bottom:0,left:0,right:0,
                          background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',
                          padding:'6px 8px',fontSize:11,color:'rgba(255,255,255,.8)',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {m.author_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => nav('/settings')}
            style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'13px 18px',borderRadius:14,cursor:'pointer',
              background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',
              color:'white',fontSize:14,fontWeight:500,
            }}>
            <span style={{display:'inline-flex',alignItems:'center',gap:10}}><Icon name="settings" size={18}/> Настройки</span>
            <span style={{opacity:.4}}>›</span>
          </button>
          {user?.is_admin && (
            <button onClick={() => nav('/admin')} style={{
              display:'flex',alignItems:'center',justifyContent:'space-between',
              padding:'13px 18px',borderRadius:14,cursor:'pointer',
              background:'rgba(120,90,200,.18)',border:'1px solid rgba(180,140,255,.3)',
              color:'rgba(200,180,255,.95)',fontSize:14,fontWeight:600,
              transition:'background .15s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(120,90,200,.32)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.18)'}>
              <span style={{display:'inline-flex',alignItems:'center',gap:10}}><Icon name="settings" size={18}/> Панель администратора</span>
              <span style={{opacity:.5}}>›</span>
            </button>
          )}
        </div>
      )}

      {/* Moments section */}
      {!editing && (
        <div style={{padding:'28px 20px 0'}}>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:11,textTransform:'uppercase',
            letterSpacing:.8,marginBottom:14}}>Мои моменты</div>

          {/* Tabs */}
          {(() => {
            const activeMoments = myMoments.filter(m => m.status === 'active');
            const archivedMoments = myMoments.filter(m => m.status === 'archived');
            const maxActive = user?.is_super ? 3 : 1;
            return (<>
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            {/* «Активные» — обычный таб (всегда активен) */}
            <button
              style={{
                padding:'7px 18px',borderRadius:50,fontSize:13,fontWeight:600,cursor:'default',
                background:'rgba(120,90,200,.8)',
                border:'1px solid rgba(180,140,255,.4)',
                color:'white',
              }}>
              {activeMoments.length > 0 ? `Активные (${activeMoments.length})` : 'Активные'}
            </button>
            {/* «Архив» — открывает поп-ап */}
            {archivedMoments.length > 0 && (
              <button onClick={() => setArchiveOpen(true)}
                style={{
                  padding:'7px 16px',borderRadius:50,fontSize:13,fontWeight:600,cursor:'pointer',
                  background:'rgba(255,255,255,.08)',
                  border:'1px solid rgba(255,255,255,.1)',
                  color:'rgba(255,255,255,.6)',
                  transition:'all .18s',
                  display:'flex',alignItems:'center',gap:6,
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.14)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}>
                <span>📦 Архив ({archivedMoments.length})</span>
                <span style={{opacity:.5}}>›</span>
              </button>
            )}
          </div>

          {/* Active tab */}
          {momentsTab === 'active' && (
            <div>
              {activeMoments.length === 0 ? (
                <div style={{background:'rgba(255,255,255,.04)',borderRadius:16,
                  padding:'24px',textAlign:'center',border:'2px dashed rgba(255,255,255,.1)'}}>
                  <div style={{fontSize:28,marginBottom:10}}>✦</div>
                  <div style={{color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600}}>
                    Нет активных моментов
                  </div>
                  <div style={{color:'rgba(255,255,255,.35)',fontSize:12,marginTop:6}}>
                    Опубликуй первый момент на главном экране
                  </div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns: activeMoments.length > 1 ? '1fr 1fr' : '1fr',gap:10}}>
                  {activeMoments.map((active, i) => (
                    <div key={active.id}
                      onClick={() => setActivePopupIdx(i)}
                      style={{background:'rgba(255,255,255,.06)',borderRadius:16,
                        border:'1px solid rgba(255,255,255,.1)',overflow:'hidden',
                        cursor:'pointer',transition:'background .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}>
                      {active.media_url && active.media_type === 'image' ? (
                        <img src={active.media_url} alt=""
                          style={{width:'100%',height: activeMoments.length > 1 ? 100 : 140,objectFit:'cover',
                            objectPosition: active.media_position || '50% 50%',display:'block'}}/>
                      ) : (
                        <div style={{width:'100%',height: activeMoments.length > 1 ? 80 : 0,
                          background:'linear-gradient(135deg,rgba(80,40,140,.4),rgba(120,60,200,.3))',
                          display: activeMoments.length > 1 ? 'flex' : 'none',
                          alignItems:'center',justifyContent:'center',fontSize:28,color:'rgba(255,255,255,.2)'}}>✦</div>
                      )}
                      <div style={{padding: activeMoments.length > 1 ? '10px 12px' : '14px 16px'}}>
                        <div style={{color:'rgba(255,255,255,.85)',fontSize: activeMoments.length > 1 ? 12 : 14,lineHeight:1.5,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp: activeMoments.length > 1 ? 3 : 4,WebkitBoxOrient:'vertical'}}>
                          {active.text}
                        </div>
                        <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>👁 {active.views || 0}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>✨ {active.stats?.resonate || 0}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>🤝 {active.stats?.talk || 0}</span>
                        </div>
                        <button onClick={async e => {
                          e.stopPropagation();
                          try {
                            await api.archiveMoment(active.id);
                            setMyMoments(prev => prev.map(m => m.id === active.id ? {...m, status:'archived'} : m));
                            showProfileToast('📦 Момент отправлен в архив');
                          } catch(e2) { showProfileToast('Ошибка: ' + e2.message); }
                        }} style={{marginTop:8,width:'100%',padding:'7px',borderRadius:10,
                          background:'rgba(255,255,255,.07)',border:'none',
                          color:'rgba(255,255,255,.5)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          📦 В архив
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeMoments.length < maxActive && activeMoments.length > 0 && (
                <div style={{marginTop:10,color:'rgba(255,255,255,.3)',fontSize:12,textAlign:'center'}}>
                  {user?.is_super
                    ? `Можно добавить ещё ${maxActive - activeMoments.length} момент(а) — перейди в ленту`
                    : null}
                </div>
              )}
            </div>
          )}</>) })()}

          {/* Archive — теперь в поп-апе (см. ниже {archiveOpen && ...}) */}
          {false && (() => {
            const archived = myMoments.filter(m => m.status === 'archived');
            return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {archived.map(m => {
                  const hasImg = m.media_url && m.media_type === 'image';
                  const isAudio = m.media_url && m.media_type === 'audio';
                  return (
                    <div key={m.id} onClick={() => setArchiveSelected(m)}
                      style={{background:'rgba(255,255,255,.06)',borderRadius:16,
                        border:'1px solid rgba(255,255,255,.1)',overflow:'hidden',
                        cursor:'pointer',transition:'background .15s',
                        display:'flex',flexDirection:'column'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}>
                      {/* Hero: фото / mood / аудио-иконка */}
                      {hasImg ? (
                        <img src={m.media_url} alt=""
                          style={{width:'100%',height:100,objectFit:'cover',
                            objectPosition: m.media_position || '50% 50%',display:'block'}}/>
                      ) : isAudio ? (
                        <div style={{width:'100%',height:100,
                          background:'linear-gradient(135deg,#1a0a38,#2a1858)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:36,color:'rgba(255,255,255,.7)'}}>🎵</div>
                      ) : (
                        <div style={{width:'100%',height:100,overflow:'hidden'}}>
                          <MoodEmoji type={m.mood_emoji || 'calm'} size={56}/>
                        </div>
                      )}
                      <div style={{padding:'10px 12px',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{color:'rgba(255,255,255,.85)',fontSize:12,lineHeight:1.45,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                          {m.text}
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>👁 {m.views || 0}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>✨ {m.stats?.resonate || 0}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>🤝 {m.stats?.talk || 0}</span>
                        </div>
                        <div style={{color:'rgba(255,255,255,.3)',fontSize:11,
                          display:'flex',alignItems:'center',gap:4}}>
                          📦 {m.archived_at
                            ? new Date(m.archived_at * 1000).toLocaleDateString('ru', {day:'numeric',month:'short'})
                            : 'в архиве'}
                        </div>
                        {/* Actions */}
                        <div style={{display:'flex',gap:6,marginTop:4}}>
                          <button onClick={(e) => { e.stopPropagation(); restoreFromArchive(m); }}
                            style={{
                              flex:1,padding:'7px 4px',borderRadius:10,
                              background:'rgba(120,90,200,.5)',border:'1px solid rgba(180,140,220,.3)',
                              color:'white',fontSize:11,fontWeight:600,cursor:'pointer',
                              transition:'background .15s',whiteSpace:'nowrap',
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(120,90,200,.7)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.5)'}>
                            ↩ Восстановить
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteForever(m); }}
                            style={{
                              padding:'7px 9px',borderRadius:10,
                              background:'rgba(255,80,80,.12)',border:'1px solid rgba(255,80,80,.3)',
                              color:'rgba(255,140,140,.95)',fontSize:13,cursor:'pointer',
                              transition:'background .15s',flexShrink:0,
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,80,80,.22)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,80,80,.12)'}
                            title="Удалить навсегда">
                            <Icon name="trash" size={15}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Disciplines cloud */}
          {disciplines.length > 0 && (
            <div style={{marginTop:24,padding:'14px 16px',
              background:'rgba(255,255,255,.07)',borderRadius:16,
              border:'1px solid rgba(255,255,255,.12)'}}>
              <div style={{color:'rgba(255,255,255,.55)',fontSize:11,
                textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>
                Дисциплины
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                {disciplines.map(d => (
                  <span key={d.tag} style={{
                    background:'rgba(140,100,220,.35)',border:'1px solid rgba(200,160,255,.35)',
                    borderRadius:20,padding:'5px 13px',fontSize:13,
                    color:'rgba(235,215,255,.95)',fontWeight:500,
                  }}>
                    {d.tag} · {d.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUPER status card — в самом конце профиля */}
      {!editing && (
        <div style={{padding:'24px 26px 0'}}>
          <SuperStatusCard user={user} onInvite={() => {
            const link = `${location.origin}/register?invite=${user?.id}`;
            navigator.clipboard?.writeText(link).then(() => {
              setInviteCopied(true);
              setTimeout(() => setInviteCopied(false), 2500);
            });
          }}/>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmModal}

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

      {/* Active moment popup */}
      {activePopupIdx !== null && (() => {
        const activeMoments = myMoments.filter(m => m.status === 'active')
          .map(m => ({ ...m, author_name: user?.name, author_avatar: user?.avatar }));
        if (!activeMoments.length) return null;
        return (
          <MomentDetailPopup
            moments={activeMoments}
            initialIndex={activePopupIdx}
            currentUser={user}
            onClose={() => setActivePopupIdx(null)}
            onEdit={() => {}}
            onArchive={(m) => {
              setMyMoments(prev => prev.map(x => x.id === m.id ? {...x, status:'archived'} : x));
              setActivePopupIdx(null);
              showProfileToast('📦 Момент отправлен в архив');
            }}
            onDelete={(m) => {
              setMyMoments(prev => prev.filter(x => x.id !== m.id));
              setActivePopupIdx(null);
              showProfileToast('Момент удалён');
            }}
          />
        );
      })()}

      {/* Saved moment popup */}
      {savedSelected && (
        <MomentDetailPopup
          moments={[savedSelected]}
          initialIndex={0}
          currentUser={user}
          onClose={() => setSavedSelected(null)}
          onEdit={() => {}}
          onArchive={() => {}}
          onDelete={() => {}}
        />
      )}

      {/* Archive list popup — модалка со всеми архивными моментами (может быть много) */}
      {archiveOpen && (() => {
        const archived = myMoments.filter(m => m.status === 'archived');
        return createPortal(
          <div onMouseDown={e => { if (e.target === e.currentTarget) setArchiveOpen(false); }}
            style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
              backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{
              width:'min(94vw,640px)',maxHeight:'88vh',
              background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
              borderRadius:18,
              boxShadow:'0 24px 64px rgba(0,0,0,.55)',
              border:'1px solid rgba(255,255,255,.12)',
              display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'16px 20px 12px',display:'flex',alignItems:'center',gap:10,
                borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
                <span style={{fontSize:22}}>📦</span>
                <div style={{flex:1}}>
                  <div style={{color:'white',fontSize:17,fontWeight:700}}>Архив моментов</div>
                  <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginTop:1}}>
                    {archived.length} {archived.length === 1 ? 'момент' :
                      (archived.length % 10 >= 2 && archived.length % 10 <= 4 && (archived.length % 100 < 10 || archived.length % 100 >= 20) ? 'момента' : 'моментов')}
                  </div>
                </div>
                <button onClick={() => setArchiveOpen(false)}
                  style={{background:'none',border:'none',color:'rgba(255,255,255,.5)',
                    fontSize:24,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:14}}>
                {archived.length === 0 ? (
                  <div style={{background:'rgba(255,255,255,.04)',borderRadius:16,
                    padding:'30px 20px',textAlign:'center',border:'2px dashed rgba(255,255,255,.1)'}}>
                    <div style={{fontSize:32,marginBottom:10,opacity:.6}}>📦</div>
                    <div style={{color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600}}>
                      Архив пуст
                    </div>
                    <div style={{color:'rgba(255,255,255,.35)',fontSize:12,marginTop:6}}>
                      Архивные моменты появятся здесь после того, как ты сам уберёшь их с публикации
                    </div>
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                    {archived.map(m => {
                      const hasImg = m.media_url && m.media_type === 'image';
                      const isAudio = m.media_url && m.media_type === 'audio';
                      return (
                        <div key={m.id} onClick={() => { setArchiveOpen(false); setArchiveSelected(m); }}
                          style={{background:'rgba(255,255,255,.06)',borderRadius:14,
                            border:'1px solid rgba(255,255,255,.1)',overflow:'hidden',
                            cursor:'pointer',transition:'background .15s',
                            display:'flex',flexDirection:'column'}}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}>
                          {hasImg ? (
                            <img src={m.media_url} alt=""
                              style={{width:'100%',height:100,objectFit:'cover',
                                objectPosition: m.media_position || '50% 50%',display:'block'}}/>
                          ) : isAudio ? (
                            <div style={{width:'100%',height:100,
                              background:'linear-gradient(135deg,#1a0a38,#2a1858)',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:36,color:'rgba(255,255,255,.7)'}}>🎵</div>
                          ) : (
                            <div style={{width:'100%',height:100,overflow:'hidden'}}>
                              <MoodEmoji type={m.mood_emoji || 'calm'} size={56}/>
                            </div>
                          )}
                          <div style={{padding:'10px 12px',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                            <div style={{color:'rgba(255,255,255,.85)',fontSize:12,lineHeight:1.45,
                              overflow:'hidden',display:'-webkit-box',
                              WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                              {m.text}
                            </div>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                              <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>👁 {m.views || 0}</span>
                              <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>✨ {m.stats?.resonate || 0}</span>
                              <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>🤝 {m.stats?.talk || 0}</span>
                            </div>
                            <div style={{color:'rgba(255,255,255,.3)',fontSize:11,
                              display:'flex',alignItems:'center',gap:4}}>
                              📦 {m.archived_at
                                ? new Date(m.archived_at * 1000).toLocaleDateString('ru', {day:'numeric',month:'short'})
                                : 'в архиве'}
                            </div>
                            <div style={{display:'flex',gap:6,marginTop:4}}>
                              <button onClick={(e) => { e.stopPropagation(); restoreFromArchive(m); }}
                                style={{
                                  flex:1,padding:'7px 4px',borderRadius:10,
                                  background:'rgba(120,90,200,.5)',border:'1px solid rgba(180,140,220,.3)',
                                  color:'white',fontSize:11,fontWeight:600,cursor:'pointer',
                                  transition:'background .15s',whiteSpace:'nowrap',
                                }}
                                onMouseEnter={e=>e.currentTarget.style.background='rgba(120,90,200,.7)'}
                                onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.5)'}>
                                ↩ Восстановить
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteForever(m); }}
                                style={{
                                  padding:'7px 9px',borderRadius:10,
                                  background:'rgba(255,80,80,.12)',border:'1px solid rgba(255,80,80,.3)',
                                  color:'rgba(255,140,140,.95)',fontSize:13,cursor:'pointer',
                                  transition:'background .15s',flexShrink:0,
                                }}
                                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,80,80,.22)'}
                                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,80,80,.12)'}
                                title="Удалить навсегда">
                                🗑
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Archive moment popup */}
      {archiveSelected && (() => {
        const archivedMoments = myMoments.filter(m => m.status === 'archived')
          .map(m => ({ ...m, author_name: user?.name, author_avatar: user?.avatar }));
        const archIdx = archivedMoments.findIndex(m => m.id === archiveSelected.id);
        const maxActive = user?.is_super ? 3 : 1;
        const activeCount = myMoments.filter(m => m.status === 'active').length;
        return (
          <MomentDetailPopup
            moments={archivedMoments}
            initialIndex={archIdx >= 0 ? archIdx : 0}
            currentUser={user}
            onClose={() => setArchiveSelected(null)}
            onEdit={() => {}}
            onArchive={() => {}}
            onDelete={(m) => {
              setMyMoments(prev => prev.filter(x => x.id !== m.id));
              setArchiveSelected(null);
              showProfileToast('Момент удалён');
            }}
            onRestore={async (m) => {
              const curActive = myMoments.filter(x => x.status === 'active').length;
              if (curActive >= maxActive) {
                showProfileToast(maxActive === 1
                  ? 'Сначала отправь текущий момент в архив'
                  : `Достигнут лимит (${maxActive} активных)`);
                return;
              }
              try {
                await api.restoreMoment(m.id);
                setMyMoments(prev => prev.map(x =>
                  x.id === m.id ? { ...x, status: 'active' } : x
                ));
                setArchiveSelected(null);
                showProfileToast('✦ Момент восстановлен');
              } catch(e) { showProfileToast('Ошибка: ' + e.message); }
            }}
          />
        );
      })()}

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
    { label:'Сообщения',       path:'/chats' },
    { label:'История звонков', path:'/calls' },
    { label:'Настройки',       path:'/settings' },
  ];
  return (
    <div className="screen">
      <div className="topbar">
        <span className="topbar-title">Главная</span>
        <div onClick={() => nav('/me')} style={{width:32,height:32,borderRadius:'50%',background:'white',
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
// Подсвечивает совпадения поискового запроса в тексте
function Highlight({ text, q }) {
  if (!text) return null;
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{
        background:'rgba(255,210,100,.35)', color:'rgba(255,235,170,1)',
        padding:'0 2px', borderRadius:3,
      }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// Рендер «О себе» с автоопределением ссылок и превращением их в <a>
function BioWithLinks({ text }) {
  if (!text) return null;
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const parts = [];
  let lastIdx = 0;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push({ t: text.slice(lastIdx, m.index), link: false });
    const cleanUrl = trimUrlTail(m[0]);
    const tail = m[0].slice(cleanUrl.length);
    parts.push({ t: cleanUrl, link: true });
    if (tail) parts.push({ t: tail, link: false });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push({ t: text.slice(lastIdx), link: false });
  return (
    <>
      {parts.map((p, i) => p.link ? (
        <a key={i} href={p.t} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            color:'rgba(180,140,255,.95)', textDecoration:'underline',
            textUnderlineOffset:2, wordBreak:'break-all',
          }}>
          {p.t.replace(/^https?:\/\//,'')}
        </a>
      ) : <span key={i}>{p.t}</span>)}
    </>
  );
}

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

// Helper: открыть карточку контакта из любого места приложения
export function openUserCard(userId) {
  if (!userId) return;
  window.dispatchEvent(new CustomEvent('hey:open-user-card', { detail: userId }));
}

// Глобальный mount для ContactCardModal — слушает hey:open-user-card,
// фетчит контакт-инфо, рендерит модалку. Вставляется один раз на уровне App.
export function GlobalUserCardMount() {
  const [userId, setUserId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const nav = useNavigate();
  const { user: me } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();

  useEffect(() => {
    function onOpen(e) {
      const id = e.detail;
      if (!id || id === me?.id) return;  // на себя не открываем
      setUserId(id);
      api.getContacts().then(setContacts).catch(() => {});
      api.getBlocked().then(setBlocked).catch(() => {});
    }
    window.addEventListener('hey:open-user-card', onOpen);
    return () => window.removeEventListener('hey:open-user-card', onOpen);
  }, [me?.id]);

  if (!userId) return null;
  const fromContacts = contacts.find(c => c.id === userId);
  const contactObj = fromContacts || { id: userId, name: '…', notes: null, nickname: null };
  const isContact   = !!fromContacts;
  const isBlocked   = blocked.some(b => b.id === userId);

  async function refreshLists() {
    try { setContacts(await api.getContacts()); } catch {}
    try { setBlocked(await api.getBlocked()); }   catch {}
  }

  return (<>
    {confirmModal}
    <ContactCardModal
      contact={contactObj}
      isBlocked={isBlocked}
      isContact={isContact}
      onClose={() => setUserId(null)}
      onChat={async () => {
        try {
          const conv = await api.openConversation(userId);
          setUserId(null);
          nav(`/chat/${conv.id}`);
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onAddContact={async () => {
        try {
          await api.addContact({ userId });
          await refreshLists();
          heyToast('✓ Добавлено в контакты', 'success');
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onRemoveContact={async () => {
        const ok = await customConfirm('Удалить из контактов? Чат и переписка останутся.',
            { confirmLabel: 'Удалить' });
        if (!ok) return;
        try {
          await api.deleteContact(userId);
          await refreshLists();
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onBlock={async () => {
        if (!await customConfirm('Заблокировать пользователя? Он не сможет писать тебе и видеть твои моменты.',
            { confirmLabel: 'Заблокировать', danger: true })) return;
        try {
          await api.blockUser(userId);
          await refreshLists();
          heyToast('Заблокирован', 'info');
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onUnblock={async () => {
        try {
          await api.unblockUser(userId);
          await refreshLists();
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onNotesChange={() => refreshLists()}
      onOpenMoment={(m) => { setUserId(null); nav(`/moments/${m.id}`); }}
    />
  </>);
}

function ContactCardModal({ contact, isBlocked, isContact, onClose, onChat,
  onAddContact, onRemoveContact, onBlock, onUnblock, onNotesChange, onOpenMoment }) {
  const [notes, setNotes]         = useState(contact.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [avatarFull, setAvatarFull] = useState(false);
  // Свежие данные профиля (аватар / bio / headline / active_moments) —
  // подтягиваем при открытии чтобы карточка не показывала устаревшие данные.
  const [fresh, setFresh] = useState(null);
  // is_contact с сервера — если проп isContact не передан, берём из fresh
  const saveTimer = useRef();

  useEffect(() => {
    let alive = true;
    if (!contact?.id) return;
    api.getUserProfile(contact.id)
      .then(p => { if (alive) setFresh(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, [contact?.id]);

  // Объединяем: свежие данные имеют приоритет над contacts-кешем
  const merged = { ...contact, ...(fresh || {}) };
  merged.nickname = contact.nickname;
  merged.notes    = contact.notes;
  // Определяем isContact: явный проп > свежий is_contact с сервера
  const resolvedIsContact = isContact !== undefined ? isContact : !!fresh?.is_contact;

  // Determine if avatar is a real image (not emoji/letter)
  const av = merged.avatar;
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
            <AvatarDisplay avatar={merged.avatar} name={merged.nickname||merged.name}
              size={96} fontSize={42}
              style={{boxShadow:'0 8px 24px rgba(0,0,0,.3)',border:'3px solid rgba(255,255,255,.25)'}}/>
            <div className="av-zoom" style={{
              position:'absolute',inset:0,borderRadius:'50%',opacity:0,transition:'opacity .2s',
              background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',
              pointerEvents:'none',color:'white',
            }}><Icon name="search" size={22}/></div>
          </div>
          <div style={{textAlign:'center', width:'100%'}}>
            <div style={{color:'white',fontSize:20,fontWeight:700}}>
              {merged.nickname || merged.name}
            </div>
            {merged.nickname && (
              <div style={{color:'rgba(255,255,255,.55)',fontSize:14,marginTop:2}}>{merged.name}</div>
            )}
            {merged.headline && (
              <div style={{color:'rgba(255,255,255,.75)',fontSize:13,marginTop:6,
                fontStyle:'italic',lineHeight:1.4}}>
                {merged.headline}
              </div>
            )}
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13,marginTop:4}}>{merged.phone}</div>
            {merged.bio && (
              <div style={{
                marginTop:12, padding:'10px 14px',
                background:'rgba(255,255,255,.1)', borderRadius:12,
                border:'1px solid rgba(255,255,255,.12)',
                color:'rgba(255,255,255,.88)', fontSize:13, lineHeight:1.5,
                textAlign:'left', whiteSpace:'pre-wrap', wordBreak:'break-word',
              }}>
                <BioWithLinks text={merged.bio}/>
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{position:'absolute',top:16,right:16,background:'none',border:'none',
              color:'rgba(255,255,255,.5)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        {/* Body */}
        <div style={{padding:'18px 22px 20px',display:'flex',flexDirection:'column',gap:14}}>
          {/* Active moments thumbnails */}
          {Array.isArray(merged.active_moments) && merged.active_moments.length > 0 && (
            <div>
              <div style={{color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:700,
                textTransform:'uppercase',letterSpacing:.6,marginBottom:8}}>
                ✦ Сейчас в моментах · {merged.active_moments.length}
              </div>
              <div style={{display:'flex',gap:8,overflowX:'auto',padding:'2px 0 4px'}}>
                {merged.active_moments.map(m => {
                  const hasImg = m.media_url && m.media_type === 'image';
                  return (
                    <div key={m.id} onClick={() => onOpenMoment?.(m)}
                      title={m.text ? m.text.slice(0, 80) : 'Момент'}
                      style={{
                        width:72,height:90,flexShrink:0,borderRadius:10,
                        overflow:'hidden',cursor:'pointer',
                        background: hasImg ? '#0a0518' : 'linear-gradient(135deg,#2a1858,#4a2898)',
                        border:'1px solid rgba(255,255,255,.12)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        color:'white',fontSize:11,padding: hasImg ? 0 : 6,
                        textAlign:'center',lineHeight:1.3,
                        transition:'transform .15s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.04)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                      {hasImg ? (
                        <img src={m.media_url} alt=""
                          style={{width:'100%',height:'100%',objectFit:'cover',
                            objectPosition: m.media_position || '50% 50%'}}/>
                      ) : (
                        <div style={{
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp:4,WebkitBoxOrient:'vertical',
                          opacity:.9,
                        }}>
                          {m.text ? m.text.slice(0,40) : '✦'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Если юзер удалил аккаунт — действий нет, показываем плашку */}
          {merged.is_deleted ? (
            <div style={{
              padding:'14px 16px',borderRadius:14,
              background:'rgba(180,180,180,.08)',
              border:'1px solid rgba(255,255,255,.1)',
              color:'rgba(225,220,245,.75)',fontSize:13,lineHeight:1.5,textAlign:'center',
            }}>
              Этот пользователь удалил аккаунт.<br/>
              Написать и добавить в контакты нельзя.
            </div>
          ) : (
            <>
              {/* Primary actions: Написать + В контактах/Добавить */}
              <div style={{display:'flex',gap:10}}>
                <button onClick={onChat}
                  style={{flex:1,padding:'12px 0',background:'rgba(120,90,200,.85)',
                    border:'1px solid rgba(180,140,220,.5)',borderRadius:14,
                    color:'white',fontSize:14,fontWeight:700,cursor:'pointer',
                    transition:'background .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.95)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.85)'}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="chat" size={16}/> Написать</span>
                </button>
                {resolvedIsContact ? (
                  <button onClick={onRemoveContact}
                    title="Убрать из контактов"
                    style={{flex:1,padding:'12px 0',background:'rgba(60,160,90,.32)',
                      border:'1px solid rgba(100,200,120,.45)',borderRadius:14,
                      color:'rgba(170,240,190,.95)',fontSize:14,fontWeight:600,cursor:'pointer',
                      transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(60,160,90,.5)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(60,160,90,.32)'}>
                    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="check" size={16}/> В контактах</span>
                  </button>
                ) : (
                  <button onClick={onAddContact}
                    style={{flex:1,padding:'12px 0',background:'rgba(255,255,255,.08)',
                      border:'1px solid rgba(255,255,255,.18)',borderRadius:14,
                      color:'white',fontSize:14,fontWeight:600,cursor:'pointer',
                      transition:'background .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.14)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}>
                    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="user-plus" size={16}/> Добавить в контакты</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Secondary: Block (de-emphasized — icon-button) */}
          <div style={{display:'flex',justifyContent:'center',marginTop:-4}}>
            {merged.is_deleted ? null : isBlocked ? (
              <button onClick={onUnblock}
                style={{
                  background:'none',border:'none',cursor:'pointer',
                  color:'rgba(160,220,180,.75)',fontSize:12,fontWeight:500,
                  padding:'6px 10px',borderRadius:8,fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.color='rgba(180,240,200,1)'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(160,220,180,.75)'}>
                ✓ Разблокировать
              </button>
            ) : (
              <button onClick={onBlock}
                style={{
                  background:'none',border:'none',cursor:'pointer',
                  color:'rgba(255,255,255,.4)',fontSize:12,fontWeight:500,
                  padding:'6px 10px',borderRadius:8,fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.color='rgba(255,160,160,.85)'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.4)'}>
                Заблокировать
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
            src={merged.avatar}
            alt={merged.name}
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
// InviteByPhoneModal — номер не найден, предлагаем пригласить
// ─────────────────────────────────────────────────────────────────────────────

function InviteByPhoneModal({ phone, onClose }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuth();

  const inviteLink = `${location.origin}/register?invite=${user?.id || ''}`;
  const waText = `Привет! Я пользуюсь HEY Messenger — быстрый и стильный мессенджер. Вступай: ${inviteLink}`;
  const waHref = `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(waText)}`;

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const overlay = { position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,.65)',
    backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 };
  const panel = { background:'rgba(28,18,56,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,400px)',
    boxShadow:'0 24px 64px rgba(0,0,0,.55)',border:'1px solid rgba(255,255,255,.13)',overflow:'hidden' };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{padding:'22px 24px 16px',display:'flex',alignItems:'center',gap:12,
          borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          <span style={{fontSize:28}}>📲</span>
          <div style={{flex:1}}>
            <div style={{color:'white',fontSize:16,fontWeight:700}}>Пользователь не найден</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13,marginTop:2}}>
              Пригласи {phone} в HEY
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {/* Invite link */}
          <div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginBottom:8}}>
              Твоя персональная ссылка для приглашения
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(255,255,255,.07)',borderRadius:12,
                padding:'10px 14px',color:'rgba(200,180,255,.9)',fontSize:12,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                border:'1px solid rgba(255,255,255,.12)',userSelect:'all'}}>
                {inviteLink}
              </div>
              <button onClick={copyLink}
                style={{padding:'10px 16px',borderRadius:12,whiteSpace:'nowrap',flexShrink:0,
                  background: linkCopied ? 'rgba(60,180,100,.7)' : 'rgba(120,90,200,.7)',
                  border:'none',color:'white',fontSize:13,fontWeight:600,cursor:'pointer',
                  transition:'background .2s'}}>
                {linkCopied ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* WhatsApp button */}
          <a href={waHref} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              padding:'14px',borderRadius:16,textDecoration:'none',
              background:'rgba(37,211,102,.18)',border:'1px solid rgba(37,211,102,.3)',
              color:'rgba(80,230,120,.9)',fontSize:15,fontWeight:600}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Написать в WhatsApp
          </a>

          <button onClick={onClose}
            style={{padding:'12px',borderRadius:16,border:'1px solid rgba(255,255,255,.15)',
              background:'none',color:'rgba(255,255,255,.5)',fontSize:14,cursor:'pointer'}}>
            Отмена
          </button>
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
  const { user } = useAuth();
  const [contacts,      setContacts]      = useState([]);
  const [blocked,       setBlocked]       = useState([]);
  const [query,         setQuery]         = useState('');
  const [inviteTarget,  setInviteTarget]  = useState(null); // phone not found — show invite popup
  const [card,          setCard]          = useState(null);
  const [showImport,    setShowImport]    = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [customConfirm, confirmModal]     = useConfirm();

  useEffect(() => {
    api.getContacts().then(setContacts).catch(console.error);
    api.getBlocked().then(setBlocked).catch(console.error);
  }, []);

  // ── Global поиск отключён — приватность.
  // Найти пользователя можно только если он уже в контактах,
  // или ввести номер телефона и нажать «+».

  // ── Add contact by phone (+ button) ─────────────────────────────────────
  async function addContact() {
    const q = query.trim();
    if (!q) return;
    // If looks like a phone number — try to add directly
    const looksLikePhone = /^[\d\s\-\+\(\)]{7,}$/.test(q);
    if (looksLikePhone) {
      const pv = validatePhone(q);
      if (!pv.ok) { heyToast(pv.msg, 'error'); return; }
      try {
        const c = await api.addContact({ phone: pv.normalized });
        setContacts(prev => prev.find(x => x.id === c.id) ? prev : [...prev, c]);
        setQuery('');
        setSearchResults(null);
      } catch(e) {
        // User not found — offer invite
        if (e.message?.includes('не найден') || e.message?.includes('404') || e.status === 404) {
          setInviteTarget(pv.normalized);
        } else {
          heyToast(e.message, 'error');
        }
      }
    }
    // Не телефон и не нашли локально → ничего не делаем,
    // дальше нужно либо точнее ввести имя, либо ввести номер.
  }

  async function openChat(contactId) {
    setCard(null);
    try {
      const conv = await api.openConversation(contactId);
      nav(`/chat/${conv.id}`);
    } catch(e) { heyToast(e.message, 'error'); }
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
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3,display:'flex',alignItems:'center',gap:8}}>
            <Icon name="users" size={20}/> Контакты
          </div>
          <DotsMenu items={[
            { label: 'Импорт контактов', icon: <Icon name="download" size={18}/>, onClick: () => setShowImport(true) },
            { label: 'Пригласить друга',  icon: <Icon name="share" size={18}/>, onClick: () => setShowInvite(true) },
          ]}/>
        </div>
      </div>

      {/* Content limited to 680 */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',flex:1,display:'flex',flexDirection:'column'}}>
      {/* Search / Add input */}
      <div style={{padding:'12px 20px',display:'flex',gap:8,flexShrink:0}}>
        <input className="glass-input" placeholder="Поиск или номер телефона"
          value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addContact()} style={{flex:1}}/>
        <button className="pill" onClick={addContact} style={{padding:'13px 20px',fontSize:20}}>+</button>
      </div>

      {/* Invite popup when phone not found */}
      {inviteTarget && (
        <InviteByPhoneModal phone={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}

      {/* List — фильтруется по query */}
      {(() => {
        const q = query.trim().toLowerCase();
        const isSearching = q.length >= 3;

        // Локальные совпадения по контактам
        const localMatches = q
          ? visibleContacts.filter(c =>
              (c.nickname || '').toLowerCase().includes(q) ||
              (c.name     || '').toLowerCase().includes(q) ||
              (c.phone    || '').includes(query.trim())
            )
          : visibleContacts;

        const hasAny = localMatches.length > 0;
        const looksLikePhone = /^[\d\s\-+()]{7,}$/.test(query.trim());

        return (
          <div style={{flex:1}}>
            {/* Поиск активен — показываем только локальные совпадения */}
            {isSearching ? (
              <>
                {/* Локальные совпадения (свои контакты) */}
                {localMatches.map(c => (
                  <div key={'local-'+c.id}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',
                      cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.06)',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div onClick={() => setCard(c)} style={{cursor:'pointer',flexShrink:0}}>
                      <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name}/>
                    </div>
                    <div style={{flex:1,minWidth:0}} onClick={() => openChat(c.id)}>
                      <div style={{color:'white',fontSize:15,fontWeight:600}}>{c.nickname||c.name}</div>
                      {!c.is_system && <div style={{color:'rgba(255,255,255,.45)',fontSize:13}}>{c.phone}</div>}
                    </div>
                    <span style={{color:'rgba(255,255,255,.25)',fontSize:18,flexShrink:0}}>›</span>
                  </div>
                ))}

                {/* Ничего не нашлось */}
                {!hasAny && (
                  <div style={{
                    padding:'24px 20px',textAlign:'center',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:10,
                  }}>
                    <div style={{fontSize:32,opacity:.5}}>🤷</div>
                    <div style={{color:'rgba(255,255,255,.45)',fontSize:14}}>
                      Никого не нашли по «{query.trim()}»
                    </div>
                    {looksLikePhone ? (
                      <button onClick={addContact}
                        style={{
                          marginTop:6,padding:'10px 18px',borderRadius:50,
                          background:'rgba(120,90,200,.75)',border:'none',color:'white',
                          fontSize:13,fontWeight:600,cursor:'pointer',
                          display:'flex',alignItems:'center',gap:8,
                        }}>
                        <span style={{fontSize:18}}>+</span> Добавить как контакт
                      </button>
                    ) : (
                      <div style={{color:'rgba(255,255,255,.3)',fontSize:12}}>
                        Введи имя ещё точнее или номер телефона
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Обычный режим — все контакты */}
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
                    <div onClick={() => setCard(c)}
                      style={{cursor:'pointer',transition:'transform .15s',flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.06)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                      <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name}/>
                    </div>
                    <div style={{flex:1,minWidth:0}} onClick={() => openChat(c.id)}>
                      <div style={{color:'white',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        {c.nickname || c.name}
                        {c.online && !c.is_deleted ? <div className="online-dot"/> : null}
                        {c.is_deleted && (
                          <span style={{fontSize:11,color:'rgba(255,255,255,.35)',fontWeight:400,
                            background:'rgba(255,255,255,.08)',borderRadius:6,padding:'2px 8px',fontStyle:'italic'}}>
                            удалил аккаунт
                          </span>
                        )}
                      </div>
                      {!c.is_deleted && !c.is_system && <div style={{color:'rgba(255,255,255,.45)',fontSize:13}}>{c.phone}</div>}
                      {c.notes && !c.is_deleted && <div style={{color:'rgba(255,255,255,.3)',fontSize:12,marginTop:2,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes}</div>}
                    </div>
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
              </>
            )}
          </div>
        );
      })()}

      {/* Contact card modal */}
      {card && (
        <ContactCardModal
          contact={card}
          isBlocked={isBlockedId(card.id)}
          isContact={true}
          onClose={() => setCard(null)}
          onChat={() => openChat(card.id)}
          onAddContact={() => {}} /* уже в контактах — кнопка не показывается */
          onRemoveContact={async () => {
            if (!await customConfirm('Удалить из контактов? Чат и переписка останутся.', { confirmLabel: 'Удалить' })) return;
            try { await api.deleteContact(card.id); setContacts(prev => prev.filter(c => c.id !== card.id)); setCard(null); }
            catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
          }}
          onBlock={() => handleBlock(card)}
          onUnblock={() => handleUnblock(card.id)}
          onNotesChange={handleNotesChange}
          onOpenMoment={(m) => { setCard(null); nav(`/moments/${m.id}`); }}
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
  // Popup for incoming request — shows requester's profile card
  const [requestCard, setRequestCard] = useState(null); // { conv, profile } | null
  const [requestCardLoading, setRequestCardLoading] = useState(false);
  const [requestCardAction, setRequestCardAction] = useState(null); // 'accept' | 'decline' | null
  const [showArchive, setShowArchive] = useState(false);

  const reload = () => api.getConversations().then(setConvs).catch(console.error);

  useEffect(() => { reload(); }, []);
  useEffect(() => socket.on('message:new', ({ message }) => {
    setConvs(prev => {
      const exists = prev.find(c => c.id === message.conversationId);
      if (!exists) { reload(); return prev; }
      return prev
        .map(c => {
          if (c.id !== message.conversationId) return c;
          if (c.is_request && c.request_from !== user?.id) return c; // don't update locked request
          return {
            ...c,
            last_text: message.text || null,
            last_at: message.created_at,
            last_sender_id: message.sender_id,
            unread_count: message.sender_id === user?.id ? c.unread_count : c.unread_count + 1,
          };
        })
        .sort((a, b) => b.last_at - a.last_at);
    });
  }), [user?.id]);
  // Удалённые чаты (другой стороной или админом группы) убираем из списка
  useEffect(() => socket.on('conversation:deleted', ({ conversationId }) => {
    setConvs(prev => prev.filter(c => c.id !== conversationId));
  }), []);
  // Приглашения в группы — могут прилететь как новые «чаты» в списке
  useEffect(() => socket.on('group:invited', () => { reload(); }), []);
  useEffect(() => socket.on('group:invite_accepted', () => { reload(); }), []);
  useEffect(() => socket.on('group:invite_declined', ({ conversationId }) => {
    setConvs(prev => prev.filter(c => c.id !== conversationId));
  }), []);
  useEffect(() => socket.on('group:member_removed', ({ conversationId, userId }) => {
    if (userId === user?.id) setConvs(prev => prev.filter(c => c.id !== conversationId));
  }), [user?.id]);

  // ── Поиск по чатам ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // показывать ли инпут поиска
  const [searchMsgs, setSearchMsgs] = useState(null); // null | array
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchMsgs(null); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try { setSearchMsgs(await api.searchAllMessages(q)); }
      catch { setSearchMsgs([]); }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Локальный фильтр по имени / телефону / тексту последнего сообщения
  const q = search.trim().toLowerCase();
  const matchConv = (c) => {
    if (!q) return true;
    return (
      (c.name      || '').toLowerCase().includes(q) ||
      (c.last_text || '').toLowerCase().includes(q)
    );
  };

  const normalConvs  = convs.filter(c => !c.is_request).filter(matchConv);
  const requestConvs = convs.filter(c => c.is_request && c.request_from !== user?.id).filter(matchConv);
  const pinnedConvs  = normalConvs.filter(c => c.is_pinned);
  const regularConvs = normalConvs.filter(c => !c.is_pinned);
  const [pinToast, setPinToast] = useState('');

  // Карта convId → conv для быстрого доступа из поисковых результатов
  const convsById = useMemo(() => Object.fromEntries(convs.map(c => [c.id, c])), [convs]);

  async function archive(c) {
    try {
      await api.archiveConversation(c.id);
      setConvs(prev => prev.filter(x => x.id !== c.id));
      setPinToast('📦 В архиве');
    } catch (e) { heyToast(e.message || 'Не удалось', 'error'); }
  }

  async function togglePin(c) {
    const wasPinned = c.is_pinned;
    try {
      if (wasPinned) {
        await api.unpinConversation(c.id);
        setConvs(prev => {
          const updated = prev.map(x => x.id === c.id ? { ...x, is_pinned: false } : x);
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return b.last_at - a.last_at;
          });
        });
        setPinToast('Откреплено');
      } else {
        await api.pinConversation(c.id);
        setConvs(prev => {
          const updated = prev.map(x => x.id === c.id ? { ...x, is_pinned: true } : x);
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return b.last_at - a.last_at;
          });
        });
        setPinToast('📌 Закреплено');
      }
    } catch(err) {
      setPinToast(err.message || 'Ошибка');
    }
    setTimeout(() => setPinToast(''), 2500);
  }

  function ConvRow({ c, isRequest }) {
    const [hovered, setHovered] = useState(false);

    async function handleRowClick() {
      if (isRequest) {
        if (!c.partner_id) { nav(`/chat/${c.id}`); return; }
        setRequestCardLoading(true);
        try {
          const profile = await api.getUserProfile(c.partner_id);
          setRequestCard({ conv: c, profile });
        } catch {
          nav(`/chat/${c.id}`);
        } finally {
          setRequestCardLoading(false);
        }
      } else {
        setConvs(prev => prev.map(x => x.id === c.id ? { ...x, unread_count: 0 } : x));
        nav(`/chat/${c.id}`);
      }
    }

    return (
      <div onClick={handleRowClick}
        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',
          cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.06)',transition:'background .12s',
          background: c.is_pinned ? 'rgba(120,90,200,.06)' : 'transparent'}}
        onMouseEnter={e=>{ e.currentTarget.style.background = c.is_pinned ? 'rgba(120,90,200,.1)' : 'rgba(255,255,255,.04)'; setHovered(true); }}
        onMouseLeave={e=>{ e.currentTarget.style.background = c.is_pinned ? 'rgba(120,90,200,.06)' : 'transparent'; setHovered(false); }}>
        {c.type === 'monolog' ? (
          <div style={{width:52,height:52,borderRadius:14,flexShrink:0,
            background:'linear-gradient(135deg,#5a4090,#8060c0)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
            📝
          </div>
        ) : c.type === 'group' ? (
          <div style={{width:52,height:52,borderRadius:14,flexShrink:0,overflow:'hidden',
            background: (c.icon && (c.icon.startsWith('http') || c.icon.startsWith('/') || c.icon.startsWith('data:')))
              ? '#0a0518' : 'rgba(200,160,210,.35)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
            {(c.icon && (c.icon.startsWith('http') || c.icon.startsWith('/') || c.icon.startsWith('data:')))
              ? <img src={c.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (c.icon || '👥')}
          </div>
        ) : (
          <AvatarDisplay avatar={c.avatar} name={c.name} size={52}/>
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:'white',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
            {c.name||'Диалог'}
            {c.is_pinned && <span style={{opacity:.6,display:'inline-flex',alignItems:'center'}}><Icon name="pin" size={11}/></span>}
          </div>
          {isRequest ? (
            <div style={{color:'rgba(180,140,220,.8)',fontSize:13}}>хочет написать вам</div>
          ) : c.is_group_invite ? (
            <div style={{color:'rgba(220,190,255,1)',fontSize:13,fontWeight:500,whiteSpace:'nowrap',
              overflow:'hidden',textOverflow:'ellipsis'}}>
              {c.group_invited_by_name
                ? `${c.group_invited_by_name} приглашает в группу`
                : 'приглашение в группу'}
            </div>
          ) : c.partner_is_deleted ? (
            <div style={{color:'rgba(255,255,255,.3)',fontSize:13,fontStyle:'italic'}}>
              Пользователь удалил аккаунт
            </div>
          ) : (
            <div style={{color:'rgba(255,255,255,.45)',fontSize:13,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {c.last_sender_id===user?.id ? 'Вы: ' : ''}{c.last_text ? renderPreviewWithEmoji(c.last_text) : '…'}
            </div>
          )}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
          {isRequest ? (
            <div style={{
              background:'rgba(120,90,200,.5)',border:'1px solid rgba(180,140,220,.4)',
              borderRadius:20,padding:'3px 10px',fontSize:11,color:'rgba(220,200,255,.9)',fontWeight:600,
            }}>Запрос</div>
          ) : c.is_group_invite ? (
            <div style={{
              background:'rgba(110,70,200,.85)',border:'1px solid rgba(200,160,240,.6)',
              borderRadius:20,padding:'3px 10px',fontSize:11,color:'white',fontWeight:700,
              boxShadow:'0 2px 8px rgba(80,40,180,.3)',
              display:'inline-flex',alignItems:'center',gap:5,
            }}><Icon name="mail" size={12}/> Приглашение</div>
          ) : (
            <>
              {/* Inline actions: pin + archive — visible on hover */}
              {hovered ? (
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(c); }}
                    title={c.is_pinned ? 'Открепить' : 'Закрепить'}
                    style={{
                      background:'none',border:'none',cursor:'pointer',padding:'2px 4px',
                      color:'white',opacity: c.is_pinned ? 0.9 : 0.5,
                      transition:'opacity .15s',lineHeight:1,
                    }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                    onMouseLeave={e=>e.currentTarget.style.opacity= c.is_pinned ? '0.9' : '0.5'}
                  ><Icon name="pin" size={14}/></button>
                  <button
                    onClick={e => { e.stopPropagation(); archive(c); }}
                    title="В архив"
                    style={{
                      background:'none',border:'none',cursor:'pointer',padding:'2px 4px',
                      color:'white',opacity:0.5,transition:'opacity .15s',lineHeight:1,
                    }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='0.5'}
                  ><Icon name="archive" size={14}/></button>
                </div>
              ) : c.last_at ? (
                <div style={{color:'rgba(255,255,255,.35)',fontSize:11}}>{fmtTime(c.last_at)}</div>
              ) : null}
              {c.unread_count > 0 && (
                <div style={{
                  minWidth:20,height:20,borderRadius:10,padding:'0 6px',
                  background:'rgba(140,100,200,.9)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,color:'white',fontWeight:700,
                }}>
                  {c.unread_count > 99 ? '99+' : c.unread_count}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', paddingBottom:80 }}>
      {/* Sticky header */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'16px 20px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3,display:'flex',alignItems:'center',gap:8}}>
            <Icon name="chat" size={20} /> Чаты
          </div>
          <DotsMenu items={[
            { label:'Поиск по чатам', icon:<Icon name="search" size={18}/>, onClick: () => {
              setSearchOpen(true);
              setTimeout(() => document.getElementById('hey-chats-search')?.focus(), 50);
            } },
            { label:'Новая группа',   icon:<Icon name="users" size={18}/>, onClick: () => nav('/groups/new') },
            { label:'Архив',          icon:<Icon name="archive" size={18}/>, onClick: () => setShowArchive(true) },
          ]}/>
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',width:'100%'}}>

        {/* Поиск по чатам и сообщениям — показывается по клику в три точки */}
        {searchOpen && (
        <div style={{padding:'12px 20px',position:'relative'}}>
          <input
            id="hey-chats-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам, сообщениям"
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
            style={{
              width:'100%', boxSizing:'border-box',
              background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.14)',
              borderRadius:50, padding:'11px 70px 11px 18px',
              color:'white', fontSize:14, fontFamily:'inherit', outline:'none',
              transition:'border-color .15s',
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.14)'}
          />
          {/* Кнопка закрыть поиск целиком */}
          <button onClick={() => { setSearch(''); setSearchOpen(false); }}
            title="Закрыть поиск"
            style={{
              position:'absolute',right:30,top:'50%',transform:'translateY(-50%)',
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',
              color:'rgba(255,255,255,.7)',fontSize:13,cursor:'pointer',
              width:26,height:26,borderRadius:'50%',
              display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0,
            }}>
            ✕
          </button>
          {false && search && (
            <button onClick={() => setSearch('')}
              style={{
                position:'absolute',right:30,top:'50%',transform:'translateY(-50%)',
                width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,.1)',
                border:'none',color:'rgba(255,255,255,.7)',fontSize:14,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0,
              }}>✕</button>
          )}
        </div>
        )}

        {/* Подзаголовок про поиск по сообщениям */}
        {searchOpen && search.trim().length >= 2 && (
          <>
            {searchLoading && (
              <div style={{color:'rgba(255,255,255,.4)',fontSize:12,padding:'4px 22px'}}>
                Ищу в сообщениях…
              </div>
            )}

            {/* Найденные сообщения */}
            {!searchLoading && searchMsgs && searchMsgs.length > 0 && (
              <>
                <div style={{
                  padding:'10px 22px 4px',color:'rgba(255,255,255,.5)',
                  fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,
                }}>
                  В сообщениях · {searchMsgs.length}
                </div>
                {searchMsgs.slice(0, 20).map(m => {
                  const c = convsById[m.conversation_id];
                  if (!c) return null;
                  return (
                    <div key={m.id} onClick={() => nav(`/chat/${c.id}`)}
                      style={{
                        display:'flex',alignItems:'flex-start',gap:12,padding:'10px 20px',
                        cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.04)',
                        transition:'background .12s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{fontSize:18,marginTop:2}}>💬</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{color:'rgba(220,200,255,.95)',fontSize:13,fontWeight:600,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {c.name || 'Диалог'}
                          <span style={{color:'rgba(255,255,255,.4)',fontWeight:400,marginLeft:8,fontSize:11}}>
                            · {new Date(m.created_at*1000).toLocaleDateString('ru',{day:'numeric',month:'short'})}
                          </span>
                        </div>
                        <div style={{color:'rgba(255,255,255,.7)',fontSize:13,marginTop:2,
                          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                          <Highlight text={m.text} q={search.trim()}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {searchMsgs.length > 20 && (
                  <div style={{padding:'8px 22px',color:'rgba(255,255,255,.4)',fontSize:11}}>
                    + ещё {searchMsgs.length - 20}
                  </div>
                )}
              </>
            )}

            {/* Заголовок «Чаты» когда есть и то и другое */}
            {(normalConvs.length > 0 || requestConvs.length > 0) && (
              <div style={{
                padding:'12px 22px 4px',color:'rgba(255,255,255,.5)',
                fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,
              }}>
                Чаты
              </div>
            )}
          </>
        )}

        {normalConvs.length === 0 && requestConvs.length === 0 && !search && (
          <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:60,fontSize:15,padding:'0 20px'}}>
            Нет активных диалогов.<br/>Перейди в Контакты, чтобы начать переписку.
          </div>
        )}
        {normalConvs.length === 0 && requestConvs.length === 0 && search.trim().length >= 2 && (!searchMsgs || searchMsgs.length === 0) && !searchLoading && (
          <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:40,fontSize:14,padding:'0 20px'}}>
            🤷 Ничего не нашли по «{search.trim()}»
          </div>
        )}

        {/* Pinned chats */}
        {pinnedConvs.length > 0 && (
          <div style={{
            padding:'14px 20px 6px',
            color:'rgba(255,255,255,.4)',fontSize:11,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'1px',
            display:'flex',alignItems:'center',gap:6,
          }}>
            <span>📌</span> Закреплённые
          </div>
        )}
        {pinnedConvs.map(c => <ConvRow key={c.id} c={c} isRequest={false}/>)}

        {/* Divider when both sections have items */}
        {pinnedConvs.length > 0 && regularConvs.length > 0 && (
          <div style={{
            padding:'14px 20px 6px',
            color:'rgba(255,255,255,.4)',fontSize:11,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'1px',
          }}>
            Все чаты
          </div>
        )}
        {regularConvs.map(c => <ConvRow key={c.id} c={c} isRequest={false}/>)}

        {/* Requests section */}
        {requestConvs.length > 0 && (
          <>
            <div style={{
              padding:'16px 20px 8px',
              color:'rgba(255,255,255,.4)',fontSize:11,fontWeight:600,
              textTransform:'uppercase',letterSpacing:'1px',
              display:'flex',alignItems:'center',gap:8,
            }}>
              Запросы на переписку
              <span style={{
                background:'rgba(120,90,200,.6)',borderRadius:20,
                padding:'1px 8px',fontSize:11,color:'white',
              }}>{requestConvs.length}</span>
            </div>
            {requestConvs.map(c => <ConvRow key={c.id} c={c} isRequest={true}/>)}
          </>
        )}

      </div>

      {/* Pin toast */}
      {pinToast && (
        <div style={{
          position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50,padding:'9px 20px',
          color:'white',fontSize:14,fontWeight:600,
          zIndex:1000,whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(0,0,0,.4)',
          pointerEvents:'none',
        }}>
          {pinToast}
        </div>
      )}

      {/* Loading spinner while fetching profile */}
      {requestCardLoading && (
        <div style={{
          position:'fixed',inset:0,zIndex:600,
          background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{color:'rgba(255,255,255,.6)',fontSize:14}}>Загрузка…</div>
        </div>
      )}

      {/* Request profile card popup */}
      {requestCard && (
        <div
          style={{
            position:'fixed',inset:0,zIndex:600,
            background:'rgba(0,0,0,.65)',backdropFilter:'blur(14px)',
            display:'flex',alignItems:'center',justifyContent:'center',
            padding:'20px',
          }}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setRequestCard(null); }}
        >
          <div style={{
            background:'rgba(28,18,58,.98)',backdropFilter:'blur(24px)',
            borderRadius:24,width:'min(100%,400px)',
            boxShadow:'0 12px 56px rgba(0,0,0,.6)',
            border:'1px solid rgba(255,255,255,.1)',
            overflow:'hidden',
          }}>
            {/* Header with avatar */}
            <div style={{
              background:'linear-gradient(160deg,rgba(92,60,160,.8),rgba(140,80,180,.6))',
              padding:'32px 24px 24px',
              display:'flex',flexDirection:'column',alignItems:'center',gap:14,
              position:'relative',
            }}>
              <button onClick={() => setRequestCard(null)} style={{
                position:'absolute',top:14,right:14,
                background:'rgba(255,255,255,.12)',border:'none',borderRadius:'50%',
                width:30,height:30,color:'white',fontSize:16,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>✕</button>

              <AvatarDisplay
                avatar={requestCard.profile.avatar}
                name={requestCard.profile.name}
                size={90} fontSize={38}
                style={{boxShadow:'0 8px 24px rgba(0,0,0,.35)',border:'3px solid rgba(255,255,255,.2)'}}
              />
              <div style={{textAlign:'center'}}>
                <div style={{color:'white',fontSize:20,fontWeight:700,marginBottom:4}}>
                  {requestCard.profile.name}
                </div>
                <div style={{
                  display:'inline-block',
                  background:'rgba(120,90,200,.45)',border:'1px solid rgba(180,140,255,.3)',
                  borderRadius:20,padding:'3px 12px',fontSize:12,color:'rgba(220,200,255,.9)',
                }}>
                  хочет написать вам
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Bio */}
              {requestCard.profile.bio && (
                <div style={{
                  background:'rgba(255,255,255,.06)',borderRadius:12,
                  border:'1px solid rgba(255,255,255,.09)',padding:'12px 14px',
                  color:'rgba(255,255,255,.75)',fontSize:14,lineHeight:1.6,
                }}>
                  {requestCard.profile.bio}
                </div>
              )}

              {/* Active moment preview if any */}
              {requestCard.profile.active_moment && (
                <div style={{
                  background:'rgba(255,255,255,.06)',borderRadius:12,
                  border:'1px solid rgba(255,255,255,.09)',padding:'12px 14px',
                }}>
                  <div style={{color:'rgba(255,255,255,.35)',fontSize:10,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>
                    Текущий момент
                  </div>
                  <div style={{color:'rgba(255,255,255,.8)',fontSize:13,lineHeight:1.5,
                    overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                    {requestCard.profile.active_moment.text}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <button
                  disabled={!!requestCardAction}
                  onClick={async () => {
                    setRequestCardAction('decline');
                    try {
                      await api.declineRequest(requestCard.conv.id);
                      setConvs(prev => prev.filter(c => c.id !== requestCard.conv.id));
                      setRequestCard(null);
                    } catch {}
                    setRequestCardAction(null);
                  }}
                  style={{
                    flex:1,padding:'13px',borderRadius:14,fontSize:14,fontWeight:600,
                    background:'rgba(200,60,60,.45)',border:'1px solid rgba(255,140,140,.55)',
                    color:'rgba(255,225,225,1)',cursor:'pointer',
                    opacity: requestCardAction === 'decline' ? .6 : 1,
                    fontFamily:'inherit',
                  }}>
                  {requestCardAction === 'decline' ? '…' : 'Отклонить'}
                </button>
                <button
                  disabled={!!requestCardAction}
                  onClick={async () => {
                    setRequestCardAction('accept');
                    try {
                      await api.acceptRequest(requestCard.conv.id);
                      setConvs(prev => prev.map(c =>
                        c.id === requestCard.conv.id ? { ...c, is_request: false } : c
                      ));
                      const convId = requestCard.conv.id;
                      setRequestCard(null);
                      nav(`/chat/${convId}`);
                    } catch {}
                    setRequestCardAction(null);
                  }}
                  style={{
                    flex:2,padding:'13px',borderRadius:14,fontSize:14,fontWeight:700,
                    background:'rgba(120,90,200,.85)',border:'1px solid rgba(180,140,255,.4)',
                    color:'white',cursor:'pointer',
                    opacity: requestCardAction === 'accept' ? .6 : 1,
                    boxShadow:'0 2px 12px rgba(120,80,200,.35)',
                    fontFamily:'inherit',
                  }}>
                  {requestCardAction === 'accept' ? '…' : '👤 Добавить и начать переписку'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <ArchiveListModal
          onClose={() => setShowArchive(false)}
          onUnarchive={(c) => { setConvs(prev => [c, ...prev]); }}/>
      )}
    </div>
  );
}

// Модалка со списком архивных чатов — восстановить или удалить навсегда
function ArchiveListModal({ onClose, onUnarchive }) {
  const [list, setList]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [customConfirm, confirmModal] = useConfirm();
  const nav = useNavigate();

  useEffect(() => {
    api.getArchivedConversations().then(setList).catch(() => setList([]));
  }, []);

  async function restore(c) {
    setBusy(true);
    try {
      await api.unarchiveConversation(c.id);
      setList(prev => prev.filter(x => x.id !== c.id));
      onUnarchive?.(c);
      heyToast('Восстановлено', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
    setBusy(false);
  }

  async function removeForever(c) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:8}}>Удалить чат «{c.name || 'Диалог'}» навсегда?</div>
        <div style={{color:'rgba(255,255,255,.65)',fontSize:13,lineHeight:1.6}}>
          Сообщения, медиа и реакции удалятся безвозвратно.
        </div>
      </>,
      { requireWord: 'УДАЛИТЬ', danger: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteConversation(c.id);
      setList(prev => prev.filter(x => x.id !== c.id));
      heyToast('Удалено', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
    setBusy(false);
  }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{position:'fixed',inset:0,zIndex:1000,
        background:'rgba(0,0,0,.55)',backdropFilter:'blur(10px)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'rgba(22,15,50,.98)',borderRadius:18,
        width:'min(94vw,520px)',maxHeight:'82vh',display:'flex',flexDirection:'column',
        border:'1px solid rgba(255,255,255,.14)',
        boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
        <div style={{padding:'16px 20px 14px',borderBottom:'1px solid rgba(255,255,255,.08)',
          display:'flex',alignItems:'center',gap:10}}>
          <Icon name="archive" size={20}/>
          <div style={{flex:1,color:'white',fontSize:17,fontWeight:700}}>Архивные чаты</div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.5)',
              cursor:'pointer',padding:0,display:'flex',alignItems:'center'}}>
            <Icon name="close" size={20}/>
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 12px 12px'}}>
          {list === null && <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:30}}>Загрузка…</div>}
          {list && list.length === 0 && (
            <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40,fontSize:14,lineHeight:1.5}}>
              Архив пуст.<br/>
              <span style={{fontSize:12,color:'rgba(225,220,245,.55)'}}>
                В чатах наведи на строку и нажми 📦 чтобы убрать в архив.
              </span>
            </div>
          )}
          {list && list.length > 0 && list.map(c => (
            <div key={c.id} style={{
              display:'flex',alignItems:'center',gap:12,padding:'10px 8px',
              borderRadius:10,
            }}>
              <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',flexShrink:0,
                background:'rgba(120,90,200,.4)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:16,color:'white',fontWeight:700}}>
                {c.avatar && (c.avatar.startsWith('http') || c.avatar.startsWith('/') || c.avatar.startsWith('data:'))
                  ? <img src={c.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (c.type === 'group' ? (c.icon || '👥') : (c.name?.[0]?.toUpperCase() || '?'))}
              </div>
              <div style={{flex:1,minWidth:0,cursor:'pointer'}}
                onClick={() => { onClose(); nav('/chat/' + c.id); }}>
                <div style={{color:'white',fontSize:14,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {c.name || 'Диалог'}
                </div>
                <div style={{color:'rgba(225,220,245,.6)',fontSize:11,marginTop:2}}>
                  {c.last_text ? c.last_text.slice(0,60) : 'Нет сообщений'}
                </div>
              </div>
              <button onClick={() => restore(c)} disabled={busy}
                title="Восстановить"
                style={{background:'rgba(120,90,200,.25)',border:'1px solid rgba(180,140,220,.4)',
                  color:'rgba(220,200,255,1)',borderRadius:8,padding:'5px 10px',fontSize:11,
                  fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                ↺ Вернуть
              </button>
              <button onClick={() => removeForever(c)} disabled={busy}
                title="Удалить навсегда"
                style={{background:'rgba(200,60,60,.2)',border:'1px solid rgba(255,120,120,.45)',
                  color:'rgba(255,180,180,1)',borderRadius:8,padding:'5px 10px',fontSize:14,
                  cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>
                ✕
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
// ChatScreen — full real-time chat
// ─────────────────────────────────────────────────────────────────────────────
// MediaViewerModal
// ─────────────────────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s]+/g;

// ── Chat video card helpers ───────────────────────────────────────────────────

const CHAT_YT_RE        = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const CHAT_VIMEO_RE     = /vimeo\.com\/(?:video\/)?(\d+)/;
const CHAT_RUTUBE_RE    = /rutube\.ru\/video\/([a-f0-9]{32})/i;
const CHAT_KINESCOPE_RE = /kinescope\.io\/(?:embed\/)?([a-zA-Z0-9]+)/;

function isChatVideoUrl(url) {
  return CHAT_YT_RE.test(url) || CHAT_VIMEO_RE.test(url) ||
         CHAT_RUTUBE_RE.test(url) || CHAT_KINESCOPE_RE.test(url);
}

function getChatEmbed(url) {
  const ytM = url.match(CHAT_YT_RE);        if (ytM) return { provider:'youtube',   videoId: ytM[1],        thumbnail: `https://i.ytimg.com/vi/${ytM[1]}/hqdefault.jpg`, label:'▶ YouTube',   color:'#ff4444' };
  const vmM = url.match(CHAT_VIMEO_RE);     if (vmM) return { provider:'vimeo',     videoId: vmM[1],        thumbnail: null,                                             label:'● Vimeo',     color:'#1ab7ea' };
  const rtM = url.match(CHAT_RUTUBE_RE);    if (rtM) return { provider:'rutube',    videoId: rtM[1],        thumbnail: null,                                             label:'▶ RuTube',   color:'#ff6600' };
  const ksM = url.match(CHAT_KINESCOPE_RE); if (ksM) return { provider:'kinescope', videoId: ksM[1],        thumbnail: `https://kinescope.io/${ksM[1]}/thumbnail`,       label:'▶ Kinescope',color:'#9b6ecc' };
  return null;
}

function getEmbedSrc(provider, videoId) {
  switch (provider) {
    case 'youtube':   return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    case 'vimeo':     return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    case 'rutube':    return `https://rutube.ru/play/embed/${videoId}?autoPlay=true`;
    case 'kinescope': return `https://kinescope.io/embed/${videoId}`;
    default:          return null;
  }
}

function ChatVideoCard({ url }) {
  const [playing, setPlaying] = useState(false);
  const info = getChatEmbed(url);
  if (!info) return null;

  const embedSrc = getEmbedSrc(info.provider, info.videoId);

  function play(e) {
    e.stopPropagation();
    if (embedSrc) setPlaying(true);
    else window.open(url, '_blank', 'noopener');
  }
  function stop(e) { e.stopPropagation(); setPlaying(false); }
  function ext(e)  { e.stopPropagation(); window.open(url, '_blank', 'noopener'); }

  return (
    <div style={{
      marginTop: 6, borderRadius: 10, overflow: 'hidden',
      background: 'rgba(10,5,30,.85)', border: '1px solid rgba(255,255,255,.12)',
      maxWidth: 300, userSelect: 'none',
    }}>
      {playing ? (
        <>
          <div style={{ width: '100%', aspectRatio: '16/9' }}>
            <iframe src={embedSrc} title={info.label}
              allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}/>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 10px', background: 'rgba(10,5,30,.95)',
          }}>
            <button onClick={stop} style={{
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
              borderRadius: 20, padding: '3px 10px', color: 'rgba(255,255,255,.6)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            }}>✕ Закрыть</button>
            <button onClick={ext} style={{
              background: 'none', border: 'none', color: `${info.color}bb`,
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>Открыть ↗</button>
          </div>
        </>
      ) : (
        <>
          {info.thumbnail ? (
            <div onClick={play} style={{ position: 'relative', width: '100%', aspectRatio: '16/9', cursor: 'pointer' }}>
              <img src={info.thumbnail} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(6px)',
                  border: '2px solid rgba(255,255,255,.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: 'white',
                }}>▶</div>
              </div>
              <div style={{
                position: 'absolute', bottom: 6, right: 6,
                background: 'rgba(0,0,0,.7)', borderRadius: 20,
                padding: '2px 7px', fontSize: 10, fontWeight: 700, color: info.color,
              }}>{info.label}</div>
            </div>
          ) : null}
          <div onClick={info.thumbnail ? undefined : play} style={{
            padding: info.thumbnail ? '6px 10px 7px' : '10px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(15,8,35,.9)', cursor: info.thumbnail ? 'default' : 'pointer',
          }}>
            {!info.thumbnail && <span style={{ fontSize: 16, flexShrink: 0, color: info.color }}>▶</span>}
            <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 11, flex: 1, wordBreak: 'break-all', lineHeight: 1.4 }}>
              {url.length > 46 ? url.slice(0, 43) + '…' : url}
            </span>
            {info.thumbnail && (
              <button onClick={play} style={{
                background: info.color, border: 'none', borderRadius: 16,
                padding: '3px 10px', color: 'white', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0,
              }}>▶</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const HEY_EMOJI = [
  'smiling','happy','winking','sad','angry','surprised',
  'wow','dead','discouraged','dissatisfied','chilly','silent',
  'suspicious','tricky smile','no comments','congrats','cute hearts','heart kiss',
  'cool','love','sleepy','nervous','starstruck','haha',
];

const HEY_EMOJI_SET = new Set(HEY_EMOJI);
const EMOJI_RE = new RegExp('\\[(' + HEY_EMOJI.map(n => n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\]', 'g');

// Лёгкий рендер для коротких превью (список чатов, цитаты): заменяет
// [emoji-name] на маленькую <img>. Без markdown и URL-парсинга.
function renderPreviewWithEmoji(text, iconSize = 14) {
  if (!text) return text;
  const re = new RegExp(EMOJI_RE.source, 'g');
  const out = [];
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (!HEY_EMOJI_SET.has(m[1])) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <img key={'e'+(i++)} src={`/emoji/${encodeURIComponent(m[1])}.svg`} alt={m[1]}
        style={{width:iconSize,height:iconSize,verticalAlign:'-2px',display:'inline-block'}}/>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// Inline markdown:
//   **bold**          — жирный
//   __underline__     — подчёркнутый
//   ~~strikethrough~~ — зачёркнутый
//   `code`            — моноширинный
// Применяется к простым текстовым фрагментам (НЕ внутри URL и эмодзи).
function renderMarkdown(text, keyOffset = 0) {
  if (!text) return text;
  // Один регекс на все 4 формата с capture-группами
  const MD = /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|`([^`\n]+?)`/g;
  const result = [];
  let last = 0, i = keyOffset;
  let m;
  while ((m = MD.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      result.push(<strong key={'md'+(i++)} style={{fontWeight:700}}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      result.push(<u key={'md'+(i++)} style={{textDecoration:'underline'}}>{m[2]}</u>);
    } else if (m[3] !== undefined) {
      result.push(<s key={'md'+(i++)} style={{textDecoration:'line-through',opacity:.75}}>{m[3]}</s>);
    } else if (m[4] !== undefined) {
      result.push(
        <code key={'md'+(i++)} style={{
          fontFamily:'ui-monospace,Menlo,Consolas,monospace',
          background:'rgba(0,0,0,.18)', borderRadius:4,
          padding:'1px 5px', fontSize:'.92em',
        }}>{m[4]}</code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

// Обрезает завершающую пунктуацию с URL: «http://example.com.» → «http://example.com».
// Также балансирует скобки: если в URL ')' больше чем '(', лишние ')' отрезаются.
function trimUrlTail(url) {
  let u = url;
  // Сначала пунктуация в конце (не часть URL по семантике предложения)
  u = u.replace(/[.,;:!?»"'`]+$/, '');
  // Затем висящие закрывающие скобки если в URL не было открывающей
  while (/[)\]}]$/.test(u)) {
    const closing = u.slice(-1);
    const opening = closing === ')' ? '(' : closing === ']' ? '[' : '{';
    const opens   = (u.match(new RegExp('\\' + opening, 'g')) || []).length;
    const closes  = (u.match(new RegExp('\\' + closing, 'g')) || []).length;
    if (closes > opens) u = u.slice(0, -1);
    else break;
  }
  return u;
}

function renderText(text) {
  // Сначала вытаскиваем URL и custom-эмодзи (они не должны попадать под markdown),
  // потом простой текст между ними прогоняем через renderMarkdown.
  const TOKEN = /(https?:\/\/[^\s]+)|\[([^\]]+)\]/g;
  const result = [];
  let last = 0, i = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      const plain = text.slice(last, m.index);
      const rendered = renderMarkdown(plain, i);
      if (Array.isArray(rendered)) result.push(...rendered);
      else result.push(rendered);
      i += 100; // запас по ключам для md
    }
    if (m[1]) {
      const url     = trimUrlTail(m[1]);
      const tailLen = m[1].length - url.length;
      if (isChatVideoUrl(url)) {
        result.push(<ChatVideoCard key={i++} url={url}/>);
      } else {
        result.push(
          <a key={i++} href={url} target="_blank" rel="noopener noreferrer"
            style={{color:'inherit',textDecoration:'underline',wordBreak:'break-all'}}
            onClick={e => e.stopPropagation()}>{url}</a>
        );
      }
      last = m.index + m[1].length - tailLen;
      // Хвост (например '.') остаётся как текст — обработается в следующей итерации
      continue;
    } else if (m[2] && HEY_EMOJI_SET.has(m[2])) {
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
  if (last < text.length) {
    const plain = text.slice(last);
    const rendered = renderMarkdown(plain, i);
    if (Array.isArray(rendered)) result.push(...rendered);
    else result.push(rendered);
  }
  return result;
}

// Модалка пересылки сообщения в один или несколько чатов
function ForwardModal({ messageId, onClose, onDone }) {
  const [convs, setConvs] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getConversations().then(setConvs).catch(e => setError(e.message));
  }, []);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) return;
    setSending(true);
    try {
      await api.forwardMessage(messageId, Array.from(selected));
      onDone?.(selected.size);
      onClose();
    } catch (e) {
      setError(e.message || 'Не удалось переслать');
    }
    setSending(false);
  }

  const q = search.trim().toLowerCase();
  const filtered = (convs || [])
    .filter(c => !c.is_request)
    .filter(c => !c.partner_is_system && !c.partner_is_blocked && !c.partner_is_deleted)
    .filter(c => !q || (c.name || '').toLowerCase().includes(q));

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
        backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{
        width:'min(94vw,440px)',maxHeight:'80vh',background:'rgba(38,28,68,.97)',
        backdropFilter:'blur(24px)',borderRadius:18,
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(255,255,255,.12)',
        display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'18px 20px 12px',display:'flex',alignItems:'center',gap:10,
          borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <span style={{fontSize:20}}>➦</span>
          <div style={{flex:1,color:'white',fontSize:16,fontWeight:700}}>Переслать в чат</div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.5)',
              fontSize:22,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
        </div>

        <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} autoFocus
            placeholder="🔍 Поиск по чатам…"
            style={{width:'100%',boxSizing:'border-box',
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',
              borderRadius:10,padding:'9px 13px',color:'white',fontSize:14,
              fontFamily:'inherit',outline:'none'}}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}/>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
          {convs === null && (
            <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:30,fontSize:14}}>
              Загрузка…
            </div>
          )}
          {convs !== null && filtered.length === 0 && (
            <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:30,fontSize:14}}>
              {q ? 'Никого не найдено' : 'Чатов нет'}
            </div>
          )}
          {filtered.map(c => {
            const isSel = selected.has(c.id);
            const icon = c.type === 'group' ? (c.icon || '👥')
                       : c.type === 'monolog' ? '📝' : null;
            const iconIsImg = typeof icon === 'string' &&
              (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:'));
            return (
              <div key={c.id} onClick={() => toggle(c.id)}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 18px',cursor:'pointer',
                  background: isSel ? 'rgba(140,100,200,.18)' : 'transparent',
                  transition:'background .12s'}}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                <div style={{width:38,height:38,borderRadius: c.type==='group' ? 12 : '50%',
                  overflow:'hidden',flexShrink:0,
                  background: iconIsImg ? '#0a0518' : 'rgba(140,100,200,.4)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
                  {c.type === 'direct'
                    ? <AvatarDisplay avatar={c.avatar} name={c.name} size={38}/>
                    : iconIsImg
                      ? <img src={icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:'white',fontSize:14,fontWeight:600,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {c.name}
                  </div>
                  <div style={{color:'rgba(255,255,255,.4)',fontSize:11}}>
                    {c.type === 'group' ? 'группа' : c.type === 'monolog' ? 'монолог' : 'личный'}
                  </div>
                </div>
                <div style={{width:22,height:22,borderRadius:'50%',
                  border: isSel ? '2px solid rgba(180,140,220,.95)' : '2px solid rgba(255,255,255,.25)',
                  background: isSel ? 'rgba(180,140,220,.95)' : 'transparent',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  flexShrink:0,transition:'all .15s',
                  color:'white',fontSize:13,fontWeight:700}}>
                  {isSel ? '✓' : ''}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{padding:'8px 18px',color:'rgba(255,140,140,.95)',fontSize:13}}>
            {error}
          </div>
        )}

        <div style={{padding:'14px 18px',display:'flex',gap:10,
          borderTop:'1px solid rgba(255,255,255,.08)'}}>
          <button onClick={onClose}
            style={{flex:1,padding:'11px 0',background:'rgba(255,255,255,.08)',
              border:'1px solid rgba(255,255,255,.12)',borderRadius:12,color:'rgba(255,255,255,.85)',
              fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
            Отмена
          </button>
          <button onClick={send} disabled={sending || selected.size === 0}
            style={{flex:1.4,padding:'11px 0',
              background: selected.size === 0 ? 'rgba(255,255,255,.07)' : 'rgba(120,90,200,.85)',
              border:'none',borderRadius:12,
              color: selected.size === 0 ? 'rgba(255,255,255,.3)' : 'white',
              fontSize:14,fontWeight:700,cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              fontFamily:'inherit',transition:'background .15s'}}>
            {sending ? 'Отправка…' : selected.size === 0
              ? 'Выбери чат'
              : `Переслать в ${selected.size}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MediaViewerModal({ convId, onClose }) {
  const [tab,    setTab]    = useState('images');
  const [images, setImages] = useState([]);
  const [files,  setFiles]  = useState([]);
  const [audios, setAudios] = useState([]);
  const [links,  setLinks]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [light,  setLight]  = useState(null); // null | { urls: string[], index: number, msgIds: string[] }

  // Закрыть модалку и проскроллить чат к нужному сообщению
  function goToMessage(msgId) {
    if (!msgId) return;
    onClose();
    // Дать модалке размонтироваться, потом дёрнуть скролл — ChatScreen ловит событие
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: msgId }));
    }, 50);
  }

  useEffect(() => {
    api.getMedia(convId).then(msgs => {
      // Распределяем вложения по категориям
      const imgs = [], fls = [], auds = [];
      for (const m of msgs) {
        const a = m.attachment;
        if (!a) continue;
        if (a.type === 'image' && a.url) imgs.push({ ...m, attachment: a, message_id: m.id });
        else if (a.type === 'images' && Array.isArray(a.urls)) {
          a.urls.forEach((u, i) => imgs.push({
            ...m, id: m.id + '_' + i, message_id: m.id,
            attachment: { type:'image', url:u },
          }));
        }
        else if (a.type === 'file') fls.push({ ...m, attachment: a });
        else if (a.type === 'audio') auds.push({ ...m, attachment: a });
      }
      setImages(imgs);
      setFiles(fls);
      setAudios(auds);
      setLoading(false);
    }).catch(console.error);
    api.searchMessages(convId, 'http').then(msgs => {
      const found = [];
      msgs.forEach(m => {
        const urls = m.text?.match(URL_RE) || [];
        urls.forEach(url => found.push({ url, sender: m.sender_name, time: m.created_at, message_id: m.id }));
      });
      setLinks(found);
    }).catch(console.error);
  }, [convId]);

  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }
  function fileEmoji(name, mime) {
    const n = (name || '').toLowerCase();
    if (mime === 'application/pdf' || n.endsWith('.pdf')) return '📕';
    if (n.endsWith('.doc') || n.endsWith('.docx')) return '📘';
    if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '📗';
    if (n.endsWith('.ppt') || n.endsWith('.pptx')) return '📙';
    if (n.endsWith('.zip') || n.endsWith('.rar')) return '🗜️';
    if (n.endsWith('.txt') || mime?.startsWith?.('text/')) return '📄';
    return '📎';
  }

  const overlay = { position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const modal = { width:'min(94vw,480px)',maxHeight:'80vh',background:'rgba(45,36,80,.97)',
    borderRadius:20,display:'flex',flexDirection:'column',overflow:'hidden',
    boxShadow:'0 16px 48px rgba(0,0,0,.5)' };

  const TABS = [
    ['images', 'image', 'Фото',   images.length],
    ['files',  'attach','Файлы',  files.length],
    ['audios', 'mic',   'Аудио',  audios.length],
    ['links',  'link',  'Ссылки', links.length],
  ];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',padding:'16px 20px 0'}}>
          <span style={{flex:1,color:'white',fontSize:17,fontWeight:600}}>Медиа и ссылки</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',cursor:'pointer',display:'inline-flex',alignItems:'center'}}><Icon name="close" size={20}/></button>
        </div>
        <div style={{display:'flex',gap:0,padding:'10px 8px 0',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
          {TABS.map(([id,icon,label,count])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1, background:'none',border:'none',padding:'8px 4px',cursor:'pointer',
              fontFamily:'inherit',
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              color: tab===id ? 'white' : 'rgba(255,255,255,.5)',
              borderBottom: tab===id ? '2px solid rgba(180,140,220,.9)' : '2px solid transparent',
              marginBottom:-1,transition:'color .15s',
              fontWeight: tab===id ? 600 : 500,
              minWidth:0,
            }}>
              <span style={{lineHeight:1,display:'inline-flex',alignItems:'center',justifyContent:'center',height:20}}><Icon name={icon} size={18}/></span>
              <span style={{fontSize:11,whiteSpace:'nowrap',
                overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%'}}>
                {label}{count > 0 ? ` · ${count}` : ''}
              </span>
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {loading && <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Загрузка…</div>}

          {!loading && tab==='images' && (
            images.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет фото</div>
              : (() => {
                  const valid = images.filter(m => m.attachment?.url);
                  const urls   = valid.map(m => m.attachment.url);
                  const msgIds = valid.map(m => m.message_id || m.id);
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}}>
                      {valid.map((m, i) => (
                        <img key={i} src={m.attachment.url} alt=""
                          onClick={()=>setLight({ urls, index: i, msgIds })}
                          style={{width:'100%',aspectRatio:'1',objectFit:'cover',
                            borderRadius:8,cursor:'zoom-in'}}/>
                      ))}
                    </div>
                  );
                })()
          )}

          {!loading && tab==='files' && (
            files.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет файлов</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {files.map(m => {
                    const a = m.attachment;
                    return (
                      <div key={m.id} onClick={() => goToMessage(m.message_id || m.id)}
                        title="Перейти к сообщению"
                        style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',
                          borderRadius:10, background:'rgba(255,255,255,.06)',
                          border:'1px solid rgba(255,255,255,.08)',cursor:'pointer',
                          transition:'background .15s'}}
                        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
                        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.06)'}>
                        <span style={{fontSize:24,flexShrink:0,lineHeight:1}}>
                          {fileEmoji(a.name, a.mime)}
                        </span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:'white',fontSize:13,fontWeight:600,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {a.name || 'Файл'}
                          </div>
                          <div style={{color:'rgba(225,220,245,.7)',fontSize:11,marginTop:2}}>
                            {fmtSize(a.size)}{m.sender_name ? ` · ${m.sender_name}` : ''} · {fmtTime(m.created_at)}
                          </div>
                        </div>
                        <a href={a.url} target="_blank" rel="noreferrer" download={a.name}
                          onClick={e => e.stopPropagation()}
                          title="Скачать"
                          style={{color:'rgba(225,220,245,.85)',fontSize:16,padding:'6px 10px',
                            borderRadius:8,textDecoration:'none',
                            background:'rgba(255,255,255,.08)'}}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.18)'; e.currentTarget.style.color='white'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.color='rgba(225,220,245,.85)'; }}>
                          ⬇
                        </a>
                      </div>
                    );
                  })}
                </div>
          )}

          {!loading && tab==='audios' && (
            audios.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет голосовых</div>
              : <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {audios.map(m => (
                    <div key={m.id} style={{padding:'12px 14px',borderRadius:12,
                      background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)'}}>
                      <AudioPlayer url={m.attachment.url} duration={m.attachment.duration} isOut={false} wide/>
                      <div style={{display:'flex',alignItems:'center',marginTop:8,gap:8}}>
                        <div style={{flex:1,color:'rgba(225,220,245,.7)',fontSize:12}}>
                          {m.sender_name || ''} · {fmtTime(m.created_at)}
                        </div>
                        <button onClick={() => goToMessage(m.message_id || m.id)}
                          title="Перейти к сообщению"
                          style={{background:'rgba(140,110,220,.25)',border:'none',
                            color:'rgba(220,200,255,.95)',fontSize:11,fontWeight:600,
                            padding:'4px 10px',borderRadius:14,cursor:'pointer',
                            fontFamily:'inherit'}}>
                          💬 К сообщению
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {!loading && tab==='links' && (
            links.length === 0
              ? <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40}}>Нет ссылок</div>
              : links.map((l,i)=>(
                  <div key={i} style={{padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      style={{color:'rgba(160,130,220,.95)',fontSize:13,wordBreak:'break-all',textDecoration:'none',fontWeight:500}}>
                      {l.url}
                    </a>
                    <div style={{display:'flex',alignItems:'center',marginTop:4,gap:8}}>
                      <div style={{flex:1,color:'rgba(225,220,245,.7)',fontSize:12}}>
                        {l.sender} · {fmtTime(l.time)}
                      </div>
                      {l.message_id && (
                        <button onClick={() => goToMessage(l.message_id)}
                          title="Перейти к сообщению"
                          style={{background:'rgba(140,110,220,.25)',border:'none',
                            color:'rgba(220,200,255,.95)',fontSize:11,fontWeight:600,
                            padding:'4px 10px',borderRadius:14,cursor:'pointer',
                            fontFamily:'inherit'}}>
                          💬 К сообщению
                        </button>
                      )}
                    </div>
                  </div>
                ))
          )}
        </div>
      </div>
      {light && (() => {
        const { urls, index } = light;
        const total = urls.length;
        const curUrl = urls[index];
        const prev = () => setLight({ urls, index: (index - 1 + total) % total });
        const next = () => setLight({ urls, index: (index + 1) % total });
        return (
          <div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,.94)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}
            onClick={(e) => {
              // Стопим всплытие, чтобы не сработал onClose родительского
              // overlay'я модалки «Медиа и ссылки» — пользователь должен
              // вернуться в каталог, а не выйти полностью.
              e.stopPropagation();
              setLight(null);
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setLight(null);
              if (e.key === 'ArrowLeft')  prev();
              if (e.key === 'ArrowRight') next();
            }}
            tabIndex={0}
            ref={el => el?.focus()}>
            {/* Close */}
            <button onClick={e => { e.stopPropagation(); setLight(null); }}
              style={{position:'absolute',top:16,right:16,
                background:'rgba(255,255,255,.12)',border:'none',color:'white',
                width:40,height:40,borderRadius:'50%',cursor:'pointer',
                fontSize:20,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            {/* Counter */}
            {total > 1 && (
              <div style={{position:'absolute',top:24,left:'50%',transform:'translateX(-50%)',
                color:'rgba(255,255,255,.85)',fontSize:14,fontWeight:600,
                background:'rgba(0,0,0,.4)',padding:'5px 14px',borderRadius:20}}>
                {index + 1} / {total}
              </div>
            )}
            {/* Prev */}
            {total > 1 && (
              <button onClick={e => { e.stopPropagation(); prev(); }}
                style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',
                  background:'rgba(255,255,255,.12)',border:'none',color:'white',
                  width:48,height:48,borderRadius:'50%',cursor:'pointer',
                  fontSize:24,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            )}
            {/* Image */}
            <img src={curUrl} alt="" onClick={e=>e.stopPropagation()}
              style={{maxWidth:'90vw',maxHeight:'78vh',borderRadius:12,objectFit:'contain'}}/>
            {/* Next */}
            {total > 1 && (
              <button onClick={e => { e.stopPropagation(); next(); }}
                style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',
                  background:'rgba(255,255,255,.12)',border:'none',color:'white',
                  width:48,height:48,borderRadius:'50%',cursor:'pointer',
                  fontSize:24,display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
            )}
            {/* Actions */}
            <div style={{marginTop:16,display:'flex',gap:8}}>
              {light.msgIds?.[index] && (
                <button onClick={e => { e.stopPropagation(); goToMessage(light.msgIds[index]); }}
                  style={{background:'rgba(140,110,220,.7)',border:'none',borderRadius:10,
                    padding:'8px 18px',color:'white',fontSize:14,cursor:'pointer',
                    fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:6}}>
                  💬 К сообщению
                </button>
              )}
              <a href={curUrl} download onClick={e=>e.stopPropagation()}
                style={{background:'rgba(255,255,255,.15)',borderRadius:10,
                  padding:'8px 18px',color:'white',textDecoration:'none',fontSize:14}}>
                ⬇ Скачать
              </a>
            </div>
          </div>
        );
      })()}
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
  const [avatarUrl,setAvatarUrl]= useState(null);   // если загружена кастомная — приоритет над emoji
  const [uploading,setUploading]= useState(false);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef();

  useEffect(() => { api.getContacts().then(setContacts).catch(console.error); }, []);

  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file, { getPresignUrl: api.getPresignUrl });
      setAvatarUrl(url);
    } catch(err) {
      heyToast(err.message || 'Не удалось загрузить аватар', 'error');
    }
    setUploading(false);
  }

  function removeAvatar() {
    setAvatarUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function create() {
    if (!name.trim()) { heyToast('Введите название группы', 'error'); return; }
    if (selected.size === 0) { heyToast('Добавьте хотя бы одного участника', 'error'); return; }
    setSaving(true);
    try {
      // приоритет: кастомный аватар → emoji
      const groupIcon = avatarUrl || icon;
      const { id } = await api.createGroup({ name: name.trim(), icon: groupIcon, memberIds: [...selected] });
      nav(`/chat/${id}`, { replace: true });
    } catch(e) { heyToast(e.message, 'error'); setSaving(false); }
  }

  // ── Фильтрация контактов по поиску ──────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredContacts = q
    ? contacts.filter(c =>
        (c.nickname || c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      )
    : contacts;

  return (
    <div className="screen">
      <TopBar title="Новая группа" onBack={() => nav(-1)}/>
      {/* Всё содержимое в едином 680 контейнере */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',display:'flex',flexDirection:'column',flex:1,minHeight:0}}>

        {/* Шапка: аватарка + название */}
        <div style={{padding:'20px 24px 16px',display:'flex',flexDirection:'column',gap:18,flexShrink:0}}>
          {/* Большая круглая аватарка по центру */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{position:'relative',width:88,height:88}}>
              <div style={{
                width:88,height:88,borderRadius:'50%',
                background: avatarUrl ? '#0a0518' : 'rgba(140,100,200,.35)',
                display:'flex',alignItems:'center',justifyContent:'center',
                overflow:'hidden',fontSize:40,
                border: '2px solid rgba(255,255,255,.12)',
              }}>
                {uploading
                  ? <div style={{fontSize:24,animation:'spin 1s linear infinite'}}>⏳</div>
                  : avatarUrl
                    ? <img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : icon}
              </div>
              {/* Кнопка камеры */}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{
                  position:'absolute',bottom:0,right:0,width:30,height:30,borderRadius:'50%',
                  background:'rgba(120,90,200,.95)',border:'2px solid var(--grad-bg-end,#1a0e36)',
                  color:'white',fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,.4)',
                }}>
                {avatarUrl ? '✎' : '📷'}
              </button>
              {avatarUrl && !uploading && (
                <button onClick={removeAvatar}
                  style={{
                    position:'absolute',top:-2,right:-2,width:24,height:24,borderRadius:'50%',
                    background:'rgba(0,0,0,.7)',border:'none',color:'white',fontSize:12,cursor:'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>✕</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatar} style={{display:'none'}}/>
            <div style={{color:'rgba(255,255,255,.4)',fontSize:11}}>
              {avatarUrl ? 'Своя аватарка' : 'Выбери эмодзи ниже или загрузи фото'}
            </div>
          </div>

          {/* Emoji-иконки (когда нет своей аватарки) */}
          {!avatarUrl && (
            <div>
              <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:8}}>Иконка группы</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'flex-start'}}>
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
          )}

          {/* Название */}
          <div>
            <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:8}}>Название группы</div>
            <input className="glass-input" value={name} onChange={e=>setName(e.target.value)}
              placeholder="Например: Команда, Семья…" style={{width:'100%',boxSizing:'border-box'}}/>
          </div>

          {/* Поиск по контактам */}
          <div>
            <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:8,
              display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Участники ({selected.size} выбрано)</span>
              {selected.size > 0 && (
                <button onClick={() => setSelected(new Set())}
                  style={{background:'none',border:'none',color:'rgba(180,140,220,.8)',
                    fontSize:12,cursor:'pointer',padding:0}}>
                  Сбросить
                </button>
              )}
            </div>
            <input className="glass-input" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Поиск по контактам" style={{width:'100%',boxSizing:'border-box'}}/>
          </div>
        </div>

        {/* Список контактов */}
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {filteredContacts.length === 0 && (
            <div style={{padding:'40px 24px',color:'rgba(255,255,255,.4)',
              textAlign:'center',fontSize:14}}>
              {q ? 'Никого не найдено' : 'У вас пока нет контактов'}
            </div>
          )}
          {filteredContacts.map(c => (
            <div key={c.id} onClick={()=>toggle(c.id)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 24px',
                cursor:'pointer',transition:'background .12s',
                background: selected.has(c.id) ? 'rgba(140,100,200,.2)' : 'transparent'}}
              onMouseEnter={e=>{ if(!selected.has(c.id)) e.currentTarget.style.background='rgba(255,255,255,.05)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = selected.has(c.id)?'rgba(140,100,200,.2)':'transparent'; }}>
              <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name} size={40} fontSize={16}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'white',fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nickname||c.name}</div>
                <div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>{c.phone}</div>
              </div>
              <div style={{width:24,height:24,borderRadius:'50%',border:'2px solid rgba(180,140,220,.6)',
                background: selected.has(c.id) ? 'rgba(140,100,200,.8)' : 'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',
                color:'white',fontSize:14,transition:'background .15s',flexShrink:0}}>
                {selected.has(c.id) && '✓'}
              </div>
            </div>
          ))}
        </div>

        {/* Кнопка создания */}
        {selected.size > 0 && (
          <div style={{padding:'12px 24px 24px',flexShrink:0,
            background:'linear-gradient(0deg,rgba(20,12,42,.95),rgba(20,12,42,0))'}}>
            <button className="pill" onClick={create} disabled={saving}
              style={{width:'100%',opacity:saving?.7:1}}>
              {saving ? 'Создание…' : `Создать группу (${selected.size + 1} участников)`}
            </button>
          </div>
        )}
      </div>
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
  const [info,    setInfo]    = useState({ name:'', icon:'👥', admin_id: null, history_visibility: 'all' });
  const [members, setMembers] = useState([]);
  const [contacts,setContacts]= useState([]);
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState('');
  const [icon,    setIcon]    = useState('👥');           // emoji или URL
  const [uploading, setUploading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');    // поиск по контактам для добавления
  const avatarInputRef = useRef();

  // Любой админ — создатель ИЛИ участник с is_admin=1
  const myMember = members.find(m => m.id === user?.id);
  const isAdmin = info.admin_id === user?.id || !!myMember?.is_admin;
  const isUrl = (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('/'));

  useEffect(() => {
    api.getGroupInfo(convId).then(c => {
      if (c) { setInfo(c); setName(c.name || ''); setIcon(c.icon || '👥'); }
    }).catch(console.error);
    api.getGroupMembers(convId).then(setMembers);
    api.getContacts().then(setContacts);
  }, [convId]);

  async function toggleMemberAdmin(m) {
    const setTo = !m.is_admin;
    if (!await customConfirm(
      setTo
        ? `Назначить «${m.name}» админом группы? Сможет добавлять/удалять участников и менять настройки.`
        : `Снять админа с «${m.name}»?`
    )) return;
    try {
      await api.setGroupMemberAdmin(convId, m.id, setTo);
      const fresh = await api.getGroupMembers(convId);
      setMembers(fresh);
      heyToast(setTo ? 'Назначен админом' : 'Админ снят', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
  }

  async function changeHistoryVisibility(value) {
    try {
      await api.setGroupHistoryVisibility(convId, value);
      setInfo(prev => ({ ...prev, history_visibility: value }));
      heyToast(value === 'all'
        ? 'Новые участники увидят всю историю'
        : 'Новые участники увидят только сообщения после вступления',
        'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
  }

  async function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      heyToast('Только изображение', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      heyToast('Картинка больше 5 МБ', 'warning');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(file, { getPresignUrl: api.getPresignUrl });
      setIcon(url);
    } catch (err) {
      heyToast('Не удалось загрузить: ' + (err.message || 'ошибка'), 'error');
    }
    setUploading(false);
  }

  async function saveInfo() {
    await api.updateGroup(convId, { name, icon });
    setInfo(p => ({ ...p, name, icon }));
    setEditing(false);
  }

  async function addMember(userId) {
    try {
      const r = await api.addGroupMember(convId, userId);
      api.getGroupMembers(convId).then(setMembers);
      if (r?.alreadyMember && r.status === 'pending') {
        heyToast('Приглашение уже отправлено — ждём ответа', 'info');
      } else if (r?.alreadyMember) {
        heyToast('Уже в группе', 'info');
      } else {
        heyToast('Приглашение отправлено — ждём подтверждения', 'success');
      }
    } catch (e) {
      heyToast('Не удалось пригласить: ' + (e.message || ''), 'error');
    }
  }

  async function removeMember(userId) {
    if (!await customConfirm('Удалить участника из группы?', { danger: true, requireWord: 'удалить' })) return;
    await api.removeGroupMember(convId, userId);
    setMembers(prev => prev.filter(m => m.id !== userId));
  }

  async function leaveGroup() {
    if (!await customConfirm('Покинуть группу? Вы потеряете доступ к переписке.')) return;
    await api.removeGroupMember(convId, user.id);
    nav('/chats', { replace: true });
  }

  const nonMembers = contacts.filter(c => !members.find(m => m.id === c.id));
  const memberSearchQ = memberSearch.trim().toLowerCase();
  const filteredNonMembers = memberSearchQ
    ? nonMembers.filter(c =>
        (c.name     || '').toLowerCase().includes(memberSearchQ) ||
        (c.nickname || '').toLowerCase().includes(memberSearchQ) ||
        (c.phone    || '').includes(memberSearch.trim())
      )
    : nonMembers;

  return (
    <div className="screen">
      <TopBar title="Настройки группы" onBack={() => nav(-1)} right={<span/>}/>
      <div style={{flex:1,overflowY:'auto',maxWidth:680,margin:'0 auto',width:'100%',padding:'20px 24px'}}>
        {/* Group header */}
        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24}}>
          <div style={{width:64,height:64,borderRadius:20,overflow:'hidden',
            background: isUrl(info.icon) ? '#0a0518' : 'rgba(140,100,200,.5)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,flexShrink:0}}>
            {isUrl(info.icon)
              ? <img src={info.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (info.icon || '👥')}
          </div>
          <div>
            <div style={{color:'white',fontSize:19,fontWeight:600}}>{info.name}</div>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13}}>{members.length} участников</div>
          </div>
          {isAdmin && <button onClick={()=>setEditing(true)}
            style={{marginLeft:'auto',background:'none',border:'none',color:'rgba(255,255,255,.5)',cursor:'pointer',display:'inline-flex',alignItems:'center'}}><Icon name="pencil" size={18}/></button>}
        </div>

        {/* Edit form */}
        {editing && isAdmin && (
          <div style={{background:'rgba(255,255,255,.08)',borderRadius:16,padding:16,marginBottom:20,display:'flex',flexDirection:'column',gap:12}}>
            {/* Превью текущего аватара + загрузка */}
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:64,height:64,borderRadius:20,overflow:'hidden',position:'relative',
                background: isUrl(icon) ? '#0a0518' : 'rgba(140,100,200,.5)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,
                cursor: uploading ? 'wait' : 'pointer',flexShrink:0}}
                onClick={() => !uploading && avatarInputRef.current?.click()}>
                {isUrl(icon)
                  ? <img src={icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : icon}
                {uploading && (
                  <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.5)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'white',fontSize:11}}>…</div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <button onClick={() => avatarInputRef.current?.click()} disabled={uploading}
                  style={{background:'rgba(140,100,200,.5)',border:'none',borderRadius:10,
                    padding:'8px 14px',color:'white',fontSize:13,cursor: uploading ? 'wait' : 'pointer'}}>
                  {uploading ? 'Загрузка…' : (isUrl(icon) ? '✎ Сменить фото' : '📷 Загрузить фото')}
                </button>
                {isUrl(icon) && !uploading && (
                  <button onClick={() => setIcon('👥')}
                    style={{marginLeft:8,background:'none',border:'1px solid rgba(255,255,255,.15)',
                      borderRadius:10,padding:'7px 12px',color:'rgba(255,255,255,.7)',
                      fontSize:13,cursor:'pointer'}}>
                    ✕ Убрать
                  </button>
                )}
                <div style={{color:'rgba(255,255,255,.4)',fontSize:11,marginTop:6}}>
                  Или выбери эмодзи ниже
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                style={{display:'none'}} onChange={handleAvatarSelect}/>
            </div>

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
              <button className="pill" onClick={saveInfo} disabled={uploading} style={{flex:1,padding:'10px 0'}}>Сохранить</button>
              <button onClick={()=>{ setEditing(false); setIcon(info.icon || '👥'); }}
                style={{flex:1,padding:'10px 0',background:'rgba(255,255,255,.1)',border:'none',
                  borderRadius:24,color:'white',cursor:'pointer'}}>Отмена</button>
            </div>
          </div>
        )}

        {/* Members */}
        <div style={{color:'rgba(255,255,255,.5)',fontSize:13,marginBottom:10}}>Участники</div>
        {members.map(m => {
          const avatarIsImg = m.avatar && (m.avatar.startsWith('http') || m.avatar.startsWith('/') || m.avatar.startsWith('data:'));
          const isCreator = m.id === info.admin_id;
          const isMemberAdmin = isCreator || !!m.is_admin;
          return (
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
            borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <div
              onClick={() => m.id !== user?.id && openUserCard(m.id)}
              style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',
                background:'rgba(200,160,210,.45)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:18,color:'white',flexShrink:0,
                cursor: m.id !== user?.id ? 'pointer' : 'default',
                transition:'transform .12s'}}
              onMouseEnter={e => { if (m.id !== user?.id) e.currentTarget.style.transform='scale(1.05)'; }}
              onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
              {avatarIsImg
                ? <img src={m.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : (m.name?.[0] || '?').toUpperCase()}
            </div>
            <div
              onClick={() => m.id !== user?.id && openUserCard(m.id)}
              style={{flex:1,minWidth:0, cursor: m.id !== user?.id ? 'pointer' : 'default'}}>
              <div style={{color:'white',fontSize:14,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                {m.name}
                {isCreator && (
                  <span style={{fontSize:10,fontWeight:700,color:'rgba(255,210,120,1)',
                    background:'rgba(255,200,80,.15)',border:'1px solid rgba(255,200,80,.35)',
                    borderRadius:6,padding:'2px 7px'}}>создатель</span>
                )}
                {!isCreator && m.is_admin && (
                  <span style={{fontSize:10,fontWeight:700,color:'rgba(200,170,255,1)',
                    background:'rgba(140,110,220,.18)',border:'1px solid rgba(180,140,220,.4)',
                    borderRadius:6,padding:'2px 7px'}}>админ</span>
                )}
                {m.status === 'pending' && (
                  <span style={{fontSize:11,color:'rgba(255,200,120,.85)',
                    background:'rgba(255,200,120,.12)',borderRadius:6,padding:'2px 7px',fontWeight:600}}>
                    🕓 ждёт подтверждения
                  </span>
                )}
              </div>
            </div>
            {/* Promote/demote: только создатель может менять админство (и не себе) */}
            {info.admin_id === user?.id && m.id !== user.id && !isCreator && m.status === 'active' && (
              <button onClick={() => toggleMemberAdmin(m)}
                title={m.is_admin ? 'Снять админа' : 'Назначить админом'}
                style={{
                  background: m.is_admin ? 'rgba(255,200,80,.18)' : 'rgba(120,90,200,.18)',
                  border: '1px solid ' + (m.is_admin ? 'rgba(255,200,80,.4)' : 'rgba(180,140,220,.4)'),
                  color: m.is_admin ? 'rgba(255,210,120,1)' : 'rgba(200,170,255,1)',
                  borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {m.is_admin ? 'Снять админа' : '+ Админ'}
              </button>
            )}
            {isAdmin && m.id !== user.id && !isCreator && (
              <button onClick={()=>removeMember(m.id)}
                title={m.status === 'pending' ? 'Отозвать приглашение' : 'Удалить участника'}
                style={{
                  background:'rgba(200,60,60,.2)',border:'1px solid rgba(255,120,120,.45)',
                  color:'rgba(255,180,180,1)',
                  borderRadius:8,padding:'5px 10px',fontSize:14,cursor:'pointer',lineHeight:1,
                  fontFamily:'inherit',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(220,80,80,.3)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(200,60,60,.2)'}>✕</button>
            )}
          </div>
          );
        })}

        {/* Visibility toggle — только для создателя */}
        {info.admin_id === user?.id && (
          <div style={{marginTop:20,padding:'14px 16px',borderRadius:14,
            background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)'}}>
            <div style={{color:'rgba(225,220,245,.85)',fontSize:12,fontWeight:700,
              textTransform:'uppercase',letterSpacing:.6,marginBottom:8}}>
              👁 Что видят новые участники
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                { v:'all', t:'Всю историю чата', d:'По умолчанию. Видят сообщения, которые были до их вступления.' },
                { v:'since_joined', t:'Только с момента вступления', d:'Прошлые сообщения скрыты — закрытое сообщество.' },
              ].map(o => (
                <label key={o.v} style={{display:'flex',alignItems:'flex-start',gap:10,
                  padding:'10px 12px',borderRadius:10,cursor:'pointer',
                  background: info.history_visibility === o.v ? 'rgba(120,90,200,.18)' : 'rgba(255,255,255,.04)',
                  border:'1px solid ' + (info.history_visibility === o.v ? 'rgba(180,140,220,.4)' : 'rgba(255,255,255,.08)'),
                  transition:'all .12s',
                }}>
                  <input type="radio" name="hist-vis"
                    checked={info.history_visibility === o.v}
                    onChange={() => changeHistoryVisibility(o.v)}
                    style={{marginTop:3,accentColor:'rgb(180,140,255)'}}/>
                  <div style={{flex:1}}>
                    <div style={{color:'white',fontSize:13,fontWeight:600}}>{o.t}</div>
                    <div style={{color:'rgba(225,220,245,.65)',fontSize:11,marginTop:2,lineHeight:1.45}}>
                      {o.d}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Add members (admin only) */}
        {isAdmin && nonMembers.length > 0 && (
          <>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13,margin:'16px 0 10px'}}>
              Добавить участников ({nonMembers.length})
            </div>
            {/* Поиск по контактам */}
            {nonMembers.length > 5 && (
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder="🔍 Поиск по имени или телефону…"
                style={{
                  width:'100%',boxSizing:'border-box',marginBottom:10,
                  background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.14)',
                  borderRadius:10,padding:'9px 14px',color:'white',fontSize:14,
                  fontFamily:'inherit',outline:'none',
                }}
                onFocus={e => e.target.style.borderColor='rgba(180,140,220,.6)'}
                onBlur={e => e.target.style.borderColor='rgba(255,255,255,.14)'}/>
            )}
            {filteredNonMembers.length === 0 && memberSearchQ && (
              <div style={{color:'rgba(255,255,255,.35)',fontSize:13,padding:'12px 0'}}>
                Никого не найдено по «{memberSearch}»
              </div>
            )}
            {filteredNonMembers.map(c => {
              const avatarIsImg = c.avatar && (c.avatar.startsWith('http') || c.avatar.startsWith('/') || c.avatar.startsWith('data:'));
              return (
                <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',
                  borderBottom:'1px solid rgba(255,255,255,.07)'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',overflow:'hidden',
                    background:'rgba(200,160,210,.3)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'white',flexShrink:0}}>
                    {avatarIsImg
                      ? <img src={c.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : (c.nickname||c.name)[0].toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:'rgba(255,255,255,.85)',fontSize:14,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {c.nickname||c.name}
                    </div>
                    {c.phone && (
                      <div style={{color:'rgba(255,255,255,.4)',fontSize:11}}>{c.phone}</div>
                    )}
                  </div>
                  <button onClick={()=>addMember(c.id)}
                    style={{background:'rgba(140,100,200,.5)',border:'none',borderRadius:10,
                      padding:'6px 14px',color:'white',fontSize:13,cursor:'pointer'}}>+</button>
                </div>
              );
            })}
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
// MessageRow — memoized so hover/typing state changes don't re-render siblings
// ─────────────────────────────────────────────────────────────────────────────

const MessageRow = memo(function MessageRow({
  m, isOut, isGroup, editingMsgId, reactionPickerMsgId,
  partnerName, currentUserId, isFlashing,
  onOpenMenu, onLightbox, onToggleReaction, onSetReactionPicker,
  statusIcon, renderText,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hasReactions = m.reactions && Object.keys(m.reactions).length > 0;

  return (
    <div
      style={{display:'flex', alignItems:'flex-end', gap:4,
        justifyContent: isOut ? 'flex-end':'flex-start',
        marginBottom: hasReactions ? 8 : 2}}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => onOpenMenu(e, m)}>

      {/* Reaction button — left side for incoming */}
      {!isOut && (
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onSetReactionPicker(p => p?.msgId === m.id ? null : { msgId: m.id, x: rect.right + 6, y: rect.top });
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
        <div
          key={isFlashing ? 'flash-' + m.id : m.id}
          className={isFlashing ? 'hey-flash' : ''}
          style={{
            background: editingMsgId === m.id
              ? 'rgba(160,120,210,.85)'
              : isOut ? 'rgba(110,80,155,.70)' : 'rgba(255,255,255,.90)',
            borderRadius: isOut ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
            padding:'10px 13px 6px',
            color: isOut ? 'white' : '#2a2040',
            fontSize:14, lineHeight:'1.5',
            transition:'background .2s'
          }}>
          {isGroup && !isOut && (
            <div
              onClick={(e) => { e.stopPropagation(); openUserCard(m.sender_id); }}
              style={{fontSize:12,fontWeight:700,color:'rgba(180,130,255,1)',marginBottom:4,
                cursor:'pointer',textDecoration:'underline',textDecorationColor:'rgba(180,130,255,.5)',
                textUnderlineOffset:2,display:'inline-block',
                textShadow:'0 1px 2px rgba(0,0,0,.25)'}}>
              {m.sender_name}
            </div>
          )}
          {/* Forwarded-from label */}
          {m.forwarded_from && (
            <div style={{
              fontSize:11, fontWeight:600,
              color: isOut ? 'rgba(255,255,255,.7)' : 'rgba(120,90,180,.85)',
              marginBottom:4, display:'flex', alignItems:'center', gap:4,
            }}>
              <span>➦ Переслано от</span>
              <span style={{fontWeight:700}}>{m.forwarded_from.name}</span>
            </div>
          )}
          {/* Quoted reply */}
          {m.reply_to && (() => {
            let preview = (m.reply_to.text || '').slice(0, 100);
            const isImg  = m.reply_to.attachment_type === 'image' || m.reply_to.attachment_type === 'images';
            const isAud  = m.reply_to.attachment_type === 'audio';
            if (!preview && isImg) preview = '🖼 Фото';
            if (!preview && isAud) preview = '🎙 Голосовое';
            const accent = isOut ? 'rgba(255,255,255,.85)' : 'rgba(120,90,200,.85)';
            const subtxt = isOut ? 'rgba(255,255,255,.7)' : 'rgba(80,60,120,.85)';
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  // Скролл к оригинальному сообщению (если оно в текущем списке)
                  window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: m.reply_to.id }));
                }}
                title="Перейти к сообщению"
                style={{
                  display:'flex', gap:8, padding:'6px 8px',
                  marginBottom: 6,
                  background: isOut ? 'rgba(255,255,255,.12)' : 'rgba(120,90,200,.1)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${accent}`,
                  cursor:'pointer',
                  transition:'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isOut ? 'rgba(255,255,255,.2)' : 'rgba(120,90,200,.18)'}
                onMouseLeave={e => e.currentTarget.style.background = isOut ? 'rgba(255,255,255,.12)' : 'rgba(120,90,200,.1)'}>
                {isImg && m.reply_to.attachment_url && (
                  <img src={m.reply_to.attachment_url} alt=""
                    style={{
                      width:36, height:36, objectFit:'cover', borderRadius:6,
                      flexShrink:0,
                    }}/>
                )}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    fontSize:11, fontWeight:700, color: accent,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>
                    ↩ {m.reply_to.sender_name || '…'}
                  </div>
                  <div style={{
                    fontSize:12, color: subtxt,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>
                    {preview ? renderPreviewWithEmoji(preview) : '…'}
                  </div>
                </div>
              </div>
            );
          })()}
          {m.attachment?.type === 'image' && (() => {
            const src = m.attachment.url;
            if (!src) return (
              <div style={{padding:'10px 0',fontSize:13,opacity:.5}}>
                🖼 Изображение недоступно
              </div>
            );
            return (
              <img src={src} alt=""
                onClick={() => onLightbox(src, [src])}
                style={{maxWidth:'100%',maxHeight:300,borderRadius:10,
                  display:'block',marginBottom: m.text ? 6 : 2,
                  cursor:'zoom-in'}}/>
            );
          })()}
          {m.attachment?.type === 'images' && Array.isArray(m.attachment.urls) && (() => {
            const urls = m.attachment.urls.filter(Boolean);
            if (!urls.length) return null;
            // Сетка: 1 → одна большая; 2 → две в ряд; 3-4 → 2x2; 5+ → 3 колонки
            const cols = urls.length === 1 ? 1
                       : urls.length === 2 ? 2
                       : urls.length <= 4 ? 2 : 3;
            return (
              <div style={{
                display:'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 4,
                marginBottom: m.text ? 6 : 2,
                maxWidth: 360,
              }}>
                {urls.map((u, i) => (
                  <img key={i} src={u} alt=""
                    onClick={() => onLightbox(u, urls)}
                    style={{
                      width:'100%', aspectRatio:'1 / 1',
                      objectFit:'cover', borderRadius:8,
                      display:'block', cursor:'zoom-in',
                    }}/>
                ))}
              </div>
            );
          })()}
          {m.attachment?.type === 'audio' && (
            <AudioPlayer
              url={m.attachment.url}
              duration={m.attachment.duration}
              isOut={isOut}
            />
          )}
          {m.attachment?.type === 'file' && (
            <a href={m.attachment.url} target="_blank" rel="noreferrer" download={m.attachment.name}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:10, marginBottom: m.text ? 6 : 2,
                background: isOut ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)',
                border:'1px solid rgba(255,255,255,.1)',
                color:'inherit', textDecoration:'none', maxWidth:300,
              }}
              onMouseEnter={e => e.currentTarget.style.background = isOut ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.25)'}
              onMouseLeave={e => e.currentTarget.style.background = isOut ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)'}>
              <span style={{fontSize:28,flexShrink:0,lineHeight:1}}>
                {(() => {
                  const n = (m.attachment.name || '').toLowerCase();
                  const mime = m.attachment.mime || '';
                  if (mime === 'application/pdf' || n.endsWith('.pdf')) return '📕';
                  if (n.endsWith('.doc') || n.endsWith('.docx')) return '📘';
                  if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '📗';
                  if (n.endsWith('.ppt') || n.endsWith('.pptx')) return '📙';
                  if (n.endsWith('.zip') || n.endsWith('.rar')) return '🗜️';
                  if (n.endsWith('.txt') || mime.startsWith('text/')) return '📄';
                  return '📎';
                })()}
              </span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,overflow:'hidden',
                  textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {m.attachment.name || 'Файл'}
                </div>
                <div style={{fontSize:11,opacity:.6,marginTop:2}}>
                  {m.attachment.size != null ? (
                    m.attachment.size < 1024 ? m.attachment.size + ' Б' :
                    m.attachment.size < 1024 * 1024 ? (m.attachment.size / 1024).toFixed(1) + ' КБ' :
                    (m.attachment.size / (1024 * 1024)).toFixed(1) + ' МБ'
                  ) : 'Скачать'}
                </div>
              </div>
              <span style={{fontSize:14,opacity:.6,flexShrink:0}}>⬇</span>
            </a>
          )}
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
              const iReacted = userIds.includes(currentUserId);
              return (
                <button key={emoji} onClick={() => onToggleReaction(m.id, emoji)}
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
            onSetReactionPicker(p => p?.msgId === m.id ? null : { msgId: m.id, x: rect.left - 210, y: rect.top });
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
}, (prev, next) =>
  prev.m === next.m &&
  prev.editingMsgId === next.editingMsgId &&
  prev.reactionPickerMsgId === next.reactionPickerMsgId
);

// ─────────────────────────────────────────────────────────────────────────────
// AudioPlayer — compact player for voice messages in bubbles
// ─────────────────────────────────────────────────────────────────────────────

export const AudioPlayer = memo(function AudioPlayer({ url, duration: initDur, isOut, wide = false }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total,   setTotal]   = useState(initDur || 0);
  const [error,   setError]   = useState(null);
  const audioRef = useRef();

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => setCurrent(a.currentTime);
    const onEnd   = () => { setPlaying(false); setCurrent(0); a.currentTime = 0; };
    const onMeta  = () => { if (isFinite(a.duration)) setTotal(a.duration); };
    const onError = () => {
      const code = a.error?.code;
      const map = { 1:'прервано', 2:'сеть', 3:'формат', 4:'недоступен' };
      setError(map[code] || 'ошибка');
      setPlaying(false);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('error', onError);
    };
  }, [url]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    if (playing) { a.pause(); setPlaying(false); return; }
    try {
      // Принудительно перезагружаем источник если ещё не пробовали — иногда
      // <audio> с preload="metadata" не дотягивает аудио и play() падает с
      // NotSupportedError. Это особенно стабильно для голосовых от других
      // (свой play()-вызов мог отработать раньше).
      if (a.readyState < 2) { a.load(); }
      await a.play();
      setPlaying(true);
    } catch(err) {
      setError(err?.name === 'NotAllowedError' ? 'разрешение' : 'не воспроизводится');
      setPlaying(false);
    }
  }

  function fmtSec(s) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const barColor = isOut ? 'rgba(255,255,255,.9)' : 'rgba(100,70,160,.85)';
  const trackColor = isOut ? 'rgba(255,255,255,.25)' : 'rgba(100,70,160,.2)';
  const textColor  = isOut ? 'rgba(255,255,255,.75)' : 'rgba(60,40,100,.65)';

  return (
    <div style={{ display:'flex', alignItems:'center', gap: wide ? 14 : 8,
      minWidth: wide ? 0 : 170,
      maxWidth: wide ? '100%' : 240,
      width: wide ? '100%' : 'auto' }}>
      <audio ref={audioRef} src={url} preload="auto" playsInline
        controlsList="nodownload" disableRemotePlayback style={{ display:'none' }} />
      <button onClick={toggle} style={{
        width: wide ? 52 : 36, height: wide ? 52 : 36,
        borderRadius:'50%', flexShrink:0,
        background: wide ? 'rgba(140,100,220,.45)'
                  : isOut ? 'rgba(255,255,255,.2)' : 'rgba(100,70,160,.15)',
        border: wide ? '1.5px solid rgba(180,140,255,.55)'
              : isOut ? '1.5px solid rgba(255,255,255,.4)' : '1.5px solid rgba(100,70,160,.3)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: wide ? 20 : 14,
        color: wide ? 'white' : (isOut ? 'white' : '#4a2a90'),
        transition:'background .15s, transform .12s',
      }}
        onMouseEnter={wide ? (e=>e.currentTarget.style.transform='scale(1.05)') : undefined}
        onMouseLeave={wide ? (e=>e.currentTarget.style.transform='scale(1)') : undefined}>
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          height: wide ? 6 : 3, borderRadius: wide ? 4 : 2,
          background: wide ? 'rgba(255,255,255,.15)' : trackColor,
          overflow:'hidden', marginBottom: wide ? 8 : 4, cursor:'pointer',
        }} onClick={e => {
          const a = audioRef.current;
          if (!a || !total) return;
          const rect = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - rect.left) / rect.width) * total;
        }}>
          <div style={{ width:`${progress*100}%`, height:'100%',
            background: wide ? 'linear-gradient(90deg,rgba(180,140,255,.95),rgba(140,100,220,.95))' : barColor,
            borderRadius: wide ? 4 : 2, transition:'width .1s linear' }} />
        </div>
        <div style={{ fontSize: wide ? 13 : 11,
          color: error ? '#ff8080' : (wide ? 'rgba(255,255,255,.75)' : textColor),
          display:'flex', alignItems:'center', gap:8, fontVariantNumeric:'tabular-nums' }}>
          {error
            ? <span>⚠ {error}</span>
            : <>
                <span>{fmtSec(current)}</span>
                {wide && <span style={{opacity:.5}}>/</span>}
                {wide && <span style={{opacity:.7}}>{fmtSec(total)}</span>}
                {!wide && <span>🎙</span>}
              </>}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export function ChatScreen() {
  const nav = useNavigate();
  const location = useLocation();
  const { convId } = useParams();
  const { user } = useAuth();

  const [messages,    setMessages]    = useState([]);
  const [text,        setText]        = useState('');
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [typing,      setTyping]      = useState(null);
  const [partner,     setPartner]     = useState({ name:'Диалог', online:false, id:null, isGroup:false, icon:null, admin_id:null, avatar:null, isDeleted:false });
  const [editingMsg,  setEditingMsg]  = useState(null);
  const [msgMenu,     setMsgMenu]     = useState(null);
  const [replyTo,     setReplyTo]     = useState(null); // message object to reply to
  const [imgPreviews, setImgPreviews] = useState([]); // [{dataUrl, file, uploading?}]
  const [filePreview, setFilePreview] = useState(null); // { file, uploading?: bool }
  const [lightbox,    setLightbox]    = useState(null); // null | { urls: string[], index: number }
  const [showMedia,   setShowMedia]   = useState(false);
  const [searchMode,  setSearchMode]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults,setSearchResults] = useState(null); // null = not searched
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  // Message request state
  const [requestLock,  setRequestLock]  = useState(null); // { requester: {id,name,avatar} } | null
  const [requesterProfile, setRequesterProfile] = useState(null);
  const [groupInvite,  setGroupInvite]  = useState(null); // { conversation, invitedBy } | null
  const [accepting,    setAccepting]    = useState(false);
  const [declining,    setDeclining]    = useState(false);
  const [reactionPicker,setReactionPicker] = useState(null); // { msgId, x, y }
  const [flashMsgId,    setFlashMsgId]    = useState(null);  // id сообщения, которое подсвечивается
  const [customConfirm, confirmModal] = useConfirm();
  const [isContact,    setIsContact]    = useState(false); // is partner in my contacts?
  // Voice recording
  const [voiceState,   setVoiceState]   = useState(null); // null | 'recording' | 'preview'
  const [voiceBlob,    setVoiceBlob]    = useState(null);
  const [voiceObjUrl,  setVoiceObjUrl]  = useState(null); // object URL for preview player
  const [voiceDuration,setVoiceDuration]= useState(0);     // seconds
  const [recTime,      setRecTime]      = useState(0);     // seconds while recording
  const [showVoiceLimit, setShowVoiceLimit] = useState(false);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const recTimerRef       = useRef(null);
  const recStreamRef      = useRef(null);
  const analyserRef       = useRef(null);
  const waveCanvasRef     = useRef(null);
  const waveRafRef        = useRef(null);
  const [firstItemIndex, setFirstItemIndex] = useState(1_000_000); // Virtuoso prepend index
  const virtuosoRef        = useRef();
  const atBottomRef        = useRef(true);  // tracks whether list is scrolled to bottom
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [pinnedMessage, setPinnedMessage]   = useState(null); // {id, text, attachment, sender_name, ...}
  const [forwardModal,  setForwardModal]    = useState(null); // {messageId} | null
  const typingTimer        = useRef();
  const textareaRef        = useRef();
  const fileInputRef       = useRef();
  const searchRef          = useRef();
  const isInitialLoad      = useRef(true);  // true until first messages batch is rendered
  const forceScrollBottom  = useRef(false); // true after user sends a message
  const readDebounceTimer  = useRef(null);  // debounce read receipts

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


  // Debounced read receipt — sends only the LAST unread message ID (one DB query on server)
  function markVisibleAsRead(msgs) {
    if (!document.hasFocus()) return;
    // Find the latest incoming unread message
    const lastUnread = [...msgs].reverse().find(m => m.sender_id !== user?.id && m.status !== 'read');
    if (!lastUnread) return;
    clearTimeout(readDebounceTimer.current);
    readDebounceTimer.current = setTimeout(() => {
      socket.markRead(lastUnread.id, convId);
    }, 300);
  }

  // When tab regains focus — mark all loaded unread messages as read
  useEffect(() => {
    function onFocus() {
      setMessages(prev => { markVisibleAsRead(prev); return prev; });
    }
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); clearTimeout(readDebounceTimer.current); };
  }, [convId, user?.id]);

  // Load requester profile when request lock is set
  useEffect(() => {
    if (!requestLock?.requester?.id) { setRequesterProfile(null); return; }
    api.getUserProfile(requestLock.requester.id)
      .then(p => setRequesterProfile(p))
      .catch(() => setRequesterProfile(null));
  }, [requestLock?.requester?.id]);

  // Load history + partner info
  useEffect(() => {
    isInitialLoad.current = true;
    setMessages([]);
    setHasMore(true);
    setLoadingMore(false);
    setFirstItemIndex(1_000_000); // reset Virtuoso prepend index on conv change
    setPinnedMessage(null);
    setGroupInvite(null);
    api.getMessages(convId).then(data => {
      if (data?.groupInvite) {
        setGroupInvite({ conversation: data.conversation, invitedBy: data.invitedBy });
        setHasMore(false);
        return;
      }
      if (data?.locked) {
        setRequestLock({ requester: data.requester });
        setHasMore(false);
        return;
      }
      setRequestLock(null);
      setMessages(data);
      if (data.length < 50) setHasMore(false);
      markVisibleAsRead(data);
    }).catch(console.error);
    // Закреплённое сообщение (если есть)
    api.getPinnedMessage(convId).then(pm => setPinnedMessage(pm)).catch(() => {});
    setIsContact(false);
    Promise.all([api.getConversations(), api.getContacts()]).then(([convs, contacts]) => {
      const c = convs.find(c => c.id === convId);
      if (!c) return;
      if (c.type === 'group') {
        setPartner({ name: c.name||'Группа', online:false, id:null,
          isGroup:true, icon:c.icon||'👥', admin_id:c.admin_id, isDeleted:false });
      } else if (c.type === 'monolog') {
        setPartner({ name:'Монолог', online:false, id:null,
          isGroup:false, isMonolog:true, icon:'📝', avatar:null,
          isDeleted:false, isSuper:false, isSystem:false });
      } else {
        setPartner(p => ({ ...p, name: c.name||'Диалог', id: c.partner_id||null,
          isGroup:false, avatar: c.avatar||null,
          isDeleted: !!c.partner_is_deleted,
          isBlocked: !!c.partner_is_blocked,
          isSuper:   !!c.partner_is_super,
          isSystem:  !!c.partner_is_system,
          online:    !!c.partner_online,
          lastSeen:  c.partner_last_seen || null }));
        if (c.partner_id) {
          setIsContact(contacts.some(ct => ct.id === c.partner_id));
        }
      }
    }).catch(console.error);
  }, [convId]);

  // Load older messages (prepend) — Virtuoso handles scroll position via firstItemIndex
  async function loadOlder() {
    if (!hasMore || loadingMore || !messages.length) return;
    setLoadingMore(true);
    try {
      const older = await api.getMessages(convId, messages[0].created_at);
      if (!Array.isArray(older) || !older.length) { setHasMore(false); return; }
      if (older.length < 50) setHasMore(false);
      setFirstItemIndex(prev => prev - older.length);
      setMessages(prev => [...older, ...prev]);
    } catch {}
    finally { setLoadingMore(false); }
  }

  // ── Lightbox: стрелки ←/→ для навигации ───────────────────────────────
  useEffect(() => {
    if (!lightbox || lightbox.urls.length <= 1) return;
    function onKey(e) {
      if (e.key === 'ArrowLeft'  && lightbox.index > 0)
        setLightbox(l => l && ({ ...l, index: l.index - 1 }));
      if (e.key === 'ArrowRight' && lightbox.index < lightbox.urls.length - 1)
        setLightbox(l => l && ({ ...l, index: l.index + 1 }));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ── Esc — закрыть самый верхний попап чата ────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // Приоритет от самого «верхнего» к нижнему
      if (lightbox)              { setLightbox(null);            return; }
      if (showMedia)             { setShowMedia(false);          return; }
      if (msgMenu)               { setMsgMenu(null);             return; }
      if (reactionPicker)        { setReactionPicker(null);      return; }
      if (showEmoji)             { setShowEmoji(false);          return; }
      if (editingMsg)            { cancelEdit();                 return; }
      if (replyTo)               { setReplyTo(null);              return; }
      if (imgPreviews.length)    {
        imgPreviews.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
        setImgPreviews([]);
        return;
      }
      if (searchMode)            { setSearchMode(false); setSearchQuery(''); setSearchResults(null); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, showMedia, msgMenu, reactionPicker, showEmoji, editingMsg, replyTo, imgPreviews, searchMode]);

  // Scroll to bottom on initial load or after send — Virtuoso's followOutput handles the rest
  useEffect(() => {
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      // Несколько попыток: первая сразу, остальные после возможной загрузки картинок
      const scroll = () => virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'instant' });
      requestAnimationFrame(scroll);
      setTimeout(scroll, 150);
      setTimeout(scroll, 500);
      setTimeout(scroll, 1200);
      return;
    }
    if (forceScrollBottom.current) {
      forceScrollBottom.current = false;
      const scroll = (smooth) => virtuosoRef.current?.scrollToIndex({
        index: 'LAST', behavior: smooth ? 'smooth' : 'auto'
      });
      scroll(true);
      // Повторные попытки — изображения и кастомные превью могут изменить высоту
      setTimeout(() => scroll(false), 150);
      setTimeout(() => scroll(false), 500);
      setTimeout(() => scroll(false), 1200);
    }
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
    const u4  = socket.on('message:status', ({ id, status }) => {
      setMessages(prev => prev.map(m => m.id===id ? { ...m, status } : m));
    });
    // Batch read receipts — server sends one event for N messages
    const u4b = socket.on('message:status_batch', ({ ids, status }) => {
      const idSet = new Set(ids);
      setMessages(prev => prev.map(m => idSet.has(m.id) ? { ...m, status } : m));
    });
    const u5 = socket.on('presence:change', ({ userId, online, lastSeen }) => {
      setPartner(p => p.id === userId
        ? { ...p, online: !!online, lastSeen: lastSeen ?? p.lastSeen ?? Math.floor(Date.now()/1000) }
        : p);
    });
    const u6 = socket.on('chat:cleared', ({ conversationId }) => {
      if (conversationId === convId) { setMessages([]); setPinnedMessage(null); }
    });
    const u6b = socket.on('conversation:deleted', ({ conversationId }) => {
      if (conversationId === convId) {
        heyToast('Чат удалён', 'info');
        nav('/chats');
      }
    });
    const u7 = socket.on('message:edited', ({ message }) => {
      if (message.conversation_id === convId)
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, text: message.text, edited_at: message.edited_at } : m));
    });
    const u8 = socket.on('message:deleted', ({ messageId, conversationId: cid }) => {
      if (cid === convId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setPinnedMessage(p => p && p.id === messageId ? null : p);
      }
    });
    const u9 = socket.on('reaction:update', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      // Подсветка сообщения на секунду
      setFlashMsgId(messageId);
      setTimeout(() => setFlashMsgId(curr => curr === messageId ? null : curr), 1000);
    });
    // На reconnect WS — могли пропустить message:new из-за оборвавшегося соединения
    // (типичный сценарий на мобильном с плохой сетью). Подтягиваем свежие сообщения.
    const u10 = socket.on('connected', () => {
      if (isInitialLoad.current) return; // первичная загрузка уже выкачает
      api.getMessages(convId).then(data => {
        if (!Array.isArray(data)) return;
        setMessages(prev => {
          // Сливаем: для каждого id берём более «свежую» (с реальным id или со статусом дальше)
          const byId = new Map();
          for (const m of prev) byId.set(m.id, m);
          for (const m of data) {
            const existing = byId.get(m.id);
            // Берём серверную версию (она канонична)
            byId.set(m.id, existing ? { ...existing, ...m } : m);
          }
          return Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
        });
      }).catch(() => {});
    });
    // Возврат во вкладку (мобильный «свернул-развернул») — тоже пересинхрон
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !isInitialLoad.current) {
        api.getMessages(convId).then(data => {
          if (!Array.isArray(data)) return;
          setMessages(prev => {
            const byId = new Map();
            for (const m of prev) byId.set(m.id, m);
            for (const m of data) {
              const existing = byId.get(m.id);
              byId.set(m.id, existing ? { ...existing, ...m } : m);
            }
            return Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
          });
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const u11 = socket.on('message:pinned', ({ conversationId, message }) => {
      if (conversationId === convId) setPinnedMessage(message);
    });
    return () => {
      u1(); u2(); u3(); u4(); u4b(); u5(); u6(); u6b(); u7(); u8(); u9(); u10(); u11();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [convId, user?.id]);

  function handleInput(e) {
    setText(e.target.value);
    socket.startTyping(convId);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.stopTyping(convId), 1500);
  }

  // ── Voice recording ────────────────────────────────────────────────────────

  const MAX_VOICE_SEC = user?.is_super ? 300 : 60; // 5 min Super, 1 min free

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')  ? 'audio/mp4'
        : '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const objUrl = URL.createObjectURL(blob);
        setVoiceBlob(blob);
        setVoiceObjUrl(objUrl);
        setVoiceDuration(recTime);
        setVoiceState('preview');
        // Stop all tracks
        recStreamRef.current?.getTracks().forEach(t => t.stop());
        recStreamRef.current = null;
      };
      mr.start(200); // collect every 200ms

      // ── Web Audio: waveform analyser ──
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source   = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const draw = () => {
          waveRafRef.current = requestAnimationFrame(draw);
          const canvas = waveCanvasRef.current;
          if (!canvas) return;
          const ctx2d = canvas.getContext('2d');
          const W = canvas.width, H = canvas.height;
          const bufLen = analyser.frequencyBinCount;
          const data   = new Uint8Array(bufLen);
          analyser.getByteFrequencyData(data);

          ctx2d.clearRect(0, 0, W, H);

          const barCount = 28;
          const barW     = 3;
          const gap      = (W - barCount * barW) / (barCount + 1);
          for (let i = 0; i < barCount; i++) {
            // Sample from lower half of freq bins (voice range)
            const binIdx  = Math.floor((i / barCount) * (bufLen * 0.5));
            const raw     = data[binIdx] / 255;
            const minH    = 3;
            const barH    = Math.max(minH, raw * (H - 4));
            const x       = gap + i * (barW + gap);
            const y       = (H - barH) / 2;
            const alpha   = 0.4 + raw * 0.6;
            ctx2d.fillStyle = `rgba(220,180,255,${alpha})`;
            ctx2d.beginPath();
            ctx2d.roundRect(x, y, barW, barH, 2);
            ctx2d.fill();
          }
        };
        draw();
      } catch { /* Web Audio not available — graceful degradation */ }

      setVoiceState('recording');
      setRecTime(0);

      recTimerRef.current = setInterval(() => {
        setRecTime(t => {
          const next = t + 1;
          if (next >= MAX_VOICE_SEC) {
            stopRecording();
            if (!user?.is_super) setShowVoiceLimit(true);
          }
          return next;
        });
      }, 1000);
    } catch {
      heyToast('Нет доступа к микрофону', 'error');
    }
  }

  function stopWaveform() {
    cancelAnimationFrame(waveRafRef.current);
    waveRafRef.current  = null;
    analyserRef.current = null;
  }

  function stopRecording() {
    clearInterval(recTimerRef.current);
    stopWaveform();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }

  function cancelVoice() {
    clearInterval(recTimerRef.current);
    stopWaveform();
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    recStreamRef.current?.getTracks().forEach(t => t.stop());
    recStreamRef.current = null;
    if (voiceObjUrl) URL.revokeObjectURL(voiceObjUrl);
    setVoiceState(null);
    setVoiceBlob(null);
    setVoiceObjUrl(null);
    setVoiceDuration(0);
    setRecTime(0);
  }

  async function sendVoice() {
    if (!voiceBlob) return;
    const blob = voiceBlob;
    const dur  = voiceDuration || recTime;
    const objUrl = voiceObjUrl;
    // Optimistic clear
    cancelVoice();
    let url;
    try {
      url = await uploadAudioBlob(blob, { getPresignUrl: api.getPresignUrl });
    } catch(e) {
      heyToast('Не удалось отправить голосовое: ' + e.message, 'error');
      return;
    }
    const attachment = { type: 'audio', url, duration: Math.round(dur) };
    const tempId = 'tmp-' + Date.now();
    forceScrollBottom.current = true;
    setMessages(prev => [...prev, {
      id: tempId, text: null, attachment,
      sender_id: user.id, sender_name: user.name,
      status: 'sent', created_at: Math.floor(Date.now() / 1000),
    }]);
    socket.sendMessage(convId, '', tempId, attachment);
    if (objUrl) URL.revokeObjectURL(objUrl);
  }

  function fmtRecTime(s) {
    const m = Math.floor(s / 60), ss = s % 60;
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    // Разделяем: изображения → в preview-бар (галерея до 10),
    //            прочие файлы → в filePreview (один файл, отправляется один сообщением)
    const images = files.filter(f => f.type.startsWith('image/'));
    const others = files.filter(f => !f.type.startsWith('image/'));

    if (images.length) {
      const MAX_TOTAL = 10;
      const remaining = MAX_TOTAL - imgPreviews.length;
      if (remaining <= 0) {
        heyToast(`Можно прикрепить максимум ${MAX_TOTAL} изображений`, 'warning');
      } else {
        const added = [];
        for (const file of images.slice(0, remaining)) {
          if (file.size > 10 * 1024 * 1024) {
            heyToast(`«${file.name}» слишком большой (макс. 10 МБ)`, 'warning');
            continue;
          }
          added.push({ dataUrl: previewUrl(file), file, uploading: false });
        }
        if (added.length) setImgPreviews(prev => [...prev, ...added]);
        if (images.length > remaining) {
          heyToast(`Лимит ${MAX_TOTAL} картинок — лишние не добавлены`, 'warning');
        }
      }
    }

    if (others.length) {
      if (filePreview) {
        heyToast('Файл уже выбран — отправь или удали его', 'warning');
        return;
      }
      const file = others[0];
      const maxMb = user?.is_super ? 50 : 25;
      if (file.size > maxMb * 1024 * 1024) {
        heyToast(`«${file.name}» слишком большой (макс. ${maxMb} МБ)`, 'warning');
        return;
      }
      if (others.length > 1) {
        heyToast('Можно прикрепить только один файл за раз', 'warning');
      }
      setFilePreview({ file, uploading: false });
    }
  }

  function fmtFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  }

  function fileIcon(mime, name) {
    const lname = (name || '').toLowerCase();
    if (mime === 'application/pdf' || lname.endsWith('.pdf')) return '📕';
    if (lname.endsWith('.doc') || lname.endsWith('.docx')) return '📘';
    if (lname.endsWith('.xls') || lname.endsWith('.xlsx')) return '📗';
    if (lname.endsWith('.ppt') || lname.endsWith('.pptx')) return '📙';
    if (lname.endsWith('.zip') || lname.endsWith('.rar')) return '🗜️';
    if (lname.endsWith('.txt') || mime?.startsWith('text/')) return '📄';
    return '📎';
  }

  async function send() {
    const t = text.trim();

    if (imgPreviews.length > 0) {
      if (imgPreviews.some(p => p.uploading)) return;
      const captured = imgPreviews;
      const capturedText = t;
      setImgPreviews(prev => prev.map(p => ({ ...p, uploading: true })));

      let urls = [];
      try {
        const results = await Promise.all(captured.map(p =>
          uploadMedia(p.file, 'chat-image', {
            getPresignUrl: api.getPresignUrl,
            uploadImage:   api.uploadImage,
          })
        ));
        urls = results.map(r => r.url);
      } catch (err) {
        heyToast(err.message || 'Не удалось загрузить изображения', 'error');
        setImgPreviews(prev => prev.map(p => ({ ...p, uploading: false })));
        return;
      }

      // Если только одна — оставляем старый формат для обратной совместимости
      const attachment = urls.length === 1
        ? { type: 'image',  url:  urls[0] }
        : { type: 'images', urls };

      const tempId = 'tmp-' + Date.now();
      const reply = replyTo ? makeReplySnippet(replyTo) : null;
      forceScrollBottom.current = true;
      setMessages(prev => [...prev, {
        id: tempId, text: capturedText || null, attachment, sender_id: user.id,
        sender_name: user.name, status: 'sent',
        created_at: Math.floor(Date.now() / 1000),
        reply_to_id: replyTo?.id || null, reply_to: reply,
      }]);
      socket.sendMessage(convId, capturedText || '', tempId, attachment, replyTo?.id);
      // Освобождаем object URLs
      captured.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
      setImgPreviews([]);
      setText('');
      setReplyTo(null);
      return;
    }

    // Отправка файла (PDF/DOC/архив и т.п.)
    if (filePreview) {
      const f = filePreview.file;
      setFilePreview(p => p ? { ...p, uploading: true } : p);
      let uploaded;
      try {
        uploaded = await uploadFile(f, { getPresignUrl: api.getPresignUrl });
      } catch (err) {
        heyToast(err.message || 'Не удалось загрузить файл', 'error');
        setFilePreview(p => p ? { ...p, uploading: false } : p);
        return;
      }
      const attachment = {
        type: 'file',
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size,
        mime: uploaded.mime,
      };
      const tempId = 'tmp-' + Date.now();
      const reply  = replyTo ? makeReplySnippet(replyTo) : null;
      forceScrollBottom.current = true;
      setMessages(prev => [...prev, {
        id: tempId, text: t || null, attachment, sender_id: user.id,
        sender_name: user.name, status:'sent',
        created_at: Math.floor(Date.now()/1000),
        reply_to_id: replyTo?.id || null, reply_to: reply,
      }]);
      socket.sendMessage(convId, t || '', tempId, attachment, replyTo?.id);
      setFilePreview(null);
      setText('');
      setReplyTo(null);
      return;
    }

    if (!t) return;

    if (editingMsg) {
      api.editMessage(convId, editingMsg.id, t)
        .then(updated => setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text, edited_at: updated.edited_at } : m)))
        .catch(e => heyToast(e.message, 'error'));
      setEditingMsg(null);
      setText('');
      return;
    }

    const tempId = 'tmp-' + Date.now();
    const reply  = replyTo ? makeReplySnippet(replyTo) : null;
    forceScrollBottom.current = true;
    setMessages(prev => [...prev, {
      id: tempId, text: t, sender_id: user.id,
      sender_name: user.name, status:'sent',
      created_at: Math.floor(Date.now()/1000),
      reply_to_id: replyTo?.id || null, reply_to: reply,
    }]);
    socket.sendMessage(convId, t, tempId, null, replyTo?.id);
    setText('');
    setReplyTo(null);
    socket.stopTyping(convId);
  }

  // Локальный snippet для оптимистического показа цитаты (до прихода реального с сервера)
  function makeReplySnippet(m) {
    if (!m) return null;
    let attType = null;
    if (m.attachment?.type) attType = m.attachment.type;
    return {
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_id === user?.id ? (user?.name || 'Вы') : (m.sender_name || partner.name),
      text: m.text ? m.text.slice(0, 120) : null,
      attachment_type: attType,
    };
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

  async function pinMsg(msg) {
    setMsgMenu(null);
    try {
      await api.pinMessage(convId, msg.id);
      // pinnedMessage обновится через WS-событие, но на всякий случай ставим оптимистически
      setPinnedMessage(msg);
    } catch (e) {
      heyToast('Не удалось закрепить: ' + (e.message || ''), 'error');
    }
  }

  async function unpinMsg() {
    setMsgMenu(null);
    try {
      await api.unpinMessage(convId);
      setPinnedMessage(null);
    } catch (e) {
      heyToast('Не удалось открепить: ' + (e.message || ''), 'error');
    }
  }

  function openForwardModal(msg) {
    setMsgMenu(null);
    setForwardModal({ messageId: msg.id });
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

  async function handleDeleteConversation() {
    const isGroup = partner.isGroup;
    const title = isGroup
      ? <>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>
            Удалить группу «{partner.name}»?
          </div>
          <div style={{color:'rgba(255,255,255,.65)',fontSize:13,lineHeight:1.6}}>
            Группа исчезнет у всех участников. Все сообщения, реакции и медиа удалятся безвозвратно.
          </div>
        </>
      : <>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>
            Удалить чат с {partner.name}?
          </div>
          <div style={{color:'rgba(255,255,255,.65)',fontSize:13,lineHeight:1.6}}>
            Переписка удалится <strong>у обоих</strong>. Все сообщения, реакции и медиа — безвозвратно.
          </div>
        </>;
    const ok = await customConfirm(title, { requireWord: 'УДАЛИТЬ', danger: true });
    if (!ok) return;
    try {
      await api.deleteConversation(convId);
      // broadcast 'conversation:deleted' тоже придёт, но мы уже навигируемся
      nav('/chats');
    } catch (e) {
      heyToast('Не удалось удалить: ' + (e.message || 'ошибка'), 'error');
    }
  }

  async function handleLeaveGroup() {
    if (!await customConfirm(
      `Покинуть группу «${partner.name}»? Вы потеряете доступ к переписке.`,
      { danger: true, confirmLabel: 'Покинуть' }
    )) return;
    try {
      await api.removeGroupMember(convId, user.id);
      nav('/chats');
    } catch (e) {
      heyToast('Не удалось выйти: ' + (e.message || 'ошибка'), 'error');
    }
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

  async function handleAddContact() {
    if (!partner.id) return;
    try {
      await api.addContact({ userId: partner.id });
      setIsContact(true);
    } catch(e) {
      heyToast(e.message || 'Не удалось добавить в контакты', 'error');
    }
  }

  // В группе содержимое может чистить только админ; в direct/monolog — любой участник
  const isGroupAdmin = partner.isGroup && partner.admin_id === user?.id;
  const canClearChat = !partner.isGroup || isGroupAdmin;
  // Админ группы не выходит через «выйти» — должен сначала передать админство
  // или удалить группу полностью
  const canLeaveGroup = partner.isGroup && !isGroupAdmin;
  // Полное удаление чата: direct — любой участник, group — только админ. Monolog нельзя.
  const canDeleteChat = !partner.isMonolog && (partner.isGroup ? isGroupAdmin : true);

  const chatMenuItems = [
    { label: 'Поиск в чате',            icon: <Icon name="search" size={18}/>, danger: false, onClick: () => { setSearchMode(true); setTimeout(()=>searchRef.current?.focus(),50); } },
    { label: 'Медиа и ссылки',          icon: <Icon name="image"  size={18}/>, danger: false, onClick: () => setShowMedia(true) },
    ...(partner.isGroup ? [
      { label: 'Настройки группы',      icon: <Icon name="settings" size={18}/>, danger: false, onClick: () => nav(`/groups/${convId}/settings`) },
      ...(isGroupAdmin ? [
        { label: 'Скопировать ссылку-приглашение', icon: <Icon name="link" size={18}/>, danger: false, onClick: async () => {
          try {
            const { token } = await api.groupInviteLink(convId);
            const url = window.location.origin + '/gjoin/' + token;
            try { await navigator.clipboard.writeText(url); } catch {
              const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta);
              ta.select(); try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
            }
            heyToast('Ссылка скопирована — отправь её другу', 'success');
          } catch (e) { heyToast(e.message || 'Не удалось создать ссылку', 'error'); }
        } },
      ] : []),
    ] : [
      ...(!isContact && partner.id && !partner.isDeleted ? [
        { label: 'Добавить в контакты', icon: <Icon name="user-plus" size={18}/>, danger: false, onClick: handleAddContact },
      ] : []),
      { label: 'Экспортировать чат',    icon: <Icon name="download" size={18}/>, danger: false, onClick: handleExportChat },
    ]),
    ...(canClearChat ? [
      { label: 'Удалить содержимое чата', icon: <Icon name="trash" size={18}/>, danger: true,  onClick: handleClearChat },
    ] : []),
    ...(canLeaveGroup ? [
      { label: 'Выйти из группы',         icon: <Icon name="logout" size={18}/>, danger: true,  onClick: handleLeaveGroup },
    ] : []),
    ...(canDeleteChat ? [
      { label: partner.isGroup ? 'Удалить группу' : 'Удалить чат',
        icon: <Icon name="close" size={18}/>, danger: true, onClick: handleDeleteConversation },
    ] : []),
  ];

  // Flat item list for Virtuoso: date separators interleaved with messages + typing
  const flatItems = useMemo(() => {
    const result = [];
    let lastDay = null;
    for (const m of messages) {
      const day = new Date(m.created_at * 1000).toDateString();
      if (day !== lastDay) {
        result.push({ type: 'date', id: 'date-' + day, day, label: fmtDate(m.created_at) });
        lastDay = day;
      }
      result.push({ type: 'msg', ...m });
    }
    if (typing) result.push({ type: 'typing', id: 'typing' });
    return result;
  }, [messages, typing]);

  // ── Scroll to specific message (клик на цитату) ──────────────────────
  useEffect(() => {
    function onScrollTo(e) {
      const targetId = e.detail;
      if (!targetId) return;
      const idx = flatItems.findIndex(it => it.id === targetId);
      if (idx < 0) {
        heyToast('Сообщение не загружено — прокрути выше', 'info');
        return;
      }
      virtuosoRef.current?.scrollToIndex({
        index: idx, align: 'center', behavior: 'smooth',
      });
      setFlashMsgId(targetId);
      setTimeout(() => setFlashMsgId(curr => curr === targetId ? null : curr), 1500);
    }
    window.addEventListener('hey:scroll-to-msg', onScrollTo);
    return () => window.removeEventListener('hey:scroll-to-msg', onScrollTo);
  }, [flatItems]);

  // Stable callbacks for MessageRow (avoid re-renders from parent re-binding)
  const handleOpenMenu  = useCallback((e, m) => openMsgMenu(e, m), []);
  const handleLightbox  = useCallback((src, urls) => {
    if (Array.isArray(urls) && urls.length > 1) {
      const idx = Math.max(0, urls.indexOf(src));
      setLightbox({ urls, index: idx });
    } else {
      setLightbox({ urls: [src], index: 0 });
    }
  }, []);
  const handleToggleRxn = useCallback((msgId, emoji) => {
    socket.send('reaction:toggle', { messageId: msgId, conversationId: convId, emoji });
    setReactionPicker(null);
  }, [convId]);
  const handleSetRxnPicker = useCallback((fn) => setReactionPicker(fn), []);

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, bottom:0,
      display:'flex', flexDirection:'column', overflow:'hidden',
      background:'var(--grad)',
    }}>
      {/* TopBar — клик на аватар/имя собеседника открывает его профиль */}
      <div className="topbar">
        <div className="topbar-inner">
          <button className="back-btn" onClick={() => {
            // Если есть история в SPA — назад; иначе явно идём в список чатов
            // (важно для прямых ссылок, refresh, push-навигации)
            if (window.history.length > 1 && location.key !== 'default') nav(-1);
            else nav('/chats');
          }}>‹</button>
          {partner.isMonolog ? (
            <div style={{width:36,height:36,borderRadius:'12px',flexShrink:0,
              background:'linear-gradient(135deg,#5a4090,#8060c0)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
              📝
            </div>
          ) : partner.isGroup ? (() => {
            const ic = partner.icon || '';
            const isImg = ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:');
            return (
              <div onClick={() => nav(`/groups/${convId}/settings`)}
                style={{width:36,height:36,borderRadius:'12px',flexShrink:0,cursor:'pointer',overflow:'hidden',
                  background: isImg ? '#0a0518' : 'rgba(140,100,200,.5)',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transition:'transform .15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                {isImg
                  ? <img src={ic} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (ic || '👥')}
              </div>
            );
          })() : (
            <div onClick={() => partner.id && openUserCard(partner.id)}
              style={{cursor: partner.id ? 'pointer' : 'default',transition:'transform .15s',
                position:'relative',width:36,height:36,flexShrink:0}}
              onMouseEnter={e=>{ if(partner.id) e.currentTarget.style.transform='scale(1.05)'; }}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <AvatarDisplay avatar={partner.avatar} name={partner.name} size={36}/>
              {partner.isSuper && (
                <div style={{
                  position:'absolute',bottom:-1,right:-1,
                  width:14,height:14,borderRadius:'50%',
                  background:'linear-gradient(135deg,#c8a8ff,#7858b0)',
                  border:'2px solid var(--topbar-bg,#1a0e36)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:7,color:'white',fontWeight:700,
                  pointerEvents:'none',
                }}>✦</div>
              )}
            </div>
          )}
          <div onClick={() => {
              if (partner.isGroup) nav(`/groups/${convId}/settings`);
              else if (partner.id) openUserCard(partner.id);
            }}
            style={{flex:1,marginLeft:8,minWidth:0,
              cursor: (partner.isGroup || partner.id) ? 'pointer' : 'default'}}>
            <div className="topbar-title" style={{flex:'unset',display:'flex',alignItems:'center',gap:8}}>
              <span>{partner.name}</span>
              {/* Зелёная точка-индикатор онлайн — справа от имени, без подписи */}
              {!!partner.online && !partner.isGroup && !partner.isMonolog && !partner.isSystem && (
                <span style={{
                  width:9, height:9, borderRadius:'50%',
                  background:'rgba(110,235,150,1)',
                  boxShadow:'0 0 0 2px rgba(40,30,80,.5), 0 0 6px rgba(110,235,150,.5)',
                  flexShrink:0,
                }}/>
              )}
            </div>
            {partner.isGroup && <div style={{fontSize:11,color:'rgba(255,255,255,.5)'}}>группа</div>}
            {/* Super-юзеру показываем «был X» только для оффлайн собеседника.
                «онлайн» подписи нет — индикатор-точка справа от имени уже
                сообщает статус. ВНИМАНИЕ: !! на числовых флагах из БД (0/1),
                иначе React рендерит «0» как текст (JSX `0 && X = 0`). */}
            {!partner.isGroup && !partner.isMonolog && !partner.isSystem
             && !!partner.id && !!user?.is_super
             && !partner.online && !!partner.lastSeen && (
              <div style={{fontSize:11,color:'rgba(255,255,255,.55)'}}>
                был {fmtLastSeenShort(partner.lastSeen)}
              </div>
            )}
          </div>
          <DotsMenu items={chatMenuItems}/>
        </div>
      </div>

      {/* Pinned message banner */}
      {pinnedMessage && !searchMode && (() => {
        const canUnpin = partner.isGroup ? (partner.admin_id === user?.id) : true;
        let preview = pinnedMessage.text || '';
        if (!preview && pinnedMessage.attachment) {
          const t = pinnedMessage.attachment.type;
          preview = t === 'image' || t === 'images' ? '🖼 Фото'
                  : t === 'audio' ? '🎙 Голосовое'
                  : t === 'file' ? `📎 ${pinnedMessage.attachment.name || 'Файл'}`
                  : 'Вложение';
        }
        return (
          <div style={{
            background:'rgba(50,38,90,.85)', backdropFilter:'blur(12px)',
            borderBottom:'1px solid rgba(180,140,220,.18)',
            flexShrink:0,
          }}>
            <div style={{maxWidth:680,margin:'0 auto',
              display:'flex',alignItems:'center',gap:10,padding:'8px 14px'}}>
              <span style={{flexShrink:0,color:'rgba(230,200,255,.95)',display:'inline-flex'}}>
                <Icon name="pin" size={16}/>
              </span>
              <div onClick={() => {
                  window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: pinnedMessage.id }));
                }}
                style={{flex:1,minWidth:0,cursor:'pointer'}}>
                <div style={{color:'rgba(255,255,255,.92)',fontSize:13,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {renderPreviewWithEmoji(preview.slice(0, 200))}
                </div>
              </div>
              {canUnpin && (
                <button onClick={unpinMsg} title="Открепить"
                  style={{background:'rgba(255,255,255,.08)',border:'none',
                    color:'rgba(255,255,255,.6)',fontSize:14,cursor:'pointer',
                    width:28,height:28,borderRadius:'50%',flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.18)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}>
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
        <div style={{flex:1,overflowY:'auto'}}>
          <div style={{maxWidth:680,margin:'0 auto',padding:'8px 16px',
            display:'flex',flexDirection:'column',gap:6}}>
          {searchResults.length === 0
            ? <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',marginTop:40}}>Ничего не найдено</div>
            : searchResults.map(m => (
                <div
                  key={m.id}
                  onClick={() => {
                    // Закрываем поиск и переходим к сообщению в чате
                    setSearchMode(false);
                    setSearchQuery('');
                    setSearchResults(null);
                    // Даём Virtuoso перерисоваться, потом скроллим
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: m.id }));
                    }, 50);
                  }}
                  style={{background:'rgba(255,255,255,.08)',borderRadius:12,padding:'10px 14px',
                    cursor:'pointer',transition:'background .15s'}}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.13)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}
                >
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
        </div>
      )}

      {/* Пустой «Монолог» — показываем подсказку про что это за чат */}
      {!requestLock && !groupInvite && !(searchMode && searchResults !== null) &&
       partner.isMonolog && messages.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 24px', overflowY: 'auto',
        }}>
          <div style={{
            maxWidth: 460, width: '100%',
            background: 'rgba(20,12,40,.55)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 18, padding: '26px 24px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 12px 36px rgba(0,0,0,.25)',
          }}>
            <div style={{
              display:'flex',alignItems:'center',justifyContent:'center',
              width:56,height:56,borderRadius:'50%',
              background:'linear-gradient(135deg,#7c4ddc,#a78bfa)',
              margin:'0 auto 14px',fontSize:28,
              boxShadow:'0 6px 18px rgba(124,77,220,.4)',
            }}>📝</div>
            <h2 style={{
              margin:0,color:'white',fontSize:18,fontWeight:800,
              textAlign:'center',marginBottom:8,
            }}>Это твой Монолог</h2>
            <p style={{
              margin:0,color:'rgba(230,225,250,.85)',fontSize:14,
              lineHeight:1.55,textAlign:'center',marginBottom:18,
            }}>
              Личный чат с самим собой. Видишь только ты — остальные сюда не попадут.
            </p>
            <div style={{
              background:'rgba(255,255,255,.05)',
              borderRadius:12,padding:'12px 14px',
              color:'rgba(230,225,250,.85)',fontSize:13,lineHeight:1.7,
            }}>
              <div style={{
                color:'rgba(200,170,255,1)',fontWeight:700,fontSize:11,
                textTransform:'uppercase',letterSpacing:.6,marginBottom:6,
              }}>Для чего пригодится</div>
              <div>💡 Заметки, мысли, цитаты — на лету</div>
              <div>🔗 Сохранить ссылку, чтобы не потерять</div>
              <div>📎 Прикрепить файл, фото, голосовое — себе</div>
              <div>✏️ Черновики сообщений и идей</div>
              <div>🔍 Всё найдётся через поиск по чату</div>
            </div>
            <p style={{
              margin:'14px 0 0',color:'rgba(230,225,250,.6)',
              fontSize:12,lineHeight:1.5,textAlign:'center',
            }}>
              Начни прямо снизу — напиши что-нибудь себе ↓
            </p>
          </div>
        </div>
      )}

      {/* Messages — virtualized list, DOM nodes fixed at ~50 regardless of history size */}
      {!requestLock && !groupInvite && !(searchMode && searchResults !== null) &&
       !(partner.isMonolog && messages.length === 0) && (
        <Virtuoso
          ref={virtuosoRef}
          style={{ flex: 1, overscrollBehavior: 'contain' }}
          firstItemIndex={firstItemIndex}
          data={flatItems}
          initialTopMostItemIndex={Math.max(0, flatItems.length - 1)}
          startReached={loadOlder}
          atBottomStateChange={bottom => { atBottomRef.current = bottom; setShowScrollDown(!bottom); }}
          followOutput={(atBottom) => {
            if (forceScrollBottom.current) return 'smooth';
            return atBottom ? 'smooth' : false;
          }}
          components={{
            Header: () => loadingMore ? (
              <div style={{textAlign:'center',padding:'8px 0',color:'rgba(255,255,255,.4)',fontSize:13}}>
                Загрузка…
              </div>
            ) : null,
            // Хвостовой отступ — чтобы последнее сообщение / индикатор «печатает»
            // не подъезжали под инпут-бар
            Footer: () => <div style={{ height: 12 }} />,
          }}
          itemContent={(_index, item) => {
            if (item.type === 'date') return (
              <div style={{display:'flex',justifyContent:'center',margin:'8px 16px'}}>
                <div style={{background:'rgba(100,72,140,.38)',borderRadius:14,padding:'4px 14px',
                  color:'rgba(255,255,255,.7)',fontSize:13,fontWeight:600}}>
                  {item.label}
                </div>
              </div>
            );
            if (item.type === 'typing') return (
              <div style={{display:'flex',gap:4,alignItems:'center',padding:'6px 24px 14px'}}>
                <div style={{color:'rgba(255,255,255,.6)',fontSize:13}}>{typing} печатает</div>
                <div style={{display:'flex',gap:3}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{width:6,height:6,borderRadius:'50%',
                      background:'rgba(255,255,255,.5)',animation:`typing 1.2s ${i*.2}s infinite`}}/>
                  ))}
                </div>
              </div>
            );
            // Regular message
            const isOut = item.sender_id === user?.id;
            return (
              <div style={{maxWidth:680,margin:'0 auto',padding:'0 16px'}}>
                <MessageRow
                  m={item}
                  isOut={isOut}
                  isGroup={partner.isGroup}
                  editingMsgId={editingMsg?.id}
                  reactionPickerMsgId={reactionPicker?.msgId}
                  currentUserId={user?.id}
                  isFlashing={flashMsgId === item.id}
                  onOpenMenu={handleOpenMenu}
                  onLightbox={handleLightbox}
                  onToggleReaction={handleToggleRxn}
                  onSetReactionPicker={handleSetRxnPicker}
                  statusIcon={statusIcon}
                  renderText={renderText}
                />
              </div>
            );
          }}
        />
      )}

      {/* Scroll-to-bottom floating button */}
      {showScrollDown && flatItems.length > 5 && !(searchMode && searchResults !== null) && (
        <button
          onClick={() => {
            forceScrollBottom.current = true;
            virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
            setTimeout(() => { forceScrollBottom.current = false; }, 500);
          }}
          aria-label="К последним сообщениям"
          style={{
            position: 'absolute',
            right: 18,
            bottom: imgPreviews.length > 0 ? 180 : 90,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(60,40,90,.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.12)',
            color: 'white', fontSize: 20, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 50,
            boxShadow: '0 4px 14px rgba(0,0,0,.35)',
            transition: 'background .15s, transform .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(80,55,120,.95)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(60,40,90,.85)'; }}
        >
          ↓
        </button>
      )}

      {/* File preview bar — один файл с именем/размером */}
      {filePreview && (
        <div style={{background:'rgba(100,78,148,.45)',flexShrink:0}}>
          <div style={{padding:'10px 14px',maxWidth:680,margin:'0 auto',
            display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28,flexShrink:0}}>
              {fileIcon(filePreview.file.type, filePreview.file.name)}
            </span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:'white',fontSize:14,fontWeight:600,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {filePreview.file.name}
              </div>
              <div style={{color:'rgba(255,255,255,.55)',fontSize:12,marginTop:2}}>
                {fmtFileSize(filePreview.file.size)}
                {filePreview.uploading && ' · отправка…'}
              </div>
            </div>
            <button onClick={() => setFilePreview(null)}
              disabled={filePreview.uploading}
              style={{background:'rgba(0,0,0,.4)',border:'none',color:'white',
                fontSize:14,cursor: filePreview.uploading ? 'wait' : 'pointer',
                width:28,height:28,borderRadius:'50%',
                display:'flex',alignItems:'center',justifyContent:'center',
                flexShrink:0,lineHeight:1}}>✕</button>
          </div>
        </div>
      )}

      {/* Image previews bar — до 10 миниатюр в ряд */}
      {imgPreviews.length > 0 && (
        <div style={{background:'rgba(100,78,148,.45)',flexShrink:0}}>
          <div style={{padding:'10px 14px',maxWidth:680,margin:'0 auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{color:'rgba(255,255,255,.85)',fontSize:13,fontWeight:600,flex:1}}>
                {imgPreviews.some(p => p.uploading)
                  ? 'Отправка…'
                  : `${imgPreviews.length} ${imgPreviews.length === 1 ? 'картинка' : 'картинки'} · добавь подпись или нажми ➤`}
              </span>
              <button onClick={() => {
                  imgPreviews.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
                  setImgPreviews([]);
                }}
                disabled={imgPreviews.some(p => p.uploading)}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',
                  fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                Сбросить
              </button>
            </div>
            <div style={{display:'flex',gap:6,overflowX:'auto',padding:'2px 0'}}>
              {imgPreviews.map((p, idx) => (
                <div key={idx} style={{position:'relative',flexShrink:0}}>
                  <img src={p.dataUrl} alt=""
                    style={{height:56,width:56,objectFit:'cover',borderRadius:8,
                      opacity: p.uploading ? .5 : 1, transition:'opacity .2s',
                      border:'1px solid rgba(255,255,255,.15)'}}/>
                  {!p.uploading && (
                    <button onClick={() => {
                        try { URL.revokeObjectURL(p.dataUrl); } catch {}
                        setImgPreviews(prev => prev.filter((_, i) => i !== idx));
                      }}
                      style={{
                        position:'absolute',top:-4,right:-4,width:18,height:18,
                        borderRadius:'50%',background:'rgba(0,0,0,.85)',
                        border:'none',color:'white',fontSize:12,cursor:'pointer',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        padding:0,lineHeight:1,
                      }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reply banner */}
      {replyTo && !editingMsg && (() => {
        const isOwnReply = replyTo.sender_id === user?.id;
        const att = replyTo.attachment;
        let preview = (replyTo.text || '').slice(0, 120);
        let thumbUrl = null;
        if (att?.type === 'image')  thumbUrl = att.url;
        if (att?.type === 'images') thumbUrl = (att.urls && att.urls[0]) || null;
        if (!preview && (att?.type === 'image' || att?.type === 'images')) preview = '🖼 Фото';
        if (!preview && att?.type === 'audio') preview = '🎙 Голосовое';
        return (
          <div style={{background:'rgba(100,78,148,.5)',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',
              maxWidth:680,margin:'0 auto'}}>
              <div style={{
                width:3,alignSelf:'stretch',minHeight:38,
                background:'rgba(180,140,255,.85)',borderRadius:2,flexShrink:0,
              }}/>
              {thumbUrl && (
                <img src={thumbUrl} alt=""
                  style={{width:40,height:40,objectFit:'cover',borderRadius:6,flexShrink:0}}/>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'rgba(200,170,255,.95)',fontSize:12,fontWeight:700,
                  display:'flex',alignItems:'center',gap:6}}>
                  <span>↩</span>
                  <span>В ответ {isOwnReply ? 'себе' : (replyTo.sender_name || partner.name)}</span>
                </div>
                <div style={{color:'rgba(255,255,255,.7)',fontSize:13,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>
                  {preview ? renderPreviewWithEmoji(preview) : '…'}
                </div>
              </div>
              <button onClick={() => setReplyTo(null)}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',
                  fontSize:22,cursor:'pointer',lineHeight:1,padding:'0 4px'}}>✕</button>
            </div>
          </div>
        );
      })()}

      {/* Edit banner */}
      {editingMsg && (
        <div style={{background:'rgba(100,78,148,.5)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',
            maxWidth:680,margin:'0 auto'}}>
            <span style={{color:'rgba(255,255,255,.85)',display:'inline-flex'}}><Icon name="pencil" size={15}/></span>
            <span style={{flex:1,color:'rgba(255,255,255,.8)',fontSize:13,
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {editingMsg.text}
            </span>
            <button onClick={cancelEdit}
              style={{background:'none',border:'none',color:'rgba(255,255,255,.6)',
                fontSize:20,cursor:'pointer',lineHeight:1}}>✕</button>
          </div>
        </div>
      )}

      {/* Emoji keyboard */}
      {showEmoji && (
        <div style={{background:'rgba(100,78,148,.78)',flexShrink:0}}>
          <div style={{maxWidth:680,margin:'0 auto',padding:'10px 12px'}}>
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
        </div>
      )}

      {/* ── Group invite overlay ─────────────────────────────────────── */}
      {groupInvite && (
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'28px 24px', gap:18,
        }}>
          {(() => {
            const ic = groupInvite.conversation?.icon || '';
            const isImg = ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:');
            return (
              <div style={{
                width:96, height:96, borderRadius:'50%', overflow:'hidden',
                background: isImg ? '#0a0518' : 'rgba(140,100,200,.5)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:46, color:'white',
                border:'3px solid rgba(255,255,255,.25)',
                boxShadow:'0 4px 24px rgba(120,80,200,.35)',
              }}>
                {isImg
                  ? <img src={ic} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (ic || '👥')}
              </div>
            );
          })()}
          <div style={{textAlign:'center'}}>
            <div style={{
              display:'inline-block',
              background:'rgba(80,50,140,.55)',
              border:'1px solid rgba(180,140,220,.5)',
              color:'white', fontSize:11, fontWeight:700,
              letterSpacing:.9, textTransform:'uppercase',
              padding:'4px 12px', borderRadius:50, marginBottom:10,
              display:'inline-flex',alignItems:'center',gap:6,
            }}>
              <Icon name="mail" size={12}/> Приглашение в группу
            </div>
            <div style={{color:'white', fontSize:22, fontWeight:800, marginBottom:8,
              textShadow:'0 2px 8px rgba(0,0,0,.25)'}}>
              {groupInvite.conversation?.name || 'Группа'}
            </div>
            {groupInvite.invitedBy?.name && (
              <div style={{color:'rgba(255,255,255,.85)', fontSize:14, lineHeight:1.5,
                textShadow:'0 1px 4px rgba(0,0,0,.2)'}}>
                {groupInvite.invitedBy.name} приглашает тебя в группу
              </div>
            )}
          </div>

          <div style={{display:'flex', gap:12, width:'100%', maxWidth:340, marginTop:8}}>
            <button
              disabled={declining}
              onClick={async () => {
                setDeclining(true);
                try { await api.declineGroupInvite(convId); nav('/chats'); }
                catch (e) { heyToast('Ошибка: ' + (e.message || ''), 'error'); }
                setDeclining(false);
              }}
              style={{
                flex:1, padding:'13px', borderRadius:14, fontSize:14, fontWeight:600,
                background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.6)',
                color:'rgba(255,225,225,1)', cursor:'pointer', opacity: declining ? .6 : 1,
                fontFamily:'inherit',
              }}>
              {declining ? '…' : 'Отклонить'}
            </button>
            <button
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                try {
                  await api.acceptGroupInvite(convId);
                  setGroupInvite(null);
                  const msgs = await api.getMessages(convId);
                  setMessages(Array.isArray(msgs) ? msgs : []);
                  heyToast('✓ Вы вступили в группу', 'success');
                } catch (e) {
                  heyToast('Ошибка: ' + (e.message || ''), 'error');
                }
                setAccepting(false);
              }}
              style={{
                flex:2, padding:'13px', borderRadius:14, fontSize:14, fontWeight:700,
                background:'rgba(120,90,200,.85)', border:'1px solid rgba(180,140,220,.5)',
                color:'white', cursor:'pointer', opacity: accepting ? .6 : 1,
                fontFamily:'inherit',
                boxShadow:'0 2px 12px rgba(120,80,200,.4)',
              }}>
              {accepting ? '…' : '✓ Принять'}
            </button>
          </div>
        </div>
      )}

      {/* ── Request lock overlay ─────────────────────────────────────── */}
      {requestLock && (
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          padding:'28px 24px', gap:20,
        }}>
          {/* Avatar */}
          <div style={{
            width:80, height:80, borderRadius:'50%',
            background:'rgba(180,140,220,.35)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:34, color:'white', fontWeight:700, overflow:'hidden',
            boxShadow:'0 4px 20px rgba(120,80,200,.3)',
          }}>
            {requestLock.requester?.avatar
              ? <img src={requestLock.requester.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (requestLock.requester?.name?.[0] || '?')}
          </div>

          {/* Name + hint */}
          <div style={{textAlign:'center'}}>
            <div style={{color:'white', fontSize:20, fontWeight:700, marginBottom:6}}>
              {requestLock.requester?.name || 'Пользователь'}
            </div>
            <div style={{color:'rgba(255,255,255,.45)', fontSize:14, lineHeight:1.6}}>
              хочет начать с вами переписку.<br/>
              Добавьте в контакты, чтобы видеть сообщения.
            </div>
          </div>

          {/* Bio */}
          {requesterProfile?.bio && (
            <div style={{
              background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.1)',
              borderRadius:12, padding:'10px 14px',
              color:'rgba(255,255,255,.75)', fontSize:14, lineHeight:1.5,
              maxWidth:300, textAlign:'center',
            }}>
              {requesterProfile.bio}
            </div>
          )}

          {/* Profile link */}
          {requestLock.requester?.id && (
            <button onClick={() => nav(`/profile/${requestLock.requester.id}`)}
              style={{
                background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)',
                borderRadius:50, padding:'7px 18px', color:'rgba(255,255,255,.7)',
                fontSize:13, cursor:'pointer',
              }}>
              Посмотреть профиль →
            </button>
          )}

          {/* Actions */}
          <div style={{display:'flex', gap:12, width:'100%', maxWidth:320}}>
            <button
              disabled={declining}
              onClick={async () => {
                setDeclining(true);
                try { await api.declineRequest(convId); nav('/chats'); } catch {}
                setDeclining(false);
              }}
              style={{
                flex:1, padding:'13px', borderRadius:14, fontSize:14, fontWeight:600,
                background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.6)',
                color:'rgba(255,225,225,1)', cursor:'pointer', opacity: declining ? .6 : 1,
              }}>
              {declining ? '…' : 'Удалить'}
            </button>
            <button
              disabled={accepting}
              onClick={async () => {
                setAccepting(true);
                try {
                  await api.acceptRequest(convId);
                  setRequestLock(null);
                  const msgs = await api.getMessages(convId);
                  setMessages(Array.isArray(msgs) ? msgs : []);
                } catch {}
                setAccepting(false);
              }}
              style={{
                flex:2, padding:'13px', borderRadius:14, fontSize:14, fontWeight:700,
                background:'rgba(120,90,200,.8)', border:'1px solid rgba(180,140,220,.4)',
                color:'white', cursor:'pointer', opacity: accepting ? .6 : 1,
                boxShadow:'0 2px 12px rgba(120,80,200,.35)',
              }}>
              {accepting ? '…' : '✓ Добавить в контакты'}
            </button>
          </div>
        </div>
      )}

      {/* Deleted user banner */}
      {partner.isDeleted && (
        <div style={{
          flexShrink:0, padding:'12px 20px',
          background:'rgba(255,255,255,.05)',
          borderTop:'1px solid rgba(255,255,255,.08)',
          textAlign:'center',
          color:'rgba(255,255,255,.45)', fontSize:13,
        }}>
          🚫 Этот пользователь удалил аккаунт
        </div>
      )}

      {/* Blocked-by-admin user banner */}
      {partner.isBlocked && !partner.isDeleted && (
        <div style={{
          flexShrink:0, padding:'12px 20px',
          background:'rgba(200,80,80,.12)',
          borderTop:'1px solid rgba(255,120,120,.2)',
          textAlign:'center',
          color:'rgba(255,180,180,.85)', fontSize:13, lineHeight:1.5,
        }}>
          🚫 Пользователь заблокирован администрацией<br/>
          <span style={{color:'rgba(255,180,180,.5)',fontSize:12}}>
            Отправка сообщений недоступна
          </span>
        </div>
      )}

      {/* Input bar */}
      {!requestLock && !groupInvite && !partner.isDeleted && !partner.isBlocked && <div style={{flexShrink:0}}>

        {/* ── Voice: recording bar ── */}
        {voiceState === 'recording' && (
          <div style={{padding:'8px 14px 10px',maxWidth:680,margin:'0 auto'}}>
            <div style={{
              display:'flex',alignItems:'center',gap:10,
              borderRadius:26,padding:'8px 10px 8px 14px',
              backgroundImage:'url(/input-bg.jpg)',backgroundSize:'cover',backgroundPosition:'center',
              border:'1px solid rgba(255,255,255,0.5)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 18px rgba(0,0,0,0.15)',
            }}>
              {/* Red dot */}
              <span style={{width:9,height:9,borderRadius:'50%',background:'#e74c3c',flexShrink:0,
                animation:'pulse 1s ease-in-out infinite',boxShadow:'0 0 6px #e74c3c'}}/>
              {/* Timer */}
              <span style={{color:'rgba(255,255,255,.9)',fontSize:14,fontWeight:600,
                fontVariantNumeric:'tabular-nums',flexShrink:0}}>
                {fmtRecTime(recTime)}
              </span>
              {/* Waveform canvas */}
              <canvas ref={waveCanvasRef} width={160} height={36}
                style={{flex:1,minWidth:0,height:36,display:'block'}}/>
              {/* Remaining time for free users */}
              {!user?.is_super && (
                <span style={{color:'rgba(255,200,100,.65)',fontSize:11,flexShrink:0}}>
                  {MAX_VOICE_SEC - recTime}с
                </span>
              )}
              {/* Cancel */}
              <button onClick={cancelVoice} title="Отменить"
                style={{width:28,height:28,borderRadius:'50%',flexShrink:0,
                  background:'rgba(200,60,60,.45)',border:'1px solid rgba(255,140,140,.55)',
                  color:'rgba(255,180,180,.85)',fontSize:14,cursor:'pointer',lineHeight:1,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              {/* Stop → preview */}
              <button onClick={stopRecording} title="Остановить"
                style={{width:36,height:36,borderRadius:18,flexShrink:0,
                  background:'rgba(100,78,148,.85)',border:'none',
                  color:'white',fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>■</button>
            </div>
          </div>
        )}

        {/* ── Voice: preview bar ── */}
        {voiceState === 'preview' && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',
            maxWidth:680,margin:'0 auto'}}>
            <button onClick={cancelVoice} title="Удалить"
              style={{width:36,height:36,borderRadius:'50%',flexShrink:0,
                background:'rgba(255,80,80,.15)',border:'1px solid rgba(255,120,120,.35)',
                color:'rgba(255,180,180,.9)',cursor:'pointer',lineHeight:1,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name="trash" size={16}/></button>
            <div style={{flex:1,background:'rgba(255,255,255,.07)',borderRadius:26,
              padding:'8px 14px',border:'1px solid rgba(255,255,255,.12)'}}>
              <AudioPlayer url={voiceObjUrl} duration={voiceDuration} isOut={true}/>
            </div>
            <button onClick={sendVoice} title="Отправить"
              style={{width:44,height:44,background:'rgba(100,78,148,.85)',border:'none',
                borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',
                justifyContent:'center',flexShrink:0,fontSize:20,color:'white'}}>
              ➤
            </button>
          </div>
        )}

        {/* ── Системный пользователь: показываем плашку вместо инпута ── */}
        {partner.isSystem && (
          <div style={{padding:'14px 20px 20px',maxWidth:680,margin:'0 auto'}}>
            <div style={{
              background:'rgba(120,90,200,.1)',
              border:'1px solid rgba(180,140,220,.2)',
              borderRadius:14, padding:'12px 16px',
              display:'flex', alignItems:'center', gap:10,
              color:'rgba(255,255,255,.5)', fontSize:13,
            }}>
              <span style={{fontSize:18}}>💬</span>
              <span>Это сервисный аккаунт. Ответить здесь нельзя.</span>
            </div>
          </div>
        )}

        {/* ── Normal text input bar (hidden while recording/preview/system) ── */}
        {!voiceState && !partner.isSystem && (
        <div style={{padding:'8px 14px 14px',maxWidth:680,margin:'0 auto'}}>
          <div style={{
            borderRadius:26,
            display:'flex', alignItems:'center', padding:'8px 8px 8px 14px', gap:6,
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
            {/* Emoji */}
            <button onClick={() => setShowEmoji(s=>!s)} title="Смайлики"
              style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,
                padding:4,opacity: showEmoji ? 1 : 0.75,transition:'opacity .15s'}}>
              <img src="/emoji/smiling.svg" alt="emoji"
                style={{width:22,height:22,display:'block',pointerEvents:'none'}}/>
            </button>
            {/* Attach */}
            <button onClick={() => fileInputRef.current?.click()} title="Прикрепить файл или картинку"
              style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,
                padding:4,opacity:.8,transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='1'}
              onMouseLeave={e=>e.currentTarget.style.opacity='.8'}>
              <img src="/emoji/paperclip.svg" alt="attach"
                style={{width:22,height:22,display:'block',pointerEvents:'none',
                  filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
            </button>
            <input ref={fileInputRef} type="file" multiple
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
              style={{display:'none'}} onChange={handleFileSelect}/>
            {/* Mic / Send — inside the pill */}
            {text.trim() || imgPreviews.length > 0 || filePreview ? (
              <button onClick={send} title="Отправить"
                style={{width:36,height:36,background:'rgba(100,78,148,.85)',border:'none',
                  borderRadius:18,cursor:'pointer',display:'flex',alignItems:'center',
                  justifyContent:'center',flexShrink:0,fontSize:17,color:'white',
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(130,100,180,.95)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(100,78,148,.85)'}>
                ➤
              </button>
            ) : (
              <button onClick={startRecording} title="Голосовое сообщение"
                style={{width:36,height:36,background:'rgba(100,78,148,.85)',border:'none',
                  borderRadius:18,cursor:'pointer',display:'flex',alignItems:'center',
                  justifyContent:'center',flexShrink:0,fontSize:17,color:'white',
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(130,100,180,.95)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(100,78,148,.85)'}>
                <Icon name="mic" size={18}/>
              </button>
            )}
          </div>
        </div>
        )}

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>}{/* end input bar outer (hidden when requestLock) */}

      {/* SuperLimitPopup — free user hit 60s */}
      {showVoiceLimit && (
        <SuperLimitPopup
          onClose={() => setShowVoiceLimit(false)}
          onInvite={() => { setShowVoiceLimit(false); nav('/me'); }}
        />
      )}

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
            const isOwn   = msgMenu.msg.sender_id === user?.id;
            const canEdit = isOwn && (Date.now()/1000 - msgMenu.msg.created_at) < 3*60*60 && !!msgMenu.msg.text;
            // Pin rights: в группе только админ, в direct/monolog — любой участник
            const canPin  = partner.isGroup ? (partner.admin_id === user?.id) : true;
            const isPinned = pinnedMessage && pinnedMessage.id === msgMenu.msg.id;
            // Copy text — только если есть текст
            const canCopy = !!msgMenu.msg.text;
            const copyText = () => {
              setMsgMenu(null);
              try { navigator.clipboard.writeText(msgMenu.msg.text || ''); heyToast('Скопировано', 'success'); }
              catch { heyToast('Не удалось скопировать', 'error'); }
            };
            return [
              { label:'Ответить', icon:<Icon name="reply" size={18}/>, danger:false, action:() => { setReplyTo(msgMenu.msg); setMsgMenu(null); textareaRef.current?.focus(); } },
              { label:'Переслать', icon:<Icon name="forward" size={18}/>, danger:false, action:() => openForwardModal(msgMenu.msg) },
              canCopy && { label:'Копировать', icon:<Icon name="copy" size={18}/>, danger:false, action: copyText },
              canPin && !isPinned && { label:'Закрепить', icon:<Icon name="pin" size={18}/>, danger:false, action:() => pinMsg(msgMenu.msg) },
              canPin &&  isPinned && { label:'Открепить', icon:<Icon name="unpin" size={18}/>, danger:false, action:() => unpinMsg() },
              canEdit && { label:'Редактировать', icon:<Icon name="pencil" size={18}/>, danger:false, action:() => startEdit(msgMenu.msg) },
              isOwn  && { label:'Удалить', icon:<Icon name="trash" size={18}/>, danger:true, action:() => deleteMsg(msgMenu.msg) },
            ].filter(Boolean).map(({ label, icon, danger, action }) => (
              <div key={label} onClick={action}
                style={{padding:'13px 18px',color:danger?'#ff6b6b':'white',fontSize:15,
                  cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,color:danger?'#ff6b6b':'rgba(255,255,255,.85)'}}>{icon}</span>{label}
              </div>
            ));
          })()}
        </div>
      )}

      {/* Media viewer */}
      {showMedia && (
        <MediaViewerModal convId={convId} onClose={()=>setShowMedia(false)}/>
      )}

      {/* Forward modal */}
      {forwardModal && (
        <ForwardModal
          messageId={forwardModal.messageId}
          onClose={() => setForwardModal(null)}
          onDone={(count) => heyToast(`Переслано в ${count} ${count === 1 ? 'чат' : 'чатов'}`, 'success')}
        />
      )}

      {/* Lightbox */}
      {lightbox && (() => {
        const urls    = lightbox.urls || [];
        const idx     = lightbox.index || 0;
        const total   = urls.length;
        const current = urls[idx];
        const canPrev = idx > 0;
        const canNext = idx < total - 1;
        return (
          <div onClick={() => setLightbox(null)}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.92)',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              backdropFilter:'blur(8px)'}}>
            {/* Стрелки навигации (если в галерее больше одной) */}
            {canPrev && (
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ urls, index: idx - 1 }); }}
                style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',zIndex:2,
                  width:48,height:48,borderRadius:'50%',
                  background:'rgba(255,255,255,.12)',backdropFilter:'blur(8px)',
                  border:'1px solid rgba(255,255,255,.18)',color:'white',
                  fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ‹
              </button>
            )}
            {canNext && (
              <button onClick={(e) => { e.stopPropagation(); setLightbox({ urls, index: idx + 1 }); }}
                style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)',zIndex:2,
                  width:48,height:48,borderRadius:'50%',
                  background:'rgba(255,255,255,.12)',backdropFilter:'blur(8px)',
                  border:'1px solid rgba(255,255,255,.18)',color:'white',
                  fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ›
              </button>
            )}

            <img src={current} alt=""
              onClick={e => e.stopPropagation()}
              style={{maxWidth:'90vw',maxHeight:'80vh',borderRadius:14,
                boxShadow:'0 8px 48px rgba(0,0,0,.6)',objectFit:'contain'}}/>

            <div style={{display:'flex',gap:12,marginTop:20,alignItems:'center'}}
              onClick={e=>e.stopPropagation()}>
              {total > 1 && (
                <div style={{
                  background:'rgba(255,255,255,.12)',borderRadius:50,padding:'8px 14px',
                  color:'rgba(255,255,255,.85)',fontSize:13,fontWeight:600,
                }}>
                  {idx + 1} / {total}
                </div>
              )}
              <a href={current} download
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
        );
      })()}

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
    } catch(e) { heyToast(e.message, 'error'); }
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
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [showBusinessRequest, setShowBusinessRequest] = useState(false);
  const [businessNote, setBusinessNote] = useState('');
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [notifPerm, setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Password change
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showPwds,     setShowPwds]     = useState(false); // показывать ли пароли в текст-режиме
  const [oldPwd,   setOldPwd]   = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [newPwd2,  setNewPwd2]  = useState('');
  const [pwdErr,   setPwdErr]   = useState('');
  const [pwdSaving,setPwdSaving]= useState(false);
  const [toast,    setToast]    = useState('');

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword,    setDeletePassword]    = useState('');
  const [deleteErr,         setDeleteErr]         = useState('');
  const [deleting,          setDeleting]          = useState(false);

  // Esc — закрыть верхнюю модалку
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (showDeleteAccount) { setShowDeleteAccount(false); return; }
      if (showPwdModal)      { setShowPwdModal(false);      return; }
      if (showBlacklist)     { setShowBlacklist(false);     return; }
      if (showFeedback)      { setShowFeedback(false);      return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteAccount, showPwdModal, showBlacklist, showFeedback]);

  async function submitDeleteAccount() {
    setDeleteErr('');
    if (!deletePassword) { setDeleteErr('Введите пароль'); return; }
    setDeleting(true);
    try {
      await api.deleteAccount(deletePassword);
      // WS event 'account:deleted' will trigger logout in AuthContext
    } catch(e) {
      setDeleteErr(e.message || 'Ошибка');
      setDeleting(false);
    }
  }

  function showSettingsToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const [pushBusy, setPushBusy] = useState(false);

  async function enablePush() {
    if (!isPushSupported()) {
      showSettingsToast('Браузер не поддерживает push-уведомления');
      return;
    }
    setPushBusy(true);
    try {
      const res = await subscribeToPush();
      setNotifPerm(Notification.permission);
      if (res.ok) showSettingsToast('✓ Push-уведомления включены');
      else if (res.reason === 'denied') showSettingsToast('Разрешите уведомления в настройках браузера');
      else showSettingsToast('Не удалось включить: ' + res.reason);
    } catch (e) {
      showSettingsToast('Ошибка: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      showSettingsToast('Push отключены на этом устройстве');
    } catch (e) {
      showSettingsToast('Ошибка: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function testPush() {
    setPushBusy(true);
    try {
      const r = await api.pushTest();
      if (r.sent > 0) showSettingsToast(`✓ Тест отправлен (${r.sent})`);
      else showSettingsToast('Нет активных подписок');
    } catch (e) {
      showSettingsToast('Ошибка теста: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function submitPasswordChange() {
    setPwdErr('');
    if (!oldPwd || !newPwd || !newPwd2) { setPwdErr('Заполните все поля'); return; }
    if (newPwd !== newPwd2) { setPwdErr('Новые пароли не совпадают'); return; }
    if (newPwd.length < 8) { setPwdErr('Пароль минимум 8 символов'); return; }
    setPwdSaving(true);
    try {
      await api.changePassword(oldPwd, newPwd);
      setShowPwdModal(false);
      setOldPwd(''); setNewPwd(''); setNewPwd2('');
      showSettingsToast('✓ Пароль изменён');
    } catch(e) { setPwdErr(e.message || 'Ошибка'); }
    setPwdSaving(false);
  }

  // Shared row style
  function Row({ icon, label, sub, onClick, chevron = true, danger = false }) {
    return (
      <button onClick={onClick} style={{
        width:'100%', display:'flex', alignItems:'center', gap:14,
        padding:'13px 18px', background:'none', border:'none',
        color: danger ? 'rgba(255,170,170,1)' : 'white',
        fontSize:14, fontWeight: danger ? 600 : 500,
        cursor:'pointer', textAlign:'left', fontFamily:'inherit',
        transition:'background .12s',
      }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,flexShrink:0,color:danger?'rgba(255,170,170,1)':'rgba(255,255,255,.85)'}}>{typeof icon === 'string' ? <span style={{fontSize:18}}>{icon}</span> : icon}</span>
        <div style={{flex:1}}>
          <div>{label}</div>
          {sub && <div style={{fontSize:12,color:'rgba(255,255,255,.65)',marginTop:1}}>{sub}</div>}
        </div>
        {chevron && <span style={{color:'rgba(255,255,255,.5)',fontSize:18}}>›</span>}
      </button>
    );
  }

  const cardStyle = {
    background:'rgba(255,255,255,.06)', borderRadius:16,
    border:'1px solid rgba(255,255,255,.08)', overflow:'hidden',
  };
  const dividerStyle = { borderBottom:'1px solid rgba(255,255,255,.05)' };
  const sectionLabelStyle = {
    color:'rgba(255,255,255,.7)', fontSize:11, fontWeight:700,
    textTransform:'uppercase', letterSpacing:.8, marginBottom:8, paddingLeft:4,
  };

  return (
    <div style={{minHeight:'100vh', background:'var(--grad)', paddingBottom:80}}>

      {/* Sticky header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--topbar)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{maxWidth:680, margin:'0 auto', padding:'14px 20px',
          display:'flex', alignItems:'center', gap:12}}>
          <button onClick={() => nav(-1)} style={{
            background:'rgba(255,255,255,.1)', border:'none', borderRadius:50,
            width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
            color:'white', fontSize:20, cursor:'pointer', flexShrink:0, lineHeight:1,
            fontFamily:'inherit',
          }}>‹</button>
          <div style={{color:'white', fontSize:20, fontWeight:800, letterSpacing:-.3}}>Настройки</div>
        </div>
      </div>

      <div style={{maxWidth:680, margin:'0 auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:20}}>

        {/* Аккаунт */}
        <div>
          <div style={sectionLabelStyle}>Аккаунт</div>
          <div style={cardStyle}>
            <div style={dividerStyle}>
              <Row icon="📱" label="Телефон" sub={user?.phone || '—'} onClick={() => {}} chevron={false}/>
            </div>
            <Row icon="🔑" label="Сменить пароль"
              onClick={() => { setShowPwdModal(true); setPwdErr(''); }}/>
          </div>
        </div>

        {/* Приложение */}
        <div>
          <div style={sectionLabelStyle}>Приложение</div>
          <div style={cardStyle}>

            {/* Оповещения — раскрываемая строка */}
            <div style={dividerStyle}>
              <button onClick={() => setShowNotif(v => !v)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:14,
                padding:'13px 18px', background:'none', border:'none',
                color:'white', fontSize:14, fontWeight:500, cursor:'pointer',
                textAlign:'left', fontFamily:'inherit', transition:'background .12s',
              }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,color:'rgba(255,255,255,.85)'}}><Icon name="bell" size={18}/></span>
                <div style={{flex:1}}>
                  <div>Оповещения</div>
                  <div style={{fontSize:12, marginTop:1, fontWeight:500,
                    color: notifPerm==='granted' ? 'rgba(110,235,150,.95)' :
                           notifPerm==='denied'  ? 'rgba(255,160,160,.95)' : 'rgba(255,255,255,.6)'}}>
                    {notifPerm==='granted' ? 'Включены' :
                     notifPerm==='denied'  ? 'Заблокированы в браузере' : 'Не настроены'}
                  </div>
                </div>
                <span style={{color:'rgba(255,255,255,.3)', fontSize:18, transition:'transform .2s',
                  display:'inline-block',
                  transform: showNotif ? 'rotate(90deg)' : 'none'}}>›</span>
              </button>
              {showNotif && (
                <div style={{padding:'4px 18px 14px', display:'flex', flexDirection:'column', gap:10}}>
                  <div style={{color:'rgba(255,255,255,.78)', fontSize:13, lineHeight:1.6}}>
                    Получайте push-уведомления о новых сообщениях, даже когда HEY свёрнут или вкладка закрыта.
                  </div>
                  <button onClick={() => nav('/help#notifications')}
                    style={{
                      alignSelf:'flex-start',
                      background:'rgba(120,90,200,.18)',
                      border:'1px solid rgba(180,140,220,.35)',
                      borderRadius:10, padding:'7px 14px',
                      color:'rgba(220,200,255,.95)', fontSize:12, fontWeight:600,
                      cursor:'pointer', fontFamily:'inherit',
                      display:'flex', alignItems:'center', gap:6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(120,90,200,.32)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(120,90,200,.18)'}>
                    <Icon name="book" size={14}/>
                    <span>Подробная инструкция по браузерам</span>
                    <span style={{opacity:.6}}>→</span>
                  </button>
                  {notifPerm === 'unsupported' && (
                    <div style={{color:'rgba(255,210,120,.95)', fontSize:13}}>
                      Браузер не поддерживает уведомления
                    </div>
                  )}
                  {notifPerm === 'denied' && (
                    <div style={{color:'rgba(255,160,160,.95)', fontSize:13, fontWeight:500}}>
                      Разрешите уведомления в настройках браузера для этого сайта и перезагрузите страницу.
                    </div>
                  )}
                  {(notifPerm === 'default' || (notifPerm === 'granted' && !pushBusy)) && (
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <button onClick={enablePush} disabled={pushBusy} style={{
                        background:'rgba(120,90,200,.75)', border:'none',
                        borderRadius:50, padding:'9px 20px', color:'white',
                        fontSize:13, fontWeight:600, cursor: pushBusy ? 'wait' : 'pointer',
                        fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                      }}>
                        {pushBusy ? 'Подключаю…' :
                         notifPerm === 'granted' ? 'Переподключить' : 'Включить уведомления'}
                      </button>
                      {notifPerm === 'granted' && (
                        <>
                          <button onClick={testPush} disabled={pushBusy} style={{
                            background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)',
                            borderRadius:50, padding:'9px 16px', color:'rgba(255,255,255,.85)',
                            fontSize:13, cursor: pushBusy ? 'wait' : 'pointer',
                            fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                          }}>
                            ✉ Тест
                          </button>
                          <button onClick={disablePush} disabled={pushBusy} style={{
                            background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.55)',
                            borderRadius:50, padding:'9px 16px', color:'rgba(255,180,180,.95)',
                            fontSize:13, cursor: pushBusy ? 'wait' : 'pointer',
                            fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                          }}>
                            Отключить
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {notifPerm === 'granted' && (
                    <div style={{display:'flex', alignItems:'center', gap:8, marginTop:4}}>
                      <div style={{width:8, height:8, borderRadius:'50%', background:'#2ecc71',
                        boxShadow:'0 0 6px rgba(46,204,113,.5)'}}/>
                      <span style={{color:'rgba(255,255,255,.65)', fontSize:12}}>
                        Подписка активна. Отключить можно отдельно на этом устройстве.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={dividerStyle}>
              <Row icon={<Icon name="ban" size={18}/>} label="Чёрный список" onClick={() => setShowBlacklist(true)}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="book" size={18}/>} label="Руководство" sub="Все функции HEY с поиском"
                onClick={() => nav('/help')}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="chat" size={18}/>} label="Написать разработчику" onClick={() => setShowFeedback(true)}/>
            </div>
            {/* Бизнес-аккаунт: только если у юзера ещё нет approved + он не админ */}
            {!user?.is_admin && user?.business_status === 'approved' && (
              <Row icon={<Icon name="users" size={18}/>} label="Мои школы (АВО)"
                sub="Интеграции с АвтоВебОфис" onClick={() => nav('/integrations/awo')}/>
            )}
            {!user?.is_admin && (user?.business_status === 'none' || !user?.business_status) && (
              <Row icon={<Icon name="users" size={18}/>}
                label="Стать бизнес-пользователем"
                sub="Подключение АВО, свои школы и курсы"
                onClick={() => setShowBusinessRequest(true)}/>
            )}
            {!user?.is_admin && user?.business_status === 'pending' && (
              <div style={{padding:'14px 16px',color:'rgba(255,200,120,.9)',fontSize:13,
                display:'flex',alignItems:'center',gap:10}}>
                🕓 Заявка на бизнес-доступ отправлена. Админ рассмотрит её и откроет «Мои школы».
                <button onClick={async () => {
                  if (!await customConfirm('Отозвать заявку?')) return;
                  try { await api.cancelBusinessRequest(); setUser(u => ({ ...u, business_status: 'none' })); }
                  catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
                }} style={{
                  background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.18)',
                  color:'rgba(225,220,245,.9)',padding:'4px 10px',borderRadius:8,
                  fontSize:11,cursor:'pointer',fontFamily:'inherit',
                }}>Отозвать</button>
              </div>
            )}
            {!user?.is_admin && user?.business_status === 'rejected' && (
              <div style={{padding:'14px 16px',color:'rgba(255,160,160,.85)',fontSize:13,lineHeight:1.5}}>
                ⚠ Заявка отклонена{user?.business_reject_reason ? `: ${user.business_reject_reason}` : ''}.
                {' '}
                <button onClick={() => setShowBusinessRequest(true)} style={{
                  background:'none',border:'none',color:'rgba(180,140,255,1)',
                  fontSize:13,cursor:'pointer',padding:0,fontFamily:'inherit',
                  textDecoration:'underline',
                }}>Отправить новую заявку</button>
              </div>
            )}
          </div>
        </div>

        {/* Выйти */}
        <button onClick={async () => {
          if (await customConfirm('Выйти из аккаунта?')) { logout(); nav('/login'); }
        }} style={{
          padding:'14px', borderRadius:14, cursor:'pointer',
          background:'rgba(200,60,60,.42)', border:'1px solid rgba(255,140,140,.55)',
          color:'rgba(255,225,225,1)', fontSize:15, fontWeight:600,
          transition:'background .15s', fontFamily:'inherit',
        }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(200,60,60,.62)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(200,60,60,.42)'}>
          Выйти из аккаунта
        </button>

        {/* Удалить аккаунт */}
        <button onClick={() => { setShowDeleteAccount(true); setDeletePassword(''); setDeleteErr(''); }}
          style={{
            padding:'14px', borderRadius:14, cursor:'pointer',
            background:'rgba(255,50,50,.08)', border:'1px solid rgba(255,80,80,.4)',
            color:'rgba(255,160,160,.95)', fontSize:13, fontWeight:600,
            transition:'all .15s', fontFamily:'inherit',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,50,50,.18)'; e.currentTarget.style.color='rgba(255,180,180,1)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,50,50,.08)'; e.currentTarget.style.color='rgba(255,160,160,.95)'; }}>
          Удалить аккаунт и все данные
        </button>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)', backdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50, padding:'10px 20px',
          color:'white', fontSize:14, fontWeight:600,
          zIndex:1000, whiteSpace:'nowrap',
        }}>
          {toast}
        </div>
      )}

      {showBlacklist && <BlacklistModal onClose={() => setShowBlacklist(false)} />}
      {showFeedback  && <FeedbackModal  onClose={() => setShowFeedback(false)}  />}

      {showBusinessRequest && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.72)',
          backdropFilter:'blur(16px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setShowBusinessRequest(false); }}>
          <div style={{background:'rgba(22,15,50,.98)',borderRadius:18,
            border:'1px solid rgba(255,255,255,.14)',
            width:'min(94vw, 460px)',padding:'24px 26px',
            boxShadow:'0 20px 60px rgba(0,0,0,.55)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <span style={{fontSize:26}}>🎓</span>
              <h2 style={{margin:0,color:'white',fontSize:18,fontWeight:800}}>
                Заявка на бизнес-доступ
              </h2>
            </div>
            <p style={{color:'rgba(225,220,245,.85)',fontSize:13,lineHeight:1.55,marginTop:0,marginBottom:14}}>
              После одобрения админом ты сможешь создавать школы, привязывать
              интеграции с АвтоВебОфис, маппить курсы на групповые чаты —
              своих, где ты админ.
            </p>
            <div style={{color:'rgba(225,220,245,.75)',fontSize:12,fontWeight:700,
              textTransform:'uppercase',letterSpacing:.6,marginBottom:6}}>
              Расскажи о себе (необязательно)
            </div>
            <textarea value={businessNote} onChange={e => setBusinessNote(e.target.value.slice(0, 500))}
              placeholder="Например: онлайн-школа театра, 200 учеников, продажи через АвтоВебОфис"
              rows={4}
              style={{
                width:'100%',boxSizing:'border-box',
                background:'rgba(0,0,0,.4)',border:'1px solid rgba(255,255,255,.18)',
                borderRadius:10,padding:'10px 12px',color:'white',fontSize:13,
                fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.5,
              }}/>
            <div style={{color:'rgba(225,220,245,.55)',fontSize:11,marginTop:4,textAlign:'right'}}>
              {businessNote.length}/500
            </div>
            <div style={{display:'flex',gap:10,marginTop:18}}>
              <button onClick={() => setShowBusinessRequest(false)} disabled={businessSubmitting}
                style={{flex:1,padding:'11px',borderRadius:12,
                  border:'1px solid rgba(255,255,255,.18)',
                  background:'rgba(255,255,255,.06)',color:'rgba(225,220,245,.9)',
                  fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                Отмена
              </button>
              <button disabled={businessSubmitting}
                onClick={async () => {
                  setBusinessSubmitting(true);
                  try {
                    await api.requestBusinessAccess(businessNote || null);
                    setUser(u => ({ ...u, business_status: 'pending' }));
                    setShowBusinessRequest(false);
                    setBusinessNote('');
                    heyToast('Заявка отправлена. Админ её рассмотрит.', 'success');
                  } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
                  setBusinessSubmitting(false);
                }}
                style={{flex:1,padding:'11px',borderRadius:12,border:'none',
                  background:'rgba(140,110,220,.9)',color:'white',
                  fontSize:14,fontWeight:700,cursor:businessSubmitting?'wait':'pointer',
                  fontFamily:'inherit',boxShadow:'0 4px 14px rgba(120,90,200,.35)'}}>
                {businessSubmitting ? '…' : 'Отправить заявку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal}

      {/* Delete account modal */}
      {showDeleteAccount && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.72)',
          backdropFilter:'blur(16px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setShowDeleteAccount(false); }}>
          <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
            borderRadius:22,width:'min(100%,420px)',padding:'28px 24px',
            boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(255,100,100,.2)'}}>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:36,marginBottom:10}}>⚠️</div>
              <div style={{color:'rgba(255,140,140,.95)',fontSize:18,fontWeight:700,marginBottom:8}}>
                Удалить аккаунт?
              </div>
              <div style={{color:'rgba(255,255,255,.5)',fontSize:13,lineHeight:1.6}}>
                Все данные будут удалены навсегда — сообщения, моменты, профиль.
                Те, кто с тобой общался, увидят «Пользователь удалил аккаунт».
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:6}}>
                Введите пароль для подтверждения:
              </div>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteErr(''); }}
                placeholder="Пароль"
                autoFocus
                style={{
                  width:'100%', boxSizing:'border-box',
                  background:'rgba(255,255,255,.07)',
                  border:`1px solid ${deleteErr ? 'rgba(255,100,100,.6)' : 'rgba(255,255,255,.14)'}`,
                  borderRadius:12, padding:'11px 14px', color:'white', fontSize:14,
                  fontFamily:'inherit', outline:'none',
                }}
              />
              {deleteErr && (
                <div style={{color:'rgba(255,140,140,.85)',fontSize:12,marginTop:6}}>{deleteErr}</div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setShowDeleteAccount(false)} style={{
                flex:1, padding:'12px', borderRadius:12,
                background:'rgba(255,255,255,.08)', border:'none',
                color:'rgba(255,255,255,.6)', fontSize:14, fontWeight:600, cursor:'pointer',
                fontFamily:'inherit',
              }}>
                Отмена
              </button>
              <button onClick={submitDeleteAccount} disabled={!deletePassword || deleting} style={{
                flex:1, padding:'12px', borderRadius:12,
                background: deletePassword && !deleting ? 'rgba(220,50,50,.85)' : 'rgba(255,255,255,.07)',
                border:'none',
                color: deletePassword && !deleting ? 'white' : 'rgba(255,255,255,.3)',
                fontSize:14, fontWeight:700, cursor: deletePassword && !deleting ? 'pointer' : 'not-allowed',
                fontFamily:'inherit',
              }}>
                {deleting ? 'Удаляем…' : 'Удалить навсегда'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password change modal */}
      {showPwdModal && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.6)',
          backdropFilter:'blur(10px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setShowPwdModal(false); }}>
          <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
            borderRadius:24,width:'min(100%,420px)',
            boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(255,255,255,.1)',
            overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',padding:'16px 20px',
              borderBottom:'1px solid rgba(255,255,255,.08)'}}>
              <span style={{color:'white',fontSize:17,fontWeight:700,flex:1}}>🔑 Смена пароля</span>
              <button onClick={()=>setShowPwdModal(false)} style={{background:'none',border:'none',
                color:'rgba(255,255,255,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
              {[
                { label:'Текущий пароль', value:oldPwd,  set:setOldPwd  },
                { label:'Новый пароль',   value:newPwd,  set:setNewPwd  },
                { label:'Повторите новый',value:newPwd2, set:setNewPwd2 },
              ].map(f => (
                <div key={f.label}>
                  <div style={{color:'rgba(255,255,255,.5)',fontSize:12,marginBottom:5}}>{f.label}</div>
                  <div style={{position:'relative'}}>
                    <input type={showPwds ? 'text' : 'password'} value={f.value}
                      onChange={e=>f.set(e.target.value)}
                      className="ul-input" placeholder="••••••••"
                      style={{paddingRight:38}}
                      onKeyDown={e=>e.key==='Enter'&&submitPasswordChange()}/>
                    {f.label === 'Текущий пароль' && (
                      <button type="button" onClick={() => setShowPwds(s => !s)}
                        title={showPwds ? 'Скрыть пароли' : 'Показать пароли'}
                        style={{
                          position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                          background:'none', border:'none', cursor:'pointer',
                          color:'rgba(255,255,255,.55)', fontSize:18, lineHeight:1,
                          padding:6, borderRadius:6,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.9)'}
                        onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.55)'}>
                        <Icon name={showPwds ? 'eye-off' : 'eye'} size={18}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pwdErr && (
                <div style={{color:'rgba(255,140,140,.9)',fontSize:13,
                  background:'rgba(200,50,50,.12)',borderRadius:10,padding:'8px 12px'}}>
                  {pwdErr}
                </div>
              )}
            </div>
            <div style={{padding:'4px 20px 20px'}}>
              <button onClick={submitPasswordChange} disabled={pwdSaving}
                style={{width:'100%',padding:'13px',borderRadius:50,fontSize:15,fontWeight:700,
                  cursor:pwdSaving?'not-allowed':'pointer',border:'none',color:'white',
                  background:pwdSaving?'rgba(255,255,255,.1)':'rgba(120,90,200,.85)',
                  transition:'all .2s',fontFamily:'inherit',
                  boxShadow:pwdSaving?'none':'0 4px 20px rgba(120,80,200,.35)'}}>
                {pwdSaving ? 'Сохраняем…' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MomentPage — /moments/:id  (standalone page, opened via share link)
// ─────────────────────────────────────────────────────────────────────────────

export function MomentPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myReaction, setMyReaction] = useState(null);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    api.getMoment(id)
      .then(m => { setMoment(m); setMyReaction(m.myReaction || null); })
      .catch(() => setMoment(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // Считаем просмотр только когда юзер залогинен и это не его момент
    if (moment && user && moment.user_id !== user.id) {
      api.viewMoment(moment.id).catch(() => {});
    }
  }, [moment?.id, user?.id]);

  async function handleReact(reaction) {
    if (reacting || !moment) return;
    setReacting(true);
    try {
      if (myReaction === reaction) {
        await api.unreactMoment(moment.id);
        setMyReaction(null);
      } else {
        const res = await api.reactMoment(moment.id, reaction);
        setMyReaction(reaction);
        if (reaction === 'talk' && res.chatId) {
          nav(`/chat/${res.chatId}`);
          return;
        }
      }
      const fresh = await api.getMoment(moment.id);
      setMoment(fresh);
    } catch {}
    setReacting(false);
  }

  async function handleChat() {
    try {
      const conv = await api.openConversation(moment.user_id);
      nav(`/chat/${conv.id}`);
    } catch {}
  }

  function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleDateString('ru', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }

  const isMine = moment?.user_id === user?.id;
  const REACTIONS = [
    { id: 'see',      label: 'Вижу',       iconName: 'eye' },
    { id: 'resonate', label: 'Резонирует', iconName: 'sparkle' },
    { id: 'talk',     label: 'Поговорить', iconName: 'chat' },
  ];

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', display:'flex',
      alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,.4)', fontSize:14 }}>
      Загрузка…
    </div>
  );

  if (!moment) return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ fontSize:48 }}>🤷</div>
      <div style={{ color:'white', fontSize:18, fontWeight:700 }}>Момент не найден</div>
      <div style={{ color:'rgba(255,255,255,.4)', fontSize:13 }}>Он мог быть удалён или перенесён в архив</div>
      <button onClick={() => nav('/main')}
        style={{ padding:'10px 24px', borderRadius:50, background:'rgba(255,255,255,.12)',
          border:'1px solid rgba(255,255,255,.2)', color:'white', fontSize:14, cursor:'pointer' }}>
        На главную
      </button>
    </div>
  );

  const hasMedia = !!moment.media_url;

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', paddingBottom:40 }}>
      {/* Header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--topbar)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{ maxWidth:680, margin:'0 auto', padding:'14px 20px',
          display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => user ? nav(-1) : nav('/')} style={{
            background:'none', border:'none', color:'white', fontSize:24,
            cursor:'pointer', lineHeight:1, padding:'0 6px', opacity:.7 }}>‹</button>
          <div style={{ color:'white', fontSize:18, fontWeight:700, flex:1 }}>
            {user ? 'Момент' : '✦ HEY · Момент'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 20px 0' }}>
        <div style={{
          background:'rgba(22,15,50,.98)', borderRadius:24,
          border:'1px solid rgba(255,255,255,.1)',
          overflow:'hidden',
          boxShadow:'0 8px 48px rgba(0,0,0,.4)',
        }}>
          {/* Media */}
          {hasMedia && (
            <div style={{ background:'#0a0518' }}>
              {moment.media_type === 'image' && (
                <img src={moment.media_url} alt=""
                  style={{ width:'100%', maxHeight:'55vw', objectFit:'contain', display:'block' }}/>
              )}
              {moment.media_type === 'video' && (
                <video src={moment.media_url} controls
                  style={{ width:'100%', display:'block', background:'#000' }}/>
              )}
              {moment.media_type === 'audio' && (
                <div style={{ padding:'28px 22px 24px', display:'flex', flexDirection:'column', gap:14,
                  background:'linear-gradient(135deg,#1a0a38,#2a1858)' }}>
                  <div style={{ fontSize:34, textAlign:'center', opacity:.9 }}>🎵</div>
                  <AudioPlayer url={moment.media_url}
                    duration={moment.media_duration} wide={true}/>
                </div>
              )}
            </div>
          )}

          <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
            {/* Author */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:40, height:40, borderRadius:'50%', flexShrink:0,
                background:'rgba(180,140,220,.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, color:'white', fontWeight:600,
                overflow:'hidden',
              }}>
                {moment.author_avatar
                  ? <img src={moment.author_avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : (moment.author_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color:'white', fontSize:15, fontWeight:600 }}>{moment.author_name}</div>
                <div style={{ color:'rgba(255,255,255,.4)', fontSize:12 }}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{ marginLeft:6, opacity:.6 }}>· редактировалось</span>}
                </div>
              </div>
            </div>

            {/* Auto tags */}
            {moment.auto_tags?.length > 0 && (
              <div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {moment.auto_tags.map(tag => (
                    <span key={tag} style={{
                      border:'1px dashed rgba(255,255,255,.25)', borderRadius:20,
                      padding:'3px 10px', fontSize:12, color:'rgba(255,255,255,.5)',
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{ color:'rgba(255,255,255,.25)', fontSize:10, marginTop:4 }}>подобрано автоматически</div>
              </div>
            )}

            {/* Text */}
            <div style={{ color:'rgba(255,255,255,.9)', fontSize:15, lineHeight:1.7,
              whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              <TextWithLinks text={moment.text}/>
            </div>

            {/* Search flag */}
            {moment.is_search && (
              <div style={{ background:'rgba(60,140,100,.18)', border:'1px solid rgba(80,180,120,.25)',
                borderRadius:12, padding:'10px 14px', color:'rgba(120,220,160,.9)', fontSize:13 }}>
                🤝 Автор ищет людей, идеи или возможности
              </div>
            )}

            {/* Analytics / Reactions */}
            {isMine ? (
              <div style={{ background:'rgba(255,255,255,.06)', borderRadius:14, padding:'12px 16px',
                display:'flex', gap:20 }}>
                <span style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>👁 {moment.views || 0}</span>
                <span style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>✨ {moment.stats?.resonate || 0} резонирует</span>
                <span style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>🤝 {moment.stats?.talk || 0}</span>
              </div>
            ) : user ? (
              <>
                <div>
                  <div style={{ color:'rgba(255,255,255,.45)', fontSize:12, marginBottom:10,
                    textTransform:'uppercase', letterSpacing:.5 }}>Отклик</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {REACTIONS.map(r => (
                      <button key={r.id} onClick={() => handleReact(r.id)}
                        style={{
                          flex:1, padding:'11px 0', borderRadius:14, fontSize:13, fontWeight:600,
                          cursor:'pointer', transition:'all .18s',
                          background: myReaction===r.id ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
                          border: myReaction===r.id ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(255,255,255,.12)',
                          color: myReaction===r.id ? 'white' : 'rgba(255,255,255,.7)',
                        }}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={r.iconName} size={17}/></div>
                        <div style={{ fontSize:11, marginTop:2 }}>{r.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleChat}
                  style={{ width:'100%', padding:'13px', borderRadius:14,
                    background:'rgba(100,78,148,.75)', border:'none',
                    color:'white', fontSize:15, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8}}><Icon name="chat" size={16}/> Написать {moment.author_name?.split(' ')[0]}</span>
                </button>
              </>
            ) : (
              /* Аноним — приглашение залогиниться/зарегистрироваться */
              <div style={{
                background:'linear-gradient(135deg, rgba(120,90,200,.18), rgba(180,140,220,.08))',
                border:'1px solid rgba(180,140,220,.3)',
                borderRadius:16, padding:'18px 18px',
                display:'flex', flexDirection:'column', gap:12,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:24}}>✦</span>
                  <div>
                    <div style={{color:'white',fontSize:15,fontWeight:700,marginBottom:2}}>
                      Это HEY — приватный мессенджер
                    </div>
                    <div style={{color:'rgba(255,255,255,.6)',fontSize:13,lineHeight:1.45}}>
                      Войди, чтобы поддержать момент и написать автору
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button onClick={() => nav('/login')}
                    style={{
                      flex:1,padding:'12px',borderRadius:12,
                      background:'rgba(120,90,200,.85)',border:'none',color:'white',
                      fontSize:14,fontWeight:700,cursor:'pointer',
                    }}>
                    Войти
                  </button>
                  <button onClick={() => nav('/register')}
                    style={{
                      flex:1,padding:'12px',borderRadius:12,
                      background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                      color:'white',fontSize:14,fontWeight:600,cursor:'pointer',
                    }}>
                    Регистрация
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PublicProfileScreen — /profile/:id
// ─────────────────────────────────────────────────────────────────────────────

export function PublicProfileScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [momentPopupIdx, setMomentPopupIdx] = useState(null);

  useEffect(() => {
    api.getUserProfile(id)
      .then(p => { setProfile(p); setAdded(p.is_contact); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddContact() {
    if (!profile) return;
    setAdding(true);
    try {
      await api.addContact({ userId: profile.id });
      setAdded(true);
    } catch {}
    setAdding(false);
  }

  async function openChat() {
    try {
      const { id: convId } = await api.openConversation(profile.id);
      nav(`/chat/${convId}`);
    } catch {}
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',
      alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.4)',fontSize:14}}>
      Загрузка…
    </div>
  );

  if (notFound) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:16}}>
      <div style={{fontSize:48}}>🤷</div>
      <div style={{color:'white',fontSize:18,fontWeight:700}}>Профиль не найден</div>
      <button onClick={() => nav(-1)}
        style={{padding:'10px 24px',borderRadius:50,background:'rgba(255,255,255,.12)',
          border:'1px solid rgba(255,255,255,.2)',color:'white',fontSize:14,cursor:'pointer'}}>
        Назад
      </button>
    </div>
  );

  const isOnline = profile?.presence?.online;
  const lastSeen = profile?.presence?.last_seen;
  const isMe = profile?.id === me?.id;

  function fmtLastSeen(ts) {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts * 1000) / 60000);
    if (diff < 1)  return 'только что';
    if (diff < 60) return `${diff} мин. назад`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h} ч. назад`;
    return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'short' });
  }

  const moment = profile?.active_moment;

  return (
    <div style={{minHeight:'100vh',background:'var(--grad)',paddingBottom:60}}>
      {/* Header */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'14px 20px',
          display:'flex',alignItems:'center',gap:12}}>
          <button onClick={() => nav(-1)} style={{
            background:'none',border:'none',color:'white',fontSize:24,
            cursor:'pointer',lineHeight:1,padding:'0 6px',opacity:.7}}>‹</button>
          <div style={{color:'white',fontSize:18,fontWeight:700,flex:1}}>{profile?.name}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',
              background: isOnline ? '#4ade80' : 'rgba(255,255,255,.25)'}}/>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:12,
              display:'flex',alignItems:'center',gap:4}}
              title={!me?.is_super && !isOnline ? 'Точное время визита видно в ✦ Super' : ''}>
              <span>
                {isOnline
                  ? 'онлайн'
                  : me?.is_super
                    ? (lastSeen ? fmtLastSeen(lastSeen) : 'не в сети')
                    : 'не в сети'}
              </span>
              {!isOnline && me?.is_super && lastSeen && (
                <span style={{
                  background:'rgba(180,140,255,.18)',
                  border:'1px solid rgba(180,140,255,.35)',
                  borderRadius:8,padding:'1px 5px',
                  fontSize:9,color:'rgba(220,200,255,.85)',
                  fontWeight:700,letterSpacing:.3,
                }}>✦</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',padding:'28px 24px 0'}}>

        {/* Avatar + name */}
        <div style={{display:'flex',gap:20,alignItems:'center',marginBottom:28}}>
          <div style={{
            width:84,height:84,borderRadius:'50%',flexShrink:0,
            background:'rgba(180,140,220,.35)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:36,overflow:'hidden',
            boxShadow:'0 4px 20px rgba(120,80,200,.3)',
          }}>
            {profile?.avatar
              ? <img src={profile.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (profile?.name?.[0] || '?')}
          </div>
          <div>
            <div style={{color:'white',fontSize:22,fontWeight:800,letterSpacing:-.3}}>{profile?.name}</div>
            {profile?.created_at && (
              <div style={{color:'rgba(255,255,255,.35)',fontSize:12,marginTop:4}}>
                В HEY с {new Date(profile.created_at * 1000).toLocaleDateString('ru',{month:'long',year:'numeric'})}
              </div>
            )}
            <AchievementBadges achievements={profile?.achievements} />
          </div>
        </div>

        {/* Bio — описание */}
        {profile?.bio && (
          <div style={{
            background:'rgba(255,255,255,.05)', borderRadius:14,
            border:'1px solid rgba(255,255,255,.08)', padding:'12px 16px',
            color:'rgba(255,255,255,.75)', fontSize:14, lineHeight:1.6,
            marginBottom:20,wordBreak:'break-word',whiteSpace:'pre-wrap',
          }}>
            <BioWithLinks text={profile.bio}/>
          </div>
        )}

        {/* Actions */}
        {!isMe && (
          <div style={{display:'flex',gap:10,marginBottom:28}}>
            <button onClick={openChat} style={{
              flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:700,cursor:'pointer',
              background:'rgba(120,90,200,.8)',border:'1px solid rgba(180,140,220,.4)',
              color:'white',transition:'all .18s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.9)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.8)'}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="chat" size={16}/> Написать</span>
            </button>
            {!added && (
              <button onClick={handleAddContact} disabled={adding} style={{
                flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:600,cursor:'pointer',
                background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.15)',
                color:'white',transition:'all .18s',
                opacity: adding ? .6 : 1,
              }}>
                {adding ? '…' : '➕ Добавить'}
              </button>
            )}
            {added && (
              <div style={{
                flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:600,
                background:'rgba(46,204,113,.15)',border:'1px solid rgba(46,204,113,.35)',
                color:'rgba(180,255,200,.8)',textAlign:'center',
              }}>✓ В контактах</div>
            )}
          </div>
        )}

        {/* Active moments — карточки квадратные как в ленте */}
        {(() => {
          const activeMoments = profile?.active_moments || (moment ? [moment] : []);
          if (activeMoments.length === 0) {
            return (
              <div style={{
                background:'rgba(255,255,255,.04)',borderRadius:16,
                padding:'24px',textAlign:'center',
                border:'2px dashed rgba(255,255,255,.1)',
                color:'rgba(255,255,255,.3)',fontSize:13,marginBottom:24,
              }}>
                Нет активного момента
              </div>
            );
          }
          return (
            <div style={{marginBottom:24}}>
              <div style={{color:'rgba(255,255,255,.4)',fontSize:11,textTransform:'uppercase',
                letterSpacing:.8,marginBottom:12}}>
                {activeMoments.length === 1 ? 'Активный момент' : `Активные моменты · ${activeMoments.length}`}
              </div>
              {/* Grid: 1 — на всю ширину; 2-3 — по две в ряд (для Super) */}
              <div style={{
                display:'grid',
                gridTemplateColumns: activeMoments.length === 1
                  ? 'minmax(0, 240px)'
                  : 'repeat(auto-fill, minmax(160px, 1fr))',
                gap:12,
              }}>
                {activeMoments.map((m, idx) => {
                  // Готовим объект для MomentCard — добавляем author_* поля из профиля
                  const enriched = {
                    ...m,
                    author_name:   profile.name,
                    author_avatar: profile.avatar,
                    author_is_super: profile.is_super,
                    user_id: profile.id,
                  };
                  return (
                    <div key={m.id} onClick={() => setMomentPopupIdx(idx)}>
                      <MomentCard
                        moment={enriched}
                        isMine={false}
                        onClick={() => setMomentPopupIdx(idx)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Moment detail popup */}
      {momentPopupIdx !== null && (() => {
        const list = (profile?.active_moments || (moment ? [moment] : []))
          .map(m => ({
            ...m,
            author_name: profile?.name,
            author_avatar: profile?.avatar,
            author_is_super: profile?.is_super,
            user_id: profile?.id,
          }));
        if (!list.length) return null;
        return (
          <MomentDetailPopup
            moments={list}
            initialIndex={momentPopupIdx}
            currentUser={me}
            onClose={() => setMomentPopupIdx(null)}
            onEdit={() => {}}
            onArchive={() => {}}
            onDelete={() => {}}
          />
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ForcePasswordModal — shown when admin reset password (must_change_password=1)
// Cannot be closed without changing password
// ─────────────────────────────────────────────────────────────────────────────

export function ForcePasswordModal({ onDone }) {
  const [newPwd,  setNewPwd]  = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [err,     setErr]     = useState('');
  const [saving,  setSaving]  = useState(false);
  const [show1,   setShow1]   = useState(false);
  const [show2,   setShow2]   = useState(false);
  const { setUser } = useAuth();

  async function handleChange() {
    setErr('');
    if (!newPwd || !newPwd2) { setErr('Заполните оба поля'); return; }
    if (newPwd !== newPwd2)  { setErr('Пароли не совпадают'); return; }
    if (newPwd.length < 8)   { setErr('Минимум 8 символов'); return; }
    setSaving(true);
    try {
      // Use a known placeholder for old password — admin already reset it
      await api.changePassword('__admin_reset__', newPwd);
      // Refresh user to clear must_change_password flag
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      onDone();
    } catch(e) {
      setErr(e.message || 'Ошибка');
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(10,5,25,.92)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: 'rgba(38,28,68,.98)', borderRadius: 22,
        width: '100%', maxWidth: 380, padding: '28px 26px 24px',
        boxShadow: '0 30px 80px rgba(0,0,0,.7)',
        border: '1px solid rgba(255,255,255,.1)'
      }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🔑</div>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Смените пароль
        </div>
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, textAlign: 'center', marginBottom: 22, lineHeight: 1.5 }}>
          Администратор выдал вам временный пароль. Придумайте новый, чтобы продолжить.
        </div>

        {/* New password */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={show1 ? 'text' : 'password'}
            placeholder="Новый пароль"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.2)', borderRadius: 14,
              padding: '13px 46px 13px 16px', color: 'white', fontSize: 15,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(180,140,220,.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.2)'}
          />
          <button type="button" onClick={() => setShow1(s => !s)} style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
            cursor: 'pointer', fontSize: 17, fontFamily: 'inherit'
          }}><Icon name={show1 ? 'eye-off' : 'eye'} size={18}/></button>
        </div>

        {/* Confirm password */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type={show2 ? 'text' : 'password'}
            placeholder="Повторите пароль"
            value={newPwd2}
            onChange={e => setNewPwd2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChange()}
            style={{
              width: '100%', background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.2)', borderRadius: 14,
              padding: '13px 46px 13px 16px', color: 'white', fontSize: 15,
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(180,140,220,.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.2)'}
          />
          <button type="button" onClick={() => setShow2(s => !s)} style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
            cursor: 'pointer', fontSize: 17, fontFamily: 'inherit'
          }}><Icon name={show2 ? 'eye-off' : 'eye'} size={18}/></button>
        </div>

        {err && (
          <div style={{
            background: 'rgba(220,60,60,.18)', border: '1px solid rgba(255,120,120,.35)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 14,
            color: 'white', fontSize: 13, textAlign: 'center'
          }}>{err}</div>
        )}

        <button
          onClick={handleChange}
          disabled={saving}
          className="auth-btn-primary"
        >
          {saving ? 'Сохраняем…' : 'Установить новый пароль'}
        </button>
      </div>
    </div>
  );
}
