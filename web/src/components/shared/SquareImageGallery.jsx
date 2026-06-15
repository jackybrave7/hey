import { useState, useRef, useEffect } from 'react';
import { squareGalleryLayout } from '../../lib/squareGalleryLayout';
import { MediaImage } from './MediaImage';

const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 10;

/**
 * Квадратная галерея: умная сетка с span'ами, контейнер 1:1.
 * reorderable: desktop — HTML5 DnD, mobile — long-press + touch drag.
 */
function GalleryImage({ src, native, onClick, style, passPointerToParent }) {
  const imgStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    ...(passPointerToParent ? { pointerEvents: 'none' } : {}),
    ...style,
  };
  if (native) {
    return <img src={src} alt="" onClick={onClick} style={imgStyle} draggable={false} />;
  }
  return (
    <MediaImage
      src={src}
      alt=""
      onClick={onClick}
      style={imgStyle}
      draggable={false}
    />
  );
}

function indexAtPoint(x, y, root) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest('[data-gallery-index]');
  if (!cell || !root?.contains(cell)) return null;
  const idx = Number(cell.getAttribute('data-gallery-index'));
  return Number.isFinite(idx) ? idx : null;
}

export function SquareImageGallery({
  urls,
  onImageClick,
  maxWidth = 360,
  gap = 4,
  style,
  native = false,
  imageOpacity,
  renderCellExtra,
  reorderable = false,
  onReorder,
  cellReorderable,
}) {
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [touchActive, setTouchActive] = useState(false);
  const gridRef = useRef(null);
  const touchRef = useRef(null);
  const longPressRef = useRef(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const list = (urls || []).filter(Boolean);
  if (!list.length) return null;

  const layout = squareGalleryLayout(list.length);
  const visible = layout.overlayIndex != null ? list.slice(0, layout.visibleCount) : list;

  function canDragCell(idx) {
    if (!reorderable || list.length < 2) return false;
    return cellReorderable ? cellReorderable(idx) : true;
  }

  function resetDrag() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    touchRef.current = null;
    setDragFrom(null);
    setDragOver(null);
    setTouchActive(false);
  }

  function startTouchDrag(fromIndex) {
    touchRef.current = { fromIndex, active: true };
    setDragFrom(fromIndex);
    setTouchActive(true);
    try { navigator.vibrate?.(12); } catch {}
  }

  function onCellTouchStart(e, idx) {
    if (!canDragCell(idx)) return;
    if (e.target.closest('[data-no-reorder]')) return;
    const t = e.touches[0];
    if (!t) return;
    touchRef.current = { fromIndex: idx, active: false, startX: t.clientX, startY: t.clientY };
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null;
      startTouchDrag(idx);
    }, LONG_PRESS_MS);
  }

  function onGlobalTouchMove(e) {
    const td = touchRef.current;
    if (!td) return;

    const t = e.touches[0];
    if (!t) return;

    if (!td.active) {
      if (!longPressRef.current) return;
      const dx = t.clientX - td.startX;
      const dy = t.clientY - td.startY;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
        touchRef.current = null;
      }
      return;
    }

    e.preventDefault();
    const over = indexAtPoint(t.clientX, t.clientY, gridRef.current);
    setDragOver(over != null && over !== td.fromIndex ? over : null);
  }

  function onGlobalTouchEnd(e) {
    const td = touchRef.current;

    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }

    if (td?.active) {
      const t = e.changedTouches[0];
      if (t) {
        const to = indexAtPoint(t.clientX, t.clientY, gridRef.current);
        if (to != null && to !== td.fromIndex) onReorderRef.current?.(td.fromIndex, to);
      }
    }

    resetDrag();
  }

  useEffect(() => {
    if (!reorderable) return;
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('touchcancel', onGlobalTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);
    };
  }, [reorderable]);

  useEffect(() => () => resetDrag(), []);

  return (
    <div
      ref={gridRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        gap,
        width: '100%',
        maxWidth,
        aspectRatio: '1 / 1',
        touchAction: touchActive ? 'none' : (reorderable && list.length > 1 ? 'manipulation' : undefined),
        ...style,
      }}
    >
      {layout.cells.map((slot) => {
        const url = visible[slot.index];
        if (!url) return null;
        const showOverlay = layout.overlayIndex === slot.index && layout.overlayLabel;
        const opacity = imageOpacity?.(slot.index);
        const draggable = canDragCell(slot.index);
        const isDragging = dragFrom === slot.index;
        const isDropTarget = dragOver === slot.index && dragFrom != null && dragFrom !== slot.index;

        return (
          <div
            key={slot.index}
            data-gallery-index={slot.index}
            draggable={draggable}
            onTouchStart={(e) => onCellTouchStart(e, slot.index)}
            onDragStart={(e) => {
              if (!draggable) { e.preventDefault(); return; }
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(slot.index));
              setDragFrom(slot.index);
            }}
            onDragOver={(e) => {
              if (!reorderable || dragFrom == null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOver(slot.index);
            }}
            onDragLeave={() => {
              setDragOver(curr => (curr === slot.index ? null : curr));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              if (Number.isFinite(from) && from !== slot.index) onReorder?.(from, slot.index);
              resetDrag();
            }}
            onDragEnd={resetDrag}
            style={{
              gridColumn: `${slot.col} / span ${slot.colSpan}`,
              gridRow: `${slot.row} / span ${slot.rowSpan}`,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 8,
              minWidth: 0,
              minHeight: 0,
              cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : undefined,
              opacity: isDragging ? 0.45 : 1,
              outline: isDropTarget ? '2px solid rgba(180,140,255,.95)' : 'none',
              outlineOffset: -2,
              transition: isDragging || isDropTarget ? 'none' : 'opacity .15s',
              WebkitTouchCallout: 'none',
            }}
          >
            <GalleryImage
              src={url}
              native={native}
              passPointerToParent={reorderable && draggable}
              onClick={onImageClick ? (e) => {
                e.stopPropagation();
                onImageClick(url, list, slot.index);
              } : undefined}
              style={{
                cursor: onImageClick ? 'zoom-in' : 'default',
                opacity: opacity != null ? opacity : 1,
                transition: opacity != null ? 'opacity .2s' : undefined,
              }}
            />
            {showOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F9F0F0',
                  fontSize: 22,
                  fontWeight: 800,
                  pointerEvents: 'none',
                }}
              >
                {layout.overlayLabel}
              </div>
            )}
            {renderCellExtra?.(slot.index)}
          </div>
        );
      })}
    </div>
  );
}
