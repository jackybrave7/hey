// AdminUsers.jsx — user list with search and filters
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsers() {
  const nav = useNavigate();
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

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
                <th style={hcell}>Имя</th>
                <th style={hcell}>Телефон</th>
                <th style={hcell}>Моменты</th>
                <th style={hcell}>Зарегистрирован</th>
                <th style={hcell}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  Пусто
                </td></tr>
              )}
              {users.map(u => (
                <tr key={u.id}
                  onClick={() => nav(`/admin/users/${u.id}`)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={cell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(120,90,200,.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'white', fontWeight: 700, flexShrink: 0,
                      }}>
                        {u.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontWeight: 600 }}>{u.name}</div>
                        {u.is_admin && <div style={{ color: 'rgba(180,140,255,.8)', fontSize: 11 }}>admin</div>}
                      </div>
                    </div>
                  </td>
                  <td style={cell}>{u.phone}</td>
                  <td style={cell}>{u.active_moments}/{u.total_moments}</td>
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
    </div>
  );
}
