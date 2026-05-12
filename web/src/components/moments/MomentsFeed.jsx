// MomentsFeed.jsx — главный экран Моментов
import { useState, useEffect, useCallback } from 'react';
import { api, socket } from '../../api';
import MomentCard from './MomentCard';
import MomentDetailPopup from './MomentDetailPopup';
import MomentCreateSheet from './MomentCreateSheet';
import MomentActionMenu from './MomentActionMenu';
import MomentDelete from './MomentDelete';
import MomentDilemma from './MomentDilemma';

export default function MomentsFeed({ currentUser }) {
  const [feed, setFeed]           = useState([]);
  const [myMoment, setMyMoment]   = useState(null);    // active own moment
  const [loading, setLoading]     = useState(true);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [selected, setSelected]     = useState(null);  // moment for detail popup
  const [showCreate, setShowCreate] = useState(false);
  const [pendingData, setPendingData]           = useState(null); // data for new moment when dilemma needed
  const [conflictExisting, setConflictExisting] = useState(null); // existing moment from 409
  const [showDilemma, setShowDilemma]           = useState(false);
  const [editTarget, setEditTarget]  = useState(null); // moment being edited
  const [menuTarget, setMenuTarget]  = useState(null); // moment for action menu
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]           = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadFeed = useCallback(async () => {
    try {
      const [feedData, myData] = await Promise.all([
        api.getMomentFeed(),
        api.getMyMoments('active'),
      ]);
      setFeed(feedData.items);
      setHasMore(feedData.hasMore);
      setMyMoment(myData[0] || null);
    } catch {}
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || feed.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = feed[feed.length - 1]?.created_at;
      const data = await api.getMomentFeed(oldest);
      setFeed(prev => {
        const ids = new Set(prev.map(m => m.id));
        const fresh = data.items.filter(m => !ids.has(m.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.hasMore);
    } catch {}
    setLoadingMore(false);
  }, [feed, hasMore, loadingMore]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // WebSocket real-time updates
  useEffect(() => {
    const unsubs = [
      socket.on('moment:new', ({ moment }) => {
        setFeed(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === moment.id)) return prev;
          return [moment, ...prev];
        });
        // If it's own moment created elsewhere, update myMoment
        if (moment.user_id === currentUser?.id) {
          setMyMoment(moment);
        }
      }),
      socket.on('moment:updated', ({ moment }) => {
        setFeed(prev => prev.map(m => m.id === moment.id ? { ...m, ...moment } : m));
        setSelected(prev => prev?.id === moment.id ? { ...prev, ...moment } : prev);
        if (moment.user_id === currentUser?.id) setMyMoment(moment);
      }),
      socket.on('moment:archived', ({ momentId }) => {
        setFeed(prev => prev.filter(m => m.id !== momentId));
        if (myMoment?.id === momentId) setMyMoment(null);
        if (selected?.id === momentId) setSelected(null);
      }),
      socket.on('moment:deleted', ({ momentId }) => {
        setFeed(prev => prev.filter(m => m.id !== momentId));
        if (myMoment?.id === momentId) setMyMoment(null);
        if (selected?.id === momentId) setSelected(null);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [currentUser?.id, myMoment?.id, selected?.id]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function handleNewMomentClick() {
    if (myMoment) {
      // Will show dilemma after user composes new content
      setShowCreate(true);
    } else {
      setShowCreate(true);
    }
  }

  async function handleMomentSaved(data) {
    // If 409 conflict, data has existing moment info - show dilemma
    setShowCreate(false);
    setEditTarget(null);
    loadFeed();
  }

  function handleCreateConflict(pendingPayload, _existingMoment) {
    setPendingData(pendingPayload);
    setShowDilemma(true);
  }

  function handleDilemmaResolved(newMoment) {
    setShowDilemma(false);
    setPendingData(null);
    setMyMoment(newMoment);
    setFeed(prev => {
      const filtered = prev.filter(m => m.user_id !== currentUser?.id);
      return [newMoment, ...filtered];
    });
    showToast('✦ Момент опубликован');
  }

  async function handleArchive(momentId) {
    try {
      await api.archiveMoment(momentId);
      setFeed(prev => prev.filter(m => m.id !== momentId));
      if (myMoment?.id === momentId) setMyMoment(null);
      if (selected?.id === momentId) setSelected(null);
      showToast('📦 Момент отправлен в архив');
    } catch(err) {
      showToast('Ошибка: ' + (err.message || 'не удалось'));
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await api.deleteMoment(deleteTarget.id);
    setFeed(prev => prev.filter(m => m.id !== deleteTarget.id));
    if (myMoment?.id === deleteTarget.id) setMyMoment(null);
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
    showToast('🗑 Момент удалён навсегда');
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const otherMoments = feed.filter(m => m.user_id !== currentUser?.id);

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--grad)',
      paddingBottom:80,
    }}>
      {/* Sticky header — full-width bg, inner content limited to 680 */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{
          maxWidth:680,margin:'0 auto',
          padding:'16px 20px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <div style={{color:'white',fontSize:20,fontWeight:800,letterSpacing:-.3}}>
            ✦ Моменты
          </div>
          <button onClick={handleNewMomentClick}
            style={{
              padding:'8px 16px',borderRadius:50,fontSize:13,fontWeight:700,cursor:'pointer',
              background:'rgba(120,90,200,.85)',border:'none',color:'white',
              boxShadow:'0 2px 12px rgba(120,80,200,.4)',transition:'all .18s',
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.9)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(120,90,200,.85)'}>
            + Мой момент
          </button>
        </div>
      </div>

      {/* 2-column grid — inner content limited to 680 */}
      <div style={{padding:'14px 20px',maxWidth:680,margin:'0 auto'}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'1fr 1fr',
          gap:14,
        }}>

        {/* My moment (wide, full-width) */}
        {myMoment ? (
          <div style={{gridColumn:'span 2'}}>
            <MomentCard
              moment={myMoment}
              isMine={true}
              onClick={() => setSelected(myMoment)}
            />
          </div>
        ) : (
          /* Empty state — my moment (wide) */
          <button onClick={handleNewMomentClick}
            style={{
              gridColumn:'span 2',
              padding:'28px 20px',borderRadius:8,cursor:'pointer',
              border:'2px dashed rgba(180,140,220,.25)',
              background:'rgba(120,90,200,.06)',
              display:'flex',flexDirection:'column',alignItems:'center',gap:10,
              transition:'all .2s',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(180,140,220,.45)'; e.currentTarget.style.background='rgba(120,90,200,.1)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(180,140,220,.25)'; e.currentTarget.style.background='rgba(120,90,200,.06)'; }}>
            <div style={{fontSize:36}}>✦</div>
            <div style={{color:'white',fontSize:16,fontWeight:700}}>Создай свой первый момент</div>
            <div style={{color:'rgba(255,255,255,.4)',fontSize:13,textAlign:'center',maxWidth:260}}>
              Покажи над чем работаешь — друзья увидят
            </div>
          </button>
        )}

        {/* Section divider */}
        {!loading && otherMoments.length > 0 && (
          <div style={{
            gridColumn:'span 2',
            color:'rgba(255,255,255,.5)',fontSize:11,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'1px',
            padding:'6px 4px 0',
          }}>
            Из твоих контактов
          </div>
        )}

        {/* Feed cards */}
        {loading ? (
          <div style={{gridColumn:'span 2',textAlign:'center',padding:'40px 0',
            color:'rgba(255,255,255,.35)',fontSize:14}}>
            Загрузка…
          </div>
        ) : otherMoments.length === 0 && !myMoment ? (
          <div style={{gridColumn:'span 2',textAlign:'center',padding:'40px 20px'}}>
            <div style={{fontSize:40,marginBottom:12}}>🌱</div>
            <div style={{color:'rgba(255,255,255,.6)',fontSize:15,fontWeight:600,marginBottom:8}}>
              Лента пуста
            </div>
            <div style={{color:'rgba(255,255,255,.35)',fontSize:13,lineHeight:1.6}}>
              Когда контакты опубликуют моменты — они появятся здесь
            </div>
          </div>
        ) : (
          otherMoments.map(m => (
            <MomentCard
              key={m.id}
              moment={m}
              isMine={false}
              onClick={() => setSelected(m)}
            />
          ))
        )}

        {/* Load more */}
        {hasMore && (
          <div style={{gridColumn:'span 2', textAlign:'center', paddingTop:8}}>
            <button onClick={loadMore} disabled={loadingMore}
              style={{
                padding:'10px 28px', borderRadius:50, fontSize:13, fontWeight:600,
                background: loadingMore ? 'rgba(255,255,255,.06)' : 'rgba(120,90,200,.75)',
                border:'1px solid rgba(180,140,220,.3)', color:'white', cursor:'pointer',
                transition:'all .18s',
              }}
              onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background='rgba(140,110,220,.9)'; }}
              onMouseLeave={e => { if (!loadingMore) e.currentTarget.style.background='rgba(120,90,200,.75)'; }}>
              {loadingMore ? 'Загрузка…' : 'Показать ещё'}
            </button>
          </div>
        )}

        </div>{/* end grid */}
      </div>{/* end padding wrapper */}

      {/* ─── Overlays ─────────────────────────────────────────────────────── */}

      {selected && (
        <MomentDetailPopup
          moment={selected}
          isMine={selected.user_id === currentUser?.id}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setSelected(null); }}
          onArchive={() => handleArchive(selected.id)}
          onDelete={() => { setDeleteTarget(selected); }}
        />
      )}

      {(showCreate || editTarget) && (
        <MomentCreateSheet
          existing={editTarget || null}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
          onSaved={(result) => {
            setShowCreate(false);
            setEditTarget(null);
            if (result._conflict) {
              // 409 conflict handled in CreateSheet — it calls onConflict
            } else {
              setMyMoment(result);
              setFeed(prev => {
                const filtered = prev.filter(m => m.id !== result.id);
                if (result.user_id === currentUser?.id) {
                  return [result, ...filtered];
                }
                return [result, ...filtered];
              });
              showToast(editTarget ? '✎ Момент обновлён' : '✦ Момент опубликован');
            }
          }}
          onConflict={(payload, existing) => {
            setShowCreate(false);
            setPendingData(payload);
            setConflictExisting(existing || myMoment);
            setShowDilemma(true);
          }}
        />
      )}

      {showDilemma && pendingData && conflictExisting && (
        <MomentDilemma
          existing={conflictExisting}
          pendingData={pendingData}
          onResolved={handleDilemmaResolved}
          onClose={() => { setShowDilemma(false); setPendingData(null); setConflictExisting(null); }}
        />
      )}

      {menuTarget && (
        <MomentActionMenu
          moment={menuTarget}
          onEdit={() => { setEditTarget(menuTarget); setMenuTarget(null); }}
          onArchive={() => handleArchive(menuTarget.id)}
          onDelete={() => { setDeleteTarget(menuTarget); setMenuTarget(null); }}
          onClose={() => setMenuTarget(null)}
        />
      )}

      {deleteTarget && (
        <MomentDelete
          moment={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,.15)',
          borderRadius:50,padding:'10px 20px',
          color:'white',fontSize:14,fontWeight:600,
          zIndex:1000,whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(0,0,0,.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
