// web/src/components/auth/AuthComponents.jsx
// Shared auth UI primitives: AuthBrand, FloatingInput, PasswordInput,
// InviteBadge, ForgotPasswordPopup

import { useState } from 'react';

// ─── CSS injected once ────────────────────────────────────────────────────────
const AUTH_CSS = `
.auth-field { margin-bottom: 14px; position: relative; }
.auth-input {
  width: 100%; background: rgba(255,255,255,.94);
  border: 1.5px solid transparent; border-radius: 26px;
  padding: 16px 18px 10px; color: #2a1a3e; font-size: 15px;
  font-family: inherit; outline: none; box-sizing: border-box;
  transition: all .15s;
}
.auth-input:focus {
  background: white; border-color: rgba(120,88,176,.5);
  box-shadow: 0 0 0 4px rgba(160,100,255,.15);
}
.auth-label {
  position: absolute; top: 14px; left: 18px;
  font-size: 15px; color: rgba(90,74,138,.55);
  pointer-events: none; transition: all .15s;
  font-weight: 400; font-family: inherit;
}
.auth-input:focus + .auth-label,
.auth-input:not(:placeholder-shown) + .auth-label {
  top: -8px; font-size: 11px; color: #7858b0;
  background: white; padding: 0 6px; font-weight: 600;
  border-radius: 4px; left: 14px;
}
.auth-input-eye { padding-right: 50px; }
.auth-eye-btn {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: rgba(90,74,138,.5); font-size: 17px; padding: 4px;
  line-height: 1; font-family: inherit;
}
.auth-eye-btn:hover { color: #7858b0; }
.auth-btn-primary {
  width: 100%; background: #7858b0; border: none; border-radius: 26px;
  padding: 15px; color: white; font-size: 15px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all .15s;
  box-shadow: 0 8px 24px rgba(120,88,176,.35);
}
.auth-btn-primary:hover {
  background: #8868c0; transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(120,88,176,.45);
}
.auth-btn-primary:active { transform: translateY(0); }
.auth-btn-primary:disabled {
  background: rgba(120,88,176,.4); cursor: not-allowed;
  transform: none; box-shadow: none;
}
@keyframes authFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
.auth-fadein { animation: authFadeUp .55s ease-out both; }
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = AUTH_CSS;
  document.head.appendChild(s);
}

// ─── AuthBrand ────────────────────────────────────────────────────────────────
export function AuthBrand({ delay = 0 }) {
  injectCSS();
  return (
    <div className="auth-fadein" style={{
      textAlign: 'center', marginBottom: 40,
      animationDelay: delay + 's'
    }}>
      <div style={{
        fontSize: 58, fontWeight: 700, letterSpacing: -2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        marginBottom: 8,
        background: 'linear-gradient(135deg, #ffffff 0%, #e8d8ff 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontFamily: 'Comfortaa, sans-serif'
      }}>
        <span style={{
          background: 'linear-gradient(135deg,#ffffff,#c8a8ff)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>✦</span>
        HEY
      </div>
      <div style={{ fontSize: 15, color: 'rgba(255,255,255,.72)', fontWeight: 400, letterSpacing: .3 }}>
        Мессенджер для тех, кто творит
      </div>
    </div>
  );
}

// ─── FloatingInput ────────────────────────────────────────────────────────────
export function FloatingInput({ id, label, type = 'text', value, onChange, onKeyDown, autoComplete }) {
  injectCSS();
  return (
    <div className="auth-field">
      <input
        className="auth-input"
        id={id} type={type} placeholder=" "
        value={value} onChange={onChange} onKeyDown={onKeyDown}
        autoComplete={autoComplete}
      />
      <label className="auth-label" htmlFor={id}>{label}</label>
    </div>
  );
}

// ─── PasswordInput ────────────────────────────────────────────────────────────
export function PasswordInput({ id, label, value, onChange, onKeyDown }) {
  injectCSS();
  const [show, setShow] = useState(false);
  return (
    <div className="auth-field" style={{ position: 'relative' }}>
      <input
        className="auth-input auth-input-eye"
        id={id} type={show ? 'text' : 'password'} placeholder=" "
        value={value} onChange={onChange} onKeyDown={onKeyDown}
        autoComplete="current-password"
      />
      <label className="auth-label" htmlFor={id}>{label}</label>
      <button className="auth-eye-btn" type="button" onClick={() => setShow(s => !s)}>
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}

// ─── InviteBadge ─────────────────────────────────────────────────────────────
export function InviteBadge({ name, avatar }) {
  injectCSS();
  const initial = name ? name[0].toUpperCase() : '?';
  return (
    <div className="auth-fadein" style={{
      background: 'rgba(160,100,255,.2)', border: '1px solid rgba(180,140,255,.45)',
      borderRadius: 16, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      maxWidth: 380, margin: '0 auto 24px', animationDelay: '.1s'
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: avatar ? 'transparent' : 'linear-gradient(135deg,#e090c0,#c060a0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 15, overflow: 'hidden'
      }}>
        {avatar
          ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : initial}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'white' }}>
        <strong style={{ fontWeight: 700 }}>{name}</strong> приглашает тебя в HEY
      </div>
    </div>
  );
}

// ─── ForgotPasswordPopup ──────────────────────────────────────────────────────
export function ForgotPasswordPopup({ onClose, tgUsername }) {
  injectCSS();
  const handle = tgUsername || 'hey_support';
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(20,10,40,.78)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(38,28,68,.98)', borderRadius: 22,
        width: '100%', maxWidth: 380, padding: '28px 26px 24px',
        position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        border: '1px solid rgba(255,255,255,.1)'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%',
          width: 32, height: 32, color: 'white', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit'
        }}>✕</button>

        <div style={{ fontSize: 42, textAlign: 'center', marginBottom: 14 }}>🔑</div>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          Забыли пароль?
        </div>
        <div style={{
          color: 'rgba(255,255,255,.68)', fontSize: 14, lineHeight: 1.6,
          textAlign: 'center', marginBottom: 22
        }}>
          Свяжись с администратором HEY — мы выпустим тебе новый пароль и поможем войти.
        </div>
        <a
          href={`https://t.me/${handle}`} target="_blank" rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#229ED9', color: 'white', borderRadius: 16,
            padding: 14, fontSize: 14, fontWeight: 600, textDecoration: 'none',
            transition: 'background .15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1a8ac0'}
          onMouseLeave={e => e.currentTarget.style.background = '#229ED9'}
        >
          <span style={{ fontSize: 18 }}>✈</span> Написать в Telegram
        </a>
        <div style={{ textAlign: 'center', marginTop: 14, color: 'rgba(255,255,255,.38)', fontSize: 11 }}>
          Обычно отвечаем в течение часа
        </div>
      </div>
    </div>
  );
}
