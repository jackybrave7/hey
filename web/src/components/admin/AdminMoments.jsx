// AdminMoments.jsx — all moments with moderation tools
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useConfirm } from '../Screens';
import { useBulkSelection, Checkbox, BulkActionBar } from './bulk';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMoments() {
  const [moments, setMoments]   = useState([]);
  const [status, setStatus]     = useState('active');
  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState('created_at');
  const [sortDir, setSortDir]   = useState('desc');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState('');
  const [deleting, setDeleting] = useState(null);
  const [preview, setPreview]   = useState(null); // { url, type } для модалки увеличения
  const [customConfirm, confirmModal, customPrompt] = useConfirm();
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulk = useBulkSelection();

  async function applyBulkAction(action) {
    const ids = bulk.ids();
    if (!ids.length) return;
    const hard = action === 'hard_delete';
    const reason = await customPrompt(
      <>
        <div style={{fontWeight:700,marginBottom:8,color: hard ? 'rgba(255,160,160,.95)' : 'white'}}>
          {hard ? '💣 ПОЛНОСТЬЮ стереть' : '🗑 Удалить'} {ids.length} {ids.length === 1 ? 'момент' : 'моментов'}?
        </div>
        {hard && (
          <div style={{color:'rgba(255,160,160,.85)', fontSize: 13, lineHeight: 1.5}}>
            Удалит строки из БД и медиа из S3. Восстановить нельзя.
          </div>
        )}
      </>,
      {
        promptPlaceholder: 'Причина (необязательно, одна на все)',
        confirmLabel: hard ? '💣 Стереть' : '🗑 Удалить',
        danger: true,
      }
    );
    if (reason === null) return;
    setBulkBusy(true);
    try {
      const res = await api.adminBatchMoments(ids, action, reason || undefined);
      showMsg(`✓ ${hard ? 'Стёрто' : 'Удалено'}: ${res.processed}${res.failed?.length ? `, ошибок: ${res.failed.length}` : ''}`);
      bulk.clear();
      load();
    } catch (e) { showMsg('Ошибка: ' + e.message); }
    setBulkBusy(false);
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  function showMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetMoments({ status: status === 'all' ? undefined : status });
      setMoments(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(moment, hard = false) {
    const reason = await customPrompt(
      <>
        <div style={{fontWeight:600,marginBottom:8}}>
          {hard ? '💣 ПОЛНОСТЬЮ стереть момент?' : 'Удалить момент?'}
        </div>
        <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:4}}>
          «{(moment.text || '').slice(0, 120)}{(moment.text || '').length > 120 ? '…' : ''}»
        </div>
        {hard && (
          <div style={{color:'rgba(255,160,160,.85)',fontSize:12,marginTop:8,lineHeight:1.5}}>
            Удалит строку из БД и медиа из S3. Восстановить нельзя.
          </div>
        )}
      </>,
      {
        promptPlaceholder: 'Причина удаления (необязательно)',
        confirmLabel: hard ? '💣 Стереть' : 'Удалить',
        danger: true,
      }
    );
    if (reason === null) return; // cancelled
    try {
      await api.adminDeleteMoment(moment.id, reason || undefined, hard ? true : undefined);
      setMoments(prev => prev.filter(m => m.id !== moment.id));
      showMsg(hard ? 'Момент стёрт' : 'Момент удалён');
    } catch (e) {
      showMsg('Ошибка: ' + e.message);
    }
  }

  const STATUSES = [
    { value: 'active', label: 'Активные' },
    { value: 'archived', label: 'Архив' },
    { value: 'all', label: 'Все' },
  ];

  const cell = { padding: '12px 16px', color: 'rgba(255,255,255,.8)', fontSize: 13,
    borderBottom: '1px solid rgba(255,255,255,.06)', verticalAlign: 'top' };
  const hcell = { ...cell, color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: .8, verticalAlign: 'middle' };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        ✦ Моменты
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по тексту, автору или телефону…"
          style={{
            flex: 1, minWidth: 220,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 10, padding: '9px 14px', color: 'white', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}/>
        <div style={{ display: 'flex', gap: 8 }}>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatus(s.value)}
              style={{
                padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: status === s.value ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
                color: status === s.value ? 'white' : 'rgba(255,255,255,.6)',
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.9)', background: 'rgba(200,50,50,.12)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          Ошибка: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 14 }}>Загрузка…</div>
      ) : (() => {
        const q = search.trim().toLowerCase();
        const filtered = q
          ? moments.filter(m =>
              (m.text || '').toLowerCase().includes(q) ||
              (m.author_name || '').toLowerCase().includes(q) ||
              (m.author_phone || '').includes(search.trim())
            )
          : moments;
        const sorted = [...filtered].sort((a, b) => {
          const va = sortBy === 'reactions'
            ? (a.stats?.see || 0) + (a.stats?.resonate || 0) + (a.stats?.talk || 0)
            : (a[sortBy] ?? 0);
          const vb = sortBy === 'reactions'
            ? (b.stats?.see || 0) + (b.stats?.resonate || 0) + (b.stats?.talk || 0)
            : (b[sortBy] ?? 0);
          if (typeof va === 'string') {
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          }
          return sortDir === 'asc' ? va - vb : vb - va;
        });
        const sortHCell = (col) => ({...hcell, cursor:'pointer', userSelect:'none'});
        const visibleIds = sorted.map(m => m.id);
        const headerCheckState = (() => {
          if (!visibleIds.length || !bulk.count) return { checked: false, indeterminate: false };
          const allSelected = visibleIds.every(id => bulk.has(id));
          return { checked: allSelected, indeterminate: !allSelected };
        })();
        return (
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...hcell, width: 40 }}>
                  <Checkbox
                    checked={headerCheckState.checked}
                    indeterminate={headerCheckState.indeterminate}
                    onClick={() => headerCheckState.checked ? bulk.clear() : bulk.selectAll(visibleIds)}
                    title="Выделить все"
                  />
                </th>
                <th style={sortHCell('author_name')} onClick={() => toggleSort('author_name')}>Автор{sortIcon('author_name')}</th>
                <th style={hcell}>Текст</th>
                <th style={hcell}>Медиа</th>
                <th style={{ ...sortHCell('views'), textAlign: 'center' }} onClick={() => toggleSort('views')}>👁{sortIcon('views')}</th>
                <th style={{ ...sortHCell('reactions'), textAlign: 'center' }} onClick={() => toggleSort('reactions')}>Реакции{sortIcon('reactions')}</th>
                <th style={sortHCell('created_at')} onClick={() => toggleSort('created_at')}>Создан{sortIcon('created_at')}</th>
                <th style={hcell}>Статус</th>
                <th style={hcell}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  {q ? 'Ничего не найдено' : 'Пусто'}
                </td></tr>
              )}
              {sorted.map(m => (
                <tr key={m.id}
                  style={{ background: bulk.has(m.id) ? 'rgba(120,90,200,.10)' : 'transparent' }}>
                  <td style={cell}>
                    <Checkbox checked={bulk.has(m.id)} onClick={() => bulk.toggle(m.id)} title="Выделить"/>
                  </td>
                  <td style={cell}>
                    {m.user_id ? (
                      <Link to={`/admin/users/${m.user_id}`}
                        style={{ color: 'rgba(180,150,250,.95)', fontWeight: 600, textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                        {m.author_name}
                      </Link>
                    ) : (
                      <div style={{ color: 'white', fontWeight: 600 }}>{m.author_name}</div>
                    )}
                    {m.author_is_deleted ? (
                      <div style={{ color: 'rgba(255,180,140,.85)', fontSize: 11, fontWeight: 600,
                        marginTop: 2 }} title="Аккаунт автора удалён">
                        🪦 автор удалён
                      </div>
                    ) : null}
                    <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11 }}>{m.author_phone}</div>
                  </td>
                  <td style={{ ...cell, maxWidth: 260 }}>
                    <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {m.text}
                    </div>
                    {m.auto_tags?.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {m.auto_tags.map(t => (
                          <span key={t} style={{ fontSize: 10, color: 'rgba(180,140,255,.7)',
                            background: 'rgba(120,90,200,.15)', borderRadius: 4, padding: '1px 5px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={cell}>
                    {!m.media_type && '—'}
                    {m.media_type === 'image' && m.media_url && (
                      <img src={m.media_url} alt="" loading="lazy"
                        onClick={() => setPreview({ url: m.media_url, type: 'image' })}
                        style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover',
                          cursor: 'zoom-in', border: '1px solid rgba(255,255,255,.12)' }}/>
                    )}
                    {m.media_type === 'video' && m.media_url && (
                      <div onClick={() => setPreview({ url: m.media_url, type: 'video' })}
                        style={{ position: 'relative', width: 64, height: 64, borderRadius: 8,
                          overflow: 'hidden', cursor: 'pointer', background: 'rgba(0,0,0,.4)',
                          border: '1px solid rgba(255,255,255,.12)' }}>
                        <video src={m.media_url + '#t=0.1'} preload="metadata" muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, color: 'white', textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>▶</div>
                      </div>
                    )}
                    {m.media_type === 'audio' && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)',
                        background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px' }}>
                        🎤 audio
                      </span>
                    )}
                    {m.media_type && !['image','video','audio'].includes(m.media_type) && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)',
                        background: 'rgba(255,255,255,.08)', borderRadius: 4, padding: '2px 6px' }}>
                        {m.media_type}
                      </span>
                    )}
                  </td>
                  <td style={{ ...cell, textAlign: 'center' }}>{m.views}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    <div style={{ fontSize: 11 }}>
                      {m.stats?.see || 0} 👁 · {m.stats?.resonate || 0} ✨ · {m.stats?.talk || 0} 🤝
                    </div>
                  </td>
                  <td style={cell}>{fmtDate(m.created_at)}</td>
                  <td style={cell}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px',
                      background: m.status === 'active' ? 'rgba(60,180,100,.12)' : 'rgba(255,255,255,.08)',
                      color: m.status === 'active' ? 'rgba(100,220,140,.8)' : 'rgba(255,255,255,.4)',
                    }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={cell}>
                    <div style={{ display:'flex', gap: 6 }}>
                      <button onClick={() => handleDelete(m, false)}
                        title="Мягкое удаление (status=deleted)"
                        style={{ background: 'rgba(200,50,50,.22)', border: 'none', borderRadius: 8,
                          padding: '6px 10px', color: 'rgba(255,120,120,.9)', fontSize: 12,
                          cursor: 'pointer', fontWeight: 600 }}>
                        🗑
                      </button>
                      <button onClick={() => handleDelete(m, true)}
                        title="Полное удаление (БД + S3)"
                        style={{ background: 'rgba(200,50,50,.5)', border: 'none', borderRadius: 8,
                          padding: '6px 10px', color: 'white', fontSize: 12,
                          cursor: 'pointer', fontWeight: 700 }}>
                        💣
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })()}

      <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, marginTop: 12 }}>
        {moments.length} моментов{search.trim() && ` · показано совпадений`}
      </div>

      <BulkActionBar
        count={bulk.count}
        busy={bulkBusy}
        onClear={bulk.clear}
        onAction={(a) => applyBulkAction(a.key)}
        actions={[
          { key: 'delete',      label: '🗑 Удалить', danger: true },
          { key: 'hard_delete', label: '💣 Стереть полностью', danger: true },
        ]}
      />

      {/* Lightbox preview */}
      {preview && (
        <div onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.88)',
            backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'zoom-out', padding: 40 }}>
          {preview.type === 'image' && (
            <img src={preview.url} alt="" onClick={e => e.stopPropagation()}
              style={{ maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain',
                borderRadius: 12, cursor: 'default' }}/>
          )}
          {preview.type === 'video' && (
            <video src={preview.url} controls autoPlay onClick={e => e.stopPropagation()}
              style={{ maxWidth: '95vw', maxHeight: '92vh', borderRadius: 12, cursor: 'default' }}/>
          )}
          <button onClick={() => setPreview(null)}
            style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,.1)',
              border: 'none', borderRadius: '50%', width: 40, height: 40,
              color: 'white', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      {confirmModal}
    </div>
  );
}
