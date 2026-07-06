import { useEffect, useRef } from 'react';

/** Полноэкранный просмотр видео с автозапуском (после клика пользователя). */
export function VideoLightbox({ src, onClose, zIndex = 500, children }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p?.catch) p.catch(() => {});
    return () => { try { v.pause(); } catch {} };
  }, [src]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <video
          ref={videoRef}
          src={src}
          controls
          autoPlay
          playsInline
          style={{
            maxWidth: 'min(94vw, 900px)',
            maxHeight: children ? 'calc(100vh - 88px)' : 'calc(100vh - 32px)',
            width: '100%',
            borderRadius: 12, background: '#000', display: 'block',
          }}
        />
      </div>

      {children && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 16px 20px',
          }}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
