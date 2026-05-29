// AdminLayout.jsx — shared layout for admin panel
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { api } from '../../api';

const NAV = [
  { to: '/admin',         label: '📊 Дашборд',          exact: true },
  { to: '/admin/users',   label: '👥 Пользователи' },
  { to: '/admin/moments', label: '✦ Моменты' },
  { to: '/admin/reports',   label: '🚩 Жалобы',         countKey: 'openReports' },
  { to: '/admin/feedbacks', label: '✉ Обращения',      countKey: 'openFeedbacks' },
  { to: '/admin/system',    label: '📢 HEY-заведующий' },
  { to: '/admin/awo',     label: '🎓 АВО / Школы' },
  { to: '/admin/business-requests', label: '💼 Бизнес-заявки', countKey: 'pendingBusiness' },
  { to: '/admin/test-users', label: '🧪 Тестовые юзеры' },
  { to: '/admin/logs',    label: '📋 Логи' },
];

const COUNT_POLL_MS = 30000;

export default function AdminLayout({ children }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [counts, setCounts] = useState({ openReports: 0, pendingBusiness: 0, openFeedbacks: 0 });

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const c = await api.adminGetCounts();
        if (alive) setCounts(c);
      } catch {}
    }
    load();
    const t = setInterval(load, COUNT_POLL_MS);
    // Перезагружаем при возврате к табу — чтобы не ждать 30с после простоя
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const sidebar = {
    width: 220,
    flexShrink: 0,
    background: 'rgba(14,8,32,.98)',
    borderRight: '1px solid rgba(255,255,255,.08)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  };

  const linkBase = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,.55)',
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'all .15s',
  };

  function Badge({ n }) {
    if (!n) return null;
    return (
      <span style={{
        minWidth: 20, height: 20, padding: '0 6px',
        borderRadius: 10,
        background: 'rgba(220,80,80,.95)',
        color: 'white',
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 4px rgba(120,30,30,.5)',
      }}>{n > 99 ? '99+' : n}</span>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--grad, #0e0820)' }}>
      {/* Sidebar */}
      <div style={sidebar}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 800, letterSpacing: -.3 }}>
            ⚙ HEY Admin
          </div>
          <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, marginTop: 2 }}>
            {user?.name}
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV.map(({ to, label, exact, countKey }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                ...linkBase,
                color: isActive ? 'white' : 'rgba(255,255,255,.55)',
                background: isActive ? 'rgba(120,90,200,.18)' : 'transparent',
                borderLeftColor: isActive ? 'rgba(140,110,220,.8)' : 'transparent',
              })}
            >
              <span>{label}</span>
              {countKey && <Badge n={counts[countKey] || 0}/>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button
            onClick={() => nav('/main')}
            style={{
              width: '100%', padding: '9px', borderRadius: 10,
              background: 'rgba(255,255,255,.07)', border: 'none',
              color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer',
            }}
          >
            ← К приложению
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
}
