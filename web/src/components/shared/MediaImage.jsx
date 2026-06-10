import { useEffect, useState } from 'react';
import { mediaFallbackUrls, mediaUrl } from '../../lib/mediaUrl';

export function MediaImage({ src, alt = '', style, ...props }) {
  const primary = mediaUrl(src);
  const fallbacks = mediaFallbackUrls(src);
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
