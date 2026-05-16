// SuperLimitPopup.jsx — попап при превышении лимита голосового (>1 мин) у бесплатных
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';

export default function SuperLimitPopup({ onClose, onInvite }) {
  const [showInfo, setShowInfo] = useState(false);

  if (showInfo) {
    return (
      <SuperInfoScreen
        onClose={() => setShowInfo(false)}
        onInvite={() => { setShowInfo(false); onInvite?.(); }}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 80px',
    }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(22,15,50,.98)', backdropFilter: 'blur(24px)',
        borderRadius: '24px 24px 0 0', width: 'min(100%, 520px)',
        padding: '28px 24px 20px',
        boxShadow: '0 -8px 48px rgba(0,0,0,.5)',
        border: '1px solid rgba(255,255,255,.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎙</div>
          <div style={{ color: 'white', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            Голосовое больше минуты — в СУПЕР
          </div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.5 }}>
            Пригласи 3 друзей в HEY и получи 3 месяца бесплатно
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '13px', borderRadius: 14,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)',
            color: 'rgba(255,255,255,.6)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Понятно
          </button>
          <button onClick={() => setShowInfo(true)} style={{
            flex: 2, padding: '13px', borderRadius: 14,
            background: 'rgba(120,90,200,.85)', border: '1px solid rgba(180,140,255,.3)',
            color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            ✦ Узнать больше
          </button>
        </div>
      </div>
    </div>
  );
}
