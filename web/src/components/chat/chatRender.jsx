import { useState } from 'react';
import { HEY_EMOJI_TOKEN_RE, isHeyEmoji, resolveEmojiName, emojiUrl } from '../../lib/heyEmoji';
import { openExternalUrl } from '../../lib/openExternalUrl';

const EMOJI_RE = HEY_EMOJI_TOKEN_RE;

const URL_RE = /https?:\/\/[^\s]+/g;

// ── Chat video card helpers ───────────────────────────────────────────────────

const CHAT_YT_RE        = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
const CHAT_VIMEO_RE     = /vimeo\.com\/(?:video\/)?(\d+)/;
const CHAT_RUTUBE_RE    = /rutube\.ru\/video\/([a-f0-9]{32})/i;
const CHAT_KINESCOPE_RE = /kinescope\.io\/(?:embed\/)?([a-zA-Z0-9]+)/;

function isChatVideoUrl(url) {
  return CHAT_YT_RE.test(url) || CHAT_VIMEO_RE.test(url) ||
         CHAT_RUTUBE_RE.test(url) || CHAT_KINESCOPE_RE.test(url);
}

function getChatEmbed(url) {
  const ytM = url.match(CHAT_YT_RE);        if (ytM) return { provider:'youtube',   videoId: ytM[1],        thumbnail: `https://i.ytimg.com/vi/${ytM[1]}/hqdefault.jpg`, label:'▶ YouTube',   color:'#ff4444' };
  const vmM = url.match(CHAT_VIMEO_RE);     if (vmM) return { provider:'vimeo',     videoId: vmM[1],        thumbnail: null,                                             label:'● Vimeo',     color:'#1ab7ea' };
  const rtM = url.match(CHAT_RUTUBE_RE);    if (rtM) return { provider:'rutube',    videoId: rtM[1],        thumbnail: null,                                             label:'▶ RuTube',   color:'#ff6600' };
  const ksM = url.match(CHAT_KINESCOPE_RE); if (ksM) return { provider:'kinescope', videoId: ksM[1],        thumbnail: `https://kinescope.io/${ksM[1]}/thumbnail`,       label:'▶ Kinescope',color:'#9b6ecc' };
  return null;
}

function getEmbedSrc(provider, videoId) {
  switch (provider) {
    case 'youtube':   return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    case 'vimeo':     return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    case 'rutube':    return `https://rutube.ru/play/embed/${videoId}?autoPlay=true`;
    case 'kinescope': return `https://kinescope.io/embed/${videoId}`;
    default:          return null;
  }
}

