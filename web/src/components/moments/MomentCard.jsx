// MomentCard.jsx
import MoodEmoji from './MoodEmoji';
import EmbeddedVideoPreview from './EmbeddedVideoPreview';
import Icon from '../Icon';
import { useSalesPressure } from '../../lib/publicSettings';
import { mediaUrl } from '../../lib/mediaUrl';
import { MediaImage } from '../shared/MediaImage';

// Карта реакции юзера → иконка для бейджа над превью момента.
// Раньше показывали россыпь эмодзи (👁 ✨ 🤝) по тотал-счётчикам, что
// читалось как «у меня 2 реакции» когда было видно несколько значков.
// Теперь показываем ОДИН монохромный значок собственной реакции.
const MY_RX_ICON = { see: 'eye', resonate: 'waves', talk: 'chat' };
const MY_RX_LABEL = { see: 'Вижу', resonate: 'Резонирует', talk: 'Поговорить' };

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
          background:'rgba(249,240,240,.85)',
          borderRadius:2,
        }}/>
      ))}
    </div>
  );
}

// Перебиваем провайдер по фактическому URL — старые записи могли быть сохранены
// с неверным провайдером (до того как добавили RuTube/Kinescope).
function detectProvider(url, fallback) {
  if (!url) return fallback;
  if (/kinescope\.io/i.test(url))  return 'kinescope';
  if (/rutube\.ru/i.test(url))     return 'rutube';
  if (/(youtube\.com|youtu\.be)/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url))     return 'vimeo';
  return fallback;
}
const PROVIDER_BADGE = {
  youtube:   { label: '▶ YT',        color: '#ff4444' },
  vimeo:     { label: '● Vimeo',     color: '#1ab7ea' },
  rutube:    { label: '▶ RuTube',    color: '#ff8a3c' },
  kinescope: { label: '▶ Kinescope', color: '#b89aff' },
};

