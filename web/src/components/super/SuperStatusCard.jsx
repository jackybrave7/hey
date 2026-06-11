// SuperStatusCard.jsx — 4 states + progress bar + super expiry date
import { useState } from 'react';
import SuperInfoScreen from './SuperInfoScreen';
import HeyLogo from '../HeyLogo';

function fmtDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysLeft(ts) {
  return Math.ceil((ts * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function SuperStatusCard({ user, onInvite }) {
  const [showInfo, setShowInfo] = useState(false);

  const isSuper         = !!user?.is_super;
  const bonusClaimed    = !!user?.super_bonus_claimed;
  const expiresAt       = user?.super_expires_at || null;
  // invited_total — все зарегистрированные по моей ссылке (как в модалке «Пригласить»);
  // invited_confirmed — из них те, кто написал первое сообщение (для бонуса СУПЕР).
  const invitedTotal     = user?.invited_total ?? user?.invited_count ?? 0;
  const invitedConfirmed = user?.invited_confirmed ?? 0;
  const remainingInvites = Math.max(0, 3 - invitedTotal);
  const remainingConfirmed = Math.max(0, 3 - invitedConfirmed);

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
    border: '1px solid rgba(249,240,240,.1)',
  };

  function SuperHeader({ subtitle }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #c8a8ff, #5F4080)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}><HeyLogo size={22} color="#F9F0F0" /></div>
        <div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg, #c8a8ff, #a078e0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            ✦ HEY СУПЕР активен
          </div>
          <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 12, marginTop: 2 }}>
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
          background: 'rgba(95, 64, 128,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}><HeyLogo size={22} color="rgba(200,170,255,.85)" /></div>
        <div>
          <div style={{ color: 'rgba(249,240,240,.85)', fontSize: 16, fontWeight: 700 }}>
            HEY СУПЕР
          </div>
          <div style={{ color: 'rgba(249,240,240,.4)', fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  function ExpiryInfo() {
    if (!expiresAt) {
      return (
        <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 12, marginBottom: 12 }}>
          Все возможности разблокированы
        </div>
      );
    }
    const days = daysLeft(expiresAt);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 12 }}>
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
    const goal = 3;
    const filled = Math.min(invitedTotal / goal, 1);
    const almostDone = invitedTotal === goal - 1;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
          <div style={{ color: 'rgba(249,240,240,.78)', fontSize: 12, fontWeight: 600 }}>
            Прогресс до СУПЕР
          </div>
          <div style={{
            color: invitedTotal >= goal ? 'rgba(100,240,140,.9)' : 'rgba(200,170,255,.9)',
            fontSize: 13, fontWeight: 700,
          }}>
            {invitedTotal} / {goal}
          </div>
        </div>
        <div style={{
          height: 8, borderRadius: 4,
          background: 'rgba(249,240,240,.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${filled * 100}%`,
            borderRadius: 4,
            background: invitedTotal >= goal
              ? 'linear-gradient(90deg, rgba(60,200,100,.8), rgba(100,240,140,.9))'
              : almostDone
                ? 'linear-gradient(90deg, #ffa500, #ff6b00)'
                : 'linear-gradient(90deg, rgba(95, 64, 128,.8), rgba(180,120,255,.9))',
            transition: 'width .3s ease',
          }} />
        </div>
        <div style={{ color: 'rgba(249,240,240,.62)', fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
          {invitedTotal >= goal
            ? '🎉 Три друга по ссылке — бонус СУПЕР активируется после первого сообщения от каждого.'
            : remainingInvites > 0
              ? `Пригласите ещё ${remainingInvites} ${remainingInvites === 1 ? 'друга' : 'друзей'} — получите СУПЕР на 3 месяца`
              : null}
        </div>
        {invitedTotal > invitedConfirmed && (
          <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>
            Засчитано для бонуса: {invitedConfirmed} / {goal} — друг должен написать хотя бы одно сообщение после регистрации.
            {remainingConfirmed > 0 && invitedConfirmed < goal && (
              <span> Осталось подтвердить: {remainingConfirmed}.</span>
            )}
          </div>
        )}
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
          <ProgressBar />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={onInvite} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'rgba(95, 64, 128,.8)', border: '1px solid rgba(180,140,255,.3)',
              color:'#F9F0F0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              transition: 'all .18s',
            }}>
              🎁 Пригласи 3 друзей — получи 3 месяца СУПЕР
            </button>
            <button onClick={() => setShowInfo(true)} style={{
              width: '100%', padding: '10px', borderRadius: 12,
              background: 'transparent', border: '1px solid rgba(249,240,240,.12)',
              color: 'rgba(249,240,240,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
            background: 'rgba(249,240,240,.05)', border: '1px solid rgba(249,240,240,.08)',
            color: 'rgba(249,240,240,.45)', fontSize: 12,
          }}>
            Ты уже использовал бонус за приглашения
          </div>
          <button onClick={() => setShowInfo(true)} style={{
            width: '100%', padding: '10px', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(249,240,240,.12)',
            color: 'rgba(249,240,240,.55)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
