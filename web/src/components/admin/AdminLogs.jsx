// AdminLogs.jsx — admin action logs
import { useState, useEffect } from 'react';
import { api } from '../../api';
import Icon from '../Icon';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ACTION_LABELS = {
  block_user:           { label: 'Блокировка',            icon: 'ban',  color: 'rgba(255,100,80,.8)' },
  unblock_user:         { label: '✓ Разблокировка',        color: 'rgba(100,220,140,.8)' },
  make_admin:           { label: '👑 Назначен admin',      color: 'rgba(200,160,80,.8)' },
  revoke_admin:         { label: '👑 Снят admin',          color: 'rgba(200,160,80,.6)' },
  reset_password:       { label: 'Сброс пароля',          icon: 'lock', color: 'rgba(180,140,255,.8)' },
  delete_moment:        { label: '🗑 Удалён момент',       color: 'rgba(255,140,100,.8)' },
  delete_user:          { label: '🗑 Удалён пользователь', color: 'rgba(255,80,80,.95)' },
  system_moment_create: { label: '📢 Момент HEY-зав.',     color: 'rgba(120,200,255,.9)' },
  system_broadcast:     { label: '📢 Рассылка HEY-зав.',   color: 'rgba(120,200,255,.9)' },
  feedback_reply:       { label: '✉ Ответ на обращение',   color: 'rgba(120,200,255,.85)' },
};

export default function AdminLogs() {
  const [logs, setLogs]       = useState([]);
  const [search, setSearch]   = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.adminGetLogs(200)
      .then(setLogs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cell = { padding: '11px 16px', color: 'rgba(249,240,240,.75)', fontSize: 13,
    borderBottom: '1px solid rgba(249,240,240,.06)', verticalAlign: 'middle' };
  const hcell = { ...cell, color: 'rgba(249,240,240,.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: .8 };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color:'#F9F0F0', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        📋 Логи администратора
      </h1>
      <p style={{ color: 'rgba(249,240,240,.4)', fontSize: 14, marginBottom: 16 }}>
        Последние 200 действий
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по администратору, цели, причине…"
          style={{
            flex: 1, minWidth: 220,
            background: 'rgba(249,240,240,.08)', border: '1px solid rgba(249,240,240,.14)',
            borderRadius: 10, padding: '9px 14px', color:'#F9F0F0', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}/>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          style={{
            background: 'rgba(249,240,240,.08)', border: '1px solid rgba(249,240,240,.14)',
            borderRadius: 10, padding: '9px 14px', color:'#F9F0F0', fontSize: 13,
            fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
          }}>
          <option value="" style={{background:'#1a0e36'}}>Все действия</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k} style={{background:'#1a0e36'}}>{v.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.9)', background: 'rgba(200,50,50,.12)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          Ошибка: {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'rgba(249,240,240,.35)', fontSize: 14 }}>Загрузка…</div>
      ) : (
        <div style={{ background: 'rgba(249,240,240,.04)', borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(249,240,240,.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={hcell}>Время</th>
                <th style={hcell}>Действие</th>
                <th style={hcell}>Администратор</th>
                <th style={hcell}>Цель</th>
                <th style={hcell}>Причина</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const q = search.trim().toLowerCase();
                const filtered = logs.filter(l => {
                  if (actionFilter && l.action !== actionFilter) return false;
                  if (!q) return true;
                  return (
                    (l.admin_name || '').toLowerCase().includes(q) ||
                    (l.target_user_name || '').toLowerCase().includes(q) ||
                    (l.target_moment_text || '').toLowerCase().includes(q) ||
                    (l.reason || '').toLowerCase().includes(q)
                  );
                });
                if (filtered.length === 0) return (
                  <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'rgba(249,240,240,.3)' }}>
                    {q || actionFilter ? 'Ничего не найдено' : 'Логов нет'}
                  </td></tr>
                );
                return null;
              })()}
              {logs.filter(l => {
                const q = search.trim().toLowerCase();
                if (actionFilter && l.action !== actionFilter) return false;
                if (!q) return true;
                return (
                  (l.admin_name || '').toLowerCase().includes(q) ||
                  (l.target_user_name || '').toLowerCase().includes(q) ||
                  (l.target_moment_text || '').toLowerCase().includes(q) ||
                  (l.reason || '').toLowerCase().includes(q)
                );
              }).map(log => {
                const info = ACTION_LABELS[log.action] || { label: log.action, color: 'rgba(249,240,240,.5)' };
                return (
                  <tr key={log.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(log.created_at)}</td>
                    <td style={cell}>
                      <span style={{ color: info.color, fontWeight: 600, display:'inline-flex', alignItems:'center', gap:6 }}>
                        {info.icon && <Icon name={info.icon} size={14} />}
                        {info.label}
                      </span>
                    </td>
                    <td style={cell}>{log.admin_name || log.admin_id}</td>
                    <td style={cell}>
                      {log.target_user_name && (
                        <div style={{ color: 'rgba(249,240,240,.75)' }}>{log.target_user_name}</div>
                      )}
                      {log.target_moment_text && (
                        <div style={{ color: 'rgba(249,240,240,.45)', fontSize: 12,
                          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', maxWidth: 200 }}>
                          «{log.target_moment_text}»
                        </div>
                      )}
                      {!log.target_user_name && !log.target_moment_text && '—'}
                    </td>
                    <td style={{ ...cell, color: 'rgba(249,240,240,.45)', fontSize: 12 }}>
                      {log.reason || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
