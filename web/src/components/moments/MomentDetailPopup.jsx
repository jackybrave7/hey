// MomentDetailPopup.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api, socket } from '../../api';
import MoodEmoji from './MoodEmoji';
import EmbeddedVideoPreview from './EmbeddedVideoPreview';
import { useSalesPressure } from '../../lib/publicSettings';
import SuperInfoScreen from '../super/SuperInfoScreen';
import { openUserCard } from '../Screens';
import { AudioPlayer } from '../chat/AudioPlayer';
import { heyToast } from '../shared/Toast';
import Icon from '../Icon';
import ChatContextMenu from '../chat/ChatContextMenu';
import HeyLogo from '../HeyLogo';
import { HEY_EMOJI_SET, emojiUrl } from '../../lib/heyEmoji';

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
}

// Рендерит текст с кликабельными ссылками. Длинные ссылки сокращаются для отображения.
// Обрезает завершающую пунктуацию с URL: «...html.» → «...html»
function trimUrlTail(url) {
  let u = url.replace(/[.,;:!?»"'`]+$/, '');
  while (/[)\]}]$/.test(u)) {
    const closing = u.slice(-1);
    const opening = closing === ')' ? '(' : closing === ']' ? '[' : '{';
    const opens   = (u.match(new RegExp('\\' + opening, 'g')) || []).length;
    const closes  = (u.match(new RegExp('\\' + closing, 'g')) || []).length;
    if (closes > opens) u = u.slice(0, -1); else break;
  }
  return u;
}

// Рендерит сразу и URL-ы (как кликабельные ссылки), и [name]-эмодзи
// (как маленькие inline-картинки). Раньше эмодзи показывались сырыми
// токенами «[winking]» в подписи момента — теперь так же красиво,
// как в чате.
export function TextWithLinks({ text, linkColor = 'rgba(180,140,255,.95)' }) {
  if (!text) return null;
  const URL_RE   = /https?:\/\/[^\s<>"']+/gi;
  const EMOJI_RE = /\[([a-z][a-z 0-9_-]*)\]/gi;

  // Сначала разбиваем по URL-ам (как раньше), а в каждом не-URL куске
  // дополнительно разбиваем по эмодзи-токенам. Так оба регэкспа не
  // конкурируют между собой.
  const urlChunks = [];
  let last = 0, m;
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) urlChunks.push({ t: text.slice(last, m.index), kind: 'text' });
    const cleanUrl = trimUrlTail(m[0]);
    const tail     = m[0].slice(cleanUrl.length);
    urlChunks.push({ t: cleanUrl, kind: 'link' });
    if (tail) urlChunks.push({ t: tail, kind: 'text' });
    last = m.index + m[0].length;
  }
  if (last < text.length) urlChunks.push({ t: text.slice(last), kind: 'text' });

  function shortenUrl(url) {
    const stripped = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (stripped.length <= 38) return stripped;
    return stripped.slice(0, 35) + '…';
  }

  function splitEmoji(chunk) {
    const out = [];
    let i = 0, mm;
    EMOJI_RE.lastIndex = 0;
    while ((mm = EMOJI_RE.exec(chunk)) !== null) {
      if (mm.index > i) out.push({ t: chunk.slice(i, mm.index), kind: 'text' });
      const name = mm[1].toLowerCase();
      if (HEY_EMOJI_SET.has(name)) out.push({ name, kind: 'emoji' });
      else out.push({ t: mm[0], kind: 'text' }); // неизвестный — оставляем как было
      i = mm.index + mm[0].length;
    }
    if (i < chunk.length) out.push({ t: chunk.slice(i), kind: 'text' });
    return out;
  }

  const flat = [];
  for (const c of urlChunks) {
    if (c.kind === 'link') { flat.push(c); continue; }
    flat.push(...splitEmoji(c.t));
  }

  return (
    <>
      {flat.map((p, i) => {
        if (p.kind === 'link') return (
          <a key={i} href={p.t} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={p.t}
            style={{ color: linkColor, textDecoration:'underline', textUnderlineOffset:2, wordBreak:'break-all' }}>
            {shortenUrl(p.t)}
          </a>
        );
        if (p.kind === 'emoji') return (
          <img key={i} src={emojiUrl(p.name)} alt={p.name} title={p.name}
            style={{ width: 20, height: 20, display:'inline-block',
              verticalAlign:'-4px', margin:'0 1px' }}/>
        );
        return <span key={i}>{p.t}</span>;
      })}
    </>
  );
}

// ── Модалка «Пожаловаться» ─────────────────────────────────────────────
// ── Reactors list modal — кто отреагировал (Super-функция) ──────────────
const REACTION_META = {
  see:      { iconName: 'eye',     title: 'Просмотры'  },
  resonate: { iconName: 'sparkle', title: 'Резонирует' },
  talk:     { iconName: 'chat',    title: 'Поговорить' },
};

