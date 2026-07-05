import { useEffect, useMemo, useState } from 'react';
import { androidImageSrc, mediaFallbackUrls, mediaUrl } from '../../lib/mediaUrl';

const diagnosticSent = new Set();
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function sendMediaDiagnostic({ src, currentSrc, failedUrl, reason }) {
  const key = `${reason}|${src}|${failedUrl || currentSrc || ''}`;
  if (diagnosticSent.has(key)) return;
  diagnosticSent.add(key);

  try {
    const token = localStorage.getItem('hey_token');
    fetch('/api/diagnostics/media-image', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        src,
        currentSrc,
        failedUrl,
        reason,
        page: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch {}
}

export function MediaImage({ src, alt = '', style, ...props }) {
  const primary = useMemo(() => androidImageSrc(src), [src]);
  const fallbacks = useMemo(() => mediaFallbackUrls(src), [src]);
  const [current, setCurrent] = useState(primary);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    setCurrent(primary);
    setFallbackIndex(0);
  }, [primary]);

  return (
    <img
      {...props}
      src={current}
      alt={alt}
      referrerPolicy={props.referrerPolicy || 'no-referrer'}
      decoding={props.decoding || 'async'}
      style={style}
      onError={(e) => {
        const next = fallbacks[fallbackIndex];
        if (next && next !== current) {
          setFallbackIndex(fallbackIndex + 1);
          setCurrent(next);
          return;
        }
        sendMediaDiagnostic({
          src,
          currentSrc: e.currentTarget.currentSrc || current,
          failedUrl: e.currentTarget.currentSrc || current,
          reason: 'img-error',
        });
        setCurrent(TRANSPARENT_PIXEL);
        props.onError?.(e);
      }}
    />
  );
}
