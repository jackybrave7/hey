// SuperPromoBanner.jsx — мини-плашка промо СУПЕР для MomentDilemma
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';
import HeyLogo from '../HeyLogo';

export default function SuperPromoBanner({ onInvite }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, rgba(95, 64, 128,.28), rgba(80,50,160,.2))',
        border: '1px solid rgba(180,140,255,.25)',
        borderRadius: 16, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #c8a8ff, #5F4080)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HeyLogo size={20} color="#F9F0F0" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(210,180,255,.95)', fontSize: 13, fontWeight: 700 }}>
            СУПЕР — до 3 моментов одновременно
          </div>
          <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 12, marginTop: 2 }}>
            Веди разные проекты параллельно
          </div>
        </div>
        <button onClick={() => setShowInfo(true)} style={{
          flexShrink: 0, padding: '6px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700,
          background: 'rgba(180,140,255,.2)', border: '1px solid rgba(180,140,255,.35)',
          color: 'rgba(200,170,255,.9)', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          Подробнее
        </button>
      </div>
      {showInfo && (
        <SuperInfoScreen
          onClose={() => setShowInfo(false)}
          onInvite={() => { setShowInfo(false); onInvite?.(); }}
        />
      )}
    </>
  );
}
