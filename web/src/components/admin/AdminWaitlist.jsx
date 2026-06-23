// AdminWaitlist.jsx — заявки «открыть регистрацию без приглашения».
// Юзеры оставляют email на InviteOnlyBlock-экране. Админ отправляет
// персональный инвайт от своего аккаунта или помечает «уведомлён» вручную.
import { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import { useConfirm } from '../shared/Confirm';
import { useAuth } from '../../AuthContext';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminWaitlist() {
  const { user: me } = useAuth();
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | notified | all
  const [busy, setBusy]     = useState({}); // {id: bool}
  const [toast, setToast]   = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const [emailTpl, setEmailTpl] = useState(null);
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplSaving, setTplSaving] = useState(false);
  const [customConfirm, confirmModal] = useConfirm();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4500);
  }

  async function load() {
    setLoading(true); setError('');
    try { setItems(await api.adminGetWaitlist()); }
    catch (e) { setError(e.message || 'Не удалось'); }
    setLoading(false);
  }

  async function loadTemplate() {
    try {
      const tpl = await api.adminGetWaitlistEmailTemplate();
      setEmailTpl(tpl);
      setTplSubject(tpl.subject || '');
      setTplBody(tpl.body || '');
    } catch (e) {
      showToast('Шаблон: ' + (e.message || 'ошибка загрузки'));
    }
  }

  useEffect(() => { load(); loadTemplate(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(x => {
      if (filter === 'pending'  && x.notified_at) return false;
      if (filter === 'notified' && !x.notified_at) return false;
      if (q && !(x.email || '').toLowerCase().includes(q)
            && !(x.source || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, search]);

  const counts = useMemo(() => ({
    all: items.length,
    pending: items.filter(x => !x.notified_at).length,
    notified: items.filter(x => x.notified_at).length,
  }), [items]);

  async function sendInvite(item) {
    const inviter = me?.name || 'вы';
    const ok = await customConfirm(
      <>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Отправить приглашение?</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(249,240,240,.75)' }}>
          На <strong style={{ color: '#F9F0F0' }}>{item.email}</strong> уйдёт письмо с
          персональной ссылкой от имени <strong style={{ color: '#F9F0F0' }}>{inviter}</strong>.
          Заявка будет помечена как обработанная.
        </div>
      </>,
      { confirmLabel: '📨 Отправить инвайт' },
    );
    if (!ok) return;
    setBusy(b => ({ ...b, [item.id]: true }));
    try {
      const r = await api.adminWaitlistSendInvite(item.id);
      setItems(prev => prev.map(x => x.id === item.id ? {
        ...x,
        notified_at: x.notified_at || Math.floor(Date.now() / 1000),
        invite_sent_at: Math.floor(Date.now() / 1000),
        invite_sent_by: me?.id,
        invite_sent_by_name: r.inviterName || inviter,
      } : x));
      if (r.emailSent) {
        showToast(`✓ Письмо отправлено на ${r.email}`);
      } else {
        showToast(`SMTP недоступен — ссылка в feedback.log. ${r.inviteLink}`);
      }
    } catch (e) {
      alert(e.message || 'Не удалось отправить');
    }
    setBusy(b => ({ ...b, [item.id]: false }));
  }

  async function toggleNotified(item) {
    setBusy(b => ({ ...b, [item.id]: true }));
    try {
      const newState = !item.notified_at;
      await api.adminWaitlistNotified(item.id, newState);
      setItems(prev => prev.map(x => x.id === item.id
        ? { ...x, notified_at: newState ? Math.floor(Date.now()/1000) : null }
        : x));
    } catch (e) { alert('Ошибка: ' + e.message); }
    setBusy(b => ({ ...b, [item.id]: false }));
  }

  async function remove(item) {
    if (!await customConfirm('Удалить заявку?',
      { hint: item.email, danger: true, confirmLabel: 'Удалить' })) return;
    setBusy(b => ({ ...b, [item.id]: true }));
    try {
      await api.adminWaitlistDelete(item.id);
      setItems(prev => prev.filter(x => x.id !== item.id));
    } catch (e) { alert('Ошибка: ' + e.message); }
    setBusy(b => ({ ...b, [item.id]: false }));
  }

  function copyAllEmails() {
    const emails = filtered.map(x => x.email).join(', ');
    navigator.clipboard?.writeText(emails);
    alert(`Скопировано ${filtered.length} email`);
  }

  async function saveTemplate() {
    setTplSaving(true);
    try {
      const r = await api.adminSaveWaitlistEmailTemplate({
        subject: tplSubject,
        body: tplBody,
      });
      setEmailTpl(prev => ({ ...prev, subject: r.subject, body: r.body }));
      showToast('✓ Шаблон письма сохранён');
    } catch (e) {
      alert(e.message || 'Не удалось сохранить шаблон');
    }
    setTplSaving(false);
  }

  async function resetTemplate() {
    if (!await customConfirm('Сбросить шаблон письма к стандартному тексту?',
      { confirmLabel: 'Сбросить' })) return;
    setTplSaving(true);
    try {
      const r = await api.adminResetWaitlistEmailTemplate();
      setTplSubject(r.subject);
      setTplBody(r.body);
      showToast('Шаблон сброшен');
    } catch (e) {
      alert(e.message || 'Не удалось сбросить');
    }
    setTplSaving(false);
  }

  const previewName = me?.name || 'Администратор HEY';
  const previewLink = 'https://hey-messenger.ru/register?invite=XXXXXXXXXX';
  const previewText = (tplBody || '')
    .replace(/\{\{inviterName\}\}/g, previewName)
    .replace(/\{\{inviteLink\}\}/g, previewLink);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap', marginBottom: 8 }}>
        <h1 style={{ color:'#F9F0F0', fontSize: 24, fontWeight: 800, margin: 0 }}>
          📨 Заявки на открытие регистрации
        </h1>
        <div style={{ color:'rgba(249,240,240,.75)', fontSize: 13, fontWeight:500 }}>
          {counts.all.toLocaleString('ru')} всего
          {counts.pending > 0 && (
            <span style={{ color:'rgba(255,200,160,1)', fontWeight:700 }}>
              {' · '}необработанных: {counts.pending}
            </span>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={copyAllEmails} disabled={!filtered.length} style={btn()}>
            📋 Скопировать все email
          </button>
          <button onClick={load} disabled={loading} style={btn()}>
            {loading ? '…' : '↻ Обновить'}
          </button>
        </div>
      </div>

      <p style={{ color: 'rgba(249,240,240,.7)', fontSize: 13, marginTop: 0, marginBottom: 18,
        lineHeight: 1.5 }}>
        Юзеры, оставившие email на экране «Только по приглашению».
        Нажмите <strong>«Отправить инвайт»</strong> — на email уйдёт персональная ссылка
        от вашего аккаунта ({me?.name || 'админ'}). Или отметьте «Уведомлён» вручную.
      </p>

      <div style={{
        marginBottom: 18, borderRadius: 14,
        border: '1px solid rgba(249,240,240,.14)',
        background: 'rgba(20,12,40,.55)', overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setTplOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', border: 'none', background: 'transparent',
            color: '#F9F0F0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <span>✉️ Шаблон письма с инвайтом</span>
          <span style={{ color: 'rgba(249,240,240,.45)', fontSize: 12 }}>{tplOpen ? '▲' : '▼'}</span>
        </button>
        {tplOpen && emailTpl && (
          <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(249,240,240,.08)' }}>
            <p style={{ color: 'rgba(249,240,240,.55)', fontSize: 12, lineHeight: 1.5, margin: '12px 0' }}>
              Переменные: <code style={{ color: 'rgba(200,180,255,.9)' }}>{'{{inviterName}}'}</code> — имя
              админа, <code style={{ color: 'rgba(200,180,255,.9)' }}>{'{{inviteLink}}'}</code> — ссылка
              (обязательна). Абзацы — через пустую строку.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 11, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: .4 }}>Тема</div>
              <input
                value={tplSubject}
                onChange={e => setTplSubject(e.target.value)}
                disabled={tplSaving}
                style={tplInput}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <div style={{ color: 'rgba(249,240,240,.5)', fontSize: 11, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: .4 }}>Текст письма</div>
              <textarea
                value={tplBody}
                onChange={e => setTplBody(e.target.value)}
                disabled={tplSaving}
                rows={14}
                style={{ ...tplInput, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <button type="button" onClick={saveTemplate} disabled={tplSaving} style={btn()}>
                {tplSaving ? '…' : '💾 Сохранить шаблон'}
              </button>
              <button type="button" onClick={resetTemplate} disabled={tplSaving} style={btn('muted')}>
                ↺ Сбросить к стандартному
              </button>
            </div>
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'rgba(249,240,240,.04)', border: '1px solid rgba(249,240,240,.1)',
            }}>
              <div style={{ color: 'rgba(249,240,240,.45)', fontSize: 11, marginBottom: 8,
                textTransform: 'uppercase' }}>Превью (пример)</div>
              <div style={{ color: 'rgba(249,240,240,.85)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {tplSubject.replace(/\{\{inviterName\}\}/g, previewName)}
              </div>
              <pre style={{
                margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: 'rgba(249,240,240,.75)', fontSize: 12, lineHeight: 1.55,
                fontFamily: 'inherit',
              }}>{previewText}</pre>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom: 14, alignItems:'center' }}>
        {[
          { v:'pending',  l:'Необработанные' },
          { v:'notified', l:'Уведомлённые' },
          { v:'all',      l:'Все' },
        ].map(t => (
          <button key={t.v} onClick={() => setFilter(t.v)}
            style={tab(filter === t.v)}>
            {t.l} <span style={{ opacity:.6 }}>{counts[t.v]}</span>
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по email / источнику…"
          style={{
            marginLeft:'auto', flex:'0 0 280px', maxWidth:'100%',
            padding:'8px 12px', borderRadius:9,
            background:'rgba(249,240,240,.07)',
            border:'1px solid rgba(249,240,240,.12)',
            color:'#F9F0F0', fontSize:13, outline:'none',
          }}/>
      </div>

      {error && (
        <div style={{ color:'rgba(255,140,140,.95)', padding:12, background:'rgba(220,80,80,.12)',
          borderRadius:10, marginBottom:14 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color:'rgba(249,240,240,.5)', padding: 40, textAlign:'center' }}>Загрузка…</div>
      ) : !filtered.length ? (
        <div style={{ color:'rgba(249,240,240,.5)', padding: 40, textAlign:'center' }}>
          {filter === 'pending' ? 'Все заявки обработаны 👌' : 'Заявок нет.'}
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, color:'#F9F0F0' }}>
            <thead>
              <tr style={{ color:'rgba(235,230,255,1)', borderBottom:'1px solid rgba(249,240,240,.18)',
                fontSize:12, textTransform:'uppercase', letterSpacing:.4 }}>
                <th style={th}>Email</th>
                <th style={th}>Источник</th>
                <th style={th}>Когда</th>
                <th style={th}>Уведомлён</th>
                <th style={th}>Инвайт</th>
                <th style={{ ...th, textAlign:'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => (
                <tr key={it.id} style={{ borderBottom:'1px solid rgba(249,240,240,.1)' }}>
                  <td style={td}>
                    <a href={`mailto:${it.email}`}
                      style={{ color:'rgba(200,180,255,1)', fontWeight:600,
                        textDecoration:'underline',
                        textDecorationColor:'rgba(200,180,255,.4)',
                        textUnderlineOffset:2 }}
                      onMouseEnter={e=>e.currentTarget.style.color='#F9F0F0'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(200,180,255,1)'}>
                      {it.email}
                    </a>
                  </td>
                  <td style={td}>
                    {it.source ? (
                      <span style={{
                        display:'inline-block', padding:'2px 8px', borderRadius:6,
                        background:'rgba(95, 64, 128,.22)',
                        border:'1px solid rgba(180,140,255,.25)',
                        color:'rgba(220,210,255,.95)', fontSize:11, fontWeight:600,
                        letterSpacing:.2,
                      }}>{it.source}</span>
                    ) : <span style={{ color:'rgba(249,240,240,.4)' }}>—</span>}
                  </td>
                  <td style={{ ...td, color:'rgba(249,240,240,.9)', fontWeight:500 }}>
                    {fmtDate(it.created_at)}
                  </td>
                  <td style={td}>
                    {it.notified_at
                      ? <span style={{
                          display:'inline-flex', alignItems:'center', gap:6,
                          padding:'2px 10px', borderRadius:6,
                          background:'rgba(70,180,110,.22)',
                          border:'1px solid rgba(120,220,150,.4)',
                          color:'rgba(170,250,200,1)', fontWeight:600, fontSize:12,
                        }}>✓ {fmtDate(it.notified_at)}</span>
                      : <span style={{
                          display:'inline-block', padding:'2px 10px', borderRadius:6,
                          background:'rgba(220,140,80,.18)',
                          border:'1px solid rgba(255,180,120,.4)',
                          color:'rgba(255,210,170,1)', fontWeight:700, fontSize:12,
                          letterSpacing:.3,
                        }}>НЕТ</span>}
                  </td>
                  <td style={td}>
                    {it.invite_sent_at ? (
                      <span title={it.invite_sent_by_name ? `От ${it.invite_sent_by_name}` : ''}
                        style={{
                          display:'inline-flex', alignItems:'center', gap:6,
                          padding:'2px 10px', borderRadius:6,
                          background:'rgba(95,64,128,.28)',
                          border:'1px solid rgba(180,140,255,.35)',
                          color:'rgba(220,200,255,1)', fontWeight:600, fontSize:12,
                        }}>
                        📨 {fmtDate(it.invite_sent_at)}
                      </span>
                    ) : (
                      <span style={{ color:'rgba(249,240,240,.35)', fontSize:12 }}>—</span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
                    <button
                      disabled={busy[it.id]}
                      onClick={() => sendInvite(it)}
                      style={smallBtn('primary')}
                      title="Отправить персональный инвайт на email"
                    >
                      📨 Инвайт
                    </button>
                    {' '}
                    <button disabled={busy[it.id]} onClick={() => toggleNotified(it)} style={smallBtn()}>
                      {it.notified_at ? '↺ Сбросить' : '✓ Уведомлён'}
                    </button>
                    {' '}
                    <button disabled={busy[it.id]} onClick={() => remove(it)} style={smallBtn('danger')}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'rgba(38,28,68,.97)', border:'1px solid rgba(180,140,255,.35)',
          borderRadius:12, padding:'12px 20px', color:'#F9F0F0', fontSize:13,
          fontWeight:600, zIndex:8000, maxWidth:'min(92vw,520px)', textAlign:'center',
          boxShadow:'0 8px 32px rgba(0,0,0,.45)',
        }}>
          {toast}
        </div>
      )}
      {confirmModal}
    </div>
  );
}

const th = { textAlign:'left', padding:'10px 12px', fontWeight:600, fontSize:13 };
const td = { padding:'10px 12px' };
function btn(variant) {
  return {
    padding:'8px 14px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none', color:'#F9F0F0',
    background: variant === 'muted' ? 'rgba(249,240,240,.08)' : 'rgba(95, 64, 128,.55)',
  };
}
const tplInput = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10,
  background: 'rgba(249,240,240,.06)',
  border: '1px solid rgba(249,240,240,.14)',
  color: '#F9F0F0', fontSize: 13, outline: 'none',
};
function smallBtn(variant) {
  const bg = variant === 'danger'
    ? 'rgba(220,80,80,.45)'
    : variant === 'primary'
      ? 'rgba(95, 64, 128,.65)'
      : 'rgba(249,240,240,.08)';
  return {
    padding:'5px 10px', borderRadius:7, fontSize:12, fontWeight:600,
    cursor:'pointer', border:'none', color:'#F9F0F0',
    background: bg,
  };
}
function tab(active) {
  return {
    padding:'8px 12px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none',
    background: active ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.06)',
    color: active ? '#F9F0F0' : 'rgba(249,240,240,.65)',
  };
}
