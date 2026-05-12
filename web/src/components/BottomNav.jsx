// BottomNav.jsx — нижняя навигация 4 пункта
import { useLocation, useNavigate } from 'react-router-dom';

const ITEMS = [
  { label: 'Моменты', icon: '✦', paths: ['/main', '/moments'] },
  { label: 'Чаты',    icon: '💬', paths: ['/conversations'], badgeKey: 'unread' },
  { label: 'Контакты',icon: '👥', paths: ['/contacts'] },
  { label: 'Я',       icon: null,  paths: ['/profile/me'] },
];

export default function BottomNav({ user, unread = 0 }) {
  const nav      = useNavigate();
  const location = useLocation();
  const path     = location.pathname;

  function isActive(item) {
    return item.paths.some(p => path === p || path.startsWith(p + '/'));
  }

  return (
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:500,
      background:'var(--topbar)',backdropFilter:'blur(24px)',
      borderTop:'1px solid rgba(255,255,255,.08)',
      padding:'0 0 env(safe-area-inset-bottom)',
      height:60,
    }}>
      <div style={{
        maxWidth:680,margin:'0 auto',height:'100%',
        display:'flex',alignItems:'center',
      }}>
      {ITEMS.map(item => {
        const active  = isActive(item);
        const dest    = item.paths[0];
        const isMe    = item.label === 'Я';
        const badge   = item.badgeKey === 'unread' ? unread : 0;

        return (
          <button
            key={item.label}
            onClick={() => nav(dest)}
            style={{
              flex:1,height:'100%',background:'none',border:'none',cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
              gap:3,padding:'6px 0',transition:'opacity .15s',
              opacity: active ? 1 : 0.5,
              position:'relative',
            }}
          >
            {/* Icon */}
            {isMe ? (
              <div style={{
                width:26,height:26,borderRadius:'50%',
                background: active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,fontWeight:700,
                color: active ? '#5c4f94' : 'white',
                border: active ? '2px solid rgba(255,255,255,.8)' : '2px solid transparent',
                transition:'all .2s',
              }}>
                {(user?.name || '?')[0].toUpperCase()}
              </div>
            ) : (
              <div style={{
                position:'relative',
                fontSize: item.label === 'Моменты' ? 17 : 20,
                fontWeight: item.label === 'Моменты' ? 800 : 400,
                color:'white',
                lineHeight:1,
              }}>
                {item.icon}
                {/* Unread badge */}
                {badge > 0 && (
                  <div style={{
                    position:'absolute',top:-6,right:-10,
                    background:'#e74c3c',color:'white',
                    fontSize:9,fontWeight:700,
                    minWidth:16,height:16,borderRadius:8,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    padding:'0 4px',lineHeight:1,
                    border:'1.5px solid rgba(74,63,130,.8)',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </div>
                )}
              </div>
            )}

            {/* Label */}
            <div style={{
              fontSize:10,fontWeight: active ? 700 : 400,
              color:'white',
              transition:'opacity .2s',
              letterSpacing:.1,
            }}>
              {item.label}
            </div>

            {/* Active underline dot */}
            {active && (
              <div style={{
                position:'absolute',bottom:5,
                width:20,height:2,borderRadius:1,
                background:'white',opacity:.7,
              }}/>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
}
