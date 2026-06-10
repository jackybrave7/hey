// SuperLimitPopup.jsx — попап при превышении лимита голосового (>1 мин) у бесплатных
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';
import Icon from '../Icon';

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
        border: '1px solid rgba(249,240,240,.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ marginBottom: 12, color: 'rgba(249,240,240,.85)' }}>
            <Icon name="mic" size={36} />
          </div>
          <div style={{ color:'#F9F0F0', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            Голосовое больше минуты — в СУПЕР
          </div>
          <div style={{ color: 'rgba(249,240,240,.6)', fontSize: 14, lineHeight: 1.5 }}>
            Пригласи 3 друзей в HEY и получи 3 месяца СУПЕР — разовая акция для новых пользователей.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '13px', borderRadius: 14,
            background: 'rgba(249,240,240,.08)', border: '1px solid rgba(249,240,240,.1)',
            color: 'rgba(249,240,240,.6)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Понятно
          </button>
          <button onClick={() => setShowInfo(true)} style={{
            flex: 2, padding: '13px', borderRadius: 14,
            background: 'rgba(95, 64, 128,.85)', border: '1px solid rgba(180,140,255,.3)',
            color:'#F9F0F0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            ✦ Узнать больше
          </button>
        </div>
      </div>
    </div>
  );
}