// bare=true — скрывает glass-caption (имя автора, текст, статистика) и
// бейдж «поиск». Используется в карточке контакта: там нужно только
// визуальное превью момента (фото / эмодзи / иконка музыки).
export default function MomentCard({ moment, isMine, onClick, bare }) {
  const salesPressure  = useSalesPressure();
  const hasMedia       = !!moment.media_url;
  // Считаем что embedded видео есть, если есть объект (даже без thumbnail — покажем плейсхолдер)
  const hasEmbedVideo  = !hasMedia && !!moment.embedded_video;
  const preview        = (moment.text || '').slice(0, 80);
  // На L1 (мягком) Super-авторов визуально не выделяем — не должно быть
  // никаких намёков на платный статус на главной ленте.
  const isAuthorSuper  = salesPressure >= 2 && !!moment.author_is_super;
  // Истинный провайдер с фолбэком на сохранённый
  const embedProvider = hasEmbedVideo
    ? detectProvider(moment.embedded_video.url, moment.embedded_video.provider)
    : null;
  const providerBadge = embedProvider ? PROVIDER_BADGE[embedProvider] : null;

  // Рамка: своя > Super автора > обычная
  let border = '1px solid rgba(249,240,240,.06)';
  let boxShadow = 'none';
  if (isMine) {
    border = '2px solid rgba(180,140,220,.7)';
    boxShadow = '0 0 0 1px rgba(95, 64, 128,.25), 0 4px 18px rgba(95, 64, 128,.3)';
  } else if (isAuthorSuper) {
    // Лиловая обводка для Super-авторов из ленты
    border = '2px solid rgba(200,140,255,.75)';
    boxShadow = '0 0 0 1px rgba(160,100,230,.25), 0 4px 18px rgba(160,100,230,.3)';
  }

  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: '1 / 1',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: '#1a0a30',
        flexShrink: 0,
        // Своя карточка выделяется ТОЛЬКО рамкой и значком, не размером
        border,
        boxShadow,
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
          // draggable=false + pointerEvents:none — у <img> на Android-Chrome/Opera
          // long-press запускает свой контекст «Сохранить картинку», а сам тап
          // иногда уходит в image-viewer вместо нашего onClick. Отключаем все
          // нативные жесты на самой картинке, события идут только через
          // карточку-обёртку (которая открывает MomentDetailPopup).
          <MediaImage src={moment.media_url} alt="" draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{width:'100%',height:'100%',objectFit:'cover',
              objectPosition: moment.media_position || '50% 50%',display:'block',
              pointerEvents:'none', userSelect:'none',
              WebkitUserSelect:'none', WebkitTouchCallout:'none',
              WebkitUserDrag:'none'}}/>
        ) : moment.media_type === 'video' ? (
          <>
            <video src={mediaUrl(moment.media_url)} muted playsInline preload="metadata"
              onContextMenu={e => e.preventDefault()}
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                pointerEvents:'none', WebkitTouchCallout:'none'}}/>
            {/* Center play button */}
            <div style={{
              position:'absolute',top:'50%',left:'50%',
              transform:'translate(-50%,-50%)',
              width:48,height:48,borderRadius:'50%',
              background:'rgba(249,240,240,.92)',
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
      ) : hasEmbedVideo ? (
        /* Embedded video thumbnail as card background */
        <>
          {moment.embedded_video.thumbnail_url && (
            <MediaImage src={moment.embedded_video.thumbnail_url} alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                background:'linear-gradient(135deg,#1e0a40,#4a1a80,#7030b0)'}}/>
          )}
          {!moment.embedded_video.thumbnail_url && (
            <div style={{width:'100%',height:'100%',
              background:'linear-gradient(135deg,#1e0a40,#4a1a80,#7030b0)'}}/>
          )}
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.22)'}}/>
          {/* 🎬 показываем ТОЛЬКО когда нет обложки — иначе это водяной
              знак поверх нормальной превьюшки и пользователь жалуется. */}
          {!moment.embedded_video.thumbnail_url && (
            <div style={{
              position:'absolute',top:'50%',left:'50%',
              transform:'translate(-50%,-50%)',fontSize:42,
              opacity:.35,color:'#F9F0F0',pointerEvents:'none',
            }}>🎬</div>
          )}
        </>
      ) : (
        // Эмодзи-момент должен зрительно занимать ту же площадь, что и
        // фото/видео-момент. Раньше size=130px давал маленький кругляш
        // посреди карточки — теперь fill масштабирует SVG по ширине плитки.
        <MoodEmoji type={moment.mood_emoji || 'calm'} fill/>
      )}

      {/* Media type badge (top-right corner) */}
      {moment.media_type === 'video' && (
        <div style={{
          position:'absolute',top:10,right:10,zIndex:3,
          width:28,height:28,borderRadius:'50%',
          background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:11,color:'#F9F0F0',
        }}>▶</div>
      )}
      {moment.media_type === 'audio' && (
        <div style={{
          position:'absolute',top:10,right:10,zIndex:3,
          width:28,height:28,borderRadius:'50%',
          background:'rgba(0,0,0,.55)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:13,color:'#F9F0F0',
        }}>🎧</div>
      )}
      {/* Embedded video badge */}
      {hasEmbedVideo && providerBadge && !bare && (
        <div style={{
          position:'absolute',top:10,right:10,zIndex:3,
          background:'rgba(0,0,0,.65)',backdropFilter:'blur(8px)',
          borderRadius:20,padding:'3px 8px',
          fontSize:10,fontWeight:700,
          color: providerBadge.color,
          whiteSpace:'nowrap',
        }}>
          {providerBadge.label}
        </div>
      )}



      {/* Search badge */}
      {moment.is_search && !isMine && !bare && (
        <div style={{
          position:'absolute',top:10,right: moment.media_type ? 44 : 10,zIndex:3,
          background:'rgba(60,140,100,.75)',backdropFilter:'blur(6px)',
          borderRadius:9,padding:'3px 8px',fontSize:10,color:'#F9F0F0',
        }}>
          🤝 Поиск
        </div>
      )}

      {/* Glass caption — только для чужих моментов; на своих ничего не перекрывает превью */}
      {!isMine && !bare && (
        <div style={{
          position:'absolute',bottom:8,left:8,right:8,zIndex:2,
          background:'rgba(20,12,40,.65)',backdropFilter:'blur(14px)',
          borderRadius:6,padding:'9px 12px',
        }}>
          <div style={{
            display:'flex',alignItems:'center',gap:6,marginBottom:4,
            overflow:'hidden',
          }}>
            {/* Аватар автора — фото или буква */}
            <div style={{
              width:18,height:18,borderRadius:'50%',flexShrink:0,
              background:'rgba(200,160,210,.45)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:10,color:'#F9F0F0',fontWeight:700,
              overflow:'hidden',
              border:'1px solid rgba(249,240,240,.2)',
            }}>
              {moment.author_avatar && (moment.author_avatar.startsWith('/') ||
                                        moment.author_avatar.startsWith('http') ||
                                        moment.author_avatar.startsWith('data:'))
                ? <MediaImage src={moment.author_avatar} alt=""
                    style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : (moment.author_name || '?')[0].toUpperCase()}
            </div>
            <span style={{
              color:'rgba(249,240,240,.75)',fontSize:11,fontWeight:500,
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
            }}>
              {moment.author_name}
            </span>
          </div>
          <div style={{
            color:'#F9F0F0',fontSize:12,fontWeight:400,lineHeight:1.45,
            overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,
            WebkitBoxOrient:'vertical',
          }}>
            {preview}{moment.text?.length > 80 ? '…' : ''}
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4}}>
            <span style={{color:'rgba(249,240,240,.35)',fontSize:10}}>{fmtTime(moment.created_at)}</span>
            {moment.myReaction && MY_RX_ICON[moment.myReaction] && (
              <span title={MY_RX_LABEL[moment.myReaction] || ''}
                style={{
                  display:'inline-flex', alignItems:'center', gap: 4,
                  color:'rgba(220,200,255,.95)', fontSize: 11, fontWeight: 600,
                  background:'rgba(140,110,220,.22)', borderRadius: 50,
                  padding:'2px 8px',
                }}>
                <Icon name={MY_RX_ICON[moment.myReaction]} size={12}/>
              </span>
            )}
          </div>
        </div>
      )}

      {/* На своих моментах — компактный счётчик просмотров в углу */}
      {isMine && !bare && (moment.views > 0 || moment.stats?.resonate > 0 || moment.stats?.talk > 0) && (
        <div style={{
          position:'absolute',bottom:8,left:8,zIndex:2,
          background:'rgba(20,12,40,.6)',backdropFilter:'blur(10px)',
          borderRadius:50,padding:'4px 10px',
          display:'flex',alignItems:'center',gap:8,
          fontSize:11,color:'rgba(249,240,240,.85)',
        }}>
          {moment.views > 0          && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eye"     size={12}/>{moment.views}</span>}
          {moment.stats?.resonate > 0 && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="waves" size={12}/>{moment.stats.resonate}</span>}
          {moment.stats?.talk > 0     && <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Icon name="chat"    size={12}/>{moment.stats.talk}</span>}
        </div>
      )}
    </div>
  );
}
