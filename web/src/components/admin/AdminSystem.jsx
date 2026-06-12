// AdminSystem.jsx — публикации от лица HEY-заведующего
import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { uploadMedia, previewUrl } from '../../lib/uploadMedia';
import { useConfirm } from '../shared/Confirm';

export default function AdminSystem() {
  const [tab, setTab] = useState('broadcast'); // 'broadcast' | 'moment'
  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <h1 style={{ color:'#F9F0F0', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        📢 HEY-заведующий
      </h1>
      <p style={{ color: 'rgba(249,240,240,.45)', fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        Публикуй моменты и рассылай сообщения от лица сервисного аккаунта.
        Юзеры не смогут ответить — это односторонний канал.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { v: 'broadcast',  l: '💬 Рассылка сообщения' },
          { v: 'onboarding', l: '⏱ Плановые рассылки'  },
          { v: 'moment',     l: '✦ Момент'              },
          { v: 'manage',     l: '📋 Опубликованное'     },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: tab === t.v ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.08)',
              color: tab === t.v ? '#F9F0F0' : 'rgba(249,240,240,.6)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'broadcast'  && <BroadcastForm/>}
      {tab === 'onboarding' && <OnboardingTab/>}
      {tab === 'moment'     && <MomentForm/>}
      {tab === 'manage'     && <ManagePublished/>}
    </div>
  );
}

// ── Управление опубликованным — моменты и рассылки ─────────────────────
function ManagePublished() {
  const [moments, setMoments]       = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  // Прочие сообщения от заведующего, не привязанные к рассылке
  // (например тестовые/ручные сообщения админа в конкретный чат).
  const [orphans, setOrphans]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editingMomentId, setEditingMomentId] = useState(null);
  const [editingBroadcastId, setEditingBroadcastId] = useState(null);
  const [editText, setEditText]     = useState('');
  const [toast, setToast]           = useState('');
  const [customConfirm, confirmModal] = useConfirm();

  function showMsg(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function load() {
    setLoading(true);
    try {
      const [ms, bs, os] = await Promise.all([
        api.adminSystemListMoments(),
        api.adminSystemListBroadcasts(),
        api.adminSystemListOrphans(),
      ]);
      setMoments(ms);
      setBroadcasts(bs);
      setOrphans(os);
    } catch (e) { showMsg('Ошибка: ' + e.message); }
    setLoading(false);
  }

  async function deleteOrphan(m) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:600,marginBottom:8}}>Удалить сообщение?</div>
        <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:6}}>
          Только у одного получателя {m.recipient_name ? `(${m.recipient_name})` : ''}.
        </div>
      </>,
      { danger: true, confirmLabel: 'Удалить' }
    );
    if (!ok) return;
    try { await api.adminSystemDeleteMessage(m.id); showMsg('✓ Удалено'); load(); }
    catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{padding:20,color:'rgba(249,240,240,.5)'}}>Загрузка…</div>;

  async function deleteMoment(m) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:600,marginBottom:8}}>Удалить момент?</div>
        <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:6}}>
          «{(m.text || '').slice(0, 120)}{(m.text || '').length > 120 ? '…' : ''}»
        </div>
        <div style={{color:'rgba(255,180,180,.7)',fontSize:12}}>Это действие необратимо.</div>
      </>,
      { danger: true, confirmLabel: 'Удалить' }
    );
    if (!ok) return;
    try { await api.adminSystemDeleteMoment(m.id); showMsg('✓ Момент удалён'); load(); }
    catch (e) { showMsg('Ошибка: ' + e.message); }
  }
  async function saveMomentEdit(m) {
    try {
      await api.adminSystemEditMoment(m.id, { text: editText });
      setEditingMomentId(null); setEditText(''); showMsg('✓ Сохранено'); load();
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }
  async function deleteBroadcast(b) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:600,marginBottom:8}}>Удалить рассылку?</div>
        <div style={{color:'rgba(249,240,240,.6)',fontSize:13,marginBottom:6}}>
          У всех получателей — это <strong>{b.recipients}</strong> чатов.
        </div>
        <div style={{color:'rgba(255,180,180,.7)',fontSize:12}}>Это действие необратимо.</div>
      </>,
      { danger: true, confirmLabel: 'Удалить' }
    );
    if (!ok) return;
    try { await api.adminSystemDeleteBroadcast(b.id); showMsg('✓ Рассылка удалена'); load(); }
    catch (e) { showMsg('Ошибка: ' + e.message); }
  }
  async function saveBroadcastEdit(b) {
    try {
      await api.adminSystemEditBroadcast(b.id, editText);
      setEditingBroadcastId(null); setEditText(''); showMsg('✓ Сохранено'); load();
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      {/* Моменты */}
      <Section title={`✦ Моменты от HEY-заведующего (${moments.length})`}>
        {moments.length === 0 && <Empty>Ничего не опубликовано</Empty>}
        {moments.map(m => (
          <Card key={m.id}>
            {editingMomentId === m.id ? (
              <>
                <textarea value={editText} onChange={e=>setEditText(e.target.value.slice(0, 2000))}
                  rows={4} style={editTextareaStyle}/>
                <Actions>
                  <BtnSecondary onClick={() => { setEditingMomentId(null); setEditText(''); }}>Отмена</BtnSecondary>
                  <BtnPrimary onClick={() => saveMomentEdit(m)}>Сохранить</BtnPrimary>
                </Actions>
              </>
            ) : (
              <>
                <Meta>
                  <Status status={m.status}/>
                  <span>{fmtDate(m.created_at)}</span>
                  {m.media_type && <Badge>{m.media_type}</Badge>}
                </Meta>
                {m.media_url && m.media_type === 'image' && (
                  <img src={m.media_url} alt="" style={{
                    maxWidth: 220, maxHeight: 220, borderRadius: 10,
                    objectFit: 'cover', display: 'block', marginBottom: 10,
                    border: '1px solid rgba(249,240,240,.08)',
                  }}/>
                )}
                {m.media_url && m.media_type === 'video' && (
                  <video src={m.media_url} controls muted style={{
                    maxWidth: 260, maxHeight: 260, borderRadius: 10,
                    display: 'block', marginBottom: 10,
                    background: '#0a0518',
                  }}/>
                )}
                {m.media_url && m.media_type === 'audio' && (
                  <audio src={m.media_url} controls style={{
                    width: '100%', maxWidth: 360, marginBottom: 10,
                  }}/>
                )}
                <Text>{m.text}</Text>
                <Actions>
                  <BtnSecondary onClick={() => { setEditingMomentId(m.id); setEditText(m.text || ''); }}>
                    ✏ Изменить
                  </BtnSecondary>
                  <BtnDanger onClick={() => deleteMoment(m)}>🗑 Удалить</BtnDanger>
                </Actions>
              </>
            )}
          </Card>
        ))}
      </Section>

      {/* Прочие сообщения (не рассылки) */}
      {orphans.length > 0 && (
        <Section title={`💌 Прямые сообщения от заведующего (${orphans.length})`}>
          {orphans.map(m => (
            <Card key={m.id}>
              <Meta>
                <span>{fmtDate(m.created_at)}</span>
                <Badge>→ {m.recipient_name || m.recipient_phone || 'неизвестно'}</Badge>
              </Meta>
              <Text>{m.text || '(пустое сообщение)'}</Text>
              <Actions>
                <BtnDanger onClick={() => deleteOrphan(m)}>🗑 Удалить</BtnDanger>
              </Actions>
            </Card>
          ))}
        </Section>
      )}

      {/* Рассылки */}
      <Section title={`💬 Рассылки сообщений (${broadcasts.length})`}>
        {broadcasts.length === 0 && <Empty>Рассылок ещё не было</Empty>}
        {broadcasts.map(b => (
          <Card key={b.id}>
            {editingBroadcastId === b.id ? (
              <>
                <div style={{ color:'rgba(255,200,120,.85)', fontSize:12, marginBottom:8 }}>
                  ⚠ Изменение текста применится у всех {b.recipients} получателей
                </div>
                <textarea value={editText} onChange={e=>setEditText(e.target.value.slice(0, 2000))}
                  rows={4} style={editTextareaStyle}/>
                <Actions>
                  <BtnSecondary onClick={() => { setEditingBroadcastId(null); setEditText(''); }}>Отмена</BtnSecondary>
                  <BtnPrimary onClick={() => saveBroadcastEdit(b)}>Сохранить у всех</BtnPrimary>
                </Actions>
              </>
            ) : (
              <>
                <Meta>
                  <span>{fmtDate(b.sent_at)}</span>
                  <Badge>📨 {b.recipients} получателей</Badge>
                </Meta>
                <Text>{b.text}</Text>
                <Actions>
                  <BtnSecondary onClick={() => { setEditingBroadcastId(b.id); setEditText(b.text || ''); }}>
                    ✏ Изменить у всех
                  </BtnSecondary>
                  <BtnDanger onClick={() => deleteBroadcast(b)}>🗑 Удалить у всех</BtnDanger>
                </Actions>
              </>
            )}
          </Card>
        ))}
      </Section>

      {toast && (
        <div style={{
          position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)',
          background:'rgba(22,15,50,.97)', borderRadius:50, padding:'10px 20px',
          color:'#F9F0F0', fontSize:14, fontWeight:600, zIndex:1000,
          border:'1px solid rgba(249,240,240,.15)', boxShadow:'0 4px 20px rgba(0,0,0,.5)',
        }}>{toast}</div>
      )}
      {confirmModal}
    </div>
  );
}

