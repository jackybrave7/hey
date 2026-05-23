// MomentDetailPopup.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import MoodEmoji from './MoodEmoji';
import EmbeddedVideoPreview from './EmbeddedVideoPreview';
import SuperInfoScreen from '../super/SuperInfoScreen';

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
}

// ── Меню для чужого момента (кнопка ⋮) ─────────────────────────────────
function ForeignAuthorMenu({ open, onToggle, onReport }) {
  const btnRef = useRef();
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      onToggle();
    };
    document.addEventListener('mousedown', handler);
    const onKey = (e) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]); // eslint-disable-line

  return (
    <>
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="Меню"
        style={{
          background: open ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)',
          border: 'none', borderRadius: 10,
          padding: '7px 10px', color: 'rgba(255,255,255,.7)',
          fontSize: 18, cursor: 'pointer', transition: 'background .15s', lineHeight: 1,
          flexShrink: 0,
        }}>⋮</button>

      {open && createPortal(
        <div onMouseDown={e => e.stopPropagation()}
          style={{
            position:'fixed', top: pos.top, right: pos.right, zIndex: 9999,
            background:'rgba(28,18,58,.98)', backdropFilter:'blur(20px)',
            borderRadius: 14, overflow:'hidden', minWidth: 200,
            boxShadow:'0 12px 40px rgba(0,0,0,.55)',
            border:'1px solid rgba(255,255,255,.1)',
          }}>
          <div onClick={onReport}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'12px 16px', cursor:'pointer',
              color:'rgba(255,140,140,.95)', fontSize:14, fontWeight:500,
              transition:'background .13s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{fontSize:17}}>🚩</span>
            <span>Пожаловаться</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Модалка «Пожаловаться» ─────────────────────────────────────────────
// ── Reactors list modal — кто отреагировал (Super-функция) ──────────────
const REACTION_META = {
  see:      { icon: '👁', title: 'Просмотры'  },
  resonate: { icon: '✨', title: 'Резонирует' },
  talk:     { icon: '🤝', title: 'Поговорить' },
};

function ReactorsModal({ filter, reactors, loading, onClose, onOpenUser }) {
  // filter = 'see' | 'resonate' | 'talk'
  const list = !reactors ? [] : reactors.filter(r => r.reaction === filter);
  const meta = REACTION_META[filter] || { icon: '✦', title: 'Отклик' };

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
        border:'1px solid rgba(255,255,255,.1)',
        boxShadow:'0 20px 60px rgba(0,0,0,.65)',
      }}>
        {/* Header */}
        <div style={{padding:'16px 20px 14px',borderBottom:'1px solid rgba(255,255,255,.08)',
          display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{fontSize:24}}>{meta.icon}</span>
          <div style={{flex:1}}>
            <div style={{color:'white',fontSize:16,fontWeight:700}}>{meta.title}</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginTop:2}}>
              {loading ? 'Загрузка…' : `${list.length} ${list.length === 1 ? 'человек' : 'человек'}`}
            </div>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',
              fontSize:24,cursor:'pointer',lineHeight:1,padding:0}}>×</button>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:'auto',padding:'8px 10px 14px'}}>
          {loading && (
            <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:'40px 20px',fontSize:14}}>
              Загрузка…
            </div>
          )}
          {!loading && list.length === 0 && (
            <div style={{color:'rgba(255,255,255,.4)',textAlign:'center',padding:'40px 20px',fontSize:14}}>
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
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,
                background:'rgba(180,140,220,.3)',overflow:'hidden',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:14,color:'white',fontWeight:700,
                border:'1px solid rgba(255,255,255,.1)'}}>
                {r.avatar
                  ? <img src={r.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  : (r.name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'white',fontSize:14,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {r.name || 'Без имени'}
                </div>
                <div style={{color:'rgba(255,255,255,.35)',fontSize:11}}>
                  {fmtTime(r.created_at)}
                </div>
              </div>
              <span style={{color:'rgba(255,255,255,.25)',fontSize:18,flexShrink:0}}>›</span>
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

  const MIN = 20;
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
        border:'1px solid rgba(255,255,255,.1)',
        boxShadow:'0 20px 60px rgba(0,0,0,.65)',
      }}>
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid rgba(255,255,255,.08)',
          display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:22}}>🚩</span>
          <div style={{flex:1}}>
            <div style={{color:'white',fontSize:16,fontWeight:700}}>Пожаловаться</div>
            <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginTop:2}}>
              Опишите, что не так. Жалоба уйдёт администратору.
            </div>
          </div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(255,255,255,.4)',
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
              background:'rgba(255,255,255,.07)',
              border:`1px solid ${trimmed.length > 0 && !canSend ? 'rgba(255,140,140,.5)' : 'rgba(255,255,255,.14)'}`,
              borderRadius:12, padding:'12px 14px', color:'white', fontSize:14,
              fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5,
            }}
          />
          <div style={{display:'flex',justifyContent:'space-between',marginTop:6,
            fontSize:11,color: trimmed.length < MIN ? 'rgba(255,180,100,.85)' : 'rgba(255,255,255,.35)'}}>
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

        <div style={{padding:'14px 22px 20px',borderTop:'1px solid rgba(255,255,255,.06)',
          display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{
              flex:1,padding:'12px',borderRadius:12,
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',
              color:'rgba(255,255,255,.8)',fontSize:14,fontWeight:600,cursor:'pointer',
            }}>
            Отмена
          </button>
          <button onClick={submit} disabled={!canSend || sending}
            style={{
              flex:2,padding:'12px',borderRadius:12,
              background: canSend && !sending ? 'rgba(200,80,80,.85)' : 'rgba(120,90,140,.4)',
              border:'1px solid ' + (canSend ? 'rgba(255,120,120,.5)' : 'rgba(255,255,255,.1)'),
              color:'white',fontSize:14,fontWeight:700,
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
  { id: 'see',       label: 'Вижу',       icon: '👁' },
  { id: 'resonate',  label: 'Резонирует', icon: '✨' },
  { id: 'talk',      label: 'Поговорить', icon: '🤝' },
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
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [copied, setCopied] = useState(false);
  const btnRef = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function openMenu(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpen(true);
  }

  function copyLink() {
    copyText(`${location.origin}/moments/${moment.id}`)
      .then(() => { setCopied(true); setTimeout(() => { setCopied(false); setOpen(false); }, 1800); })
      .catch(() => setOpen(false));
  }

  const menuItems = [
    { icon: '✎', label: 'Изменить момент', color: 'rgba(255,255,255,.88)', action: () => { setOpen(false); onEdit(moment); } },
    { icon: copied ? '✓' : '↗', label: copied ? 'Ссылка скопирована!' : 'Поделиться ссылкой', color: copied ? 'rgba(80,220,140,.9)' : 'rgba(255,255,255,.88)', action: copyLink },
    { icon: '📦', label: 'В архив', color: 'rgba(255,255,255,.88)', action: () => { setOpen(false); onArchive(moment); onClose(); } },
    { icon: '🗑', label: 'Удалить навсегда', color: 'rgba(255,100,100,.9)', action: () => { setOpen(false); onDelete(moment); onClose(); } },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        style={{
          background: open ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)',
          border: 'none', borderRadius: 10,
          padding: '7px 10px', color: 'rgba(255,255,255,.7)',
          fontSize: 18, cursor: 'pointer', transition: 'background .15s', lineHeight: 1,
        }}
      >⋯</button>

      {open && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999,
            background: 'rgba(28,18,58,.98)', backdropFilter: 'blur(20px)',
            borderRadius: 14, overflow: 'hidden', minWidth: 210,
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
            border: '1px solid rgba(255,255,255,.1)',
          }}
        >
          {menuItems.map(({ icon, label, color, action }) => (
            <div key={label} onClick={action}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                color, fontSize: 14, fontWeight: 500,
                borderBottom: '1px solid rgba(255,255,255,.05)',
                transition: 'background .13s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 17 }}>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
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
}) {
  const nav = useNavigate();

  const [idx, setIdx]           = useState(initialIndex ?? 0);
  const [moment, setMoment]     = useState(moments[initialIndex ?? 0]);
  const [myReaction, setMyReaction] = useState(moment.myReaction || null);
  const [reacting, setReacting] = useState(false);
  const [flashRxn, setFlashRxn] = useState(null); // id реакции которая на секунду подсвечивается
  const [reportOpen, setReportOpen] = useState(false);
  const [foreignMenuOpen, setForeignMenuOpen] = useState(false);
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
          border:'1px solid rgba(255,255,255,.12)', color:'white',
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
          border:'1px solid rgba(255,255,255,.12)', color:'white',
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
      const fresh = await api.getMoment(moment.id);
      setMoment(fresh);
    } catch {}
    setReacting(false);
  }

  async function handleChat() {
    try {
      const conv = await api.openConversation(moment.user_id);
      onClose();
      nav(`/chat/${conv.id}`);
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
        position:'fixed',inset:0,zIndex:700,
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
        border:'1px solid rgba(255,255,255,.1)',
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
                background: i === idx ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.3)',
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
              <div style={{padding:'24px 20px',display:'flex',flexDirection:'column',gap:12,
                background:'linear-gradient(135deg,#1a0a38,#2a1858)'}}>
                <div style={{fontSize:32,textAlign:'center'}}>🎵</div>
                <audio src={moment.media_url} controls style={{width:'100%'}}/>
              </div>
            )}
            <button onClick={onClose} style={{position:'absolute',top:12,right:12,
              background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
              border:'none',borderRadius:'50%',width:36,height:36,
              color:'white',fontSize:18,cursor:'pointer',display:'flex',
              alignItems:'center',justifyContent:'center'}}>✕</button>
            {navArrows}
          </div>
        )}

        <div style={{flex:1,overflowY:'auto'}}>
          {/* No-media mood or embedded video */}
          {!hasMedia && (
            hasEmbedVideo ? (
              <div style={{flexShrink:0,position:'relative',background:'#0a0518'}}>
                <EmbeddedVideoPreview data={moment.embedded_video} size="full"/>
                <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                  background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
                  border:'none',borderRadius:'50%',width:36,height:36,
                  color:'white',fontSize:18,cursor:'pointer',display:'flex',
                  alignItems:'center',justifyContent:'center',zIndex:10}}>✕</button>
                {navArrows}
              </div>
            ) : (
              <div style={{height:160,flexShrink:0,position:'relative'}}>
                <MoodEmoji type={moment.mood_emoji||'calm'} size={80}/>
                <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                  background:'rgba(0,0,0,.35)',border:'none',borderRadius:'50%',
                  width:36,height:36,color:'white',fontSize:18,cursor:'pointer',
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
                  else { onClose?.(); nav(`/profile/${moment.user_id}`); }
                }}
                style={{width:40,height:40,flexShrink:0,position:'relative',cursor:'pointer'}}>
                <div style={{width:40,height:40,borderRadius:'50%',
                  background:'rgba(180,140,220,.35)',overflow:'hidden',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,color:'white',fontWeight:600,
                  transition:'transform .15s'}}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  {moment.author_avatar
                    ? <img src={moment.author_avatar} alt={moment.author_name||''}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : (moment.author_name||'?')[0].toUpperCase()
                  }
                </div>
                {moment.author_is_super && (
                  <div style={{
                    position:'absolute',bottom:-1,right:-1,
                    width:14,height:14,borderRadius:'50%',
                    background:'linear-gradient(135deg,#c8a8ff,#7858b0)',
                    border:'2px solid rgba(22,15,50,.98)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:7,color:'white',fontWeight:700,
                    pointerEvents:'none',
                  }}>✦</div>
                )}
              </div>
              <div style={{flex:1,cursor:'pointer'}}
                onClick={() => {
                  if (!moment.user_id) return;
                  if (moment.user_id === currentUser?.id) { onClose?.(); nav('/me'); }
                  else { onClose?.(); nav(`/profile/${moment.user_id}`); }
                }}>
                <div style={{color:'white',fontSize:15,fontWeight:600}}>{moment.author_name}</div>
                <div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{marginLeft:6,opacity:.6}}>· редактировалось</span>}
                </div>
              </div>
              {isMine ? (
                <InlineMenu moment={moment} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} onClose={onClose}/>
              ) : (
                <ForeignAuthorMenu
                  open={foreignMenuOpen}
                  onToggle={() => setForeignMenuOpen(v => !v)}
                  onReport={() => { setForeignMenuOpen(false); setReportOpen(true); }}
                />
              )}
            </div>

            {/* Auto tags */}
            {moment.auto_tags?.length > 0 && (
              <div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {moment.auto_tags.map(tag => (
                    <span key={tag} style={{border:'1px dashed rgba(255,255,255,.25)',borderRadius:20,
                      padding:'3px 10px',fontSize:12,color:'rgba(255,255,255,.5)'}}>{tag}</span>
                  ))}
                </div>
                <div style={{color:'rgba(255,255,255,.25)',fontSize:10,marginTop:4}}>подобрано автоматически</div>
              </div>
            )}

            {/* Text */}
            <div style={{color:'rgba(255,255,255,.9)',fontSize:15,lineHeight:1.7,whiteSpace:'pre-wrap'}}>
              {moment.text}
            </div>

            {/* Embedded video (shown below text when there's also a media_url) */}
            {hasEmbedVideo && hasMedia && (
              <EmbeddedVideoPreview data={moment.embedded_video} size="full"/>
            )}

            {/* Search flag */}
            {moment.is_search && (
              <div style={{background:'rgba(60,140,100,.18)',border:'1px solid rgba(80,180,120,.25)',
                borderRadius:12,padding:'10px 14px',color:'rgba(120,220,160,.9)',fontSize:13}}>
                🤝 Автор ищет людей, идеи или возможности
              </div>
            )}

            {/* Analytics / Reactions */}
            {isMine ? (
              <>
                {moment.author_is_super ? (
                  /* Super-автор — каждый счётчик кликабелен, открывает список реактивших */
                  <div style={{background:'rgba(255,255,255,.06)',borderRadius:14,padding:'8px',
                    display:'flex',gap:4}}>
                    {[
                      { key: 'see',      icon: '👁', count: moment.stats?.see || 0,      label: 'просмотры'   },
                      { key: 'resonate', icon: '✨', count: moment.stats?.resonate || 0, label: 'резонирует' },
                      { key: 'talk',     icon: '🤝', count: moment.stats?.talk || 0,     label: 'поговорить' },
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
                          background: stat.count > 0 ? 'rgba(255,255,255,.04)' : 'transparent',
                          border:'1px solid ' + (stat.count > 0 ? 'rgba(255,255,255,.08)' : 'transparent'),
                          color: stat.count > 0 ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.3)',
                          cursor: stat.count > 0 ? 'pointer' : 'default',
                          fontFamily:'inherit',
                          display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                          transition:'background .12s',
                        }}
                        onMouseEnter={e => { if (stat.count > 0) e.currentTarget.style.background='rgba(255,255,255,.09)'; }}
                        onMouseLeave={e => { if (stat.count > 0) e.currentTarget.style.background='rgba(255,255,255,.04)'; }}>
                        <span style={{fontSize:18,lineHeight:1}}>{stat.icon}</span>
                        <span style={{fontSize:15,fontWeight:700,lineHeight:1}}>{stat.count}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Обычный — клик по строке открывает Super-промо */
                  <div
                    onClick={() => setShowAnalyticsPromo(true)}
                    style={{background:'rgba(255,255,255,.06)',borderRadius:14,padding:'12px 16px',
                      display:'flex',gap:20,cursor:'pointer'}}>
                    <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>👁 {moment.views || 0}</span>
                    <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>✨ {moment.stats?.resonate || 0}</span>
                    <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>🤝 {moment.stats?.talk || 0}</span>
                    <span style={{marginLeft:'auto',color:'rgba(255,255,255,.25)',fontSize:12}}>кто? ›</span>
                  </div>
                )}
              </>
            ) : (
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
                        background: active ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.06)',
                        border: active ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(255,255,255,.1)',
                        color: active ? 'white' : 'rgba(255,255,255,.65)',
                        fontFamily:'inherit',
                      }}>
                      <span style={{fontSize:16,lineHeight:1}}>{r.icon}</span>
                      <span style={{fontSize:12,fontWeight:500}}>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {onRestore ? (
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0,
            display:'flex',gap:8}}>
            <button onClick={() => onRestore(moment)}
              style={{flex:1,padding:'13px',borderRadius:14,
                background:'rgba(120,90,200,.75)',border:'none',
                color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
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
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
            <button onClick={handleChat}
              style={{width:'100%',padding:'13px',borderRadius:14,
                background:'rgba(100,78,148,.75)',border:'none',
                color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
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
          boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(255,255,255,.1)',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:14}}>📊</div>
          <div style={{color:'white',fontSize:17,fontWeight:700,marginBottom:8}}>Хочешь увидеть кто именно?</div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:14,lineHeight:1.5,marginBottom:20}}>
            В СУПЕР видно каждого кто отреагировал — с аватаром и временем
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={() => setShowAnalyticsPromo(false)} style={{flex:1,padding:'12px',borderRadius:13,
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',
              color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Понятно</button>
            <button onClick={() => { setShowAnalyticsPromo(false); setShowSuperInfo(true); }} style={{flex:2,padding:'12px',borderRadius:13,
              background:'rgba(120,90,200,.85)',border:'1px solid rgba(180,140,255,.3)',
              color:'white',fontSize:14,fontWeight:700,cursor:'pointer'}}>✦ Узнать больше</button>
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
          alert('✓ Жалоба отправлена. Спасибо, мы рассмотрим её.');
        }}
      />
    )}

    {reactorsModal && (
      <ReactorsModal
        filter={reactorsModal}
        reactors={reactors}
        loading={!reactors}
        onClose={() => setReactorsModal(null)}
        onOpenUser={(uid) => { setReactorsModal(null); onClose?.(); nav(`/profile/${uid}`); }}
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
            border:'none',borderRadius:'50%',width:40,height:40,color:'white',
            fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>
    )}
    </>
  );
}
