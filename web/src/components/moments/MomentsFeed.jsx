// MomentsFeed.jsx — главный экран Моментов
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, socket } from '../../api';
import MomentCard from './MomentCard';
import MomentDetailPopup from './MomentDetailPopup';
import MomentCreateSheet from './MomentCreateSheet';
import MomentActionMenu from './MomentActionMenu';
import MomentDelete from './MomentDelete';
import MomentDilemma from './MomentDilemma';
import SuperMomentGallery from './SuperMomentGallery';
import SuperInfoScreen from '../super/SuperInfoScreen';
import { useSalesPressure } from '../../lib/publicSettings';

export default function MomentsFeed({ currentUser }) {
  const salesPressure = useSalesPressure();
  const location = useLocation();
  const nav = useNavigate();
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
  const [showSuperInfo, setShowSuperInfo] = useState(false);

  // Drag-to-reorder для своих моментов.
  // Реализовано через Pointer Events + долгий тап для тача — нативный
  // HTML5 DnD на Android не работает вообще, плюс <img> поднимает свой
  // контекст-меню на long-press. Pointer events работают и для мыши, и
  // для пальца; для тача требуем 400мс hold чтобы отделить от вертикального
  // скролла и от обычного тапа-открытия момента.
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const dragRef = useRef({
    pointerId: null, startX: 0, startY: 0, holdTimer: null,
    armed: false, // long-press уже сработал → нужно сместить чтобы инициировать drag
    dragging: false,
  });

  // Auto-open моментa, если пришли по /moments/:id (redirect от MomentPage)
  // или после deep-link через router.state.openMomentId. После первого
  // открытия чистим state, чтобы при ручном закрытии попапа он не
  // открывался обратно (Back в браузере оставлял бы state).
  useEffect(() => {
    const openId = location.state?.openMomentId;
    if (!openId) return;
    let alive = true;
    api.getMoment(openId)
      .then(m => {
        if (!alive || !m) return;
        setSelected({ moments: [m], index: 0 });
      })
      .catch(() => {})
      .finally(() => {
        // Стираем state, чтобы повторных авто-открытий не было.
        if (alive) nav(location.pathname, { replace: true, state: null });
      });
    return () => { alive = false; };
  }, [location.state?.openMomentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-top — показываем кнопку когда юзер прокрутил ленту глубоко
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 600); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Поиск индекса тайла под текущими координатами через elementFromPoint.
  // Каждый тайл несёт data-momentslot=idx — это надёжнее чем хитро ловить
  // event.target (там может оказаться <img> или вложенный текст).
  function slotIdxAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return -1;
    const slot = el.closest('[data-momentslot]');
    if (!slot) return -1;
    const v = parseInt(slot.getAttribute('data-momentslot'));
    return Number.isFinite(v) ? v : -1;
  }

  function onPointerDown(e, idx) {
    // Только основная кнопка мыши / пальцем
    if (e.button !== undefined && e.button !== 0) return;
    const isTouch = e.pointerType === 'touch';
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      holdTimer: null, armed: !isTouch, // мышью — сразу armed; тачем — после hold
      dragging: false, fromIdx: idx,
    };
    // Захватываем pointer, чтобы получать move/up даже если палец уехал с тайла
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    if (isTouch) {
      // Долгий тап (400мс) — переводим в armed-режим, дальше move инициирует drag
      dragRef.current.holdTimer = setTimeout(() => {
        const ref = dragRef.current;
        if (ref.pointerId === e.pointerId) {
          ref.armed = true;
          // Лёгкая вибрация-сигнал «можно тащить»
          try { navigator.vibrate?.(15); } catch {}
          // Подсветим что готовы тащить
          setDragIdx(ref.fromIdx);
        }
      }, 400);
    }
  }

  function onPointerMove(e) {
    const ref = dragRef.current;
    if (ref.pointerId !== e.pointerId) return;
    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;
    // До инициации drag (на тач — до long-press, на мышь — после порога 5px)
    if (!ref.dragging) {
      if (!ref.armed) {
        // Если палец заметно двинулся ДО long-press — это скролл, отменяем hold
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          clearTimeout(ref.holdTimer);
          ref.holdTimer = null;
          ref.pointerId = null;
        }
        return;
      }
      // armed — проверим есть ли движение, чтобы начать
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      ref.dragging = true;
      setDragIdx(ref.fromIdx);
    }
    // Drag активен — определяем над каким слотом находимся
    const idx = slotIdxAt(e.clientX, e.clientY);
    if (idx >= 0 && idx !== overIdx) setOverIdx(idx);
  }

  async function onPointerUp(e) {
    const ref = dragRef.current;
    if (ref.pointerId !== e.pointerId) return;
    clearTimeout(ref.holdTimer);
    const fromIdx = ref.fromIdx;
    const wasDragging = ref.dragging;
    const toIdx = wasDragging ? slotIdxAt(e.clientX, e.clientY) : -1;
    dragRef.current = { pointerId: null, holdTimer: null, armed: false, dragging: false };
    setDragIdx(null);
    setOverIdx(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}

    if (wasDragging) {
      // Гасим click который браузер пошлёт сразу после pointerup —
      // иначе после перетаскивания откроется детальный popup момента.
      dragRef.current.suppressClickUntil = Date.now() + 300;
    }
    if (!wasDragging || toIdx < 0 || toIdx === fromIdx) return;
    const next = [...myMoments];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setMyMoments(next);
    try {
      await api.reorderMoments(next.map(m => m.id));
    } catch(err) {
      setMyMoments(myMoments);
      showToast('Не удалось сохранить порядок');
    }
  }

  function onPointerCancel(e) {
    const ref = dragRef.current;
    if (ref.pointerId !== e.pointerId) return;
    clearTimeout(ref.holdTimer);
    dragRef.current = { pointerId: null, holdTimer: null, armed: false, dragging: false };
    setDragIdx(null);
    setOverIdx(null);
  }

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
      // Реакция — дёргаем актуальный момент и обновляем счётчики во всех
      // местах где он сейчас отображается (лента, мои моменты, открытый
      // popup). Без этого автор видел свой момент со старыми счётчиками
      // пока не перезагрузит страницу.
      socket.on('moment:reaction', ({ momentId }) => {
        api.getMoment(momentId).then(fresh => {
          if (!fresh) return;
          setFeed(prev => prev.map(m => m.id === momentId ? { ...m, ...fresh } : m));
          setMyMoments(prev => prev.map(m => m.id === momentId ? { ...m, ...fresh } : m));
          setSelected(prev => prev && prev.moments
            ? { ...prev, moments: prev.moments.map(m => m.id === momentId ? { ...m, ...fresh } : m) }
            : prev);
        }).catch(() => {});
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
          {canAddMore && (
            <button onClick={() => setShowCreate(true)}
              style={{
                padding: '8px 16px', borderRadius: 50, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(120,90,200,.85)', border: 'none', color: 'white',
                boxShadow: '0 2px 12px rgba(120,80,200,.4)', transition: 'all .18s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,110,220,.9)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(120,90,200,.85)'}>
              {hasMyMoments ? '+ Добавить' : '+ Мой момент'}
            </button>
          )}
        </div>
      </div>

      {/* ─── My moments section ─────────────────────────────────────────── */}
      <div style={{ padding: '14px 20px 0', maxWidth: 680, margin: '0 auto' }}>
        {hasMyMoments ? (
          <>
            {/* 3-column grid of slots — свои моменты можно перетаскивать */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              {myMoments.map((m, idx) => (
                <div key={m.id}
                  data-momentslot={idx}
                  onPointerDown={e => onPointerDown(e, idx)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  // На <img> внутри MomentCard Android поднимает контекст-меню
                  // через long-press. Блокируем нативный callout + selection,
                  // плюс touch-action:none — иначе long-press съест браузер
                  // раньше нашего таймера.
                  onContextMenu={e => e.preventDefault()}
                  style={{
                    cursor: dragIdx !== null ? 'grabbing' : 'grab',
                    opacity: dragIdx === idx ? 0.4 : 1,
                    transform: overIdx === idx && dragIdx !== null && dragIdx !== idx
                      ? 'scale(1.05)' : 'scale(1)',
                    transition: 'transform .15s, opacity .15s',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitUserDrag: 'none',
                  }}>
                  <MomentCard
                    moment={m}
                    isMine={true}
                    onClick={() => {
                      // Если только что отпустили drag — давим click, иначе
                      // popup откроется сразу после перетаскивания.
                      if (dragRef.current.suppressClickUntil
                          && Date.now() < dragRef.current.suppressClickUntil) return;
                      setSelected({ moments: myMoments, index: idx });
                    }}
                  />
                </div>
              ))}

              {/* Super: "+ Добавить" placeholders for remaining slots up to 3 */}
              {isSuper && myMoments.length < 3 && (
                <button onClick={() => setShowCreate(true)}
                  style={{
                    aspectRatio:'1 / 1', borderRadius:12, cursor:'pointer',
                    border:'2px dashed rgba(180,140,220,.4)',
                    background:'rgba(120,90,200,.06)',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    gap:6, color:'white', transition:'all .15s',
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(120,90,200,.14)'; e.currentTarget.style.borderColor='rgba(180,140,220,.6)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(120,90,200,.06)'; e.currentTarget.style.borderColor='rgba(180,140,220,.4)'; }}>
                  <span style={{fontSize:28,lineHeight:1}}>+</span>
                  <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,.85)'}}>Добавить</span>
                </button>
              )}

              {/* Non-Super: "Ещё в СУПЕР" locked teaser (only when has 1 moment).
                  В мягком режиме продаж (L1) промо на главной не показываем
                  совсем — это одна из ключевых точек, которые админ просил
                  убрать, чтобы лента не напоминала о платных фичах. */}
              {!isSuper && myMoments.length === 1 && salesPressure >= 2 && (
                <button onClick={() => setShowSuperInfo(true)}
                  style={{
                    aspectRatio:'1 / 1', borderRadius:12, cursor:'pointer',
                    border:'2px dashed rgba(180,140,220,.22)',
                    background:'rgba(255,255,255,.04)',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    gap:6, transition:'all .15s',
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(180,140,220,.08)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.04)'; }}>
                  <span style={{fontSize:20,color:'rgba(180,140,220,.6)'}}>✦</span>
                  <span style={{fontSize:12,fontWeight:500,color:'rgba(200,170,255,.55)'}}>Ещё в СУПЕР</span>
                </button>
              )}
            </div>
          </>
        ) : (
          // Нет своих моментов — большой онбординг-CTA на всю ширину
          <button onClick={() => setShowCreate(true)}
            style={{
              width:'100%',
              padding: '28px 20px', borderRadius: 12, cursor: 'pointer',
              border: '2px dashed rgba(180,140,220,.25)',
              background: 'rgba(120,90,200,.06)',
              display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 18,
              transition: 'all .2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,140,220,.45)'; e.currentTarget.style.background = 'rgba(120,90,200,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,140,220,.25)'; e.currentTarget.style.background = 'rgba(120,90,200,.06)'; }}>
            <div style={{ fontSize: 36, flexShrink:0,
              width:60,height:60,borderRadius:14,
              background:'rgba(120,90,200,.35)',
              display:'flex',alignItems:'center',justifyContent:'center'}}>✦</div>
            <div style={{textAlign:'left',flex:1}}>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700, marginBottom:4 }}>Создай свой первый момент</div>
              <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 13 }}>
                Покажи над чем работаешь — друзья увидят
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ─── Contacts feed ──────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 14px', maxWidth: 680, margin: '0 auto' }}>
        {!loading && feedGroups.length > 0 && (
          <div style={{
            color: 'rgba(255,255,255,.5)', fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '1px',
            padding: '0 4px 12px',
            borderTop:'1px solid rgba(255,255,255,.06)',
            paddingTop:14,marginTop:6,
          }}>
            Из твоих контактов
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
            // Каждый автор — одна квадратная карточка. По клику открывается
            // попап со всеми его моментами (можно листать).
            feedGroups.map(group => {
              const first = group.moments[0];
              return (
                <MomentCard
                  key={first.id}
                  moment={first}
                  isMine={false}
                  onClick={() => setSelected({
                    moments: group.moments,
                    index: 0,
                  })}
                />
              );
            })
          )}

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
          // Реакция/просмотр изменились в попапе → апдейтим ленту,
          // чтобы мини-иконки в каталоге показались сразу.
          onMomentUpdated={(fresh) => {
            const patch = (arr) => arr.map(m => m.id === fresh.id ? { ...m, ...fresh } : m);
            setFeed(patch);
            setMyMoments(patch);
            setSelected(s => s ? { ...s, moments: patch(s.moments) } : s);
          }}
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

      {showSuperInfo && (
        <SuperInfoScreen
          onClose={() => setShowSuperInfo(false)}
          onInvite={() => setShowSuperInfo(false)}
        />
      )}

      {/* Floating scroll-to-top — появляется когда лента прокручена далеко вниз */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Наверх"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 80,  // над BottomNav (60px height + breathing room)
            zIndex: 400,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(120,90,200,.92)',
            border: '1px solid rgba(180,140,220,.5)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(80,50,150,.45),0 2px 6px rgba(0,0,0,.2)',
            transition: 'transform .15s, background .15s',
            fontFamily: 'inherit',
            fontSize: 20, fontWeight: 700, lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(140,110,220,1)'; e.currentTarget.style.transform='translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(120,90,200,.92)'; e.currentTarget.style.transform='translateY(0)'; }}>
          ↑
        </button>
      )}
    </div>
  );
}