// Маленькие хелперы для секции
function Section({ title, children }) {
  return (
    <div>
      <div style={{
        color:'rgba(249,240,240,.7)', fontSize:13, fontWeight:700, textTransform:'uppercase',
        letterSpacing:.8, marginBottom:10, paddingLeft:2,
      }}>{title}</div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>{children}</div>
    </div>
  );
}
function Card({ children }) {
  return (
    <div style={{
      background:'rgba(249,240,240,.05)', border:'1px solid rgba(249,240,240,.08)',
      borderRadius:14, padding:'14px 16px',
    }}>{children}</div>
  );
}
function Meta({ children }) {
  return <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,
    color:'rgba(249,240,240,.5)',fontSize:12}}>{children}</div>;
}
function Text({ children }) {
  return <div style={{color:'rgba(249,240,240,.9)',fontSize:14,lineHeight:1.5,
    marginBottom:12,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{children}</div>;
}
function Actions({ children }) {
  return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{children}</div>;
}
function Status({ status }) {
  const map = {
    active:   { bg:'rgba(60,180,100,.15)',  color:'rgba(120,230,160,.95)', label:'активен' },
    archived: { bg:'rgba(180,140,90,.15)',  color:'rgba(230,200,140,.95)', label:'архив'   },
    deleted:  { bg:'rgba(180,80,80,.15)',   color:'rgba(255,140,140,.95)', label:'удалён'  },
  };
  const s = map[status] || map.active;
  return <span style={{background:s.bg,color:s.color,borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700}}>{s.label}</span>;
}
function Badge({ children }) {
  return <span style={{background:'rgba(249,240,240,.08)',borderRadius:6,padding:'2px 8px',fontSize:11}}>{children}</span>;
}
function Empty({ children }) {
  return <div style={{padding:'20px',textAlign:'center',color:'rgba(249,240,240,.35)',fontSize:13,
    background:'rgba(249,240,240,.03)',borderRadius:12,border:'1px dashed rgba(249,240,240,.08)'}}>{children}</div>;
}
function BtnSecondary({ children, ...p }) {
  return <button {...p} style={{padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',
    border:'1px solid rgba(249,240,240,.15)',background:'rgba(249,240,240,.05)',color:'#F9F0F0',fontFamily:'inherit'}}>{children}</button>;
}
function BtnPrimary({ children, ...p }) {
  return <button {...p} style={{padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',
    border:'none',background:'rgba(95, 64, 128,.85)',color:'#F9F0F0',fontFamily:'inherit'}}>{children}</button>;
}
function BtnDanger({ children, ...p }) {
  return <button {...p} style={{padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',
    border:'1px solid rgba(255,80,80,.35)',background:'rgba(255,80,80,.12)',color:'rgba(255,170,170,.95)',fontFamily:'inherit'}}>{children}</button>;
}
const editTextareaStyle = {
  width:'100%', boxSizing:'border-box',
  background:'rgba(0,0,0,.35)', border:'1px solid rgba(249,240,240,.15)',
  borderRadius:10, padding:'10px 12px', color:'#F9F0F0', fontSize:14,
  fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.5,
  marginBottom:10,
};

// ── Рассылка сообщения ─────────────────────────────────────────────────
function BroadcastForm() {
  const [text, setText]       = useState('');
  const [imgs, setImgs]       = useState([]); // [{dataUrl, file, uploading, url?}]
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef();

  const MAX_IMGS = 10;
  const canSend = (text.trim().length > 0 || imgs.length > 0) && !imgs.some(i => i.uploading);

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_IMGS - imgs.length;
    if (remaining <= 0) { setError(`Максимум ${MAX_IMGS} картинок`); return; }
    setError('');
    const added = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith('image/'))    { setError(`«${f.name}» не картинка`); continue; }
      if (f.size > 10 * 1024 * 1024)       { setError(`«${f.name}» больше 10 МБ`); continue; }
      added.push({ dataUrl: previewUrl(f), file: f, uploading: false });
    }
    if (added.length) setImgs(prev => [...prev, ...added]);
  }

  function removeImg(idx) {
    setImgs(prev => {
      const item = prev[idx];
      if (item?.dataUrl) { try { URL.revokeObjectURL(item.dataUrl); } catch {} }
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function uploadAll() {
    setImgs(prev => prev.map(p => p.url ? p : ({ ...p, uploading: true })));
    const updated = [...imgs];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].url) continue; // уже загружено
      try {
        const res = await uploadMedia(updated[i].file, 'chat-image', {
          getPresignUrl: api.getPresignUrl,
          uploadImage:   api.uploadImage,
        });
        updated[i] = { ...updated[i], url: res.url, uploading: false };
      } catch (e) {
        throw new Error(`Не удалось загрузить «${updated[i].file.name}»: ${e.message}`);
      }
    }
    setImgs(updated);
    return updated.map(p => p.url).filter(Boolean);
  }

  async function send() {
    setError('');
    if (!confirming) { setConfirming(true); return; }
    setSending(true);
    setConfirming(false);
    try {
      let attachment = null;
      if (imgs.length === 1) {
        const urls = await uploadAll();
        attachment = { type: 'image', url: urls[0] };
      } else if (imgs.length > 1) {
        const urls = await uploadAll();
        attachment = { type: 'images', urls };
      }
      const res = await api.adminSystemBroadcast(text.trim(), attachment);
      setResult(res);
      // Очистка
      imgs.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
      setImgs([]);
      setText('');
    } catch (e) {
      setError(e.message || 'Ошибка отправки');
      setImgs(prev => prev.map(p => ({ ...p, uploading: false })));
    }
    setSending(false);
  }

  return (
    <div style={{
      background: 'rgba(249,240,240,.04)', borderRadius: 14,
      border: '1px solid rgba(249,240,240,.08)', padding: 20,
    }}>
      <div style={{ color: 'rgba(249,240,240,.7)', fontSize: 13, marginBottom: 8 }}>
        Текст сообщения (придёт всем юзерам в чат с HEY-заведующим):
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, 2000))}
        rows={6}
        placeholder="Привет! С сегодня в HEY доступна новая функция…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,240,240,.14)',
          borderRadius: 12, padding: '12px 14px', color:'#F9F0F0', fontSize: 14,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
          minHeight: 120,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 11, color: 'rgba(249,240,240,.5)' }}>
        <span>Можно добавить картинки (до {MAX_IMGS})</span>
        <span>{text.length} / 2000</span>
      </div>

      {/* Image attachments */}
      <div style={{ marginTop: 12 }}>
        {imgs.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: 10 }}>
            {imgs.map((p, idx) => (
              <div key={idx} style={{ position:'relative' }}>
                <img src={p.dataUrl} alt=""
                  style={{
                    width:64, height:64, objectFit:'cover', borderRadius:10,
                    opacity: p.uploading ? .5 : 1,
                    border:'1px solid rgba(249,240,240,.15)',
                  }}/>
                {!p.uploading && (
                  <button onClick={() => removeImg(idx)}
                    style={{
                      position:'absolute', top:-4, right:-4,
                      width:20, height:20, borderRadius:'50%',
                      background:'rgba(0,0,0,.85)', border:'none', color:'#F9F0F0',
                      fontSize:13, cursor:'pointer', padding:0, lineHeight:1,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
        <button onClick={() => fileRef.current?.click()}
          disabled={imgs.length >= MAX_IMGS || sending}
          style={{
            padding:'8px 14px', borderRadius:10, fontSize:13, fontWeight:600,
            cursor: imgs.length >= MAX_IMGS ? 'not-allowed' : 'pointer',
            border:'1px dashed rgba(180,140,220,.4)',
            background:'rgba(95, 64, 128,.08)',
            color:'rgba(220,200,255,.85)',
            fontFamily:'inherit',
            opacity: imgs.length >= MAX_IMGS ? .5 : 1,
          }}>
          📎 {imgs.length === 0 ? 'Прикрепить картинки' : `+ ещё (${MAX_IMGS - imgs.length} осталось)`}
        </button>
        <input ref={fileRef} type="file" multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFiles} style={{ display:'none' }}/>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,80,80,.15)', color: 'rgba(255,170,170,.98)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(46,204,113,.18)', color: 'rgba(190,255,210,.98)', fontSize: 13 }}>
          ✓ Доставлено {result.delivered} из {result.total}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {confirming ? (
          <>
            <button onClick={() => setConfirming(false)} disabled={sending}
              style={btnStyle('rgba(249,240,240,.08)', 'rgba(249,240,240,.85)')}>
              Отмена
            </button>
            <button onClick={send} disabled={sending}
              style={btnStyle('rgba(200,80,80,.85)', '#F9F0F0')}>
              {sending ? 'Отправка…' : '⚠ Подтверди — это уйдёт ВСЕМ'}
            </button>
          </>
        ) : (
          <button onClick={send} disabled={sending || !canSend}
            style={{
              ...btnStyle('rgba(95, 64, 128,.85)', '#F9F0F0'),
              opacity: (!canSend || sending) ? .5 : 1,
              cursor:  (!canSend || sending) ? 'not-allowed' : 'pointer',
            }}>
            Отправить всем →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Плановые рассылки (после регистрации) ─────────────────────────────
const QUICK_EMOJIS = ['👋', '✨', '🎉', '💡', '❤️', '🔥', '📎', '🙂'];

function fmtOnboardingDelay(r) {
  const p = [];
  if (r.delay_days) p.push(`${r.delay_days} д.`);
  if (r.delay_hours) p.push(`${r.delay_hours} ч.`);
  if (r.delay_minutes) p.push(`${r.delay_minutes} мин.`);
  return p.join(' ') || '—';
}

function OnboardingTab() {
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle]       = useState('');
  const [delayDays, setDelayDays]     = useState(0);
  const [delayHours, setDelayHours]   = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [text, setText]         = useState('');
  const [imgs, setImgs]         = useState([]);
  const [enabled, setEnabled]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [error, setError]       = useState('');
  const fileRef = useRef();
  const textRef = useRef();
  const [customConfirm, confirmModal] = useConfirm();
  const MAX_IMGS = 10;

  function showMsg(m) { setToast(m); setTimeout(() => setToast(''), 2500); }

  async function load() {
    setLoading(true);
    try { setRules(await api.adminSystemListOnboarding()); }
    catch (e) { showMsg('Ошибка: ' + e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDelayDays(0);
    setDelayHours(0);
    setDelayMinutes(5);
    setText('');
    imgs.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
    setImgs([]);
    setEnabled(true);
    setError('');
  }

  function startEdit(r) {
    setEditingId(r.id);
    setTitle(r.title || '');
    setDelayDays(r.delay_days || 0);
    setDelayHours(r.delay_hours || 0);
    setDelayMinutes(r.delay_minutes || 0);
    setText(r.text || '');
    setEnabled(!!r.enabled);
    setError('');
    imgs.forEach(p => { try { URL.revokeObjectURL(p.dataUrl); } catch {} });
    const att = r.attachment;
    if (att?.type === 'image' && att.url) {
      setImgs([{ dataUrl: att.url, file: null, uploading: false, url: att.url, existing: true }]);
    } else if (att?.type === 'images' && att.urls?.length) {
      setImgs(att.urls.map(u => ({ dataUrl: u, file: null, uploading: false, url: u, existing: true })));
    } else {
      setImgs([]);
    }
  }

  function insertEmoji(ch) {
    const ta = textRef.current;
    if (!ta) { setText(t => (t + ch).slice(0, 2000)); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + ch + text.slice(end)).slice(0, 2000);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + ch.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_IMGS - imgs.length;
    if (remaining <= 0) { setError(`Максимум ${MAX_IMGS} картинок`); return; }
    setError('');
    const added = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith('image/')) { setError(`«${f.name}» не картинка`); continue; }
      if (f.size > 10 * 1024 * 1024) { setError(`«${f.name}» больше 10 МБ`); continue; }
      added.push({ dataUrl: previewUrl(f), file: f, uploading: false });
    }
    if (added.length) setImgs(prev => [...prev, ...added]);
  }

  function removeImg(idx) {
    setImgs(prev => {
      const item = prev[idx];
      if (item?.dataUrl && !item.existing) { try { URL.revokeObjectURL(item.dataUrl); } catch {} }
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function buildAttachment() {
    if (!imgs.length) return null;
    const urls = [];
    for (const p of imgs) {
      if (p.url) { urls.push(p.url); continue; }
      const res = await uploadMedia(p.file, 'chat-image', {
        getPresignUrl: api.getPresignUrl,
        uploadImage: api.uploadImage,
      });
      urls.push(res.url);
    }
    return urls.length === 1 ? { type: 'image', url: urls[0] } : { type: 'images', urls };
  }

  async function save() {
    setError('');
    const trimmed = text.trim();
    if (!trimmed && !imgs.length) { setError('Нужен текст или картинка'); return; }
    const totalDelay = (Number(delayDays) || 0) * 86400
      + (Number(delayHours) || 0) * 3600
      + (Number(delayMinutes) || 0) * 60;
    if (totalDelay <= 0) { setError('Укажите задержку больше 0'); return; }
    setSaving(true);
    try {
      let attachment = null;
      if (imgs.length) {
        setImgs(prev => prev.map(p => p.url ? p : ({ ...p, uploading: true })));
        attachment = await buildAttachment();
        setImgs(prev => prev.map((p, i) => ({
          ...p,
          uploading: false,
          url: attachment?.type === 'image' ? attachment.url : attachment?.urls?.[i],
        })));
      }
      const payload = {
        title: title.trim() || null,
        delayDays: Number(delayDays) || 0,
        delayHours: Number(delayHours) || 0,
        delayMinutes: Number(delayMinutes) || 0,
        text: trimmed,
        attachment,
        enabled,
      };
      if (editingId) await api.adminSystemUpdateOnboarding(editingId, payload);
      else await api.adminSystemCreateOnboarding(payload);
      showMsg(editingId ? '✓ Сохранено' : '✓ Правило создано');
      resetForm();
      load();
    } catch (e) {
      setError(e.message || 'Ошибка');
      setImgs(prev => prev.map(p => ({ ...p, uploading: false })));
    }
    setSaving(false);
  }

  async function toggleEnabled(r) {
    try {
      await api.adminSystemUpdateOnboarding(r.id, { enabled: !r.enabled });
      load();
    } catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  async function removeRule(r) {
    const ok = await customConfirm(
      <>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Удалить правило?</div>
        <div style={{ color: 'rgba(249,240,240,.6)', fontSize: 13 }}>
          «{r.title || (r.text || '').slice(0, 60)}» — уже отправлено {r.sent_count} раз.
        </div>
      </>,
      { danger: true, confirmLabel: 'Удалить' },
    );
    if (!ok) return;
    try { await api.adminSystemDeleteOnboarding(r.id); showMsg('✓ Удалено'); load(); }
    catch (e) { showMsg('Ошибка: ' + e.message); }
  }

  const canSave = (text.trim().length > 0 || imgs.length > 0) && !saving && !imgs.some(i => i.uploading);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        background: 'rgba(249,240,240,.04)', borderRadius: 14,
        border: '1px solid rgba(249,240,240,.08)', padding: 20,
      }}>
        <div style={{ color: 'rgba(249,240,240,.75)', fontSize: 13, marginBottom: 14, lineHeight: 1.55 }}>
          Сообщение уйдёт в чат с HEY-заведующим через указанное время после регистрации.
          Каждому пользователю — один раз. Уже зарегистрированным, у кого срок прошёл, отправится при ближайшей проверке (раз в минуту).
        </div>

        <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, marginBottom: 6 }}>Название (для себя)</div>
        <input value={title} onChange={e => setTitle(e.target.value.slice(0, 120))}
          placeholder="Приветствие через 5 минут"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 14,
            background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,240,240,.14)',
            borderRadius: 10, padding: '10px 12px', color: '#F9F0F0', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}/>

        <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, marginBottom: 8 }}>Через сколько после регистрации</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { label: 'Дней', val: delayDays, set: setDelayDays, max: 365 },
            { label: 'Часов', val: delayHours, set: setDelayHours, max: 23 },
            { label: 'Минут', val: delayMinutes, set: setDelayMinutes, max: 59 },
          ].map(f => (
            <label key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 72 }}>
              <span style={{ fontSize: 11, color: 'rgba(249,240,240,.45)' }}>{f.label}</span>
              <input type="number" min={0} max={f.max} value={f.val}
                onChange={e => f.set(Math.max(0, Math.min(f.max, parseInt(e.target.value, 10) || 0)))}
                style={{
                  width: 80, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,240,240,.14)',
                  borderRadius: 10, padding: '8px 10px', color: '#F9F0F0', fontSize: 14, fontFamily: 'inherit',
                }}/>
            </label>
          ))}
        </div>

        <div style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, marginBottom: 6 }}>Текст сообщения</div>
        <textarea ref={textRef} value={text} onChange={e => setText(e.target.value.slice(0, 2000))}
          rows={5} placeholder="Привет! 👋 Рады видеть тебя в HEY…"
          style={editTextareaStyle}/>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {QUICK_EMOJIS.map(ch => (
            <button key={ch} type="button" onClick={() => insertEmoji(ch)}
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(249,240,240,.12)',
                background: 'rgba(249,240,240,.06)', fontSize: 18, cursor: 'pointer', padding: 0,
              }}>{ch}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(249,240,240,.4)', marginBottom: 10 }}>{text.length} / 2000</div>

        {imgs.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {imgs.map((p, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={p.dataUrl} alt="" style={{
                  width: 64, height: 64, objectFit: 'cover', borderRadius: 10,
                  opacity: p.uploading ? .5 : 1, border: '1px solid rgba(249,240,240,.15)',
                }}/>
                {!p.uploading && (
                  <button onClick={() => removeImg(idx)} style={{
                    position: 'absolute', top: -4, right: -4, width: 20, height: 20,
                    borderRadius: '50%', background: 'rgba(0,0,0,.85)', border: 'none',
                    color: '#F9F0F0', fontSize: 13, cursor: 'pointer',
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={imgs.length >= MAX_IMGS || saving}
          style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: '1px dashed rgba(180,140,220,.4)', background: 'rgba(95, 64, 128,.08)',
            color: 'rgba(220,200,255,.85)', fontFamily: 'inherit', marginBottom: 14,
          }}>
          📎 Прикрепить картинки (до {MAX_IMGS})
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }}/>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer',
          color: 'rgba(249,240,240,.75)', fontSize: 13 }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>
          Правило активно
        </label>

        {error && (
          <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,80,80,.15)', color: 'rgba(255,170,170,.98)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <BtnPrimary onClick={save} disabled={!canSave}>
            {saving ? 'Сохранение…' : (editingId ? 'Сохранить правило' : 'Добавить правило')}
          </BtnPrimary>
          {editingId && <BtnSecondary onClick={resetForm}>Отмена</BtnSecondary>}
        </div>
      </div>

      <Section title={`Активные правила (${rules.length})`}>
        {loading && <Empty>Загрузка…</Empty>}
        {!loading && rules.length === 0 && <Empty>Правил пока нет</Empty>}
        {rules.map(r => (
          <Card key={r.id}>
            <Meta>
              <span style={{
                background: r.enabled ? 'rgba(60,180,100,.15)' : 'rgba(180,80,80,.15)',
                color: r.enabled ? 'rgba(120,230,160,.95)' : 'rgba(255,140,140,.95)',
                borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
              }}>{r.enabled ? 'вкл' : 'выкл'}</span>
              <Badge>⏱ {fmtOnboardingDelay(r)}</Badge>
              <Badge>📨 {r.sent_count} отправлено</Badge>
            </Meta>
            {r.title && <div style={{ color: 'rgba(220,200,255,.9)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{r.title}</div>}
            <Text>{r.text || (r.attachment ? '🖼 с картинкой' : '—')}</Text>
            <Actions>
              <BtnSecondary onClick={() => startEdit(r)}>✏ Изменить</BtnSecondary>
              <BtnSecondary onClick={() => toggleEnabled(r)}>{r.enabled ? 'Выключить' : 'Включить'}</BtnSecondary>
              <BtnDanger onClick={() => removeRule(r)}>🗑</BtnDanger>
            </Actions>
          </Card>
        ))}
      </Section>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', borderRadius: 50, padding: '10px 20px',
          color: '#F9F0F0', fontSize: 14, fontWeight: 600, zIndex: 1000,
          border: '1px solid rgba(249,240,240,.15)',
        }}>{toast}</div>
      )}
      {confirmModal}
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
      background: 'rgba(249,240,240,.04)', borderRadius: 14,
      border: '1px solid rgba(249,240,240,.08)', padding: 20,
    }}>
      <div style={{ color: 'rgba(249,240,240,.7)', fontSize: 13, marginBottom: 8 }}>
        Текст момента:
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, 2000))}
        rows={5}
        placeholder="Анонс / новость / приглашение…"
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,240,240,.14)',
          borderRadius: 12, padding: '12px 14px', color:'#F9F0F0', fontSize: 14,
          fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
          minHeight: 100,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
        fontSize: 11, color: 'rgba(249,240,240,.5)', marginBottom: 16 }}>
        <span>Поддерживаются YouTube/Vimeo/RuTube/Kinescope ссылки в тексте</span>
        <span>{text.length} / 2000</span>
      </div>

      {/* Media uploader */}
      <div style={{ color: 'rgba(249,240,240,.7)', fontSize: 13, marginBottom: 8 }}>
        Медиа (картинка или аудио) — необязательно:
      </div>
      {!media ? (
        <button onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', padding: '20px', borderRadius: 12, cursor: 'pointer',
            border: '2px dashed rgba(180,140,220,.35)',
            background: 'rgba(95, 64, 128,.06)',
            color: 'rgba(249,240,240,.7)', fontSize: 14, fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(95, 64, 128,.12)'; e.currentTarget.style.borderColor = 'rgba(180,140,220,.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(95, 64, 128,.06)'; e.currentTarget.style.borderColor = 'rgba(180,140,220,.35)'; }}>
          <span style={{ fontSize: 28 }}>📎</span>
          <span>Прикрепить файл</span>
          <span style={{ fontSize: 12, opacity: .65 }}>JPG / PNG / WebP / GIF · MP3 / OGG · до 20 МБ</span>
        </button>
      ) : (
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          background: '#0a0518', border: '1px solid rgba(249,240,240,.1)',
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
              color:'#F9F0F0', fontSize: 14, fontWeight: 600, gap: 8,
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
                border: 'none', color:'#F9F0F0', fontSize: 16, cursor: 'pointer',
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
          ...btnStyle('rgba(95, 64, 128,.85)', '#F9F0F0'),
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
