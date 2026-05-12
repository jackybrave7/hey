// AdminLogs.jsx — admin action logs
import { useState, useEffect } from 'react';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ACTION_LABELS = {
  block_user:       { label: '🚫 Блокировка',       color: 'rgba(255,100,80,.8)' },
  unblock_user:     { label: '✓ Разблокировка',      color: 'rgba(100,220,140,.8)' },
  make_admin:       { label: '👑 Назначен admin',    color: 'rgba(200,160,80,.8)' },
  revoke_admin:     { label: '👑 Снят admin',        color: 'rgba(200,160,80,.6)' },
  reset_password:   { label: '🔑 Сброс пароля',     color: 'rgba(180,140,255,.8)' },
  delete_moment:    { label: '🗑 Удалён момент',    color: 'rgba(255,140,100,.8)' },
};

export default function AdminLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.adminGetLogs(200)
      .then(setLogs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cell = { padding: '11px 16px', color: 'rgba(255,255,255,.75)', fontSize: 13,
    borderBottom: '1px solid rgba(255,255,255,.06)', verticalAlign: 'middle' };
  const hcell = { ...cell, color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: .8 };

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        📋 Логи администратора
      </h1>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, marginBottom: 24 }}>
        Последние 200 действий
      </p>

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
                <th style={hcell}>Время</th>
                <th style={hcell}>Действие</th>
                <th style={hcell}>Администратор</th>
                <th style={hcell}>Цель</th>
                <th style={hcell}>Причина</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
                  Логов нет
                </td></tr>
              )}
              {logs.map(log => {
                const info = ACTION_LABELS[log.action] || { label: log.action, color: 'rgba(255,255,255,.5)' };
                return (
                  <tr key={log.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{fmtDate(log.created_at)}</td>
                    <td style={cell}>
                      <span style={{ color: info.color, fontWeight: 600 }}>{info.label}</span>
                    </td>
                    <td style={cell}>{log.admin_name || log.admin_id}</td>
                    <td style={cell}>
                      {log.target_user_name && (
                        <div style={{ color: 'rgba(255,255,255,.75)' }}>{log.target_user_name}</div>
                      )}
                      {log.target_moment_text && (
                        <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 12,
                          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', maxWidth: 200 }}>
                          «{log.target_moment_text}»
                        </div>
                      )}
                      {!log.target_user_name && !log.target_moment_text && '—'}
                    </td>
                    <td style={{ ...cell, color: 'rgba(255,255,255,.45)', fontSize: 12 }}>
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
