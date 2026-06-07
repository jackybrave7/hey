// AdminWaitlist.jsx — заявки «открыть регистрацию без приглашения».
// Юзеры оставляют email на InviteOnlyBlock-экране. Админ их прорабатывает:
// помечает «уведомлён» когда написал, или удаляет неактуальное.
import { useEffect, useState, useMemo } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminWaitlist() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending'); // pending | notified | all
  const [busy, setBusy]     = useState({}); // {id: bool}
  const [customConfirm, confirmModal] = useConfirm();

  async function load() {
    setLoading(true); setError('');
    try { setItems(await api.adminGetWaitlist()); }
    catch (e) { setError(e.message || 'Не удалось'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap', marginBottom: 8 }}>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, margin: 0 }}>
          📨 Заявки на открытие регистрации
        </h1>
        <div style={{ color:'rgba(255,255,255,.75)', fontSize: 13, fontWeight:500 }}>
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

      <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 0, marginBottom: 18,
        lineHeight: 1.5 }}>
        Юзеры, оставившие email на экране «Только по приглашению». Когда
        напишешь им — нажми «✓ Уведомлён», чтобы убрать из счётчика.
      </p>

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
            background:'rgba(255,255,255,.07)',
            border:'1px solid rgba(255,255,255,.12)',
            color:'white', fontSize:13, outline:'none',
          }}/>
      </div>

      {error && (
        <div style={{ color:'rgba(255,140,140,.95)', padding:12, background:'rgba(220,80,80,.12)',
          borderRadius:10, marginBottom:14 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color:'rgba(255,255,255,.5)', padding: 40, textAlign:'center' }}>Загрузка…</div>
      ) : !filtered.length ? (
        <div style={{ color:'rgba(255,255,255,.5)', padding: 40, textAlign:'center' }}>
          {filter === 'pending' ? 'Все заявки обработаны 👌' : 'Заявок нет.'}
        </div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, color:'white' }}>
            <thead>
              <tr style={{ color:'rgba(235,230,255,1)', borderBottom:'1px solid rgba(255,255,255,.18)',
                fontSize:12, textTransform:'uppercase', letterSpacing:.4 }}>
                <th style={th}>Email</th>
                <th style={th}>Источник</th>
                <th style={th}>Когда</th>
                <th style={th}>Уведомлён</th>
                <th style={{ ...th, textAlign:'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => (
                <tr key={it.id} style={{ borderBottom:'1px solid rgba(255,255,255,.1)' }}>
                  <td style={td}>
                    <a href={`mailto:${it.email}`}
                      style={{ color:'rgba(200,180,255,1)', fontWeight:600,
                        textDecoration:'underline',
                        textDecorationColor:'rgba(200,180,255,.4)',
                        textUnderlineOffset:2 }}
                      onMouseEnter={e=>e.currentTarget.style.color='white'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(200,180,255,1)'}>
                      {it.email}
                    </a>
                  </td>
                  <td style={td}>
                    {it.source ? (
                      <span style={{
                        display:'inline-block', padding:'2px 8px', borderRadius:6,
                        background:'rgba(120,90,200,.22)',
                        border:'1px solid rgba(180,140,255,.25)',
                        color:'rgba(220,210,255,.95)', fontSize:11, fontWeight:600,
                        letterSpacing:.2,
                      }}>{it.source}</span>
                    ) : <span style={{ color:'rgba(255,255,255,.4)' }}>—</span>}
                  </td>
                  <td style={{ ...td, color:'rgba(255,255,255,.9)', fontWeight:500 }}>
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
                  <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
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
      {confirmModal}
    </div>
  );
}

const th = { textAlign:'left', padding:'10px 12px', fontWeight:600, fontSize:13 };
const td = { padding:'10px 12px' };
function btn() {
  return {
    padding:'8px 14px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none', color:'white',
    background:'rgba(120,90,200,.55)',
  };
}
function smallBtn(variant) {
  return {
    padding:'5px 10px', borderRadius:7, fontSize:12, fontWeight:600,
    cursor:'pointer', border:'none', color:'white',
    background: variant === 'danger' ? 'rgba(220,80,80,.45)' : 'rgba(255,255,255,.08)',
  };
}
function tab(active) {
  return {
    padding:'8px 12px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none',
    background: active ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.06)',
    color: active ? 'white' : 'rgba(255,255,255,.65)',
  };
}
