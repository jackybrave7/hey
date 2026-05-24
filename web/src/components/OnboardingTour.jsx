// OnboardingTour.jsx — гид для новых пользователей
// Показывается после регистрации, объясняет ключевые концепции HEY.
import { useState, useEffect } from 'react';

const STEPS = [
  {
    icon: '✦',
    gradient: 'linear-gradient(135deg, #5a2d96, #7c45c7, #a87ce4)',
    title: 'Это HEY',
    body: 'Приватный мессенджер для близкого круга. Без алгоритмов, без бесконечной ленты, без рекламы.\n\nЗдесь видят тебя только те, кого ты сам добавил.',
  },
  {
    icon: '✦',
    gradient: 'linear-gradient(135deg, #2a1058, #5a2d96, #b89aff)',
    title: 'Моменты',
    body: 'Это не «посты» и не «сторис». Момент — короткая записка о том, что у тебя сейчас.\n\nЖивёт пока ты его не уберёшь. У обычных аккаунтов — один активный. У ✦ Super — до трёх.',
  },
  {
    icon: '👁',
    gradient: 'linear-gradient(135deg, #0e2a3a, #1a4a60, #4ade80)',
    title: 'Реакции — не лайки',
    body: 'На каждый момент можно отреагировать честнее, чем лайком:\n\n👁  Вижу — заметил, прочёл\n✨  Резонирует — это про меня\n🤝  Поговорить — давай обсудим',
  },
  {
    icon: '💬',
    gradient: 'linear-gradient(135deg, #3a1a5a, #6a3a9a, #c8a8ff)',
    title: 'Поговорить — открывает чат',
    body: 'Когда ставишь 🤝, у автора момент сразу превращается в приглашение в диалог. Это самый прямой способ начать разговор по сути.',
  },
  {
    icon: '🔒',
    gradient: 'linear-gradient(135deg, #1a3a3a, #2a6060, #80e0c8)',
    title: 'Только свои',
    body: 'Никакого поиска людей по системе. Добавить можно только по номеру телефона или по личной ссылке-приглашению.\n\nЛента моментов — только твои контакты.',
  },
  {
    icon: '✦',
    gradient: 'linear-gradient(135deg, #5a3a10, #a08030, #ffd070)',
    title: '✦ Super',
    body: 'Статус Super даётся за приглашение друзей или докупается. С ним:\n\n· до 3 активных моментов\n· видишь когда контакт был онлайн\n· видишь кто отреагировал\n· больше места для медиа',
  },
  {
    icon: '🚀',
    gradient: 'linear-gradient(135deg, #2a1058, #5a2d96, #a87ce4)',
    title: 'Поехали',
    body: 'Первое что стоит сделать — добавить аватарку и пару контактов.\n\nКогда у тебя появятся друзья в HEY, лента моментов оживёт.',
  },
];

export default function OnboardingTour({ onDone }) {
  const [idx, setIdx] = useState(0);
  const last = idx === STEPS.length - 1;
  const step = STEPS[idx];

  // Клавиатура: ←/→, Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if (last) onDone(); else setIdx(i => Math.min(STEPS.length - 1, i + 1));
      }
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1));
      if (e.key === 'Escape')     onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onDone]);

  // Свайп
  const [touchStart, setTouchStart] = useState(null);
  function onTouchStart(e) { setTouchStart(e.touches[0].clientX); }
  function onTouchEnd(e) {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (dx < -40 && !last) setIdx(i => i + 1);
    if (dx >  40 && idx > 0) setIdx(i => i - 1);
    setTouchStart(null);
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:10000,
      background: step.gradient,
      display:'flex', flexDirection:'column',
      transition:'background 0.5s ease',
      overflow:'hidden',
    }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}>

      {/* Skip button (top-right) */}
      <div style={{
        position:'absolute', top:14, right:14, zIndex:2,
      }}>
        <button onClick={onDone}
          style={{
            background:'rgba(0,0,0,.25)', border:'1px solid rgba(255,255,255,.15)',
            borderRadius:50, padding:'7px 14px',
            color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:600,
            cursor:'pointer', backdropFilter:'blur(8px)',
            fontFamily:'inherit',
          }}>
          Пропустить
        </button>
      </div>

      {/* Step indicator dots (top) */}
      <div style={{
        display:'flex', gap:6, justifyContent:'center',
        padding:'24px 20px 0',
      }}>
        {STEPS.map((_, i) => (
          <div key={i}
            style={{
              flex: i === idx ? 2 : 1, maxWidth: i === idx ? 36 : 16,
              height: 4, borderRadius: 4,
              background: i <= idx ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.25)',
              transition:'all .3s',
            }}/>
        ))}
      </div>

      {/* Content */}
      <div key={idx} style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'30px 28px',
        animation:'heyTourFade .45s ease-out',
      }}>
        <div style={{
          fontSize: 84, lineHeight:1,
          marginBottom: 28,
          filter:'drop-shadow(0 6px 22px rgba(0,0,0,.35))',
        }}>
          {step.icon}
        </div>

        <div style={{
          color:'white', fontSize: 30, fontWeight: 800, letterSpacing:-.5,
          textAlign:'center', marginBottom: 16,
        }}>
          {step.title}
        </div>

        <div style={{
          color:'rgba(255,255,255,.9)', fontSize: 16, lineHeight: 1.6,
          textAlign:'center', maxWidth: 420, whiteSpace:'pre-wrap',
        }}>
          {step.body}
        </div>
      </div>

      {/* Nav buttons (bottom) */}
      <div style={{
        padding:'20px 20px 36px',
        display:'flex', gap:10,
        maxWidth: 480, margin:'0 auto', width:'100%',
        boxSizing:'border-box',
      }}>
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)}
            style={{
              flex:1, padding:'14px', borderRadius:50,
              background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)',
              color:'white', fontSize:15, fontWeight:700, cursor:'pointer',
              fontFamily:'inherit', backdropFilter:'blur(6px)',
            }}>
            ‹ Назад
          </button>
        )}
        <button onClick={() => last ? onDone() : setIdx(i => i + 1)}
          style={{
            flex: idx > 0 ? 2 : 1, padding:'14px', borderRadius:50,
            background:'rgba(255,255,255,.95)', border:'none',
            color:'#2a1058', fontSize:15, fontWeight:800, cursor:'pointer',
            fontFamily:'inherit',
            boxShadow:'0 4px 16px rgba(0,0,0,.25)',
          }}>
          {last ? '✦ Поехали' : 'Дальше ›'}
        </button>
      </div>

      <style>{`
        @keyframes heyTourFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
