// AdminDashboard.jsx — stats overview
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

function StatCard({ label, value, sub, accent, link }) {
  const content = (
    <>
      <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        color: accent || 'white', fontSize: 36, fontWeight: 800, lineHeight: 1,
      }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 6 }}>{sub}</div>
      )}
    </>
  );
  const style = {
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.09)',
    borderRadius: 16,
    padding: '20px 24px',
    display: 'block', textDecoration: 'none',
    transition: 'background .15s, transform .15s',
  };
  if (link) return (
    <Link to={link} style={{ ...style, cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.transform = 'none'; }}>
      {content}
    </Link>
  );
  return <div style={style}>{content}</div>;
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
            sub={`${stats.admins} адм · ${stats.blocked} забл`} link="/admin/users"/>
          <StatCard label="Активные за 3 дня" value={stats.activeUsers}
            sub={stats.users ? `${Math.round((stats.activeUsers / stats.users) * 100)}% от всех` : null}
            accent="rgba(110,235,150,.95)" link="/admin/users?filter=active3d"/>
          <StatCard label="Группы" value={stats.groups}
            link="/admin/groups"/>
          <StatCard label="Активные моменты" value={stats.activeMoments}
            link="/admin/moments"/>
          <StatCard label="Всего моментов" value={stats.moments}
            link="/admin/moments"/>
          <StatCard label="Реакции" value={stats.reactions} />
          <StatCard label="Сообщения" value={stats.messages} />
          <StatCard label="Открытые жалобы" value={stats.openReports || 0}
            sub={stats.openReports > 0 ? 'требуют внимания' : 'всё чисто'}
            accent={stats.openReports > 0 ? 'rgba(255,180,100,.95)' : 'rgba(110,235,150,.95)'}
            link="/admin/reports"/>
        </div>
      )}

      {!stats && !error && (
        <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 14 }}>Загрузка…</div>
      )}
    </div>
  );
}
