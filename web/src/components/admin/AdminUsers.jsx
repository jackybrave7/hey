// AdminUsers.jsx — user list with search and filters
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useConfirm } from '../Screens';
import { useBulkSelection, Checkbox, BulkActionBar } from './bulk';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsers() {
  const nav = useNavigate();
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('');
  const [sortBy, setSortBy]   = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulk = useBulkSelection();
  const [customConfirm, confirmModal] = useConfirm();

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGetUsers({ search: search || undefined, filter: filter || undefined });
      setUsers(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const FILTERS = [
    { value: '', label: 'Все' },
    { value: 'admins', label: 'Администраторы' },
    { value: 'blocked', label: 'Заблокированные' },
  ];

  const cell = { padding: '12px 16px', color: 'rgba(255,255,255,.8)', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,.06)' };
  const hcell = { ...cell, color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 };

  const sortedUsers = useMemo(() => [...users].sort((a, b) => {
    const va = a[sortBy] ?? '';
    const vb = b[sortBy] ?? '';
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  }), [users, sortBy, sortDir]);

  // id'ы которые реально можно выделить и применить действие — без self и без админов
  const selectableIds = useMemo(
    () => sortedUsers.filter(u => !u.is_admin).map(u => u.id),
    [sortedUsers]
  );
  const headerCheckState = useMemo(() => {
    if (!selectableIds.length || !bulk.count) return { checked: false, indeterminate: false };
    const allSelected = selectableIds.every(id => bulk.has(id));
    return { checked: allSelected, indeterminate: !allSelected };
  }, [selectableIds, bulk]);

  async function applyBulkAction(action) {
    const ids = bulk.ids();
    if (!ids.length) return;
    const LABELS = {
      block:       { name: 'заблокировать', confirmLabel: 'Заблокировать' },
      unblock:     { name: 'разблокировать', confirmLabel: 'Разблокировать' },
      delete:      { name: 'удалить (мягко)', confirmLabel: '🗑 Удалить' },
      hard_delete: { name: 'СТЕРЕТЬ ПОЛНОСТЬЮ', confirmLabel: '💣 Стереть',
                     requireWord: 'СТЕРЕТЬ',
                     warning: 'Удалит аккаунты, их моменты и медиа из S3. Сообщения анонимизируются. Восстановить нельзя.' },
    };
    const meta = LABELS[action];
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:8,color: action === 'hard_delete' ? 'rgba(255,160,160,.95)' : 'white'}}>
          {meta.confirmLabel} {ids.length} {ids.length === 1 ? 'пользователя' : 'пользователей'}?
        </div>
        {meta.warning && (
          <div style={{color:'rgba(255,160,160,.85)', fontSize: 13, lineHeight: 1.5}}>{meta.warning}</div>
        )}
      </>,
      { confirmLabel: meta.confirmLabel, danger: action !== 'unblock', requireWord: meta.requireWord }
    );
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await api.adminBatchUsers(ids, action);
      const msg = `✓ ${meta.name}: ${res.processed}${res.failed?.length ? `, ошибок: ${res.failed.length}` : ''}`;
      showToast(msg);
      bulk.clear();
      load();
    } catch (e) { showToast('Ошибка: ' + e.message); }
    setBulkBusy(false);
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        👥 Пользователи
      </h1>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону…"
          style={{
            flex: 1, minWidth: 220,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 10, padding: '9px 14px', color: 'white', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{
                padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: filter === f.value ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.08)',
                color: filter === f.value ? 'white' : 'rgba(255,255,255,.6)',
              }}>
              {f.label}
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
      ) : (
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...hcell, width: 40 }}>
                  <Checkbox
                    checked={headerCheckState.checked}
                    indeterminate={headerCheckState.indeterminate}
                    onClick={() => headerCheckState.checked ? bulk.clear() : bulk.selectAll(selectableIds)}
                    title="Выделить всех (кроме админов)"
                  />
                </th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('name')}>Имя{sortIcon('name')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('phone')}>Телефон{sortIcon('phone')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('total_moments')}>Моменты{sortIcon('total_moments')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}}
                  onClick={() => toggleSort('invited_total')}
                  title="Пригласил всего (подтверждённых — написали первое сообщение)">
                  Привёл{sortIcon('invited_total')}
                </th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('created_at')}>Зарегистрирован{sortIcon('created_at')}</th>
                <th style={hcell}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  Пусто
                </td></tr>
              )}
              {sortedUsers.map(u => (
                <tr key={u.id}
                  onClick={() => nav(`/admin/users/${u.id}`)}
                  style={{ cursor: 'pointer', background: bulk.has(u.id) ? 'rgba(120,90,200,.10)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = bulk.has(u.id) ? 'rgba(120,90,200,.16)' : 'rgba(255,255,255,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = bulk.has(u.id) ? 'rgba(120,90,200,.10)' : 'transparent'}>
                  <td style={cell} onClick={(e) => e.stopPropagation()}>
                    {u.is_admin
                      ? <span style={{ color:'rgba(255,255,255,.2)', fontSize: 11 }}>—</span>
                      : <Checkbox checked={bulk.has(u.id)} onClick={() => bulk.toggle(u.id)} title="Выделить"/>}
                  </td>
                  <td style={cell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(120,90,200,.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'white', fontWeight: 700, flexShrink: 0,
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,.1)',
                      }}>
                        {u.avatar && (u.avatar.startsWith('/') || u.avatar.startsWith('http') || u.avatar.startsWith('data:'))
                          ? <img src={u.avatar} alt=""
                              onError={e => { e.currentTarget.style.display = 'none'; }}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : (u.name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'white', fontWeight: 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          {u.is_admin && <span style={{ color: 'rgba(180,140,255,.8)', fontSize: 11 }}>admin</span>}
                          {u.is_super && (
                            <span style={{ color: 'rgba(255,200,80,.9)', fontSize: 11 }}
                              title={u.super_expires_at
                                ? 'Super до ' + new Date(u.super_expires_at*1000).toLocaleDateString('ru')
                                : 'Super без ограничения'}>
                              ✦ super
                              {u.super_expires_at != null && (
                                <span style={{opacity:.7,marginLeft:4}}>
                                  до {new Date(u.super_expires_at*1000).toLocaleDateString('ru',{day:'2-digit',month:'2-digit',year:'2-digit'})}
                                </span>
                              )}
                              {u.super_expires_at == null && (
                                <span style={{opacity:.7,marginLeft:4}}>∞</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={cell}>{u.phone}</td>
                  <td style={cell}>{u.active_moments}/{u.total_moments}</td>
                  <td style={cell}>
                    {(u.invited_total || 0) > 0 ? (
                      <span title={`Всего: ${u.invited_total}, написали первое сообщение: ${u.invited_confirmed || 0}`}>
                        <strong style={{color:'rgba(220,200,255,.95)'}}>{u.invited_total}</strong>
                        <span style={{color:'rgba(255,255,255,.4)'}}> ({u.invited_confirmed || 0})</span>
                      </span>
                    ) : <span style={{color:'rgba(255,255,255,.25)'}}>—</span>}
                  </td>
                  <td style={cell}>{fmtDate(u.created_at)}</td>
                  <td style={cell}>
                    {u.is_blocked ? (
                      <span style={{ color: 'rgba(255,100,100,.9)', fontSize: 12, fontWeight: 600,
                        background: 'rgba(200,50,50,.18)', borderRadius: 6, padding: '2px 8px' }}>
                        заблокирован
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(100,220,140,.8)', fontSize: 12, fontWeight: 600,
                        background: 'rgba(60,180,100,.12)', borderRadius: 6, padding: '2px 8px' }}>
                        активен
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, marginTop: 12 }}>
        {users.length} пользователей
      </div>

      <BulkActionBar
        count={bulk.count}
        busy={bulkBusy}
        onClear={bulk.clear}
        onAction={(a) => applyBulkAction(a.key)}
        actions={[
          { key: 'block',       label: '🚫 Заблокировать' },
          { key: 'unblock',     label: '↩ Разблокировать' },
          { key: 'delete',      label: '🗑 Удалить', danger: true },
          { key: 'hard_delete', label: '💣 Стереть полностью', danger: true },
        ]}
      />

      {toast && (
        <div style={{ position:'fixed', bottom: 80, left: '50%', transform:'translateX(-50%)',
          background:'rgba(22,15,50,.97)', border:'1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding:'10px 20px', color:'white', fontSize: 14, fontWeight: 600,
          zIndex: 1200, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
      {confirmModal}
    </div>
  );
}
