import { useState } from 'react';
import { api } from '../../api';
import { heyToast } from './Toast';
import { trimUrlTail } from '../chat/chatRender';

function FieldLine({ value }) {
  // Чуть жирнее значение + более явная подчёркивающая линия — чтобы строки
  // контактов читались как «данные», а не сливались с фоном профиля.
  const isEmail = typeof value === 'string' && value.includes('@');
  return (
    <div style={{ minWidth: 0, width: '100%' }}>
      <div style={{
        color:'#F9F0F0',
        fontSize: isEmail ? 15 : 17,
        fontWeight:500, paddingBottom:5,
        letterSpacing:.1,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        lineHeight: 1.35,
      }}>{value}</div>
      <div style={{ height:1, width:'100%',
        background:'rgba(210,185,240,.58)' }}/>
    </div>
  );
}

// Бейдж «✉ Подтвердите email» с кнопкой повторной отправки. Показывается
// под FieldLine в профиле, когда user.email_verified=0.
function EmailVerifyHint() {
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  async function resend() {
    if (sending) return;
    setSending(true);
    try {
      await api.resendEmailVerification();
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      try { heyToast(e.message || 'Не удалось отправить', 'error'); } catch {}
    }
    setSending(false);
  }
  return (
    <div style={{
      marginTop: 6,
      background:'rgba(255,200,80,.10)',
      border:'1px solid rgba(255,200,80,.28)',
      borderRadius: 10, padding:'8px 12px',
      display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap',
      color:'rgba(255,210,150,.92)', fontSize: 12,
    }}>
      <span style={{ fontSize: 14 }}>✉</span>
      <span style={{ flex: 1, minWidth: 120 }}>
        {done ? 'Ссылка отправлена — проверь почту' : 'Подтвердите email — мы прислали ссылку'}
      </span>
      <button onClick={resend} disabled={sending || done}
        style={{
          background:'rgba(255,200,80,.18)', border:'1px solid rgba(255,200,80,.35)',
          color:'rgba(255,220,160,.95)', borderRadius: 8,
          padding:'4px 10px', fontSize: 11, fontWeight: 600,
          cursor: sending || done ? 'default' : 'pointer', fontFamily:'inherit',
          opacity: sending || done ? .6 : 1,
        }}>
        {sending ? '…' : (done ? '✓' : 'Отправить ещё раз')}
      </button>
    </div>
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
            color:'rgba(200,225,255,1)', textDecoration:'underline',
            textDecorationColor:'rgba(200,225,255,.75)',
            textUnderlineOffset:2, textDecorationThickness:1.5,
            fontWeight:700, wordBreak:'break-all',
          }}>
          {p.t.replace(/^https?:\/\//,'')}
        </a>
      ) : <span key={i}>{p.t}</span>)}
    </>
  );
}

export { FieldLine, EmailVerifyHint, BioWithLinks };
