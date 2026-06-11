import { useEffect, useMemo, useState } from 'react';
import { androidImageFetchUrls, mediaFallbackUrls, mediaUrl } from '../../lib/mediaUrl';

const androidBlobCache = new Map();

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
      for (const url of androidFetchUrls) {
        try {
          const res = await fetch(url, { cache: 'reload', signal: ctrl.signal });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) continue;

          const objectUrl = URL.createObjectURL(blob);
          androidBlobCache.set(cacheKey, objectUrl);
          if (alive) setCurrent(objectUrl);
          return;
        } catch {
          if (ctrl.signal.aborted) return;
        }
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [androidFetchUrls, primary]);

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
        props.onError?.(e);
      }}
    />
  );
}
