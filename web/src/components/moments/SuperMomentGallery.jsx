// SuperMomentGallery.jsx — full-width gallery for Super users with multiple active moments
import { useState, useEffect } from 'react';
import { api } from '../../api';
import MomentCard from './MomentCard';

export default function SuperMomentGallery({ moments: initialMoments, isMine, onSelect, onMomentsChanged }) {
  const [moments, setMoments] = useState(initialMoments);
  const [idx, setIdx] = useState(0);

  // Sync when parent passes a new moments list (e.g. after WS update)
  useEffect(() => {
    const incoming = initialMoments.map(m => m.id).join();
    const current  = moments.map(m => m.id).join();
    if (incoming !== current) {
      setMoments(initialMoments);
      setIdx(i => Math.min(i, initialMoments.length - 1));
    }
  }, [initialMoments]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = moments[idx] || moments[0];
  if (!current) return null;

  const canPrev = idx > 0;
  const canNext = idx < moments.length - 1;

  function go(newIdx) { setIdx(Math.max(0, Math.min(moments.length - 1, newIdx))); }

  async function moveLeft() {
    if (!canPrev) return;
    const reordered = [...moments];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    try {
      await api.reorderMoments(reordered.map(m => m.id));
      setMoments(reordered);
      setIdx(idx - 1);
      onMomentsChanged?.(reordered);
    } catch {}
  }

  async function moveRight() {
    if (!canNext) return;
    const reordered = [...moments];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    try {
      await api.reorderMoments(reordered.map(m => m.id));
      setMoments(reordered);
      setIdx(idx + 1);
      onMomentsChanged?.(reordered);
    } catch {}
  }

  return (
    <div>
      {/* Super badge header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, paddingLeft: 4,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(90deg, rgba(200,160,255,.18), rgba(120,80,200,.18))',
          border: '1px solid rgba(200,160,255,.25)',
          borderRadius: 50, padding: '3px 10px',
        }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <span style={{ color: 'rgba(220,180,255,.9)', fontSize: 11, fontWeight: 700 }}>
            Супер · {moments.length} {moments.length === 1 ? 'момент' : moments.length < 5 ? 'момента' : 'моментов'}
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,.28)', fontSize: 11 }}>
          {idx + 1} / {moments.length}
        </span>
      </div>

      {/* Card + side nav */}
      <div style={{ position: 'relative' }}>
        <MomentCard moment={current} isMine={isMine} onClick={() => onSelect(current)} />

        {canPrev && (
          <button
            onClick={e => { e.stopPropagation(); go(idx - 1); }}
            style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(20,12,40,.75)', backdropFilter: 'blur(8px)',
              color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,.4)', zIndex: 10, transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,70,170,.8)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(20,12,40,.75)'}
          >‹</button>
        )}

        {canNext && (
          <button
            onClick={e => { e.stopPropagation(); go(idx + 1); }}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(20,12,40,.75)', backdropFilter: 'blur(8px)',
              color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,.4)', zIndex: 10, transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,70,170,.8)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(20,12,40,.75)'}
          >›</button>
        )}
      </div>

      {/* Dot indicators */}
      {moments.length > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
          {moments.map((_, i) => (
            <div
              key={i}
              onClick={() => go(i)}
              style={{
                width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === idx ? 'rgba(180,140,220,.9)' : 'rgba(255,255,255,.25)',
                cursor: 'pointer', transition: 'all .2s',
              }}
            />
          ))}
        </div>
      )}

      {/* Reorder controls (isMine only, when more than 1 moment) */}
      {isMine && moments.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8,
        }}>
          <button
            onClick={moveLeft}
            disabled={!canPrev}
            style={{
              background: canPrev ? 'rgba(255,255,255,.08)' : 'transparent',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 50,
              padding: '4px 14px', color: canPrev ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.2)',
              fontSize: 12, cursor: canPrev ? 'pointer' : 'default', transition: 'all .15s',
            }}
          >← Переместить</button>
          <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 11 }}>порядок</span>
          <button
            onClick={moveRight}
            disabled={!canNext}
            style={{
              background: canNext ? 'rgba(255,255,255,.08)' : 'transparent',
              border: '1px solid rgba(255,255,255,.1)', borderRadius: 50,
              padding: '4px 14px', color: canNext ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.2)',
              fontSize: 12, cursor: canNext ? 'pointer' : 'default', transition: 'all .15s',
            }}
          >Переместить →</button>
        </div>
      )}
    </div>
  );
}
