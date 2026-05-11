// MomentCard.jsx
import MoodEmoji from './MoodEmoji';

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)   return 'только что';
  if (diff < 3600) return Math.floor(diff/60) + ' мин';
  if (diff < 86400)return Math.floor(diff/3600) + ' ч';
  return d.toLocaleDateString('ru', { day:'numeric', month:'short' });
}

// Animated audio bars overlay
function AudioBars() {
  const heights = [16, 32, 22, 40, 18, 28, 14];
  return (
    <div style={{
      position:'absolute', left:'50%', top:'50%',
      transform:'translate(-50%,-50%)',
      display:'flex', gap:4, alignItems:'center', height:50,
      zIndex:2, pointerEvents:'none',
    }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width:5, height:h,
          background:'rgba(255,255,255,.85)',
          borderRadius:2,
        }}/>
      ))}
    </div>
  );
}

export default function MomentCard({ moment, isMine, onClick }) {
  const hasMedia = !!moment.media_url;
  const preview  = (moment.text || '').slice(0, 80);

  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: isMine ? '16/9' : '3/4',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: '#1a0a30',
        flexShrink: 0,
        transition: 'transform .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}
    >
      {/* Subtle top gradient for badge readability */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,height:60,
        background:'linear-gradient(180deg,rgba(0,0,0,.35) 0%,transparent 100%)',
        zIndex:1,pointerEvents:'none',
      }}/>

      {/* Media or mood emoji */}
      {hasMedia ? (
        moment.media_type === 'image' ? (
          <img src={moment.media_url} alt=""
            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        ) : moment.media_type === 'video' ? (
          <>
            <video src={moment.media_url} muted
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            {/* Center play button */}
            <div style={{
              position:'absolute',top:'50%',left:'50%',
              transform:'translate(-50%,-50%)',
              width:48,height:48,borderRadius:'50%',
              background:'rgba(255,255,255,.92)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:18,color:'#2a1a3e',
              boxShadow:'0 6px 20px rgba(0,0,0,.4)',
              zIndex:2,pointerEvents:'none',
            }}>▶</div>
          </>
        ) : (
          /* Audio with background image or gradient + bars */
          <div style={{width:'100%',height:'100%',
            background:'linear-gradient(135deg,#1e0a40,#4a1a80,#7030b0)'}}>
            <AudioBars/>
          </div>
        )
      ) : (
        <MoodEmoji type={moment.mood_emoji || 'calm'} size={isMine ? 170 : 130}/>
      )}

      {/* Media type badge (top-right corner) */}
      {moment.media_type === 'video' && (
        <div style={{
          position:'absolute',top:10,right:10,zIndex:3,
          width:28,height:28,borderRadius:'50%',
          background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,color:'white',
        }}>▶</div>
      )}
      {moment.media_type === 'audio' && (
        <div style={{
          position:'absolute',top:10,right:10,zIndex:3,
          width:28,height:28,borderRadius:'50%',
          background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:13,color:'white',
        }}>🎧</div>
      )}

      {/* My moment badge (top-left) */}
      {isMine && (
        <div style={{
          position:'absolute',top:10,left:10,zIndex:3,
          background:'rgba(120,88,176,.85)',backdropFilter:'blur(8px)',
          borderRadius:9,padding:'3px 9px',
          fontSize:10,color:'white',fontWeight:700,
        }}>
          ✦ Мой момент
        </div>
      )}

      {/* Search badge */}
      {moment.is_search && !isMine && (
        <div style={{
          position:'absolute',top:10,right: moment.media_type ? 44 : 10,zIndex:3,
          background:'rgba(60,140,100,.75)',backdropFilter:'blur(6px)',
          borderRadius:9,padding:'3px 8px',fontSize:10,color:'white',
        }}>
          🤝 Поиск
        </div>
      )}

      {/* Glass caption */}
      <div style={{
        position:'absolute',bottom:8,left:8,right:8,zIndex:2,
        background:'rgba(20,12,40,.65)',backdropFilter:'blur(14px)',
        borderRadius:6,padding:'9px 12px',
      }}>
        {!isMine && (
          <div style={{
            color:'rgba(255,255,255,.55)',fontSize:11,fontWeight:400,
            marginBottom:3,
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
          }}>
            {moment.author_name}
          </div>
        )}
        <div style={{
          color:'white',fontSize: isMine ? 14 : 12,fontWeight:400,lineHeight:1.45,
          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,
          WebkitBoxOrient:'vertical',
        }}>
          {preview}{moment.text?.length > 80 ? '…' : ''}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4}}>
          <span style={{color:'rgba(255,255,255,.35)',fontSize:10}}>{fmtTime(moment.created_at)}</span>
          {isMine && (
            <span style={{color:'rgba(255,255,255,.35)',fontSize:10}}>
              👁 {moment.views || 0}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
