// AdminDashboard.jsx — stats overview
import { useState, useEffect } from 'react';
import { api } from '../../api';

function StatCard({ label, value, sub, color = 'rgba(120,90,200,.8)' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(255,255,255,.09)',
      borderRadius: 16,
      padding: '20px 24px',
    }}>
      <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 12, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ color: 'white', fontSize: 36, fontWeight: 800, lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 12, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminGetStats()
      .then(setStats)
      .catch(e => setError(e.message));
  }, []);

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        📊 Дашборд
      </h1>
      <p style={{ color: 'rgba(255,255,255,.4)', fontSize: 14, marginBottom: 28 }}>
        Общая статистика системы
      </p>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.9)', background: 'rgba(200,50,50,.12)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          Ошибка: {error}
        </div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard label="Пользователи" value={stats.users}
            sub={`${stats.admins} адм · ${stats.blocked} забл`} />
          <StatCard label="Активные моменты" value={stats.activeMoments} />
          <StatCard label="Всего моментов" value={stats.moments} />
          <StatCard label="Реакции" value={stats.reactions} />
        </div>
      )}

      {!stats && !error && (
        <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 14 }}>Загрузка…</div>
      )}
    </div>
  );
}