function ReactorsModal({ filter, reactors, loading, onClose, onOpenUser }) {
  // filter = 'see' | 'resonate' | 'talk'
  // Дедуп по user.id — на случай если бэк вернул того же юзера дважды
  const list = !reactors ? [] : (() => {
    const seen = new Set();
    return reactors
      .filter(r => r.reaction === filter)
      .filter(r => seen.has(r.id) ? false : (seen.add(r.id), true));
  })();
  const meta = REACTION_META[filter] || { iconName: 'sparkle', title: 'Отклик' };

  function fmtTime(ts) {
    if (!ts) return '';
    const diff = (Date.now() - ts * 1000) / 1000;
    if (diff < 60)    return 'только что';
    if (diff < 3600)  return Math.floor(diff/60) + ' мин';
    if (diff < 86400) return Math.floor(diff/3600) + ' ч';
    return new Date(ts*1000).toLocaleDateString('ru', { day:'numeric', month:'short' });
  }

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:10000,
        background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      }}>
      <div style={{
        background:'rgba(22,15,50,.98)', borderRadius:18,
        width:'min(94vw, 420px)', maxHeight:'80vh', display:'flex', flexDirection:'column',
        border:'1px solid rgba(249,240,240,.1)',
        boxShadow:'0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px 14px',borderBottom:'1px solid rgba(249,240,240,.08)',
          display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{display:'inline-flex',alignItems:'center',color:'rgba(249,240,240,.9)'}}><Icon name={meta.iconName} size={22}/></span>
          <div style={{flex:1}}>
            <div style={{color:'#F9F0F0',fontSize:16,fontWeight:700}}>{meta.title}</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginTop:2}}>
              {loading ? 'Загрузка…' : `${list.length} ${list.length === 1 ? 'человек' : 'человек'}`}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(249,240,240,.4)',
              fontSize:24,cursor:'pointer',lineHeight:1,padding:0}}>×</button>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 10px 14px'}}>
          {loading && (
            <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',padding:'40px 20px',fontSize:14}}>
              Загрузка…
            </div>
          )}
          {!loading && list.length === 0 && (
            <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',padding:'40px 20px',fontSize:14}}>
              Пока никого
            </div>
          )}
          {!loading && list.map(r => (
            <button key={r.id + r.reaction}
              onClick={() => onOpenUser(r.id)}
              style={{
                width:'100%',display:'flex',alignItems:'center',gap:12,
                padding:'10px 12px',borderRadius:12,marginBottom:4,
                background:'transparent',border:'none',cursor:'pointer',
                fontFamily:'inherit',textAlign:'left',
                transition:'background .12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,240,240,.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,
                background:'rgba(180,140,220,.3)',overflow:'hidden',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:14,color:'#F9F0F0',fontWeight:700,
                border:'1px solid rgba(249,240,240,.1)'}}>
                {r.avatar
                  ? <img src={r.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (r.name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'#F9F0F0',fontSize:14,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {r.name || 'Без имени'}
                </div>
                <div style={{color:'rgba(249,240,240,.35)',fontSize:11}}>
                  {fmtTime(r.created_at)}
                </div>
              </div>
              <span style={{color:'rgba(249,240,240,.25)',fontSize:18,flexShrink:0}}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ReportModal({ targetType, targetId, onClose, onSent }) {
  const [text, setText]     = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState('');

  const MIN = 5;
  const MAX = 1000;
  const trimmed = text.trim();
  const canSend = trimmed.length >= MIN && trimmed.length <= MAX;

  async function submit() {
    setError('');
    if (!canSend) {
      setError(trimmed.length < MIN
        ? `Опишите подробнее (минимум ${MIN} символов, сейчас ${trimmed.length})`
        : `Слишком длинно (максимум ${MAX})`);
      return;
    }
    setSending(true);
    try {
      await api.createReport({ targetType, targetId, reason: trimmed });
      onSent?.();
    } catch (e) {
      setError(e.message || 'Не удалось отправить жалобу');
    }
    setSending(false);
  }

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:10000,
        background:'rgba(0,0,0,.65)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      }}>
      <div style={{
        background:'rgba(28,18,58,.99)', borderRadius:18,
        width:'min(94vw, 460px)', overflow:'hidden',
        border:'1px solid rgba(249,240,240,.1)',
        boxShadow:'0 20px 60px rgba(0,0,0,.65)',
      }}>
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid rgba(249,240,240,.08)',
          display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>🚩</span>
          <div style={{flex:1}}>
            <div style={{color:'#F9F0F0',fontSize:16,fontWeight:700}}>Пожаловаться</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginTop:2}}>
              Опишите, что не так. Жалоба уйдёт администратору.
            </div>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(249,240,240,.4)',
              fontSize:24,cursor:'pointer',lineHeight:1,padding:0}}>×</button>
        </div>

        <div style={{padding:'18px 22px'}}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX))}
            placeholder="Например: спам, оскорбления, неподходящий контент…"
            rows={5}
            autoFocus
            style={{
              width:'100%', boxSizing:'border-box',
              background:'rgba(249,240,240,.07)',
              border:`1px solid ${trimmed.length > 0 && !canSend ? 'rgba(255,140,140,.5)' : 'rgba(249,240,240,.14)'}`,
              borderRadius:12, padding:'12px 14px', color:'#F9F0F0', fontSize:14,
              fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5,
            }}
          />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,
            fontSize:11,color: trimmed.length < MIN ? 'rgba(255,180,100,.85)' : 'rgba(249,240,240,.35)'}}>
            <span>
              {trimmed.length < MIN
                ? `Ещё ${MIN - trimmed.length} символ(ов)`
                : '✓ Можно отправить'}
            </span>
            <span>{trimmed.length} / {MAX}</span>
          </div>

          {error && (
            <div style={{
              marginTop:12,padding:'10px 12px',borderRadius:10,
              background:'rgba(255,80,80,.12)',
              color:'rgba(255,160,160,.95)',fontSize:13,
            }}>{error}</div>
          )}
        </div>

        <div style={{padding:'14px 22px 20px',borderTop:'1px solid rgba(249,240,240,.06)',
          display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{
              flex:1,padding:'12px',borderRadius:12,
              background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.12)',
              color:'rgba(249,240,240,.8)',fontSize:14,fontWeight:600,cursor:'pointer',
            }}>
            Отмена
          </button>
          <button onClick={submit} disabled={!canSend || sending}
            style={{
              flex:2,padding:'12px',borderRadius:12,
              background: canSend && !sending ? 'rgba(200,80,80,.85)' : 'rgba(120,90,140,.4)',
              border:'1px solid ' + (canSend ? 'rgba(255,120,120,.5)' : 'rgba(249,240,240,.1)'),
              color:'#F9F0F0',fontSize:14,fontWeight:700,
              cursor: canSend && !sending ? 'pointer' : 'not-allowed',
            }}>
            {sending ? 'Отправка…' : 'Отправить жалобу'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const REACTIONS = [
  { id: 'see',       label: 'Вижу',       iconName: 'eye' },
  { id: 'resonate',  label: 'Резонирует', iconName: 'sparkle' },
  { id: 'talk',      label: 'Поговорить', iconName: 'chat' },
];

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

// Rendered via portal so backdrop-filter on parent doesn't trap it
function InlineMenu({ moment, onEdit, onArchive, onDelete, onClose }) {
  function copyLink() {
    copyText(`${location.origin}/moments/${moment.id}`)
      .then(() => heyToast('Ссылка скопирована', 'success'))
      .catch(() => heyToast('Не удалось скопировать', 'error'));
  }

  return (
    <ChatContextMenu
      ariaLabel="Меню момента"
      items={[
        { label: 'Изменить момент', icon: <Icon name="edit" size={15}/>, onClick: () => onEdit(moment) },
        { label: 'Поделиться ссылкой', iconName: 'export', onClick: copyLink },
        { label: 'В архив', iconName: 'archive', onClick: () => { onArchive(moment); onClose(); } },
        { label: 'Удалить навсегда', iconName: 'delete', danger: true, separatorBefore: true,
          onClick: () => { onDelete(moment); onClose(); } },
      ]}
      trigger={
        <span style={{
          background: 'rgba(249,240,240,.08)',
          borderRadius: 10, padding: '7px 10px', color: 'rgba(249,240,240,.7)',
          fontSize: 18, lineHeight: 1,
        }}>⋯</span>
      }
    />
  );
}

// ── Main popup ────────────────────────────────────────────────────────────────
export default function MomentDetailPopup({
  moments,        // array of moments to navigate through
  initialIndex,   // starting index
  currentUser,
  onClose,
  onEdit,         // (moment) => void
  onArchive,      // (moment) => void
  onDelete,       // (moment) => void
  onRestore,
  onMomentUpdated, // (freshMoment) => void — родитель синкает свой список
  zIndex,          // override — когда поп-ап открывается поверх другой модалки
                   // (например ContactCardModal на z:10500), родитель передаёт
                   // более высокий z, чтобы попап не уехал под ту модалку.
}) {
  const nav = useNavigate();
  const salesPressure = useSalesPressure();

  const [idx, setIdx]           = useState(initialIndex ?? 0);
  const [moment, setMoment]     = useState(moments[initialIndex ?? 0]);
  const [myReaction, setMyReaction] = useState(moment.myReaction || null);
  const [reacting, setReacting] = useState(false);
  const [flashRxn, setFlashRxn] = useState(null); // id реакции которая на секунду подсвечивается
  const [reportOpen, setReportOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [reactorsModal, setReactorsModal] = useState(null); // null | 'all' | 'see' | 'resonate' | 'talk'
  const [reactors, setReactors] = useState(null);
  const [showAnalyticsPromo, setShowAnalyticsPromo] = useState(false);
  const [showSuperInfo, setShowSuperInfo]             = useState(false);
  const [imgLightbox, setImgLightbox]                 = useState(false);

  const touchStartX = useRef(null);
  const isMine = moment.user_id === currentUser?.id;
  const canPrev = idx > 0;
  const canNext = idx < moments.length - 1;

  // Load fresh data whenever the displayed moment changes
  useEffect(() => {
    const m = moments[idx];
    setMoment(m);
    setMyReaction(m.myReaction || null);
    setReactors(null);
    setImgLightbox(false);

    api.getMoment(m.id).then(fresh => {
      setMoment(fresh);
      setMyReaction(fresh.myReaction || null);
    }).catch(() => {});

    const mine = m.user_id === currentUser?.id;
    if (!mine) api.viewMoment(m.id).catch(() => {});
    if (mine && m.author_is_super) {
      api.getMomentReactors(m.id).then(setReactors).catch(() => {});
    }
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // WS-подписка: реакция от кого-то на текущий открытый момент → подтянуть
  // свежие счётчики. Без этого автор смотрит свой момент и не видит как
  // кто-то поставил «резонирует» — пока не закроет/откроет.
  useEffect(() => {
    if (!moment?.id) return;
    const off = socket.on('moment:reaction', ({ momentId }) => {
      if (momentId !== moment.id) return;
      api.getMoment(momentId).then(fresh => {
        if (fresh) setMoment(prev => prev?.id === fresh.id ? { ...prev, ...fresh } : prev);
      }).catch(() => {});
      // Список реакторов (для авторов в Super) тоже актуализируем.
      const mine = moment.user_id === currentUser?.id;
      if (mine && moment.author_is_super) {
        api.getMomentReactors(moment.id).then(setReactors).catch(() => {});
      }
    });
    return () => off();
  }, [moment?.id, moment?.user_id, moment?.author_is_super, currentUser?.id]);

  const goPrev = useCallback(() => { if (canPrev) setIdx(i => i - 1); }, [canPrev]);
  const goNext = useCallback(() => { if (canNext) setIdx(i => i + 1); }, [canNext]);

  // Стрелки навигации — вставляются абсолютно внутрь hero-контейнера,
  // чтобы центрироваться вертикально по медиа, а не по всему попапу
  const navArrows = (
    <>
      {canPrev && (
        <button onClick={(e) => { e.stopPropagation(); goPrev(); }} style={{
          position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
          zIndex:10, width:36, height:36, borderRadius:'50%',
          background:'rgba(20,12,40,.8)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(249,240,240,.12)', color:'#F9F0F0',
          fontSize:20, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 2px 12px rgba(0,0,0,.5)',
        }}>‹</button>
      )}
      {canNext && (
        <button onClick={(e) => { e.stopPropagation(); goNext(); }} style={{
          position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
          zIndex:10, width:36, height:36, borderRadius:'50%',
          background:'rgba(20,12,40,.8)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(249,240,240,.12)', color:'#F9F0F0',
          fontSize:20, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 2px 12px rgba(0,0,0,.5)',
        }}>›</button>
      )}
    </>
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'Escape')     onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [goPrev, goNext, onClose]);

  async function handleReact(reaction) {
    if (reacting) return;
    setReacting(true);
    // Подсветка — только когда ставим реакцию (не при сбросе)
    const isSettingNew = myReaction !== reaction;
    if (isSettingNew) {
      setFlashRxn(reaction);
      setTimeout(() => setFlashRxn(curr => curr === reaction ? null : curr), 1000);
    }
    try {
      if (myReaction === reaction) {
        await api.unreactMoment(moment.id);
        setMyReaction(null);
      } else {
        await api.reactMoment(moment.id, reaction);
        setMyReaction(reaction);
      }
      // Синхронизируем И moment, И myReaction по серверной правде,
      // чтобы не висеть со «своей реакцией» которая на сервере уже снята.
      const fresh = await api.getMoment(moment.id);
      setMoment(fresh);
      setMyReaction(fresh.myReaction || null);
      // Прокидываем в родителя — лента/каталог должны сразу показать
      // новую мини-иконку реакции, а не ждать перезагрузки страницы.
      onMomentUpdated?.(fresh);
    } catch {
      // На случай сетевого/серверного сбоя пересинхронизируем с сервером
      try {
        const fresh = await api.getMoment(moment.id);
        setMoment(fresh);
        setMyReaction(fresh.myReaction || null);
        onMomentUpdated?.(fresh);
      } catch {}
    }
    setReacting(false);
  }

  async function handleChat() {
    try {
      const conv = await api.openConversation(moment.user_id);
      onClose();
      // Прикрепляем мини-карточку момента к черновику чата как «зацепку
      // общения». Подхватывает ChatScreen из location.state.momentRef.
      const momentRef = {
        id: moment.id,
        text: moment.text || null,
        media_url: moment.media_url || null,
        media_type: moment.media_type || null,
        media_position: moment.media_position || null,
        author_name: moment.author_name || null,
        author_id: moment.user_id || null,
      };
      nav(`/chat/${conv.id}`, { state: { momentRef } });
    } catch {}
  }

  // Touch swipe
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50)  goPrev();
    if (dx < -50) goNext();
  }

  const hasMedia      = !!moment.media_url;
  const hasEmbedVideo = !!moment.embedded_video;

  return (
    <>
    <div
      style={{
        position:'fixed',inset:0,zIndex: zIndex || 700,
        background:'rgba(0,0,0,.72)',backdropFilter:'blur(16px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'20px',
      }}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={{
        background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(100%,520px)',
        maxHeight:'90vh',display:'flex',flexDirection:'column',
        boxShadow:'0 8px 48px rgba(0,0,0,.6)',
        border:'1px solid rgba(249,240,240,.1)',
        overflow:'hidden',
        position:'relative',
      }}>

        {/* ← / → nav arrows вставляются ниже — внутри hero-блока, чтобы центрироваться по медиа */}

        {/* Dot indicators */}
        {moments.length > 1 && (
          <div style={{
            position:'absolute', bottom: hasMedia ? 'auto' : 8, top: hasMedia ? 8 : 'auto',
            left:'50%', transform:'translateX(-50%)',
            display:'flex', gap:5, zIndex:10, pointerEvents:'none',
          }}>
            {moments.map((_, i) => (
              <div key={i} style={{
                width: i === idx ? 16 : 5, height:5, borderRadius:3,
                background: i === idx ? 'rgba(249,240,240,.9)' : 'rgba(249,240,240,.3)',
                transition:'all .2s',
              }}/>
            ))}
          </div>
        )}

        {/* Media */}
        {hasMedia && (
          <div style={{flexShrink:0,position:'relative',background:'#0a0518',maxHeight:'45vh',overflow:'hidden'}}>
            {moment.media_type === 'image' && (
              <img src={moment.media_url} alt=""
                onClick={() => setImgLightbox(true)}
                style={{width:'100%',maxHeight:'45vh',objectFit:'contain',display:'block',
                  cursor:'zoom-in',transition:'opacity .15s'}}
                onMouseEnter={e => e.currentTarget.style.opacity='.88'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}
              />
            )}
            {moment.media_type === 'video' && (
              <video src={moment.media_url} controls
                style={{width:'100%',maxHeight:'45vh',display:'block',background:'#000'}}/>
            )}
            {moment.media_type === 'audio' && (
              // Высота шапки выровнена с image/video (≈45vh), как просил
              // пользователь — раньше аудио было «коротеньким», а
              // картинка/видео занимали полэкрана. По центру — большая
              // нота, а во время воспроизведения вокруг неё «дышит»
              // дорожка вертикальных полосок-волн (CSS keyframes).
              <div style={{
                padding:'28px 22px 24px',
                display:'flex',flexDirection:'column',justifyContent:'space-between',
                gap:18, minHeight:'min(45vh, 380px)',
                background:'linear-gradient(135deg,#1a0a38,#2a1858)',
                position:'relative',
              }}>
                <div style={{flex:1,display:'flex',flexDirection:'column',
                  alignItems:'center',justifyContent:'center',gap:18,position:'relative'}}>
                  <div style={{fontSize:64,opacity:.9,lineHeight:1}}>🎵</div>
                  {/* Анимированный «эквалайзер» — рендерим всегда, но
                      animation-play-state переключается по `audioPlaying`,
                      чтобы при паузе полоски замирали. */}
                  <div className={`hey-audio-wave ${audioPlaying ? 'is-playing' : ''}`}
                    style={{display:'flex',alignItems:'flex-end',gap:5,height:48}}>
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
                      <span key={i} style={{
                        width:5, borderRadius:3,
                        background:'linear-gradient(180deg, #c8a8ff, #5F4080)',
                        animationDelay: `${(i % 6) * 0.12}s`,
                      }}/>
                    ))}
                  </div>
                </div>
                <AudioPlayer url={moment.media_url}
                  duration={moment.media_duration} wide={true}
                  onPlayingChange={setAudioPlaying}/>
              </div>
            )}
            <button onClick={onClose} style={{position:'absolute',top:12,right:12,
              background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
              border:'none',borderRadius:'50%',width:36,height:36,
              color:'#F9F0F0',fontSize:18,cursor:'pointer',display:'flex',
              alignItems:'center',justifyContent:'center'}}>✕</button>
            {navArrows}
          </div>
        )}

        <div style={{flex:1,overflowY:'auto'}}>
          {/* No-media mood or embedded video */}
          {!hasMedia && (
            hasEmbedVideo ? (
              <div style={{flexShrink:0,position:'relative',background:'#0a0518'}}>
                <EmbeddedVideoPreview data={moment.embedded_video} size="full" hideMeta/>
                <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                  background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
                  border:'none',borderRadius:'50%',width:36,height:36,
                  color:'#F9F0F0',fontSize:18,cursor:'pointer',display:'flex',
                  alignItems:'center',justifyContent:'center',zIndex:10}}>✕</button>
                {navArrows}
              </div>
            ) : (
              <div style={{
                // Эмодзи-момент в попапе должен занимать ту же «шапку», что и
                // фото/видео (~45vh). Иначе он смотрелся в 2-3 раза ниже.
                height:'min(45vh, 360px)',
                flexShrink:0,position:'relative',
              }}>
                <MoodEmoji type={moment.mood_emoji||'calm'} fill/>
                <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                  background:'rgba(0,0,0,.35)',border:'none',borderRadius:'50%',
                  width:36,height:36,color:'#F9F0F0',fontSize:18,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                {navArrows}
              </div>
            )
          )}

          <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Author + time — клик на аватар или имя открывает профиль автора */}
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div onClick={() => {
                  if (!moment.user_id) return;
                  if (moment.user_id === currentUser?.id) { onClose?.(); nav('/me'); }
                  else { onClose?.(); openUserCard(moment.user_id); }
                }}
                style={{width:40,height:40,flexShrink:0,position:'relative',cursor:'pointer'}}>
                <div style={{width:40,height:40,borderRadius:'50%',
                  background:'rgba(180,140,220,.35)',overflow:'hidden',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,color:'#F9F0F0',fontWeight:600,
                  transition:'transform .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  {moment.author_avatar
                    ? <img src={moment.author_avatar} alt={moment.author_name||''}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : (moment.author_name||'?')[0].toUpperCase()
                  }
                </div>
                {moment.author_is_super && salesPressure >= 2 && (
                  <div style={{
                    position:'absolute',bottom:-1,right:-1,
                    width:14,height:14,borderRadius:'50%',
                    background:'linear-gradient(135deg,#c8a8ff,#5F4080)',
                    border:'2px solid rgba(22,15,50,.98)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    pointerEvents:'none',
                  }}><HeyLogo size={8} color="#F9F0F0" /></div>
                )}
              </div>
              <div style={{flex:1,cursor:'pointer'}}
                onClick={() => {
                  if (!moment.user_id) return;
                  if (moment.user_id === currentUser?.id) { onClose?.(); nav('/me'); }
                  else { onClose?.(); openUserCard(moment.user_id); }
                }}>
                <div style={{color:'#F9F0F0',fontSize:15,fontWeight:600}}>{moment.author_name}</div>
                <div style={{color:'rgba(249,240,240,.4)',fontSize:12}}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{marginLeft:6,opacity:.6}}>· редактировалось</span>}
                </div>
              </div>
              {isMine ? (
                <InlineMenu moment={moment} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} onClose={onClose}/>
              ) : (
                <ChatContextMenu
                  ariaLabel="Меню момента"
                  items={[{
                    label: 'Пожаловаться',
                    icon: <Icon name="flag" size={15}/>,
                    danger: true,
                    onClick: () => setReportOpen(true),
                  }]}
                  trigger={
                    <span style={{
                      background: 'rgba(249,240,240,.08)',
                      borderRadius: 10, padding: '7px 10px', color: 'rgba(249,240,240,.7)',
                      fontSize: 18, lineHeight: 1, flexShrink: 0,
                    }}>⋮</span>
                  }
                />
              )}
            </div>

            {/* Auto tags */}
            {moment.auto_tags?.length > 0 && (
              <div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {moment.auto_tags.map(tag => (
                    <span key={tag} style={{border:'1px dashed rgba(249,240,240,.25)',borderRadius:20,
                      padding:'3px 10px',fontSize:12,color:'rgba(249,240,240,.5)'}}>{tag}</span>
                  ))}
                </div>
                <div style={{color:'rgba(249,240,240,.25)',fontSize:10,marginTop:4}}>подобрано автоматически</div>
              </div>
            )}

            {/* Text — если есть превью видео, скрываем сам URL из подписи
                (он избыточен; автор увидит в режиме редактирования) */}
            <div style={{color:'rgba(249,240,240,.9)',fontSize:15,lineHeight:1.7,
              whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
              <TextWithLinks
                text={hasEmbedVideo && moment.embedded_video?.url
                  ? moment.text.replace(moment.embedded_video.url, '').replace(/\s{2,}/g, ' ').trim()
                  : moment.text}/>
            </div>

            {/* Embedded video (shown below text when there's also a media_url) */}
            {hasEmbedVideo && hasMedia && (
              <EmbeddedVideoPreview data={moment.embedded_video} size="full" hideMeta/>
            )}

            {/* Search flag */}
            {moment.is_search && (
              <div style={{background:'rgba(60,140,100,.18)',border:'1px solid rgba(80,180,120,.25)',
                borderRadius:12,padding:'10px 14px',color:'rgba(120,220,160,.9)',fontSize:13}}>
                🤝 Автор ищет людей, идеи или возможности
              </div>
            )}

            {/* Analytics для собственных моментов — остаётся в скролл-области.
               Реакции (для чужих) переехали ВНИЗ как липкая полоса — см. ниже. */}
            {isMine && (
              <>
                {moment.author_is_super ? (
                  <div style={{background:'rgba(249,240,240,.06)',borderRadius:14,padding:'8px',
                    display:'flex',gap:4}}>
                    {[
                      // Раньше у «👁 просмотры» стоял флаг noReactors:true и
                      // список «кто видел» не открывался. Теперь имя
                      // совпадает с фильтром в ReactorsModal ('see'), и
                      // тап показывает список юзеров с переходом в их
                      // карточки (как у резонирует / поговорить).
                      { key: 'see',      iconName: 'eye',     count: moment.views || 0,           label: 'просмотры'   },
                      { key: 'resonate', iconName: 'sparkle', count: moment.stats?.resonate || 0, label: 'резонирует' },
                      { key: 'talk',     iconName: 'chat',    count: moment.stats?.talk || 0,     label: 'поговорить' },
                    ].map(stat => (
                      <button key={stat.key}
                        onClick={() => {
                          if (stat.count === 0) return;
                          setReactorsModal(stat.key);
                          if (!reactors) api.getMomentReactors(moment.id).then(setReactors).catch(() => {});
                        }}
                        disabled={stat.count === 0}
                        style={{
                          flex:1,padding:'8px 6px',borderRadius:10,
                          background: stat.count > 0 ? 'rgba(249,240,240,.04)' : 'transparent',
                          border:'1px solid ' + (stat.count > 0 ? 'rgba(249,240,240,.08)' : 'transparent'),
                          color: stat.count > 0 ? 'rgba(249,240,240,.85)' : 'rgba(249,240,240,.3)',
                          cursor: stat.count > 0 ? 'pointer' : 'default',
                          fontFamily:'inherit',
                          display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                          transition:'background .12s',
                        }}
                        onMouseEnter={e => { if (stat.count > 0) e.currentTarget.style.background='rgba(249,240,240,.09)'; }}
                        onMouseLeave={e => { if (stat.count > 0) e.currentTarget.style.background='rgba(249,240,240,.04)'; }}>
                        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',height:18}}><Icon name={stat.iconName} size={17}/></span>
                        <span style={{fontSize:15,fontWeight:700,lineHeight:1}}>{stat.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    // L1: показываем счётчики без CTA «купи Super чтобы увидеть кто».
                    // L2: тап открывает промо-попап (старое поведение).
                    onClick={() => salesPressure >= 2 && setShowAnalyticsPromo(true)}
                    style={{background:'rgba(249,240,240,.06)',borderRadius:14,padding:'12px 16px',
                      display:'flex',gap:20,
                      cursor: salesPressure >= 2 ? 'pointer' : 'default'}}>
                    <span style={{color:'rgba(249,240,240,.6)',fontSize:14,display:'inline-flex',alignItems:'center',gap:6}}><Icon name="eye"     size={14}/>{moment.views || 0}</span>
                    <span style={{color:'rgba(249,240,240,.6)',fontSize:14,display:'inline-flex',alignItems:'center',gap:6}}><Icon name="sparkle" size={14}/>{moment.stats?.resonate || 0}</span>
                    <span style={{color:'rgba(249,240,240,.6)',fontSize:14,display:'inline-flex',alignItems:'center',gap:6}}><Icon name="chat"    size={14}/>{moment.stats?.talk || 0}</span>
                    {salesPressure >= 2 && (
                      <span style={{marginLeft:'auto',color:'rgba(249,240,240,.25)',fontSize:12}}>кто? ›</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Реакции — sticky-полоса под скролл-областью, видна всегда */}
        {!isMine && (
          <div style={{
            padding:'10px 20px 4px',
            borderTop:'1px solid rgba(249,240,240,.08)',
            flexShrink:0,
            background:'rgba(22,15,50,.85)',
            backdropFilter:'blur(10px)',
          }}>
            <div style={{display:'flex',gap:6}}>
              {REACTIONS.map(r => {
                const active   = myReaction===r.id;
                const flashing = flashRxn===r.id;
                return (
                  <button key={r.id + (flashing ? '-flash' : '')}
                    onClick={() => handleReact(r.id)} title={r.label}
                    className={flashing ? 'hey-flash' : ''}
                    style={{
                      flex:1,padding:'8px 6px',borderRadius:12,
                      cursor:'pointer',transition:'all .15s',
                      display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                      background: active ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.06)',
                      border: active ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(249,240,240,.1)',
                      color: active ? '#F9F0F0' : 'rgba(249,240,240,.65)',
                      fontFamily:'inherit',
                    }}>
                    <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name={r.iconName} size={15}/></span>
                    <span style={{fontSize:12,fontWeight:500}}>{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        {onRestore ? (
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(249,240,240,.08)',flexShrink:0,
            display:'flex',gap:8}}>
            <button onClick={() => onRestore(moment)}
              style={{flex:1,padding:'13px',borderRadius:14,
                background:'rgba(95, 64, 128,.75)',border:'none',
                color:'#F9F0F0',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              ↩ Восстановить
            </button>
            {onDelete && (
              <button onClick={() => onDelete(moment)}
                style={{padding:'13px 18px',borderRadius:14,
                  background:'rgba(255,80,80,.12)',border:'1px solid rgba(255,80,80,.3)',
                  color:'rgba(255,140,140,.95)',fontSize:15,fontWeight:600,cursor:'pointer',
                  flexShrink:0,
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,80,80,.22)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,80,80,.12)'}
                title="Удалить навсегда">
                🗑
              </button>
            )}
          </div>
        ) : !isMine ? (
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(249,240,240,.08)',flexShrink:0}}>
            <button onClick={handleChat}
              style={{width:'100%',padding:'13px',borderRadius:14,
                background:'rgba(95, 64, 128,.75)',border:'none',
                color:'#F9F0F0',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              ✉ Написать {moment.author_name?.split(' ')[0]}
            </button>
          </div>
        ) : null}
      </div>
    </div>

    {/* Analytics promo */}
    {showAnalyticsPromo && (
      <div style={{position:'fixed',inset:0,zIndex:800,background:'rgba(0,0,0,.6)',backdropFilter:'blur(12px)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}
        onMouseDown={e=>{ if(e.target===e.currentTarget) setShowAnalyticsPromo(false); }}>
        <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
          borderRadius:22,width:'min(100%,380px)',padding:'28px 24px',
          boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(249,240,240,.1)',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:14}}>📊</div>
          <div style={{color:'#F9F0F0',fontSize:17,fontWeight:700,marginBottom:8}}>Хочешь увидеть кто именно?</div>
          <div style={{color:'rgba(249,240,240,.5)',fontSize:14,lineHeight:1.5,marginBottom:20}}>
            В СУПЕР видно каждого кто отреагировал — с аватаром и временем
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={() => setShowAnalyticsPromo(false)} style={{flex:1,padding:'12px',borderRadius:13,
              background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.1)',
              color:'rgba(249,240,240,.6)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Понятно</button>
            <button onClick={() => { setShowAnalyticsPromo(false); setShowSuperInfo(true); }} style={{flex:2,padding:'12px',borderRadius:13,
              background:'rgba(95, 64, 128,.85)',border:'1px solid rgba(180,140,255,.3)',
              color:'#F9F0F0',fontSize:14,fontWeight:700,cursor:'pointer'}}>✦ Узнать больше</button>
          </div>
        </div>
      </div>
    )}

    {showSuperInfo && <SuperInfoScreen onClose={() => setShowSuperInfo(false)} onInvite={() => setShowSuperInfo(false)}/>}

    {reportOpen && (
      <ReportModal
        targetType="moment"
        targetId={moment.id}
        onClose={() => setReportOpen(false)}
        onSent={() => {
          setReportOpen(false);
          window.dispatchEvent(new CustomEvent('hey:toast', {
            detail: { message: '✓ Жалоба отправлена. Спасибо, мы рассмотрим её.', type: 'success' }
          }));
        }}
      />
    )}

    {reactorsModal && (
      <ReactorsModal
        filter={reactorsModal}
        reactors={reactors}
        loading={!reactors}
        onClose={() => setReactorsModal(null)}
        onOpenUser={(uid) => {
          // По макету: тап по строчке открывает карточку юзера поп-апом,
          // не уводит на отдельную страницу профиля. openUserCard монтирует
          // её через глобальный портал — момент остаётся открытым под ней.
          setReactorsModal(null);
          openUserCard(uid);
        }}
      />
    )}

    {/* Image lightbox */}
    {imgLightbox && (
      <div onClick={() => setImgLightbox(false)}
        style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.92)',backdropFilter:'blur(20px)',
          display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out',padding:16}}>
        <img src={moment.media_url} alt=""
          style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:12,
            boxShadow:'0 8px 60px rgba(0,0,0,.7)',pointerEvents:'none'}}/>
        <button onClick={() => setImgLightbox(false)}
          style={{position:'fixed',top:18,right:18,background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
            border:'none',borderRadius:'50%',width:40,height:40,color:'#F9F0F0',
            fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>
    )}
    </>
  );
}
