// SuperStatusCard.jsx — 4 states + progress bar + super expiry date
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';
import { useSalesPressure } from '../../lib/publicSettings';

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysLeft(ts) {
  return Math.ceil((ts * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function SuperStatusCard({ user, onInvite }) {
  const [showInfo, setShowInfo] = useState(false);
  const salesPressure = useSalesPressure();

  const isSuper         = !!user?.is_super;
  const bonusClaimed    = !!user?.super_bonus_claimed;
  const expiresAt       = user?.super_expires_at || null;
  const invitedCount    = user?.invited_count ?? 0;
  // L1 (мягкий): прогресс-бар появляется только начиная с 2/3 — раньше юзер
  // не должен видеть «давай-давай», пока не близок к цели.
  // L2 (жёсткий): прогресс с 0/3.
  const showProgressBar = salesPressure >= 2 ? true : invitedCount >= 2;

  // State A: is_super && !bonus_claimed
  // State B: !is_super && !bonus_claimed
  // State C: !is_super && bonus_claimed
  // State D: is_super && bonus_claimed

  const baseCardStyle = {
    borderRadius: 18,
    padding: '18px 20px',
  };

  const activeCardStyle = {
    ...baseCardStyle,
    background: 'linear-gradient(135deg, rgba(140,100,220,.4) 0%, rgba(100,60,180,.3) 100%)',
    border: '1px solid rgba(200,160,255,.3)',
  };

  const inactiveCardStyle = {
    ...baseCardStyle,
    background: 'rgba(22,15,50,.6)',
    border: '1px solid rgba(255,255,255,.1)',
  };

  function SuperHeader({ subtitle }) {
    return (
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
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  function InactiveHeader({ subtitle }) {
    return (
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
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  function ExpiryInfo() {
    if (!expiresAt) {
      return (
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginBottom: 12 }}>
          Все возможности разблокированы
        </div>
      );
    }
    const days = daysLeft(expiresAt);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12 }}>
          Активен до {fmtDate(expiresAt)}
        </div>
        {days <= 30 && days > 0 && (
          <div style={{
            marginTop: 6, padding: '5px 10px', borderRadius: 8,
            background: 'rgba(255,165,0,.15)', border: '1px solid rgba(255,165,0,.3)',
            color: '#ffa500', fontSize: 12, fontWeight: 600, display: 'inline-block',
          }}>
            Осталось {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
          </div>
        )}
      </div>
    );
  }

  function ProgressBar() {
    const filled = Math.min(invitedCount / 3, 1);
    const almostDone = invitedCount === 2;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>
            Прогресс: {invitedCount} / 3 друзей
          </div>
          {almostDone && (
            <div style={{ color: '#ffa500', fontSize: 12, fontWeight: 600 }}>
              Остался 1 шаг!
            </div>
          )}
        </div>
        <div style={{
          height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${filled * 100}%`,
            borderRadius: 3,
            background: almostDone
              ? 'linear-gradient(90deg, #ffa500, #ff6b00)'
              : 'linear-gradient(90deg, #c8a8ff, #7858b0)',
            transition: 'width .3s ease',
          }} />
        </div>
      </div>
    );
  }

  // State A: active, bonus not yet claimed.
  // Раньше тут была кнопка «Пригласи 3 друзей — активируй бонус 3 месяца»,
  // но юзеру с уже активным СУПЕР такая акция выглядит как навязывание.
  // Оставляем только статус и дату; за приглашения отвечает отдельная
  // карточка «Пригласить друга» ниже по экрану профиля.
  if (isSuper && !bonusClaimed) {
    return (
      <>
        <div style={activeCardStyle}>
          <SuperHeader subtitle="До 3 Моментов, длинные голосовые, аналитика" />
          <ExpiryInfo />
          {/* TODO: enable when payments are ready */}
          {false && <button>Продлить</button>}
        </div>
        {showInfo && (
          <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
        )}
      </>
    );
  }

  // State B: not active, bonus not yet claimed — show progress bar
  if (!isSuper && !bonusClaimed) {
    return (
      <>
        <div style={inactiveCardStyle}>
          <InactiveHeader subtitle="До 3 Моментов, длинные голосовые, аналитика" />
          {showProgressBar && <ProgressBar />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={onInvite} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'rgba(120,90,200,.8)', border: '1px solid rgba(180,140,255,.3)',
              color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              transition: 'all .18s',
            }}>
              🎁 Пригласи 3 друзей — получи 3 месяца СУПЕР
            </button>
            <button onClick={() => setShowInfo(true)} style={{
              width: '100%', padding: '10px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(255,255,255,.12)',
              color: 'rgba(255,255,255,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Узнать больше
            </button>
          </div>
          {/* TODO: enable when payments are ready */}
          {false && <button>Продлить</button>}
        </div>
        {showInfo && (
          <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
        )}
      </>
    );
  }

  // State C: not active, bonus already claimed
  if (!isSuper && bonusClaimed) {
    return (
      <>
        <div style={inactiveCardStyle}>
          <InactiveHeader subtitle="Реферальный бонус исчерпан" />
          <div style={{
            marginBottom: 12, padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            color: 'rgba(255,255,255,.45)', fontSize: 12,
          }}>
            Ты уже использовал бонус за приглашения
          </div>
          <button onClick={() => setShowInfo(true)} style={{
            width: '100%', padding: '10px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(255,255,255,.12)',
            color: 'rgba(255,255,255,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Узнать больше
          </button>
          {/* TODO: enable when payments are ready */}
          {false && <button>Продлить</button>}
        </div>
        {showInfo && (
          <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
        )}
      </>
    );
  }

  // State D: active, bonus already claimed
  return (
    <>
      <div style={activeCardStyle}>
        <SuperHeader subtitle="Реферальный бонус получен" />
        <ExpiryInfo />
        {/* TODO: enable when payments are ready */}
        {false && <button>Продлить</button>}
      </div>
      {showInfo && (
        <SuperInfoScreen onClose={() => setShowInfo(false)} onInvite={() => { setShowInfo(false); onInvite?.(); }} />
      )}
    </>
  );
}
