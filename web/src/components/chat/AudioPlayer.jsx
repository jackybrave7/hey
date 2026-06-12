// web/src/components/chat/AudioPlayer.jsx
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { getAudioWaveform, placeholderWaveform, WAVEFORM_BARS } from '../../lib/audioWaveform';
import { subscribeAudioPlayer, claimAudioPlayback, releaseAudioPlayback } from '../../lib/audioPlayback';

let nextPlayerId = 0;

function WaveformBars({ peaks, progress, isOut, wide, onSeek }) {
  const bars = peaks?.length ? peaks : placeholderWaveform(WAVEFORM_BARS);
  const playedColor = wide
    ? 'rgba(220,190,255,.98)'
    : isOut ? 'rgba(249,240,240,.98)' : 'rgba(72,42,128,.95)';
  const idleColor = wide
    ? 'rgba(249,240,240,.22)'
    : isOut ? 'rgba(249,240,240,.32)' : 'rgba(72,42,128,.28)';
  const h = wide ? 40 : 30;

  return (
    <div
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onClick={onSeek}
      style={{
        display: 'flex', alignItems: 'center', gap: wide ? 2.5 : 1.5,
        height: h, cursor: 'pointer', flex: 1, minWidth: 0,
      }}>
      {bars.map((level, i) => {
        const isPlayed = (i + 1) / bars.length <= progress;
        const barH = Math.max(4, level * (h - 4));
        return (
          <span
            key={i}
            style={{
              flex: 1, maxWidth: wide ? 5 : 4, minWidth: 2,
              height: barH, alignSelf: 'center', borderRadius: 3,
              background: isPlayed ? playedColor : idleColor,
              transition: 'background .08s linear, height .12s ease',
            }}
          />
        );
      })}
    </div>
  );
}

export const AudioPlayer = memo(function AudioPlayer({
  url, duration: initDur, waveform: initWaveform, isOut, wide = false, onPlayingChange,
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total,   setTotal]   = useState(initDur || 0);
  const [error,   setError]   = useState(null);
  const [peaks,   setPeaks]   = useState(initWaveform?.length ? initWaveform : null);
  const audioRef = useRef();
  const playerId = useRef(++nextPlayerId).current;

  const stopPlayback = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    setPlaying(false);
  }, []);

  useEffect(() => subscribeAudioPlayer(playerId, stopPlayback), [playerId, stopPlayback]);

  useEffect(() => { onPlayingChange?.(playing); }, [playing, onPlayingChange]);

  useEffect(() => {
    if (initWaveform?.length) {
      setPeaks(initWaveform);
      return;
    }
    let cancelled = false;
    if (!url) return;
    getAudioWaveform(url).then(p => {
      if (cancelled) return;
      setPeaks(p || placeholderWaveform(WAVEFORM_BARS, url.length));
    });
    return () => { cancelled = true; };
  }, [url, initWaveform]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime  = () => setCurrent(a.currentTime);
    const onEnd   = () => {
      releaseAudioPlayback(playerId);
      setPlaying(false);
      setCurrent(0);
      a.currentTime = 0;
    };
    const onMeta  = () => { if (isFinite(a.duration)) setTotal(a.duration); };
    const onError = () => {
      const map = { 1:'прервано', 2:'сеть', 3:'формат', 4:'недоступен' };
      setError(map[a.error?.code] || 'ошибка');
      releaseAudioPlayback(playerId);
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
  }, [url, playerId]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    if (playing) {
      a.pause();
      releaseAudioPlayback(playerId);
      setPlaying(false);
      return;
    }
    try {
      if (a.readyState < 2) a.load();
      claimAudioPlayback(playerId);
      await a.play();
      setPlaying(true);
    } catch (err) {
      releaseAudioPlayback(playerId);
      setError(err?.name === 'NotAllowedError' ? 'разрешение' : 'не воспроизводится');
      setPlaying(false);
    }
  }

  function seekFromEvent(e) {
    const a = audioRef.current;
    const dur = total || initDur;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(dur, ((e.clientX - rect.left) / rect.width) * dur));
  }

  function fmtSec(s) {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const durLabel = fmtSec(total || initDur);
  const atStart = current < 0.5;
  const textColor = error
    ? '#ff8080'
    : wide ? 'rgba(249,240,240,.82)' : isOut ? 'rgba(249,240,240,.88)' : 'rgba(48,28,88,.82)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: wide ? 14 : 10,
      minWidth: wide ? 0 : 196,
      maxWidth: wide ? '100%' : 268,
      width: wide ? '100%' : 'auto',
    }}>
      <audio ref={audioRef} src={url} preload="auto" playsInline
        controlsList="nodownload" disableRemotePlayback style={{ display: 'none' }} />
      <button onClick={toggle} style={{
        width: wide ? 52 : 38, height: wide ? 52 : 38,
        borderRadius: '50%', flexShrink: 0,
        background: wide ? 'rgba(140,100,220,.45)'
          : isOut ? 'rgba(249,240,240,.22)' : 'rgba(72,42,128,.14)',
        border: wide ? '1.5px solid rgba(180,140,255,.55)'
          : isOut ? '1.5px solid rgba(249,240,240,.5)' : '1.5px solid rgba(72,42,128,.35)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: wide ? 20 : 15,
        color: wide ? '#F9F0F0' : (isOut ? '#F9F0F0' : '#3a2068'),
        transition: 'background .15s, transform .12s',
      }}
        onMouseEnter={wide ? (e => e.currentTarget.style.transform = 'scale(1.05)') : undefined}
        onMouseLeave={wide ? (e => e.currentTarget.style.transform = 'scale(1)') : undefined}>
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: wide ? 8 : 5 }}>
        <WaveformBars
          peaks={peaks}
          progress={progress}
          isOut={isOut}
          wide={wide}
          onSeek={seekFromEvent}
        />
        <div style={{
          fontSize: wide ? 13 : 11, color: textColor,
          display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}>
          {error
            ? <span>⚠ {error}</span>
            : atStart
              ? <span>{durLabel}</span>
              : <>
                  <span>{fmtSec(current)}</span>
                  <span style={{ opacity: .45 }}>/</span>
                  <span style={{ opacity: .78 }}>{durLabel}</span>
                </>}
        </div>
      </div>
    </div>
  );
});
