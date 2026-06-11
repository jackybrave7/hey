// web/src/components/auth/AuthComponents.jsx
// Shared auth UI primitives: AuthBrand, FloatingInput, PasswordInput,
// InviteBadge, ForgotPasswordPopup

import { useState } from 'react';
import HeyLogo from '../HeyLogo';

// ─── CSS injected once ────────────────────────────────────────────────────────
const AUTH_CSS = `
.auth-field { margin-bottom: 14px; position: relative; }
.auth-input {
  width: 100%; background: rgba(249,240,240,.94);
  border: 1.5px solid transparent; border-radius: 26px;
  padding: 16px 18px 10px; color: #2a1a3e; font-size: 15px;
  font-family: inherit; outline: none; box-sizing: border-box;
  transition: all .15s;
}
.auth-input:focus {
  background: #F9F0F0; border-color: rgba(95, 64, 128,.5);
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
  top: -8px; font-size: 11px; color: #5F4080;
  background: #F9F0F0; padding: 0 6px; font-weight: 600;
  border-radius: 4px; left: 14px;
}
.auth-input-eye { padding-right: 50px; }
.auth-eye-btn {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: rgba(90,74,138,.5); font-size: 17px; padding: 4px;
  line-height: 1; font-family: inherit;
}
.auth-eye-btn:hover { color: #5F4080; }
.auth-btn-primary {
  width: 100%; background: #5F4080; border: none; border-radius: 26px;
  padding: 15px; color: #F9F0F0; font-size: 15px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all .15s;
  box-shadow: 0 8px 24px rgba(95, 64, 128,.35);
}
.auth-btn-primary:hover {
  background: #735494; transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(95, 64, 128,.45);
}
.auth-btn-primary:active { transform: translateY(0); }
.auth-btn-primary:disabled {
  background: rgba(95, 64, 128,.4); cursor: not-allowed;
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
        background: 'linear-gradient(135deg, #F9F0F0 0%, #e8d8ff 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontFamily: 'Comfortaa, sans-serif'
      }}>
        <HeyLogo size={52} color="#F9F0F0" title="HEY" />
        HEY
      </div>
      <div style={{ fontSize: 15, color: 'rgba(249,240,240,.9)', fontWeight: 500, letterSpacing: .3 }}>
        Мессенджер для тех, кто творит
      </div>
    </div>
  );
}

// ─── FloatingInput ────────────────────────────────────────────────────────────
export function FloatingInput({ id, label, type = 'text', value, onChange, onKeyDown, autoComplete, inputMode, inputRef }) {
  injectCSS();
  return (
    <div className="auth-field">
      <input
        ref={inputRef}
        className="auth-input"
        id={id} type={type} placeholder=" "
        value={value} onChange={onChange} onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        inputMode={inputMode}
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
        color:'#F9F0F0', fontWeight: 700, fontSize: 15, overflow: 'hidden'
      }}>
        {avatar
          ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          : initial}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.45, color:'#F9F0F0' }}>
        <strong style={{ fontWeight: 700 }}>{name}</strong> приглашает тебя в HEY
      </div>
    </div>
  );
}

// ─── ForgotPasswordPopup ──────────────────────────────────────────────────────
export function ForgotPasswordPopup({ onClose, tgUsername }) {
  injectCSS();
  // Бот восстановления пароля. Юзер шлёт /start → делится контактом →
  // бот выдаёт разовый пароль. См. server/src/tgBot.js
  const handle = tgUsername || 'hey_messenger_support_bot';
  const [email, setEmail]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState('');

  async function submit() {
    setErr('');
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setErr('Введи корректный email');
      return;
    }
    setBusy(true);
    try {
      // Ленивый импорт api, чтобы AuthComponents не тащил циклическую зависимость
      const { api } = await import('../../api');
      await api.passwordResetRequest(v);
      setSent(true);
    } catch (e) { setErr(e.message || 'Не удалось отправить'); }
    setBusy(false);
  }

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
        border: '1px solid rgba(249,240,240,.1)'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(249,240,240,.1)', border: 'none', borderRadius: '50%',
          width: 32, height: 32, color:'#F9F0F0', fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'inherit'
        }}>✕</button>

        <div style={{ fontSize: 42, textAlign: 'center', marginBottom: 14 }}>🔑</div>
        <div style={{ color:'#F9F0F0', fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          Забыли пароль?
        </div>

        {sent ? (
          <div style={{
            color: 'rgba(220,255,220,.92)', fontSize: 14, lineHeight: 1.6,
            textAlign: 'center', marginBottom: 18,
            background: 'rgba(60,170,110,.18)', border: '1px solid rgba(110,235,150,.35)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            ✓ Если такой email есть в системе, мы отправили на него ссылку для смены пароля.
            Ссылка действительна 1 час.
          </div>
        ) : (
          <>
            <div style={{
              color: 'rgba(249,240,240,.88)', fontSize: 13, lineHeight: 1.55,
              textAlign: 'center', marginBottom: 16,
            }}>
              Если ты указал email в профиле — введи его здесь, и пришлём ссылку для сброса пароля.
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="you@example.com" autoFocus type="email"
              style={{
                width:'100%', boxSizing:'border-box', marginBottom: 12,
                background:'rgba(0,0,0,.4)', border:'1px solid rgba(249,240,240,.18)',
                borderRadius: 12, padding:'12px 14px', color:'#F9F0F0', fontSize: 14,
                fontFamily: 'inherit', outline: 'none',
              }}/>
            {err && (
              <div style={{ color:'rgba(255,140,140,.95)', fontSize: 12,
                marginBottom: 10, textAlign:'center' }}>{err}</div>
            )}
            <button onClick={submit} disabled={busy}
              style={{
                width: '100%', padding: '13px', borderRadius: 14,
                background: 'rgba(140,110,220,.95)', border: '1px solid rgba(180,140,220,.4)',
                color:'#F9F0F0', fontSize: 14, fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: busy ? .7 : 1, marginBottom: 14,
              }}>
              {busy ? 'Отправляем…' : 'Отправить ссылку на email'}
            </button>
          </>
        )}

        <div style={{
          textAlign: 'center', margin: '4px 0 10px',
          color: 'rgba(249,240,240,.75)', fontSize: 12,
        }}>
          или
        </div>
        <a
          href={`https://t.me/${handle}`} target="_blank" rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#229ED9', color:'#F9F0F0', borderRadius: 16,
            padding: 12, fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'background .15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#1a8ac0'}
          onMouseLeave={e => e.currentTarget.style.background = '#229ED9'}
        >
          <span style={{ fontSize: 16 }}>✈</span> Восстановить через Telegram-бота
        </a>
        <div style={{ textAlign:'center', marginTop: 8,
          color:'rgba(249,240,240,.8)', fontSize: 11, lineHeight: 1.5 }}>
          Бот попросит поделиться номером и сразу выдаст разовый пароль.
        </div>
      </div>
    </div>
  );
}
