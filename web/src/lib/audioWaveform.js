const cache = new Map();
export const WAVEFORM_BARS = 40;
const MIN_BAR = 0.12;

function peaksFromChannelData(channel, bars) {
  const step = Math.max(1, Math.floor(channel.length / bars));
  const peaks = [];
  let maxPeak = 0;
  for (let i = 0; i < bars; i++) {
    let peak = 0;
    const start = i * step;
    const end = Math.min(start + step, channel.length);
    for (let j = start; j < end; j++) {
      peak = Math.max(peak, Math.abs(channel[j]));
    }
    peaks.push(peak);
    maxPeak = Math.max(maxPeak, peak);
  }
  if (maxPeak <= 0) return peaks.map(() => MIN_BAR);
  return peaks.map(p => Math.max(MIN_BAR, p / maxPeak));
}

async function decodeToPeaks(arrayBuffer, bars = WAVEFORM_BARS) {
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return peaksFromChannelData(audioBuffer.getChannelData(0), bars);
  } finally {
    void ctx.close();
  }
}

/** Декоративная волна, если декодировать аудио не удалось. */
export function placeholderWaveform(bars = WAVEFORM_BARS, seed = 0) {
  const out = [];
  for (let i = 0; i < bars; i++) {
    const t = (i / bars) * Math.PI * 5 + (seed % 97) * 0.17;
    const env = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI);
    out.push(MIN_BAR + env * (0.35 + 0.65 * Math.abs(Math.sin(t + i * 0.38))));
  }
  return out;
}

export async function getBlobWaveform(blob, bars = WAVEFORM_BARS) {
  if (!blob) return null;
  return decodeToPeaks(await blob.arrayBuffer(), bars);
}

export async function getAudioWaveform(url, bars = WAVEFORM_BARS) {
  if (!url) return null;
  const key = `${url}@${bars}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('fetch');
    const peaks = await decodeToPeaks(await res.arrayBuffer(), bars);
    cache.set(key, peaks);
    return peaks;
  } catch {
    cache.set(key, null);
    return null;
  }
}
