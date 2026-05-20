// EmbeddedVideoPreview.jsx
// Clickable video thumbnail card for embedded YouTube/Vimeo links in Moments

function fmtDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function EmbeddedVideoPreview({ data, size = 'full' }) {
  if (!data) return null;

  const isYT    = data.provider === 'youtube';
  const isVimeo = data.provider === 'vimeo';

  function open(e) {
    e.stopPropagation();
    window.open(data.url, '_blank', 'noopener');
  }

  const providerLabel = isYT ? '▶ YouTube' : isVimeo ? '● Vimeo' : data.provider;
  const providerColor = isYT ? '#ff0000' : isVimeo ? '#1ab7ea' : '#888';
  const hasThumbnail  = !!data.thumbnail_url;

  const isCard = size === 'card';

  return (
    <div
      onClick={open}
      title={data.title || data.url}
      style={{
        borderRadius: isCard ? 8 : 14,
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#0d0820',
        border: '1px solid rgba(255,255,255,.1)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Thumbnail area */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        background: hasThumbnail ? 'transparent' : 'linear-gradient(135deg,#1a0840,#2a1060)',
        overflow: 'hidden',
      }}>
        {hasThumbnail && (
          <img
            src={data.thumbnail_url}
            alt={data.title || ''}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        {/* Dark overlay for contrast */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.28)',
        }}/>

        {/* Center play button */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: isCard ? 40 : 56,
          height: isCard ? 40 : 56,
          borderRadius: '50%',
          background: 'rgba(255,255,255,.18)',
          backdropFilter: 'blur(6px)',
          border: '2px solid rgba(255,255,255,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isCard ? 16 : 22,
          color: 'white',
          boxShadow: '0 4px 20px rgba(0,0,0,.5)',
          transition: 'background .15s',
          pointerEvents: 'none',
        }}>▶</div>

        {/* Provider badge */}
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(0,0,0,.72)',
          backdropFilter: 'blur(6px)',
          borderRadius: 20,
          padding: '3px 8px',
          fontSize: isCard ? 10 : 11,
          fontWeight: 700,
          color: providerColor,
          border: `1px solid ${providerColor}44`,
          whiteSpace: 'nowrap',
        }}>{providerLabel}</div>
      </div>

      {/* Full-size info below thumbnail */}
      {!isCard && (data.title || data.author || data.duration_seconds) && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(15,8,32,.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {data.title && (
            <div style={{
              color: 'rgba(255,255,255,.9)',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.4,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>{data.title}</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {data.author && (
              <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{data.author}</span>
            )}
            {data.duration_seconds && (
              <span style={{ color: 'rgba(255,255,255,.35)', fontSize: 11 }}>
                {fmtDuration(data.duration_seconds)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
