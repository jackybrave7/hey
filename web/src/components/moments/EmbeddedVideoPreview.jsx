// EmbeddedVideoPreview.jsx
// Video thumbnail → inline iframe player for Moments / chat link previews
import { useState } from 'react';
import { openExternalUrl } from '../../lib/openExternalUrl';

function fmtDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PROVIDERS = {
  youtube:   { label: '▶ YouTube',   color: '#ff3333' },
  vimeo:     { label: '● Vimeo',     color: '#1ab7ea' },
  rutube:    { label: '▶ RuTube',    color: '#ff6600' },
  kinescope: { label: '▶ Kinescope', color: '#7b5ea7' },
};

function getEmbedUrl(provider, videoId) {
  switch (provider) {
    case 'youtube':   return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    case 'vimeo':     return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    case 'rutube':    return `https://rutube.ru/play/embed/${videoId}?autoPlay=true`;
    case 'kinescope': return `https://kinescope.io/embed/${videoId}`;
    default:          return null;
  }
}

// hideMeta — для моментов: не тащить с видеохостинга title/author/duration.
// onlyTitleMeta — для чата: показываем только title+author, без дублирующей
// кнопки «↗ YouTube/Vimeo/…» на обложке.
export default function EmbeddedVideoPreview({ data, size = 'full', hideMeta = false, onlyTitleMeta = false }) {
  const [playing, setPlaying] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  if (!data) return null;

  const p            = PROVIDERS[data.provider] || { label: '▶ Видео', color: '#aaa' };
  const hasThumbnail = !!data.thumbnail_url && !thumbBroken;
  const embedUrl     = getEmbedUrl(data.provider, data.video_id);
  const isCard       = size === 'card';
  const showFooter   = !isCard && (!hideMeta || playing);
  const hasMeta      = !!(data.title || data.author || data.duration_seconds);

  function play(e) {
    e.stopPropagation();
    if (isCard) { openExternalUrl(data.url); return; }
    if (embedUrl) setPlaying(true);
    else openExternalUrl(data.url);
  }

  function stop(e) {
    e.stopPropagation();
    setPlaying(false);
  }

  function openExternal(e) {
    e.stopPropagation();
    openExternalUrl(data.url);
  }

  return (
    <div
      style={{
        borderRadius: isCard ? 8 : 12,
        overflow: 'hidden',
        background: '#0d0820',
        border: '1px solid rgba(249,240,240,.1)',
        userSelect: 'none',
        flexShrink: 0,
        width: '100%',
      }}
    >
      {/* Фиксированная сцена 16:9 — превью и плеер в одном месте, без скачка */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          background: hasThumbnail && !playing ? 'transparent' : 'linear-gradient(135deg,#1a0840,#2a1060)',
          overflow: 'hidden',
        }}
      >
        {playing && !isCard && embedUrl ? (
          <iframe
            src={embedUrl}
            title={data.title || data.provider}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', border: 'none', display: 'block',
            }}
          />
        ) : (
          <div
            onClick={play}
            title={data.title || 'Смотреть видео'}
            style={{
              position: 'absolute', inset: 0, cursor: 'pointer',
            }}
          >
            {hasThumbnail && (
              <img src={data.thumbnail_url} alt={data.title || ''}
                onError={() => setThumbBroken(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            )}
            {!hasThumbnail && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%) translateY(-30px)',
                fontSize: isCard ? 32 : 56, opacity: .25, color: '#F9F0F0',
                pointerEvents: 'none',
              }}>🎬</div>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.28)' }}/>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: isCard ? 40 : 56, height: isCard ? 40 : 56,
              borderRadius: '50%',
              background: 'rgba(249,240,240,.18)', backdropFilter: 'blur(6px)',
              border: '2px solid rgba(249,240,240,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isCard ? 16 : 22, color: '#F9F0F0',
              boxShadow: '0 4px 20px rgba(0,0,0,.5)',
            }}>▶</div>
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)',
              borderRadius: 20, padding: '3px 8px',
              fontSize: isCard ? 10 : 11, fontWeight: 700,
              color: p.color, border: `1px solid ${p.color}44`,
              whiteSpace: 'nowrap',
            }}>{p.label}</div>
          </div>
        )}
      </div>

      {/* Нижняя панель одной высоты: метаданные или кнопки плеера */}
      {showFooter && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(15,8,32,.9)',
          minHeight: hasMeta && !hideMeta ? 56 : (playing ? 44 : 0),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
          boxSizing: 'border-box',
        }}>
          {!hideMeta && hasMeta && data.title && (
            <div
              onClick={playing ? undefined : play}
              style={{
                color: 'rgba(249,240,240,.9)', fontSize: 13, fontWeight: 600,
                lineHeight: 1.35,
                cursor: playing ? 'default' : 'pointer',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: playing ? 1 : 2, WebkitBoxOrient: 'vertical',
              }}
            >
              {data.title}
            </div>
          )}
          {playing ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8,
            }}>
              <button onClick={stop}
                style={{
                  background: 'rgba(249,240,240,.08)', border: '1px solid rgba(249,240,240,.15)',
                  borderRadius: 20, padding: '4px 12px', color: 'rgba(249,240,240,.7)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ✕ Закрыть плеер
              </button>
              <button onClick={openExternal}
                style={{
                  background: 'none', border: 'none',
                  color: `${p.color}cc`, fontSize: 11, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600,
                }}>
                Открыть на сайте ↗
              </button>
            </div>
          ) : !hideMeta && hasMeta ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                {data.author && (
                  <span style={{ color: 'rgba(249,240,240,.45)', fontSize: 11 }}>{data.author}</span>
                )}
                {data.duration_seconds && (
                  <span style={{ color: 'rgba(249,240,240,.35)', fontSize: 11 }}>
                    {fmtDuration(data.duration_seconds)}
                  </span>
                )}
              </div>
              {!onlyTitleMeta && (
                <button onClick={openExternal}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: `${p.color}99`, fontSize: 11, fontFamily: 'inherit',
                    padding: 0, flexShrink: 0,
                  }}>
                  ↗ {p.label.replace(/[▶●]\s*/, '')}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
