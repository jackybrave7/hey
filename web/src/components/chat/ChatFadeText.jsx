import { useEffect, useRef, useState } from 'react';

/** Обрезка длинного текста градиентом; для статуса — периодический marquee. */
export default function ChatFadeText({
  text,
  className = '',
  marquee = false,
  style,
}) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text]);

  useEffect(() => {
    if (!marquee || !overflow) {
      setAnimate(false);
      return;
    }
    const t = setInterval(() => setAnimate(a => !a), 8000);
    return () => clearInterval(t);
  }, [marquee, overflow]);

  return (
    <div
      className={[
        'chat-fade-text',
        overflow && 'is-overflow',
        marquee && animate && 'is-marquee',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <span ref={ref} className="chat-fade-text-inner">{text}</span>
    </div>
  );
}
