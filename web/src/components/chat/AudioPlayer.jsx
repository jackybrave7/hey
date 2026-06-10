// web/src/components/chat/AudioPlayer.jsx
import { useState, useEffect, useRef, memo } from 'react';
import Icon from '../Icon';
export const AudioPlayer = memo(function AudioPlayer({ url, duration: initDur, isOut, wide = false, onPlayingChange }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total,   setTotal]   = useState(initDur || 0);
  const [error,   setError]   = useState(null);
  const audioRef = useRef();

  // Уведомляем родителя о смене play/pause — нужно для того, чтобы
  // в моменте можно было показывать анимацию волн при проигрывании.
  useEffect(() => { onPlayingChange?.(playing); }, [playing, onPlayingChange]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => setCurrent(a.currentTime);
    const onEnd   = () => { setPlaying(false); setCurrent(0); a.currentTime = 0; };
    const onMeta  = () => { if (isFinite(a.duration)) setTotal(a.duration); };
    const onError = () => {
      const code = a.error?.code;
      const map = { 1:'прервано', 2:'сеть', 3:'формат', 4:'недоступен' };
      setError(map[code] || 'ошибка');
      setPlaying(false);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('error', onError);
    };
  }, [url]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    if (playing) { a.pause(); setPlaying(false); return; }
    try {
      // Принудительно перезагружаем источник если ещё не пробовали — иногда
      // <audio> с preload="metadata" не дотягивает аудио и play() падает с
      // NotSupportedError. Это особенно стабильно для голосовых от других
      // (свой play()-вызов мог отработать раньше).
      if (a.readyState < 2) { a.load(); }
      await a.play();
      setPlaying(true);
    } catch(err) {
      setError(err?.name === 'NotAllowedError' ? 'разрешение' : 'не воспроизводится');
      setPlaying(false);
    }
  }

  function fmtSec(s) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const barColor = isOut ? 'rgba(249,240,240,.9)' : 'rgba(100,70,160,.85)';
  const trackColor = isOut ? 'rgba(249,240,240,.25)' : 'rgba(100,70,160,.2)';
  const textColor  = isOut ? 'rgba(249,240,240,.75)' : 'rgba(60,40,100,.65)';

  return (
    <div style={{ display:'flex', alignItems:'center', gap: wide ? 14 : 8,
      minWidth: wide ? 0 : 170,
      maxWidth: wide ? '100%' : 240,
      width: wide ? '100%' : 'auto' }}>
      <audio ref={audioRef} src={url} preload="auto" playsInline
        controlsList="nodownload" disableRemotePlayback style={{ display:'none' }} />
      <button onClick={toggle} style={{
        width: wide ? 52 : 36, height: wide ? 52 : 36,
        borderRadius:'50%', flexShrink:0,
        background: wide ? 'rgba(140,100,220,.45)'
                  : isOut ? 'rgba(249,240,240,.2)' : 'rgba(100,70,160,.15)',
        border: wide ? '1.5px solid rgba(180,140,255,.55)'
              : isOut ? '1.5px solid rgba(249,240,240,.4)' : '1.5px solid rgba(100,70,160,.3)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: wide ? 20 : 14,
        color: wide ? '#F9F0F0' : (isOut ? '#F9F0F0' : '#4a2a90'),
        transition:'background .15s, transform .12s',
      }}
        onMouseEnter={wide ? (e=>e.currentTarget.style.transform='scale(1.05)') : undefined}
        onMouseLeave={wide ? (e=>e.currentTarget.style.transform='scale(1)') : undefined}>
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          height: wide ? 6 : 3, borderRadius: wide ? 4 : 2,
          background: wide ? 'rgba(249,240,240,.15)' : trackColor,
          overflow:'hidden', marginBottom: wide ? 8 : 4, cursor:'pointer',
        }} onClick={e => {
          const a = audioRef.current;
          if (!a || !total) return;
          const rect = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - rect.left) / rect.width) * total;
        }}>
          <div style={{ width:`${progress*100}%`, height:'100%',
            background: wide ? 'linear-gradient(90deg,rgba(180,140,255,.95),rgba(140,100,220,.95))' : barColor,
            borderRadius: wide ? 4 : 2, transition:'width .1s linear' }} />
        </div>
        <div style={{ fontSize: wide ? 13 : 11,
          color: error ? '#ff8080' : (wide ? 'rgba(249,240,240,.75)' : textColor),
          display:'flex', alignItems:'center', gap:8, fontVariantNumeric:'tabular-nums' }}>
          {error
            ? <span>⚠ {error}</span>
            : <>
                <span>{fmtSec(current)}</span>
                {wide && <span style={{opacity:.5}}>/</span>}
                {wide && <span style={{opacity:.7}}>{fmtSec(total)}</span>}
                {!wide && <span style={{display:'inline-flex',opacity:.7}}><Icon name="mic" size={12} /></span>}
              </>}
        </div>
      </div>
    </div>
  );
});
