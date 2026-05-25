// AdminSystem.jsx — публикации от лица HEY-заведующего
import { useState, useRef } from 'react';
import { api } from '../../api';
import { uploadMedia, previewUrl } from '../../lib/uploadMedia';

export default function AdminSystem() {
  const [tab, setTab] = useState('broadcast'); // 'broadcast' | 'moment'
  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        📢 HEY-заведующий
      </h1>
      <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        Публикуй моменты и рассылай сообщения от лица сервисного аккаунта.
        Юзеры не смогут ответить — это односторонний канал.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { v: 'broadcast', l: '💬 Рассылка сообщения' },
          { v: 'moment',    l: '✦ Момент'             },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: tab === t.v ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
              color: tab === t.v ? 'white' : 'rgba(255,255,255,.6)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'broadcast' && <BroadcastForm/>}
      {tab === 'moment'    && <MomentForm/>}
    </div>
  );
}

// ── Рассылка сообщения ─────────────────────────────────────────────────
function BroadcastForm() {
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [confirming, setConfirming] = useState(false);

  async function send() {
    setError('');
    const trimmed = text.trim();
    if (trimmed.length < 5) { setError('Слишком короткое сообщение'); return; }
    if (!confirming) { setConfirming(true); return; }
    setSending(true);
    setConfirming(false);
    try {
      const res = await api.adminSystemBroadcast(trimmed);
      setResult(res);
      setText('');
    } catch (e) {
      setError(e.message || 'Ошибка отправки');
    }
    setSending(false);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,.08)', padding: 20,
    }}>
      <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginBottom: 8 }}>
        Текст сообщения (придёт всем юзерам в чат с HEY-заведующим):
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, 2000))}
        rows={6}
        placeholder="Привет! С сегодня в HEY доступна новая функция…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
          minHeight: 120,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
        <span/>
        <span>{text.length} / 2000</span>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,80,80,.12)', color: 'rgba(255,160,160,.95)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(46,204,113,.15)', color: 'rgba(180,255,200,.95)', fontSize: 13 }}>
          ✓ Доставлено {result.delivered} из {result.total}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {confirming ? (
          <>
            <button onClick={() => setConfirming(false)} disabled={sending}
              style={btnStyle('rgba(255,255,255,.08)', 'rgba(255,255,255,.7)')}>
              Отмена
            </button>
            <button onClick={send} disabled={sending}
              style={btnStyle('rgba(200,80,80,.8)', 'white')}>
              {sending ? 'Отправка…' : '⚠ Подтверди — это уйдёт ВСЕМ'}
            </button>
          </>
        ) : (
          <button onClick={send} disabled={sending || text.trim().length < 5}
            style={btnStyle('rgba(120,90,200,.75)', 'white')}>
            Отправить всем →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Публикация момента ─────────────────────────────────────────────────
function MomentForm() {
  const [text, setText]         = useState('');
  const [media, setMedia]       = useState(null);    // {dataUrl, file, uploading, url?, type?}
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    if (!isImage && !isAudio) {
      setError('Поддерживаются только картинки и аудио');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Файл слишком большой (макс. 20 МБ)');
      return;
    }
    const localUrl = previewUrl(file);
    setMedia({ dataUrl: localUrl, file, uploading: true, type: isImage ? 'image' : 'audio' });
    try {
      const res = await uploadMedia(file, isImage ? 'moment-image' : 'moment-audio', {
        getPresignUrl:     api.getPresignUrl,
        uploadMomentMedia: api.uploadMomentMedia,
      });
      setMedia(m => ({ ...m, uploading: false, url: res.url, type: res.mediaType || (isImage?'image':'audio') }));
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
      setMedia(null);
    }
  }

  function removeMedia() {
    if (media?.dataUrl) { try { URL.revokeObjectURL(media.dataUrl); } catch {} }
    setMedia(null);
  }

  async function publish() {
    setError('');
    setResult(null);
    const trimmed = text.trim();
    if (trimmed.length < 5) { setError('Слишком короткий текст'); return; }
    if (media?.uploading) { setError('Подожди, файл ещё грузится'); return; }
    setSending(true);
    try {
      const res = await api.adminSystemMoment({
        text: trimmed,
        mediaUrl:  media?.url || null,
        mediaType: media?.url ? media.type : null,
      });
      setResult(res);
      setText('');
      removeMedia();
    } catch (e) {
      setError(e.message || 'Ошибка публикации');
    }
    setSending(false);
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,.08)', padding: 20,
    }}>
      <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginBottom: 8 }}>
        Текст момента:
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, 2000))}
        rows={5}
        placeholder="Анонс / новость / приглашение…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 14,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
          minHeight: 100,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 16 }}>
        <span>Поддерживаются YouTube/Vimeo/RuTube/Kinescope ссылки в тексте</span>
        <span>{text.length} / 2000</span>
      </div>

      {/* Media uploader */}
      <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginBottom: 8 }}>
        Медиа (картинка или аудио) — необязательно:
      </div>
      {!media ? (
        <button onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', padding: '20px', borderRadius: 12, cursor: 'pointer',
            border: '2px dashed rgba(180,140,220,.35)',
            background: 'rgba(120,90,200,.06)',
            color: 'rgba(255,255,255,.7)', fontSize: 14, fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(120,90,200,.12)'; e.currentTarget.style.borderColor = 'rgba(180,140,220,.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,90,200,.06)'; e.currentTarget.style.borderColor = 'rgba(180,140,220,.35)'; }}>
          <span style={{ fontSize: 28 }}>📎</span>
          <span>Прикрепить файл</span>
          <span style={{ fontSize: 12, opacity: .65 }}>JPG / PNG / WebP / GIF · MP3 / OGG · до 20 МБ</span>
        </button>
      ) : (
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          background: '#0a0518', border: '1px solid rgba(255,255,255,.1)',
          maxHeight: 240,
        }}>
          {media.type === 'image' ? (
            <img src={media.url || media.dataUrl} alt=""
              style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}/>
          ) : (
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column',
              gap: 10, background: 'linear-gradient(135deg,#1a0a38,#2a1858)' }}>
              <div style={{ fontSize: 28, textAlign: 'center' }}>🎵</div>
              <audio src={media.url || media.dataUrl} controls style={{ width: '100%' }}/>
            </div>
          )}
          {media.uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(10,5,25,.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 14, fontWeight: 600, gap: 8,
            }}>
              <span style={{ fontSize: 24 }}>⏳</span> Загрузка…
            </div>
          )}
          {!media.uploading && (
            <button onClick={removeMedia}
              style={{
                position: 'absolute', top: 8, right: 8,
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)',
                border: 'none', color: 'white', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
          )}
        </div>
      )}
      <input ref={fileRef} type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp3,audio/ogg"
        onChange={handleFile} style={{ display: 'none' }}/>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,80,80,.15)', color: 'rgba(255,170,170,.98)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(46,204,113,.18)', color: 'rgba(190,255,210,.98)', fontSize: 13 }}>
          ✓ Момент опубликован: <code style={{fontSize:11}}>{result.moment.id}</code>
        </div>
      )}

      <button onClick={publish}
        disabled={sending || text.trim().length < 5 || media?.uploading}
        style={{
          ...btnStyle('rgba(120,90,200,.85)', 'white'),
          marginTop: 16,
          opacity: (sending || text.trim().length < 5 || media?.uploading) ? .5 : 1,
          cursor: (sending || text.trim().length < 5 || media?.uploading) ? 'not-allowed' : 'pointer',
        }}>
        {sending ? 'Публикуем…' : '✦ Опубликовать момент'}
      </button>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    padding: '11px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', border: 'none', background: bg, color,
  };
}
