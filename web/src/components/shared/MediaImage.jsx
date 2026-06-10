import { useEffect, useState } from 'react';
import { mediaFallbackUrl, mediaUrl } from '../../lib/mediaUrl';

export function MediaImage({ src, alt = '', style, ...props }) {
  const primary = mediaUrl(src);
  const fallback = mediaFallbackUrl(src);
  const [current, setCurrent] = useState(primary);

  useEffect(() => {
    setCurrent(primary);
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
        if (fallback && current !== fallback) {
          setCurrent(fallback);
          return;
        }
        props.onError?.(e);
      }}
    />
  );
}
