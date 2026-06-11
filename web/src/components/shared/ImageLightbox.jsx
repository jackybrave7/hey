import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaImage } from './MediaImage';

function clampPan(px, py, imgW, imgH, viewW, viewH) {
  if (!imgW || !imgH || !viewW || !viewH) return { x: px, y: py };
  const maxX = Math.max(0, (imgW - viewW) / 2);
  const maxY = Math.max(0, (imgH - viewH) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, px)),
    y: Math.max(-maxY, Math.min(maxY, py)),
  };
}

const SWIPE_COMMIT_RATIO = 0.22;
const SWIPE_VELOCITY = 0.35;
const SLIDE_MS = 320;

/**
 * Просмотр фото: сначала вписывается в экран, повторный тап/клик — натуральный
 * размер с перетаскиванием по деталям в пределах кадра.
 * Несколько фото — горизонтальная галерея со свайп-анимацией.
 */
export function ImageLightbox({
  urls,
  index = 0,
  onClose,
  onIndexChange,
  zIndex = 500,
  children,
}) {
  const [zoomed, setZoomed] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [slideAnim, setSlideAnim] = useState(false);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const swipeRef = useRef(null);
  const movedRef = useRef(false);
  const pendingIndexRef = useRef(null);

  const total = urls?.length || 0;
  const current = urls?.[index];
  const canPrev = index > 0;
  const canNext = index < total - 1;
  const gallery = !zoomed && total > 1;

  useEffect(() => {
    setZoomed(false);
    setNatural({ w: 0, h: 0 });
    setPan({ x: 0, y: 0 });
    setDragX(0);
    setSlideAnim(false);
    pendingIndexRef.current = null;
  }, [index, current]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoomed, gallery]);

  useEffect(() => {
    if (!zoomed) return;
    setPan(p => clampPan(p.x, p.y, natural.w, natural.h, viewSize.w, viewSize.h));
  }, [zoomed, natural.w, natural.h, viewSize.w, viewSize.h]);

  const finishSlide = useCallback(() => {
    const target = pendingIndexRef.current;
    if (target != null && target !== index) onIndexChange?.(target);
    pendingIndexRef.current = null;
    setDragX(0);
    setSlideAnim(false);
  }, [index, onIndexChange]);

  const animateToIndex = useCallback((targetIndex) => {
    if (!onIndexChange || targetIndex === index) return;
    const w = viewSize.w;
    if (!w) {
      onIndexChange(targetIndex);
      return;
    }
    pendingIndexRef.current = targetIndex;
    setSlideAnim(true);
    setDragX(targetIndex > index ? -w : w);
  }, [index, onIndexChange, viewSize.w]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (zoomed) {
          setZoomed(false);
          setPan({ x: 0, y: 0 });
          return;
        }
        onClose?.();
        return;
      }
      if (zoomed || !onIndexChange || slideAnim) return;
      if (e.key === 'ArrowLeft' && canPrev) animateToIndex(index - 1);
      if (e.key === 'ArrowRight' && canNext) animateToIndex(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed, canPrev, canNext, index, onClose, onIndexChange, slideAnim, animateToIndex]);

  const toggleZoom = useCallback((e) => {
    if (movedRef.current) return;
    e?.stopPropagation?.();
    setZoomed(z => {
      if (z) setPan({ x: 0, y: 0 });
      return !z;
    });
  }, []);

  const onBackdropClick = useCallback(() => {
    if (zoomed) {
      setZoomed(false);
      setPan({ x: 0, y: 0 });
      return;
    }
    onClose?.();
  }, [zoomed, onClose]);

  const rubberBand = useCallback((dx) => {
    if ((dx > 0 && !canPrev) || (dx < 0 && !canNext)) return dx * 0.32;
    return dx;
  }, [canPrev, canNext]);

  const onSwipePointerDown = (e) => {
    if (!gallery || e.button !== 0 || slideAnim) return;
    movedRef.current = false;
    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startDragX: dragX,
      t: Date.now(),
      axis: null,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSwipePointerMove = (e) => {
    const s = swipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (s.axis !== 'x') {
        swipeRef.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        return;
      }
    }
    if (s.axis !== 'x') return;
    e.preventDefault();
    if (Math.abs(dx) > 8) movedRef.current = true;
    setDragX(rubberBand(s.startDragX + dx));
  };

  const onSwipePointerUp = (e) => {
    const s = swipeRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    swipeRef.current = null;

    const dx = e.clientX - s.startX;
    const dt = Math.max(1, Date.now() - s.t);
    const w = viewSize.w || viewportRef.current?.clientWidth || 0;
    const velocity = dx / dt;

    let target = index;
    if (w && (dx < -w * SWIPE_COMMIT_RATIO || velocity < -SWIPE_VELOCITY) && canNext) {
      target = index + 1;
    } else if (w && (dx > w * SWIPE_COMMIT_RATIO || velocity > SWIPE_VELOCITY) && canPrev) {
      target = index - 1;
    }

    if (target !== index) {
      animateToIndex(target);
      return;
    }

    if (Math.abs(dragX) > 1) {
      pendingIndexRef.current = null;
      setSlideAnim(true);
      setDragX(0);
    }
  };

  const onPanPointerDown = (e) => {
    if (!zoomed || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPanPointerMove = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setPan(clampPan(
      dragRef.current.panX + dx,
      dragRef.current.panY + dy,
      natural.w,
      natural.h,
      viewSize.w,
      viewSize.h,
    ));
  };

  const endPan = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const wasTap = !movedRef.current;
    dragRef.current = null;
    setDragging(false);
    if (wasTap) toggleZoom(e);
  };

  if (!current) return null;

  const navBtn = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: zIndex + 2,
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(249,240,240,.12)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(249,240,240,.18)',
    color: '#F9F0F0',
    fontSize: 24,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const slideStyle = gallery ? {
    display: 'flex',
    height: '100%',
    width: '100%',
    transform: `translateX(${-index * viewSize.w + dragX}px)`,
    transition: slideAnim ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
    willChange: 'transform',
  } : null;

  const imageCellStyle = {
    flex: '0 0 100%',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
  };

  const fittedImageStyle = {
    maxWidth: '90vw',
    maxHeight: '80vh',
    objectFit: 'contain',
    borderRadius: 14,
    boxShadow: '0 8px 48px rgba(0,0,0,.6)',
    cursor: 'zoom-in',
    userSelect: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(0,0,0,.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onBackdropClick}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          zIndex: zIndex + 3,
          background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(8px)',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          color: '#F9F0F0',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {!zoomed && total > 1 && (
        <div style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: zIndex + 2,
          color: 'rgba(249,240,240,.85)',
          fontSize: 14,
          fontWeight: 600,
          background: 'rgba(0,0,0,.4)',
          padding: '5px 14px',
          borderRadius: 20,
          pointerEvents: 'none',
        }}>
          {index + 1} / {total}
        </div>
      )}

      {!zoomed && canPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); animateToIndex(index - 1); }}
          style={{ ...navBtn, left: 20 }}
        >
          ‹
        </button>
      )}
      {!zoomed && canNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); animateToIndex(index + 1); }}
          style={{ ...navBtn, right: 20 }}
        >
          ›
        </button>
      )}

      <div
        ref={viewportRef}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={zoomed ? onPanPointerDown : gallery ? onSwipePointerDown : undefined}
        onPointerMove={zoomed ? onPanPointerMove : gallery ? onSwipePointerMove : undefined}
        onPointerUp={zoomed ? endPan : gallery ? onSwipePointerUp : undefined}
        onPointerCancel={zoomed ? endPan : gallery ? onSwipePointerUp : undefined}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          touchAction: gallery ? 'pan-y pinch-zoom' : zoomed ? 'none' : 'manipulation',
          cursor: zoomed ? (dragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {zoomed && natural.w > 0 ? (
          <MediaImage
            src={current}
            alt=""
            onLoad={(e) => {
              setNatural({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              });
            }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: natural.w,
              height: natural.h,
              maxWidth: 'none',
              maxHeight: 'none',
              objectFit: 'contain',
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        ) : gallery ? (
          <div
            style={slideStyle}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'transform' && slideAnim) finishSlide();
            }}
          >
            {urls.map((url, i) => (
              <div key={`${url}-${i}`} style={imageCellStyle}>
                <MediaImage
                  src={url}
                  alt=""
                  onClick={i === index ? toggleZoom : undefined}
                  onLoad={i === index ? (e) => {
                    setNatural({
                      w: e.currentTarget.naturalWidth,
                      h: e.currentTarget.naturalHeight,
                    });
                  } : undefined}
                  style={fittedImageStyle}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={imageCellStyle}>
            <MediaImage
              src={current}
              alt=""
              onClick={toggleZoom}
              onLoad={(e) => {
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                });
              }}
              style={fittedImageStyle}
              draggable={false}
            />
          </div>
        )}
      </div>

      {!zoomed && children && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 16px 20px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}

      <div style={{
        position: 'fixed',
        bottom: zoomed ? 10 : (children ? 72 : 10),
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(249,240,240,.42)',
        fontSize: 11,
        pointerEvents: 'none',
        zIndex: zIndex + 1,
        whiteSpace: 'nowrap',
      }}>
        {zoomed
          ? 'Перетащите · тап без сдвига — уменьшить'
          : total > 1
            ? 'Свайп влево/вправо · нажмите на фото — полный размер'
            : 'Нажмите на фото — полный размер'}
      </div>
    </div>
  );
}