function ChatVideoCard({ url }) {
  const [playing, setPlaying] = useState(false);
  const info = getChatEmbed(url);
  if (!info) return null;

  const embedSrc = getEmbedSrc(info.provider, info.videoId);

  function play(e) {
    e.stopPropagation();
    if (embedSrc) setPlaying(true);
    else openExternalUrl(url);
  }
  function stop(e) { e.stopPropagation(); setPlaying(false); }
  function ext(e)  { e.stopPropagation(); openExternalUrl(url); }

  return (
    <div style={{
      marginTop: 6, borderRadius: 10, overflow: 'hidden',
      background: 'rgba(10,5,30,.85)', border: '1px solid rgba(249,240,240,.12)',
      maxWidth: 300, userSelect: 'none',
    }}>
      {playing ? (
        <>
          <div style={{ width: '100%', aspectRatio: '16/9' }}>
            <iframe src={embedSrc} title={info.label}
              allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}/>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 10px', background: 'rgba(10,5,30,.95)',
          }}>
            <button onClick={stop} style={{
              background: 'rgba(249,240,240,.08)', border: '1px solid rgba(249,240,240,.15)',
              borderRadius: 20, padding: '3px 10px', color: 'rgba(249,240,240,.6)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
            }}>✕ Закрыть</button>
            <button onClick={ext} style={{
              background: 'none', border: 'none', color: `${info.color}bb`,
              fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>Открыть ↗</button>
          </div>
        </>
      ) : (
        <>
          {info.thumbnail ? (
            <div onClick={play} style={{ position: 'relative', width: '100%', aspectRatio: '16/9', cursor: 'pointer' }}>
              <img src={info.thumbnail} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(249,240,240,.2)', backdropFilter: 'blur(6px)',
                  border: '2px solid rgba(249,240,240,.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color:'#F9F0F0',
                }}>▶</div>
              </div>
              <div style={{
                position: 'absolute', bottom: 6, right: 6,
                background: 'rgba(0,0,0,.7)', borderRadius: 20,
                padding: '2px 7px', fontSize: 10, fontWeight: 700, color: info.color,
              }}>{info.label}</div>
            </div>
          ) : null}
          <div onClick={info.thumbnail ? undefined : play} style={{
            padding: info.thumbnail ? '6px 10px 7px' : '10px 12px',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(15,8,35,.9)', cursor: info.thumbnail ? 'default' : 'pointer',
          }}>
            {!info.thumbnail && <span style={{ fontSize: 16, flexShrink: 0, color: info.color }}>▶</span>}
            <span style={{ color: 'rgba(249,240,240,.45)', fontSize: 11, flex: 1, wordBreak: 'break-all', lineHeight: 1.4 }}>
              {url.length > 46 ? url.slice(0, 43) + '…' : url}
            </span>
            {info.thumbnail && (
              <button onClick={play} style={{
                background: info.color, border: 'none', borderRadius: 16,
                padding: '3px 10px', color:'#F9F0F0', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0,
              }}>▶</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Лёгкий рендер для коротких превью (список чатов, цитаты): заменяет
// [emoji-name] на маленькую <img>. Без markdown и URL-парсинга.
function renderPreviewWithEmoji(text, iconSize = 14) {
  if (!text) return text;
  const re = new RegExp(EMOJI_RE.source, 'g');
  const out = [];
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    const em = resolveEmojiName(m[1]);
    if (!em) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <img key={'e'+(i++)} src={emojiUrl(em)} alt={em}
        style={{width:iconSize,height:iconSize,verticalAlign:'-2px',display:'inline-block'}}/>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

// Inline markdown:
//   **bold**          — жирный
//   __underline__     — подчёркнутый
//   ~~strikethrough~~ — зачёркнутый
//   `code`            — моноширинный
// Применяется к простым текстовым фрагментам (НЕ внутри URL и эмодзи).
function renderMarkdown(text, keyOffset = 0) {
  if (!text) return text;
  // Один регекс на все 4 формата с capture-группами
  const MD = /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|`([^`\n]+?)`/g;
  const result = [];
  let last = 0, i = keyOffset;
  let m;
  while ((m = MD.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      result.push(<strong key={'md'+(i++)} style={{fontWeight:700}}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      result.push(<u key={'md'+(i++)} style={{textDecoration:'underline'}}>{m[2]}</u>);
    } else if (m[3] !== undefined) {
      result.push(<s key={'md'+(i++)} style={{textDecoration:'line-through',opacity:.75}}>{m[3]}</s>);
    } else if (m[4] !== undefined) {
      result.push(
        <code key={'md'+(i++)} style={{
          fontFamily:'ui-monospace,Menlo,Consolas,monospace',
          background:'rgba(0,0,0,.18)', borderRadius:4,
          padding:'1px 5px', fontSize:'.92em',
        }}>{m[4]}</code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

// Обрезает завершающую пунктуацию с URL: «http://example.com.» → «http://example.com».
// Также балансирует скобки: если в URL ')' больше чем '(', лишние ')' отрезаются.
function trimUrlTail(url) {
  let u = url;
  // Сначала пунктуация в конце (не часть URL по семантике предложения)
  u = u.replace(/[.,;:!?»"'`]+$/, '');
  // Затем висящие закрывающие скобки если в URL не было открывающей
  while (/[)\]}]$/.test(u)) {
    const closing = u.slice(-1);
    const opening = closing === ')' ? '(' : closing === ']' ? '[' : '{';
    const opens   = (u.match(new RegExp('\\' + opening, 'g')) || []).length;
    const closes  = (u.match(new RegExp('\\' + closing, 'g')) || []).length;
    if (closes > opens) u = u.slice(0, -1);
    else break;
  }
  return u;
}

function renderText(text) {
  // Сначала вытаскиваем URL и custom-эмодзи (они не должны попадать под markdown),
  // потом простой текст между ними прогоняем через renderMarkdown.
  const TOKEN = /(https?:\/\/[^\s]+)|\[([^\]]+)\]/g;
  const result = [];
  let last = 0, i = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      const plain = text.slice(last, m.index);
      const rendered = renderMarkdown(plain, i);
      if (Array.isArray(rendered)) result.push(...rendered);
      else result.push(rendered);
      i += 100; // запас по ключам для md
    }
    if (m[1]) {
      const url     = trimUrlTail(m[1]);
      const tailLen = m[1].length - url.length;
      // Видеоплатформы теперь рендерятся через server-side link_preview
      // (EmbeddedVideoPreview под текстом сообщения). Здесь — только
      // короткая ссылка-текст: длинные URL обрезаем многоточием
      // (host/path…hash), чтобы пузырь не «расползался».
      const display = url.length > 48
        ? url.slice(0, 32) + '…' + url.slice(-12)
        : url;
      result.push(
        <a key={i++} href={url} target="_blank" rel="noopener noreferrer"
          title={url}
          style={{color:'inherit',textDecoration:'underline',wordBreak:'break-all'}}
          onClick={e => e.stopPropagation()}>{display}</a>
      );
      last = m.index + m[1].length - tailLen;
      continue;
    } else if (m[2] && isHeyEmoji(m[2])) {
      const em = resolveEmojiName(m[2]);
      result.push(
        <img key={i++} src={emojiUrl(em)} alt={em}
          style={{width:24,height:24,verticalAlign:'middle',display:'inline-block',
            filter:'drop-shadow(1px 2px 1px rgba(0,0,0,0.5))'}}/>
      );
    } else {
      result.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    const plain = text.slice(last);
    const rendered = renderMarkdown(plain, i);
    if (Array.isArray(rendered)) result.push(...rendered);
    else result.push(rendered);
  }
  return result;
}
export {
  URL_RE, isChatVideoUrl, getChatEmbed, getEmbedSrc, ChatVideoCard,
  renderPreviewWithEmoji, renderMarkdown, trimUrlTail, renderText,
};
