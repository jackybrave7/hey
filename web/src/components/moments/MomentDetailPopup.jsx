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

        {/* ← / → nav arrows */}
        {canPrev && (
          <button onClick={goPrev} style={{
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
          <button onClick={goNext} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            zIndex:10, width:36, height:36, borderRadius:'50%',
            background:'rgba(20,12,40,.8)', backdropFilter:'blur(8px)',
            border:'1px solid rgba(255,255,255,.12)', color:'white',
            fontSize:20, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 12px rgba(0,0,0,.5)',
          }}>›</button>
        )}

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
              </div>
            ) : (
              <div style={{height:160,flexShrink:0,position:'relative'}}>
                <MoodEmoji type={moment.mood_emoji||'calm'} size={80}/>
                <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                  background:'rgba(0,0,0,.35)',border:'none',borderRadius:'50%',
                  width:36,height:36,color:'white',fontSize:18,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              </div>
            )
          )}

          <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Author + time */}
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:40,height:40,borderRadius:'50%',
                background:'rgba(180,140,220,.35)',flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:18,color:'white',fontWeight:600,position:'relative'}}>
                {(moment.author_name||'?')[0].toUpperCase()}
                {moment.author_is_super && (
                  <div style={{
                    position:'absolute',bottom:0,right:0,
                    width:14,height:14,borderRadius:'50%',
                    background:'linear-gradient(135deg,#c8a8ff,#7858b0)',
                    border:'2px solid rgba(22,15,50,.98)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:7,color:'white',fontWeight:700,
                  }}>✦</div>
                )}
              </div>
              <div style={{flex:1}}>
                <div style={{color:'white',fontSize:15,fontWeight:600}}>{moment.author_name}</div>
                <div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{marginLeft:6,opacity:.6}}>· редактировалось</span>}
                </div>
              </div>
              {isMine && (
                <InlineMenu moment={moment} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} onClose={onClose}/>
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
                <div
                  onClick={() => { if (!moment.author_is_super) setShowAnalyticsPromo(true); }}
                  style={{background:'rgba(255,255,255,.06)',borderRadius:14,padding:'12px 16px',
                    display:'flex',gap:20,cursor: moment.author_is_super ? 'default' : 'pointer'}}>
                  <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>👁 {moment.views || 0}</span>
                  <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>✨ {moment.stats?.resonate || 0}</span>
                  <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>🤝 {moment.stats?.talk || 0}</span>
                  {!moment.author_is_super && (
                    <span style={{marginLeft:'auto',color:'rgba(255,255,255,.25)',fontSize:12}}>кто? ›</span>
                  )}
                </div>
                {moment.author_is_super && reactors && reactors.length > 0 && (
                  <div>
                    <div style={{color:'rgba(255,255,255,.35)',fontSize:11,fontWeight:600,
                      textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>
                      ⭐ Кто отреагировал
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {reactors.map(r => (
                        <div key={r.user_id + r.reaction} style={{
                          display:'flex',alignItems:'center',gap:10,
                          background:'rgba(255,255,255,.05)',borderRadius:10,padding:'8px 12px',
                        }}>
                          <div style={{width:30,height:30,borderRadius:'50%',flexShrink:0,
                            background:'rgba(180,140,220,.3)',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:13,color:'white',fontWeight:600,overflow:'hidden'}}>
                            {r.avatar
                              ? <img src={r.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              : (r.name||'?')[0].toUpperCase()}
                          </div>
                          <span style={{color:'rgba(255,255,255,.8)',fontSize:13,flex:1}}>{r.name}</span>
                          <span style={{fontSize:16}}>
                            {r.reaction === 'see' ? '👁' : r.reaction === 'resonate' ? '✨' : '🤝'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <div style={{color:'rgba(255,255,255,.45)',fontSize:12,marginBottom:10,
                  textTransform:'uppercase',letterSpacing:.5}}>Отклик</div>
                <div style={{display:'flex',gap:8}}>
                  {REACTIONS.map(r => (
                    <button key={r.id} onClick={() => handleReact(r.id)}
                      style={{
                        flex:1,padding:'11px 0',borderRadius:14,fontSize:13,fontWeight:600,
                        cursor:'pointer',transition:'all .18s',
                        background: myReaction===r.id ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
                        border: myReaction===r.id ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(255,255,255,.12)',
                        color: myReaction===r.id ? 'white' : 'rgba(255,255,255,.7)',
                      }}>
                      <div style={{fontSize:18}}>{r.icon}</div>
                      <div style={{fontSize:11,marginTop:2}}>{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {onRestore ? (
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
            <button onClick={() => onRestore(moment)}
              style={{width:'100%',padding:'13px',borderRadius:14,
                background:'rgba(120,90,200,.75)',border:'none',
                color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              ↩ Вернуть в активные
            </button>
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
