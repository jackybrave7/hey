// SuperStatusCard.jsx — карточка статуса СУПЕР в профиле (2 состояния)
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';

export default function SuperStatusCard({ user, onInvite }) {
  const [showInfo, setShowInfo] = useState(false);
  const isSuper = !!user?.is_super;

  if (isSuper) {
    return (
      <>
        <div style={{
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(140,100,220,.4) 0%, rgba(100,60,180,.3) 100%)',
          border: '1px solid rgba(200,160,255,.3)',
          padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #c8a8ff, #7858b0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: 'white', fontWeight: 700, flexShrink: 0,
            }}>✦</div>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                background: 'linear-gradient(135deg, #c8a8ff, #a078e0)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                ✦ HEY СУПЕР активен
              </div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 2 }}>
                Все возможности разблокированы
              </div>
            </div>
          </div>

          <button onClick={onInvite} style={{
            width: '100%', padding: '11px', borderRadius: 12,
            background: 'rgba(180,140,255,.2)', border: '1px solid rgba(180,140,255,.3)',
            color: 'rgba(200,170,255,.9)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            transition: 'all .18s',
          }}>
            🔗 Пригласить друзей и продлить
          </button>
        </div>
        {showInfo && (
          <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
        )}
      </>
    );
  }

  return (
    <>
      <div style={{
        borderRadius: 18,
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.1)',
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(120,90,200,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'rgba(200,170,255,.7)', fontWeight: 700, flexShrink: 0,
          }}>✦</div>
          <div>
            <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 16, fontWeight: 700 }}>
              HEY СУПЕР
            </div>
            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginTop: 2 }}>
              До 3 Моментов, длинные голосовые, аналитика
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onInvite} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            background: 'rgba(120,90,200,.8)', border: '1px solid rgba(180,140,255,.3)',
            color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            transition: 'all .18s',
          }}>
            🎁 Пригласи 3 друзей — получи 3 месяца
          </button>
          <button onClick={() => setShowInfo(true)} style={{
            width: '100%', padding: '10px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,.12)',
            color: 'rgba(255,255,255,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Узнать больше
          </button>
        </div>
      </div>
      {showInfo && (
        <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
      )}
    </>
  );
}
