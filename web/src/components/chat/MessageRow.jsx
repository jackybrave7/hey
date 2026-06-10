import { useEffect, useRef, useState, memo } from 'react';
import Icon from '../Icon';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { AudioPlayer } from './AudioPlayer';
import HeyLogo from '../HeyLogo';
import EmbeddedVideoPreview from '../moments/EmbeddedVideoPreview';
import { HEY_EMOJI_SET, emojiUrl } from '../../lib/heyEmoji';
import { openUserCard } from '../../lib/openUserCard';
import GroupInvitePreview from './GroupInvitePreview';
import { fmtTime } from '../../lib/formatTime';
import { fileTypeIcon, AttachmentPreview } from '../../lib/fileTypeIcon';
import { mediaUrl } from '../../lib/mediaUrl';
import { renderPreviewWithEmoji } from './chatRender';

function rxSig(reactions) {
  if (!reactions || !Object.keys(reactions).length) return '0';
  return Object.keys(reactions).sort().map(emoji => {
    const ids = (reactions[emoji] || [])
      .map(r => (typeof r === 'string' ? r : r?.id))
      .filter(Boolean)
      .join(',');
    return `${emoji}:${ids}`;
  }).join('|');
}

const MessageRow = memo(function MessageRow({
  m, isOut, isGroup, editingMsgId, reactionPickerMsgId,
  partnerName, currentUserId, isFlashing,
  onOpenMenu, onLightbox, onToggleReaction, onSetReactionPicker, onOpenMomentRef,
  statusIcon, renderText,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverOffTimer = useRef(null);
  // На десктопе показываем кнопку по hover, на touch/WebView — по тапу
  // на пузырь. Right-click / long-press открывает меню.
  const [tappedReveal, setTappedReveal] = useState(false);
  const isDeleted = Number(m.is_deleted) === 1;
  const canHover = typeof window !== 'undefined'
    && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const showReactBtn = !isOut && !isDeleted
    && (isHovered || (!canHover && tappedReveal) || reactionPickerMsgId === m.id);
  const hasReactions = m.reactions && Object.keys(m.reactions).length > 0;
  const deletedLabel = isOut
    ? 'Вы удалили сообщение'
    : `${m.sender_name || 'Участник'} удалил(а) сообщение`;

  useEffect(() => () => {
    if (hoverOffTimer.current) clearTimeout(hoverOffTimer.current);
  }, []);

  const keepHovered = () => {
    if (hoverOffTimer.current) {
      clearTimeout(hoverOffTimer.current);
      hoverOffTimer.current = null;
    }
    setIsHovered(true);
  };

  const releaseHovered = (e) => {
    const row = e.currentTarget;
    const next = e.relatedTarget;
    if (next && row.contains(next)) return;
    const rect = row.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    const stillInside = Number.isFinite(x) && Number.isFinite(y)
      && x >= rect.left - 8 && x <= rect.right + 8
      && y >= rect.top - 8 && y <= rect.bottom + 8;
    if (stillInside) return;
    hoverOffTimer.current = setTimeout(() => setIsHovered(false), 120);
  };

  return (
    <div
      style={{display:'flex', alignItems:'flex-end', gap:4,
        justifyContent: isOut ? 'flex-end':'flex-start',
        // width:100% + minWidth:0 — критично для мобилы: без width row
        // принимает natural-content-width и не знает где «правый край»,
        // поэтому 36-px смайл-слот вылезает за экран. С width:100% row
        // знает рамки и flex-shrink правильно ужимает пузырь.
        width:'100%', minWidth:0, boxSizing:'border-box',
        marginBottom: hasReactions ? 12 : 8}}
      onContextMenu={(e) => onOpenMenu(e, m)}>

      {/* Аватар отправителя — только в группах для входящих сообщений.
          Кликается → открывает карточку контакта. В direct-чатах аватар
          собеседника висит в шапке, дублировать на каждом пузыре излишне. */}
      {isGroup && !isOut && (
        <div
          onClick={(e) => { e.stopPropagation(); openUserCard(m.sender_id); }}
          title={m.sender_name || 'Открыть профиль'}
          style={{ flexShrink:0, alignSelf:'flex-start', marginTop:6, cursor:'pointer' }}>
          <AvatarDisplay
            avatar={m.sender_avatar}
            name={m.sender_name}
            size={28}
            fontSize={12}
          />
        </div>
      )}


      <div style={{display:'flex', flexDirection:'column',
        alignItems: isOut ? 'flex-end' : 'flex-start',
        // Жёсткий пиксельный cap (без CSS min() — на случай нестандартного
        // поведения flex-min-content). Достаточно для всех нормальных
        // viewport'ов, на узких мобилках всё равно ограничится width родителя.
        maxWidth: 540, minWidth: 0}}
        onMouseEnter={keepHovered}
        onMouseMove={keepHovered}
        onMouseLeave={releaseHovered}>
        <div
          key={isFlashing ? 'flash-' + m.id : m.id}
          className={isFlashing ? 'hey-flash' : ''}
          onClick={(e) => {
            // Тап по пузырю на мобилке открывает «smile»-кнопку для реакции.
            // На десктопе hover уже работает — двойного действия не будет
            // потому что на десктопе isHovered=true и кнопка и так видна.
            // Селект текста и клик по ссылкам не ломаем: игнорируем клики
            // если внутри пузыря выделен текст или клик пришёл с <a>.
            if (isOut || canHover) return;
            const sel = window.getSelection?.();
            if (sel && sel.toString().length > 0) return;
            if (e.target.closest && e.target.closest('a,button,img[role="button"]')) return;
            setTappedReveal(v => !v);
          }}
          style={{
            background: editingMsgId === m.id
              ? 'rgba(160,120,210,.85)'
              : isOut ? 'rgba(110,80,155,.70)' : 'rgba(249,240,240,.90)',
            borderRadius: isOut ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
            padding:'10px 13px 6px',
            color: isOut ? '#F9F0F0' : '#2a2040',
            fontSize:14, lineHeight:'1.5',
            transition:'background .2s',
            // Подстраховка на сам пузырь — даже если родитель почему-то даст
            // больше, сам bubble не вырастет шире.
            maxWidth: '100%',
            minWidth: 0,
            wordBreak: 'break-word',
            cursor: !isOut ? 'pointer' : 'default',
          }}>
          {isGroup && !isOut && !isDeleted && (
            <div
              onClick={(e) => { e.stopPropagation(); openUserCard(m.sender_id); }}
              style={{fontSize:12,fontWeight:700,color:'rgba(180,130,255,1)',marginBottom:4,
                cursor:'pointer',display:'inline-block',
                textShadow:'0 1px 2px rgba(0,0,0,.25)'}}>
              {m.sender_name}
            </div>
          )}
          {isDeleted ? (
            <div style={{
              fontSize: 13, fontStyle: 'italic', lineHeight: 1.45,
              color: isOut ? 'rgba(249,240,240,.55)' : 'rgba(80,60,120,.55)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="delete" size={14} />
              <span>{deletedLabel}</span>
            </div>
          ) : (<>
          {/* Forwarded-from label */}
          {m.forwarded_from && (
            <div style={{
              fontSize:11, fontWeight:600,
              color: isOut ? 'rgba(249,240,240,.7)' : 'rgba(120,90,180,.85)',
              marginBottom:4, display:'flex', alignItems:'center', gap:4,
            }}>
              <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <Icon name="forward" size={11} /> Переслано от
              </span>
              <span style={{fontWeight:700}}>{m.forwarded_from.name}</span>
            </div>
          )}
          {/* Quoted reply */}
          {m.reply_to && (() => {
            const previewText = (m.reply_to.text || '').slice(0, 100);
            const attType = m.reply_to.attachment_type;
            const isImg  = attType === 'image' || attType === 'images';
            const accent = isOut ? 'rgba(249,240,240,.85)' : 'rgba(95, 64, 128,.85)';
            const subtxt = isOut ? 'rgba(249,240,240,.7)' : 'rgba(80,60,120,.85)';
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  // Скролл к оригинальному сообщению (если оно в текущем списке)
                  window.dispatchEvent(new CustomEvent('hey:scroll-to-msg', { detail: m.reply_to.id }));
                }}
                title="Перейти к сообщению"
                style={{
                  display:'flex', gap:8, padding:'6px 8px',
                  marginBottom: 6,
                  background: isOut ? 'rgba(249,240,240,.12)' : 'rgba(95, 64, 128,.1)',
                  borderRadius: 8,
                  borderLeft: `3px solid ${accent}`,
                  cursor:'pointer',
                  transition:'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.2)' : 'rgba(95, 64, 128,.18)'}
                onMouseLeave={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.12)' : 'rgba(95, 64, 128,.1)'}>
                {isImg && m.reply_to.attachment_url && (
                  <img src={mediaUrl(m.reply_to.attachment_url)} alt=""
                    style={{
                      width:36, height:36, objectFit:'cover', borderRadius:6,
                      flexShrink:0,
                    }}/>
                )}
                <div style={{flex:1, minWidth:0}}>
                  <div style={{
                    fontSize:11, fontWeight:700, color: accent,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>
                    ↩ {m.reply_to.sender_name || '…'}
                  </div>
                  <div style={{
                    fontSize:12, color: subtxt,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>
                    {m.reply_to.is_deleted || attType === 'deleted'
                      ? 'Удалённое сообщение'
                      : previewText
                        ? renderPreviewWithEmoji(previewText)
                        : attType
                          ? <AttachmentPreview type={attType} size={12} />
                          : '…'}
                  </div>
                </div>
              </div>
            );
          })()}
          {m.attachment?.type === 'image' && (() => {
            const src = mediaUrl(m.attachment.url);
            if (!src) return (
              <div style={{padding:'10px 0',fontSize:13,opacity:.5}}>
                🖼 Изображение недоступно
              </div>
            );
            return (
              <img src={src} alt="" referrerPolicy="no-referrer" decoding="async"
                onClick={() => onLightbox(src, [src])}
                style={{maxWidth:'100%',maxHeight:300,borderRadius:10,
                  display:'block',marginBottom: m.text ? 6 : 2,
                  cursor:'zoom-in'}}/>
            );
          })()}
          {m.attachment?.type === 'images' && Array.isArray(m.attachment.urls) && (() => {
            const urls = m.attachment.urls.filter(Boolean).map(mediaUrl);
            if (!urls.length) return null;
            // Сетка: 1 → одна большая; 2 → две в ряд; 3-4 → 2x2; 5+ → 3 колонки
            const cols = urls.length === 1 ? 1
                       : urls.length === 2 ? 2
                       : urls.length <= 4 ? 2 : 3;
            return (
              <div style={{
                display:'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 4,
                marginBottom: m.text ? 6 : 2,
                maxWidth: 360,
              }}>
                {urls.map((u, i) => (
                  <img key={i} src={u} alt=""
                    onClick={() => onLightbox(u, urls)}
                    style={{
                      width:'100%', aspectRatio:'1 / 1',
                      objectFit:'cover', borderRadius:8,
                      display:'block', cursor:'zoom-in',
                    }}/>
                ))}
              </div>
            );
          })()}
          {m.attachment?.type === 'audio' && (
            <AudioPlayer
              url={m.attachment.url}
              duration={m.attachment.duration}
              isOut={isOut}
            />
          )}
          {m.attachment?.type === 'file' && (
            <a href={m.attachment.url} target="_blank" rel="noreferrer" download={m.attachment.name}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:10, marginBottom: m.text ? 6 : 2,
                background: isOut ? 'rgba(249,240,240,.12)' : 'rgba(0,0,0,.18)',
                border:'1px solid rgba(249,240,240,.1)',
                color:'inherit', textDecoration:'none', maxWidth:300,
              }}
              onMouseEnter={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.18)' : 'rgba(0,0,0,.25)'}
              onMouseLeave={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.12)' : 'rgba(0,0,0,.18)'}>
              <span style={{flexShrink:0,lineHeight:1,display:'inline-flex'}}>
                {fileTypeIcon(m.attachment.name, m.attachment.mime, 28)}
              </span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,overflow:'hidden',
                  textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {m.attachment.name || 'Файл'}
                </div>
                <div style={{fontSize:11,opacity:.6,marginTop:2}}>
                  {m.attachment.size != null ? (
                    m.attachment.size < 1024 ? m.attachment.size + ' Б' :
                    m.attachment.size < 1024 * 1024 ? (m.attachment.size / 1024).toFixed(1) + ' КБ' :
                    (m.attachment.size / (1024 * 1024)).toFixed(1) + ' МБ'
                  ) : 'Скачать'}
                </div>
              </div>
              <span style={{fontSize:14,opacity:.6,flexShrink:0}}>⬇</span>
            </a>
          )}
          {m.attachment?.type === 'moment' && m.attachment.moment && (() => {
            const mom = m.attachment.moment;
            return (
              <button
                onClick={() => onOpenMomentRef && onOpenMomentRef(mom.id)}
                title="Открыть момент"
                style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'8px 10px', borderRadius:10, marginBottom: m.text ? 6 : 2,
                  background: isOut ? 'rgba(249,240,240,.12)' : 'rgba(95, 64, 128,.18)',
                  border:`1px solid ${isOut ? 'rgba(249,240,240,.18)' : 'rgba(180,140,220,.3)'}`,
                  color:'inherit', cursor:'pointer', maxWidth: 280,
                  fontFamily:'inherit', textAlign:'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.18)' : 'rgba(95, 64, 128,.28)'}
                onMouseLeave={e => e.currentTarget.style.background = isOut ? 'rgba(249,240,240,.12)' : 'rgba(95, 64, 128,.18)'}>
                <div style={{flexShrink:0, width: 42, height: 42, borderRadius: 8,
                  overflow:'hidden', background:'#1a0a30',
                  display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {mom.media_url && mom.media_type === 'image' ? (
                    <img src={mediaUrl(mom.media_url)} alt="" draggable={false}
                      style={{width:'100%', height:'100%', objectFit:'cover',
                        objectPosition: mom.media_position || '50% 50%'}}/>
                  ) : (
                    <HeyLogo size={20} color="rgba(220,200,255,.85)" />
                  )}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize: 10, fontWeight: 700,
                    color: isOut ? 'rgba(249,240,240,.7)' : 'rgba(220,200,255,.85)',
                    textTransform:'uppercase', letterSpacing: .5}}>
                    ✦ Момент {mom.author_name ? `· ${mom.author_name}` : ''}
                  </div>
                  <div style={{fontSize: 12, marginTop: 2, opacity: .85,
                    overflow:'hidden', textOverflow:'ellipsis',
                    display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical'}}>
                    {mom.text || '— без описания —'}
                  </div>
                </div>
              </button>
            );
          })()}
          {/* Превью видео-ссылки идёт ПЕРЕД текстом сообщения — карточка
             с обложкой + плеером важнее самой ссылки. hideMeta скрывает
             нижний блок «↗ YouTube/Vimeo/…», который дублирует бейдж
             платформы на самой обложке. */}
          {m.link_preview && m.link_preview.type === 'group_invite' && (
            <GroupInvitePreview data={m.link_preview} isOut={isOut}/>
          )}
          {m.link_preview && m.link_preview.type !== 'group_invite' && (
            <div style={{marginBottom: m.text ? 8 : 0, width: 'min(100%, 360px)'}}>
              <EmbeddedVideoPreview data={m.link_preview} size="full" hideMeta={false}
                onlyTitleMeta/>
            </div>
          )}
          {m.text && (() => {
            const trimmed = m.text.trim();
            const single  = trimmed.match(/^\[([^\]]+)\]$/);
            // Большой эмодзи (72px) — только если в сообщении нет никаких
            // вложений и нет link-preview. Когда эмодзи подписывает фото/
            // файл/видео-ссылку, он должен идти обычным инлайн-размером,
            // а не перекрывать вложение.
            const hasAttachment = !!m.attachment || !!m.link_preview;
            if (single && HEY_EMOJI_SET.has(single[1]) && !hasAttachment) {
              return (
                <div style={{padding:'4px 0', textAlign: isOut ? 'right' : 'left'}}>
                  <img src={emojiUrl(single[1])} alt={single[1]}
                    title={single[1]}
                    style={{width:72,height:72,display:'inline-block',
                      filter:'drop-shadow(1px 2px 2px rgba(0,0,0,.4))'}}/>
                </div>
              );
            }
            return (
              <div style={{wordBreak:'break-word',whiteSpace:'pre-wrap'}}>
                {renderText(m.text)}
              </div>
            );
          })()}
          </>)}
          <div style={{fontSize:11,opacity:.6,textAlign:'right',marginTop:3,display:'flex',justifyContent:'flex-end',gap:4}}>
            {m.edited_at && <span>изм.</span>}
            <span>{fmtTime(m.created_at)}</span>
            {isOut && statusIcon(m.status)}
          </div>
        </div>

        {/* Reaction chips. Логика отображения:
            • Single reactor — показываем только эмодзи (для группы рядом
              мини-аватар автора реакции, для direct/monolog даже его не
              надо — собеседник известен).
            • В группе с несколькими reactor'ами — стек до 3 мини-аватарок
              + «+N» если больше.
            • В direct с несколькими — только цифра-счётчик.
            Реакторы теперь приходят как [{id,name,avatar},...] вместо
            массива user_id (сервер делает JOIN). */}
        {hasReactions && (
          <div style={{display:'flex', flexWrap:'wrap', gap:4, marginTop:5}}>
            {Object.entries(m.reactions).map(([emoji, reactors]) => {
              // Бэк-compat: если сервер ещё прислал массив строк (старый
              // формат) — конвертим на лету в объекты-заглушки. Дополнительно
              // фильтруем null/undefined элементы, чтобы JSX не упал на r.id.
              const list = (reactors || [])
                .filter(r => r != null)
                .map(r => typeof r === 'string' ? { id: r, name: '', avatar: null } : r);
              if (!list.length) return null;
              const iReacted = list.some(r => r.id === currentUserId);
              const total = list.length;
              const showAvatars = isGroup && total >= 1;
              const visible = showAvatars ? list.slice(0, 3) : [];
              const extra = showAvatars ? Math.max(0, total - visible.length) : 0;
              return (
                <button key={emoji} onClick={() => onToggleReaction(m.id, emoji)}
                  title={emoji + (total > 1 ? ` · ${total}` : '')}
                  style={{
                    background: iReacted ? 'rgba(130,100,190,.6)' : 'rgba(249,240,240,.18)',
                    border: iReacted ? '1px solid rgba(170,130,220,.75)' : '1px solid rgba(249,240,240,.12)',
                    borderRadius:14, padding:'2px 6px 2px 6px', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:5, fontSize:12,
                    color:'#F9F0F0', transition:'background .15s',
                  }}>
                  <img src={emojiUrl(emoji)} alt={emoji}
                    style={{width:16, height:16,
                      filter:'drop-shadow(1px 1px 1px rgba(0,0,0,0.4))'}}/>
                  {showAvatars ? (
                    <span style={{display:'inline-flex', alignItems:'center'}}>
                      {visible.map((r, i) => (
                        <span key={r.id}
                          style={{
                            marginLeft: i === 0 ? 0 : -6,
                            border: '1.5px solid rgba(80,55,135,1)',
                            borderRadius: '50%',
                            width: 18, height: 18, overflow:'hidden',
                            background:'rgba(249,240,240,.15)',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            fontSize: 9, fontWeight: 700,
                          }}>
                          {r.avatar && typeof r.avatar === 'string'
                            ? <img src={mediaUrl(r.avatar)} alt=""
                                style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                            : <span>{(r.name || '?').charAt(0).toUpperCase()}</span>}
                        </span>
                      ))}
                      {extra > 0 && (
                        <span style={{marginLeft: 3, fontWeight:700, fontSize:11}}>
                          +{extra}
                        </span>
                      )}
                    </span>
                  ) : (
                    total > 1 ? <span style={{fontWeight:600}}>{total}</span> : null
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Зарезервированный 36-px слот для smile-кнопки реакции (только
          для входящих). Слот существует ВСЕГДА — поэтому хит-зона row'а
          включает кнопку, и при ховере она не «мерцает» когда мышь
          переходит из пузыря в саму кнопку. layout shift тоже отсутствует,
          потому что слот зарезервирован независимо от состояния hover.
          На исходящих не рисуем — ставить реакцию на свои бессмысленно. */}
      {!isOut && !isDeleted && (
        <div style={{
          width: 36, flexShrink: 0, alignSelf: 'flex-end',
          marginBottom: 4, display:'flex', alignItems:'center', justifyContent:'center',
        }}
          onMouseEnter={keepHovered}
          onMouseMove={keepHovered}
          onMouseLeave={releaseHovered}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setTappedReveal(false);
              onSetReactionPicker(p => p?.msgId === m.id ? null
                : { msgId: m.id, x: rect.left + rect.width/2, y: rect.top });
            }}
            className="hey-react-btn"
            data-react-btn
            data-hovered={showReactBtn ? 'y' : 'n'}
            title="Реакция"
            style={{
              width: 32, height: 32, borderRadius:'50%',
              background:'rgba(60,40,100,.92)',
              border:'1px solid rgba(160,130,210,.6)',
              padding: 0,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              cursor: showReactBtn ? 'pointer' : 'default',
              boxShadow:'0 2px 10px rgba(0,0,0,.4)',
              opacity: showReactBtn ? 1 : 0,
              pointerEvents: showReactBtn ? 'auto' : 'none',
              transition: 'opacity .15s',
              animation: showReactBtn ? 'heyReactBtnIn .15s ease-out' : 'none',
            }}>
            <Icon name="smile" size={18} />
          </button>
        </div>
      )}

      {/* На свои сообщения реакцию не ставят — кнопку-инициатор для
          исходящих не показываем. (Реакции от других на наше сообщение
          по-прежнему отрисуются как чипы.) */}
    </div>
  );
}, (prev, next) =>
  prev.m.id === next.m.id &&
  rxSig(prev.m.reactions) === rxSig(next.m.reactions) &&
  prev.m.is_deleted === next.m.is_deleted &&
  prev.m.sender_name === next.m.sender_name &&
  prev.m.sender_avatar === next.m.sender_avatar &&
  prev.m.text === next.m.text &&
  prev.m.status === next.m.status &&
  prev.isOut === next.isOut &&
  prev.isGroup === next.isGroup &&
  prev.isFlashing === next.isFlashing &&
  prev.editingMsgId === next.editingMsgId &&
  prev.reactionPickerMsgId === next.reactionPickerMsgId &&
  prev.currentUserId === next.currentUserId
);
export default MessageRow;
