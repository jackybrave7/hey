// MomentsFeed.jsx — главный экран Моментов
import { useState, useEffect, useCallback } from 'react';
import { api, socket } from '../../api';
import MomentCard from './MomentCard';
import MomentDetailPopup from './MomentDetailPopup';
import MomentCreateSheet from './MomentCreateSheet';
import MomentActionMenu from './MomentActionMenu';
import MomentDelete from './MomentDelete';
import MomentDilemma from './MomentDilemma';
import SuperMomentGallery from './SuperMomentGallery';

export default function MomentsFeed({ currentUser }) {
  const [feed, setFeed]             = useState([]);
  const [myMoments, setMyMoments]   = useState([]);   // active own moments (array)
  const [loading, setLoading]       = useState(true);
  const [hasMore, setHasMore]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // UI state
  const [selected, setSelected]       = useState(null);  // { moments, index }
  const [showCreate, setShowCreate]   = useState(false);
  const [pendingData, setPendingData]           = useState(null);
  const [conflictExisting, setConflictExisting] = useState(null);
  const [showDilemma, setShowDilemma]           = useState(false);
  const [editTarget, setEditTarget]  = useState(null);
  const [menuTarget, setMenuTarget]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]           = useState('');

  const isSuper = !!(currentUser?.is_super);

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
      setMyMoments(Array.isArray(myData) ? myData : (myData ? [myData] : []));
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
        return [...prev, ...data.items.filter(m => !ids.has(m.id))];
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
        if (moment.user_id === currentUser?.id) {
          setMyMoments(prev => prev.some(m => m.id === moment.id) ? prev : [moment, ...prev]);
        } else {
          setFeed(prev => prev.some(m => m.id === moment.id) ? prev : [moment, ...prev]);
        }
      }),
      socket.on('moment:updated', ({ moment }) => {
        setFeed(prev => prev.map(m => m.id === moment.id ? { ...m, ...moment } : m));
        setSelected(prev => prev?.id === moment.id ? { ...prev, ...moment } : prev);
        if (moment.user_id === currentUser?.id) {
          setMyMoments(prev => prev.map(m => m.id === moment.id ? { ...m, ...moment } : m));
        }
      }),
      socket.on('moment:archived', ({ momentId }) => {
        setFeed(prev => prev.filter(m => m.id !== momentId));
        setMyMoments(prev => prev.filter(m => m.id !== momentId));
        if (selected?.moments.some(m => m.id === momentId)) setSelected(null);
      }),
      socket.on('moment:deleted', ({ momentId }) => {
        setFeed(prev => prev.filter(m => m.id !== momentId));
        setMyMoments(prev => prev.filter(m => m.id !== momentId));
        if (selected?.moments.some(m => m.id === momentId)) setSelected(null);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [currentUser?.id, selected?.id]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleArchive(moment) {
    const momentId = moment?.id || moment;
    try {
      await api.archiveMoment(momentId);
      setFeed(prev => prev.filter(m => m.id !== momentId));
      setMyMoments(prev => prev.filter(m => m.id !== momentId));
      if (selected?.moments.some(m => m.id === momentId)) setSelected(null);
      showToast('📦 Момент отправлен в архив');
    } catch(err) {
      showToast('Ошибка: ' + (err.message || 'не удалось'));
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await api.deleteMoment(deleteTarget.id);
    setFeed(prev => prev.filter(m => m.id !== deleteTarget.id));
    setMyMoments(prev => prev.filter(m => m.id !== deleteTarget.id));
    if (selected?.moments.some(m => m.id === deleteTarget.id)) setSelected(null);
    setDeleteTarget(null);
    showToast('🗑 Момент удалён навсегда');
  }

  function handleDilemmaResolved(newMoment) {
    setShowDilemma(false);
    setPendingData(null);
    setConflictExisting(null);
    setMyMoments(prev => {
      const filtered = prev.filter(m => m.id !== newMoment.id);
      return [newMoment, ...filtered];
    });
    setFeed(prev => {
      const filtered = prev.filter(m => m.id !== newMoment.id);
      return [newMoment, ...filtered];
    });
    showToast('✦ Момент опубликован');
  }

  // ─── Feed grouping ─────────────────────────────────────────────────────────
  // Group feed moments by user. Super users with multiple moments → gallery card.
  const otherMoments = feed.filter(m => m.user_id !== currentUser?.id);
  const feedGroups = [];
  const seenUsers = new Set();
  for (const m of otherMoments) {
    if (seenUsers.has(m.user_id)) continue;
    seenUsers.add(m.user_id);
    const userMoments = otherMoments
      .filter(x => x.user_id === m.user_id)
      .sort((a, b) => (b.moment_order || 0) - (a.moment_order || 0) || b.created_at - a.created_at);
    feedGroups.push({ userId: m.user_id, moments: userMoments, isSuper: !!m.author_is_super });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasMyMoments  = myMoments.length > 0;
  const canAddMore    = isSuper ? myMoments.length < 3 : myMoments.length < 1;
  const showMyGallery = isSuper && myMoments.length > 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grad)', paddingBottom: 80 }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--topbar)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <div style={{
          maxWidth: 680, margin: '0 auto',
          padding: '16px 20px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: -.3 }}>
            ✦ Моменты
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{
              padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'rgba(120,90,200,.85)', border: 'none', color: 'white',
              boxShadow: '0 2px 12px rgba(120,80,200,.4)', transition: 'all .18s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,110,220,.9)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(120,90,200,.85)'}>
            {canAddMore && hasMyMoments ? '+ Добавить' : '+ Мой момент'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '14px 20px', maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* ── My moments ── */}
          {hasMyMoments ? (
            <div style={{ gridColumn: 'span 2' }}>
              {showMyGallery ? (
                <SuperMomentGallery
                  moments={myMoments}
                  isMine={true}
                  onSelect={m => setSelected({ moments: myMoments, index: myMoments.findIndex(x => x.id === m.id) })}
                  onMomentsChanged={setMyMoments}
                />
              ) : (
                <MomentCard
                  moment={myMoments[0]}
                  isMine={true}
                  onClick={() => setSelected({ moments: myMoments, index: 0 })}
                />
              )}
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)}
              style={{
                gridColumn: 'span 2',
                padding: '28px 20px', borderRadius: 8, cursor: 'pointer',
                border: '2px dashed rgba(180,140,220,.25)',
                background: 'rgba(120,90,200,.06)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,140,220,.45)'; e.currentTarget.style.background = 'rgba(120,90,200,.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,220,.25)'; e.currentTarget.style.background = 'rgba(120,90,200,.06)'; }}>
              <div style={{ fontSize: 36 }}>✦</div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>Создай свой первый момент</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>
                Покажи над чем работаешь — друзья увидят
              </div>
            </button>
          )}

          {/* Section divider */}
          {!loading && feedGroups.length > 0 && (
            <div style={{
              gridColumn: 'span 2',
              color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '1px',
              padding: '6px 4px 0',
            }}>
              Из твоих контактов
            </div>
          )}

          {/* Feed */}
          {loading ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,.35)', fontSize: 14 }}>
              Загрузка…
            </div>
          ) : feedGroups.length === 0 && !hasMyMoments ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Лента пуста</div>
              <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 13, lineHeight: 1.6 }}>
                Когда контакты опубликуют моменты — они появятся здесь
              </div>
            </div>
          ) : (
            feedGroups.map(group => {
              const showGallery = group.isSuper && group.moments.length > 1;
              // Super users always full-width (span 2)
              if (group.isSuper) {
                return (
                  <div key={group.userId} style={{ gridColumn: 'span 2' }}>
                    {showGallery ? (
                      <SuperMomentGallery
                        moments={group.moments}
                        isMine={false}
                        onSelect={m => setSelected({ moments: group.moments, index: group.moments.findIndex(x => x.id === m.id) })}
                      />
                    ) : (
                      <MomentCard
                        moment={group.moments[0]}
                        isMine={false}
                        onClick={() => setSelected({ moments: otherMoments, index: otherMoments.findIndex(x => x.id === group.moments[0].id) })}
                      />
                    )}
                  </div>
                );
              }
              return (
                <MomentCard
                  key={group.moments[0].id}
                  moment={group.moments[0]}
                  isMine={false}
                  onClick={() => setSelected({ moments: otherMoments, index: otherMoments.findIndex(x => x.id === group.moments[0].id) })}
                />
              );
            })
          )}

          {/* Load more */}
          {hasMore && (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', paddingTop: 8 }}>
              <button onClick={loadMore} disabled={loadingMore}
                style={{
                  padding: '10px 28px', borderRadius: 50, fontSize: 13, fontWeight: 600,
                  background: loadingMore ? 'rgba(255,255,255,.06)' : 'rgba(120,90,200,.75)',
                  border: '1px solid rgba(180,140,220,.3)', color: 'white', cursor: 'pointer',
                  transition: 'all .18s',
                }}
                onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.background = 'rgba(140,110,220,.9)'; }}
                onMouseLeave={e => { if (!loadingMore) e.currentTarget.style.background = 'rgba(120,90,200,.75)'; }}>
                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ─── Overlays ──────────────────────────────────────────────────────────── */}

      {selected && (
        <MomentDetailPopup
          moments={selected.moments}
          initialIndex={selected.index ?? 0}
          currentUser={currentUser}
          onClose={() => setSelected(null)}
          onEdit={m => { setEditTarget(m); setSelected(null); }}
          onArchive={m => { handleArchive(m); setSelected(null); }}
          onDelete={m => { setDeleteTarget(m); setSelected(null); }}
        />
      )}

      {(showCreate || editTarget) && (
        <MomentCreateSheet
          existing={editTarget || null}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
          onSaved={(result) => {
            setShowCreate(false);
            setEditTarget(null);
            if (!result._conflict) {
              if (result.user_id === currentUser?.id) {
                setMyMoments(prev => editTarget
                  ? prev.map(m => m.id === result.id ? result : m)
                  : [result, ...prev.filter(m => m.id !== result.id)]);
              }
              setFeed(prev => prev.map(m => m.id === result.id ? result : m));
              showToast(editTarget ? '✎ Момент обновлён' : '✦ Момент опубликован');
            }
          }}
          onConflict={(payload, existing) => {
            setShowCreate(false);
            setPendingData(payload);
            setConflictExisting(existing || myMoments[0] || null);
            setShowDilemma(true);
          }}
        />
      )}

      {showDilemma && pendingData && conflictExisting && (
        <MomentDilemma
          existing={conflictExisting}
          pendingData={pendingData}
          currentUser={currentUser}
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,20,60,.95)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px',
          color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
