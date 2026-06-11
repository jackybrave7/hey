import { useEffect, useMemo, useState } from 'react';
import { androidImageFetchUrls, mediaFallbackUrls, mediaUrl } from '../../lib/mediaUrl';

const androidBlobCache = new Map();
const diagnosticSent = new Set();

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
  const primary = mediaUrl(src);
  const fallbacks = mediaFallbackUrls(src);
  const androidFetchUrls = useMemo(() => androidImageFetchUrls(src), [src]);
  const [current, setCurrent] = useState(primary);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  useEffect(() => {
    setCurrent(primary);
    setFallbackIndex(0);
  }, [primary]);

  useEffect(() => {
    if (!androidFetchUrls.length) return;

    const cacheKey = androidFetchUrls.join('|');
    const cached = androidBlobCache.get(cacheKey);
    if (cached) {
      setCurrent(cached);
      return;
    }

    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      let lastFailedUrl = null;
      for (const url of androidFetchUrls) {
        try {
          const res = await fetch(url, { cache: 'reload', signal: ctrl.signal });
          if (!res.ok) {
            lastFailedUrl = `${url} -> HTTP ${res.status}`;
            continue;
          }
          const blob = await res.blob();
          if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) {
            lastFailedUrl = `${url} -> ${blob.type || 'empty'} ${blob.size}`;
            continue;
          }

          const objectUrl = URL.createObjectURL(blob);
          androidBlobCache.set(cacheKey, objectUrl);
          if (alive) setCurrent(objectUrl);
          return;
        } catch (e) {
          if (ctrl.signal.aborted) return;
          lastFailedUrl = `${url} -> ${e?.message || 'fetch failed'}`;
        }
      }
      if (alive) {
        sendMediaDiagnostic({
          src,
          currentSrc: primary,
          failedUrl: lastFailedUrl,
          reason: 'android-fetch-failed',
        });
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [androidFetchUrls, primary, src]);

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
        if (next) {
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
        props.onError?.(e);
      }}
    />
  );
}
