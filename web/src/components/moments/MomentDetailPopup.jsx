// MomentDetailPopup.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import MoodEmoji from './MoodEmoji';

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
}

const REACTIONS = [
  { id: 'see',       label: 'Вижу',       icon: '👁' },
  { id: 'resonate',  label: 'Резонирует', icon: '✨' },
  { id: 'talk',      label: 'Поговорить', icon: '🤝' },
];

// Inline contextual menu triggered by ⋯
function InlineMenu({ moment, onEdit, onArchive, onDelete, onClose }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}/moments/${moment.id}`).catch(() => {});
    setOpen(false);
  }

  const menuItems = [
    {
      icon: '✎', label: 'Изменить момент', color: 'rgba(255,255,255,.88)',
      action: () => { setOpen(false); onEdit(); },
    },
    {
      icon: '↗', label: 'Поделиться ссылкой', color: 'rgba(255,255,255,.88)',
      action: copyLink,
    },
    {
      icon: '📦', label: 'В архив', color: 'rgba(255,255,255,.88)',
      action: () => { setOpen(false); onArchive(); onClose(); },
    },
    {
      icon: '🗑', label: 'Удалить навсегда', color: 'rgba(255,100,100,.9)',
      action: () => { setOpen(false); onDelete(); onClose(); },
    },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)',
          border: 'none', borderRadius: 10,
          padding: '7px 10px', color: 'rgba(255,255,255,.7)',
          fontSize: 18, cursor: 'pointer', transition: 'background .15s',
          lineHeight: 1,
        }}
      >⋯</button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: 'rgba(28,18,58,.98)', backdropFilter: 'blur(20px)',
          borderRadius: 14, overflow: 'hidden', minWidth: 210,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          border: '1px solid rgba(255,255,255,.1)',
        }}>
          {menuItems.map(({ icon, label, color, action }) => (
            <div
              key={label}
              onClick={action}
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
        </div>
      )}
    </div>
  );
}

export default function MomentDetailPopup({ moment: initial, isMine, onClose, onEdit, onArchive, onDelete }) {
  const nav = useNavigate();
  const [moment, setMoment] = useState(initial);
  const [myReaction, setMyReaction] = useState(initial.myReaction || null);
  const [reacting, setReacting] = useState(false);

  // Register view
  useEffect(() => {
    if (!isMine) {
      api.viewMoment(moment.id).catch(() => {});
    }
  }, [moment.id, isMine]);

  // Refresh stats
  useEffect(() => {
    api.getMoment(moment.id).then(m => {
      setMoment(m);
      setMyReaction(m.myReaction || null);
    }).catch(() => {});
  }, [moment.id]);

  async function handleReact(reaction) {
    if (reacting) return;
    setReacting(true);
    try {
      if (myReaction === reaction) {
        await api.unreactMoment(moment.id);
        setMyReaction(null);
      } else {
        const res = await api.reactMoment(moment.id, reaction);
        setMyReaction(reaction);
        if (reaction === 'talk' && res.chatId) {
          onClose();
          nav(`/chat/${res.chatId}`);
          return;
        }
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

  const hasMedia = !!moment.media_url;

  return (
    <div
      style={{
        position:'fixed',inset:0,zIndex:700,
        background:'rgba(0,0,0,.72)',backdropFilter:'blur(16px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'20px',
      }}
      onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}
    >
      <div style={{
        background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(100%,520px)',
        maxHeight:'90vh',display:'flex',flexDirection:'column',
        boxShadow:'0 8px 48px rgba(0,0,0,.6)',
        border:'1px solid rgba(255,255,255,.1)',
        overflow:'hidden',
      }}>
        {/* Media */}
        {hasMedia && (
          <div style={{flexShrink:0,position:'relative',background:'#0a0518',maxHeight:'45vh',overflow:'hidden'}}>
            {moment.media_type === 'image' && (
              <img src={moment.media_url} alt=""
                style={{width:'100%',maxHeight:'45vh',objectFit:'contain',display:'block'}}/>
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
          {/* No-media mood */}
          {!hasMedia && (
            <div style={{height:160,flexShrink:0,position:'relative'}}>
              <MoodEmoji type={moment.mood_emoji||'calm'} size={80}/>
              <button onClick={onClose} style={{position:'absolute',top:12,right:12,
                background:'rgba(0,0,0,.35)',border:'none',borderRadius:'50%',
                width:36,height:36,color:'white',fontSize:18,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          )}

          <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
            {/* Author + time */}
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:40,height:40,borderRadius:'50%',
                background:'rgba(180,140,220,.35)',flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:18,color:'white',fontWeight:600}}>
                {(moment.author_name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{color:'white',fontSize:15,fontWeight:600}}>{moment.author_name}</div>
                <div style={{color:'rgba(255,255,255,.4)',fontSize:12}}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{marginLeft:6,opacity:.6}}>· редактировалось</span>}
                </div>
              </div>
              {/* ⋯ inline menu for own moments */}
              {isMine && (
                <InlineMenu
                  moment={moment}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onClose={onClose}
                />
              )}
            </div>

            {/* Auto tags */}
            {moment.auto_tags?.length > 0 && (
              <div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {moment.auto_tags.map(tag => (
                    <span key={tag} style={{
                      border:'1px dashed rgba(255,255,255,.25)',borderRadius:20,
                      padding:'3px 10px',fontSize:12,color:'rgba(255,255,255,.5)'
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{color:'rgba(255,255,255,.25)',fontSize:10,marginTop:4}}>подобрано автоматически</div>
              </div>
            )}

            {/* Text */}
            <div style={{color:'rgba(255,255,255,.9)',fontSize:15,lineHeight:1.7,whiteSpace:'pre-wrap'}}>
              {moment.text}
            </div>

            {/* Search flag */}
            {moment.is_search && (
              <div style={{background:'rgba(60,140,100,.18)',border:'1px solid rgba(80,180,120,.25)',
                borderRadius:12,padding:'10px 14px',color:'rgba(120,220,160,.9)',fontSize:13}}>
                🤝 Автор ищет людей, идеи или возможности
              </div>
            )}

            {/* Analytics (own) or Reactions (other) */}
            {isMine ? (
              <div style={{background:'rgba(255,255,255,.06)',borderRadius:14,padding:'12px 16px',
                display:'flex',gap:20}}>
                <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>👁 {moment.views || 0}</span>
                <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>✨ {moment.stats?.resonate || 0} резонирует</span>
                <span style={{color:'rgba(255,255,255,.6)',fontSize:14}}>🤝 {moment.stats?.talk || 0}</span>
              </div>
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

        {/* Footer — only for other people's moments */}
        {!isMine && (
          <div style={{padding:'14px 20px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
            <button onClick={handleChat}
              style={{width:'100%',padding:'13px',borderRadius:14,
                background:'rgba(100,78,148,.75)',border:'none',
                color:'white',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              ✉ Написать {moment.author_name?.split(' ')[0]}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
