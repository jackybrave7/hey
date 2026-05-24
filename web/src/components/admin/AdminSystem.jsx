// AdminSystem.jsx — публикации от лица HEY-заведующего
import { useState } from 'react';
import { api } from '../../api';

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
  const [text, setText]       = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  async function publish() {
    setError('');
    const trimmed = text.trim();
    if (trimmed.length < 5) { setError('Слишком короткий текст'); return; }
    setSending(true);
    try {
      const res = await api.adminSystemMoment({
        text: trimmed,
        mediaUrl: mediaUrl.trim() || null,
        mediaType: mediaUrl.trim() ? mediaType : null,
      });
      setResult(res);
      setText('');
      setMediaUrl('');
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
      <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginBottom: 8 }}>
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
        fontSize: 11, color: 'rgba(255,255,255,.35)', marginBottom: 16 }}>
        <span>Поддерживаются YouTube/Vimeo/RuTube/Kinescope ссылки в тексте</span>
        <span>{text.length} / 2000</span>
      </div>

      <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginBottom: 8 }}>
        URL медиа (S3 / прямая ссылка) — необязательно:
      </div>
      <input
        value={mediaUrl}
        onChange={e => setMediaUrl(e.target.value)}
        placeholder="https://..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 13,
          fontFamily: 'inherit', outline: 'none', marginBottom: 8,
        }}
      />
      {mediaUrl.trim() && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['image', 'video', 'audio'].map(t => (
            <button key={t} onClick={() => setMediaType(t)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: mediaType === t ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
                color: mediaType === t ? 'white' : 'rgba(255,255,255,.55)',
              }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,80,80,.12)', color: 'rgba(255,160,160,.95)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(46,204,113,.15)', color: 'rgba(180,255,200,.95)', fontSize: 13 }}>
          ✓ Момент опубликован: <code style={{fontSize:11}}>{result.moment.id}</code>
        </div>
      )}

      <button onClick={publish} disabled={sending || text.trim().length < 5}
        style={{ ...btnStyle('rgba(120,90,200,.75)', 'white'), marginTop: 16 }}>
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
