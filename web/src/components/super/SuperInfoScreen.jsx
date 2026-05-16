// SuperInfoScreen.jsx — полноэкранный попап с информацией о HEY СУПЕР
export default function SuperInfoScreen({ onClose, onInvite }) {
  const features = [
    { icon: '✦', text: '3 момента одновременно (вместо 1)' },
    { icon: '🎙', text: 'Голосовые до 5 минут (вместо 1)' },
    { icon: '🎬', text: 'Видео в моменте до 3 минут' },
    { icon: '📊', text: 'Детальная аналитика — кто видел и резонирует' },
    { icon: '📌', text: 'До 15 закреплённых чатов' },
    { icon: '📦', text: 'Архив-портфолио с публичной ссылкой' },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(22,15,50,.98)', backdropFilter: 'blur(24px)',
        borderRadius: 24, width: 'min(100%, 480px)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 48px rgba(0,0,0,.6)',
        border: '1px solid rgba(255,255,255,.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 24px 20px',
          background: 'linear-gradient(160deg, rgba(120,80,200,.35) 0%, rgba(80,40,140,.2) 100%)',
          borderBottom: '1px solid rgba(255,255,255,.08)',
          textAlign: 'center',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, color: 'white', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>

          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c8a8ff 0%, #7858b0 100%)',
            fontSize: 28, color: 'white', fontWeight: 700,
            marginBottom: 14,
            boxShadow: '0 4px 20px rgba(120,80,200,.5)',
          }}>
            ✦
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, marginBottom: 6,
            background: 'linear-gradient(135deg, #c8a8ff, #a078e0)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            HEY СУПЕР
          </div>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 14 }}>
            Когда хочется больше
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Features list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {features.map(({ icon, text }) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(255,255,255,.05)',
                borderRadius: 14, padding: '13px 16px',
                border: '1px solid rgba(255,255,255,.07)',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Referral block */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(120,80,200,.3), rgba(80,40,140,.2))',
            border: '1px solid rgba(180,140,255,.25)',
            borderRadius: 18, padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎁</div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              Пригласи 3 друзей — получи 3 месяца
            </div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Каждый приглашённый друг даёт тебе месяц СУПЕР бесплатно
            </div>
            <button onClick={onInvite} style={{
              width: '100%', padding: '13px', borderRadius: 14,
              background: 'rgba(120,90,200,.85)', border: '1px solid rgba(180,140,255,.4)',
              color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              transition: 'all .18s',
            }}>
              🔗 Пригласить друзей
            </button>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, marginTop: 12 }}>
              Прямая покупка появится позже
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
