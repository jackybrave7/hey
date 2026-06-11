import { useState, useEffect } from 'react';
import { detectLikelyFromRussia } from '../../lib/isLikelyFromRussia';

export function NoVpnRuNote({ style, delay = 0 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectLikelyFromRussia().then((ok) => {
      if (!cancelled) setShow(ok);
    });
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 20,
        background: 'rgba(80, 175, 115, .28)',
        border: '1px solid rgba(140, 230, 170, .5)',
        color: '#E8FFF0',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.35,
        animation: delay ? `authFadeUp .55s ease-out ${delay}s both` : undefined,
        ...style,
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>✓</span>
      Работает без VPN
    </div>
  );
}
