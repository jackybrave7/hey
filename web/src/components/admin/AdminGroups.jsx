// AdminGroups.jsx — список всех групповых чатов
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRel(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60)        return 'только что';
  if (diff < 3600)      return Math.floor(diff / 60) + ' мин назад';
  if (diff < 86400)     return Math.floor(diff / 3600) + ' ч назад';
  if (diff < 30*86400)  return Math.floor(diff / 86400) + ' дн назад';
  return fmtDate(ts);
}

export default function AdminGroups() {
  const nav = useNavigate();
  const [groups, setGroups]   = useState([]);
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('last_message_at');
  const [sortDir, setSortDir] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.adminGetGroups({ search: search || undefined })
        .then(setGroups)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const sorted = useMemo(() => [...groups].sort((a, b) => {
    const va = a[sortBy] ?? 0;
    const vb = b[sortBy] ?? 0;
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  }), [groups, sortBy, sortDir]);

  const cell  = { padding: '12px 16px', color: 'rgba(255,255,255,.8)', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,.06)' };
  const hcell = { ...cell, color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        🫂 Группы
      </h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию…"
          style={{
            flex: 1, minWidth: 220,
            background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
            borderRadius: 10, padding: '9px 14px', color: 'white', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
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
        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('name')}>Название{sortIcon('name')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('members_count')}>Участники{sortIcon('members_count')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('messages_count')}>Сообщений{sortIcon('messages_count')}</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('last_message_at')}>Последняя активность{sortIcon('last_message_at')}</th>
                <th style={{...hcell}}>Создатель</th>
                <th style={{...hcell, cursor:'pointer', userSelect:'none'}} onClick={() => toggleSort('created_at')}>Создана{sortIcon('created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={6} style={{...cell, textAlign:'center', color:'rgba(255,255,255,.3)'}}>Пусто</td></tr>
              )}
              {sorted.map(g => {
                const ic = g.icon || '';
                const isImg = ic && (ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:'));
                return (
                  <tr key={g.id}
                    onClick={() => nav(`/admin/groups/${g.id}`)}
                    style={{ cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={cell}>
                      <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isImg ? '#0a0518' : 'rgba(120,90,200,.4)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize: 16, color:'white', fontWeight: 700,
                          border:'1px solid rgba(255,255,255,.1)', overflow:'hidden', flexShrink:0,
                        }}>
                          {isImg
                            ? <img src={ic} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                            : (ic || '👥')}
                        </div>
                        <div style={{minWidth:0}}>
                          <div style={{color:'white', fontWeight:600, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.name || '— без названия —'}</div>
                          <div style={{color:'rgba(255,255,255,.35)', fontSize: 11}}>
                            {g.history_visibility === 'since_joined' ? '🔒 история скрыта' : 'история видна'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={cell}>
                      <strong style={{color:'white'}}>{g.members_count}</strong>
                      {g.pending_count > 0 && (
                        <span style={{color:'rgba(255,200,120,.85)', marginLeft: 6}}>+{g.pending_count} 🕓</span>
                      )}
                    </td>
                    <td style={cell}>{g.messages_count}</td>
                    <td style={cell}>{fmtRel(g.last_message_at)}</td>
                    <td style={cell}>{g.admin_name || '—'}</td>
                    <td style={cell}>{fmtDate(g.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, marginTop: 12 }}>
        {groups.length} групп
      </div>
    </div>
  );
}
