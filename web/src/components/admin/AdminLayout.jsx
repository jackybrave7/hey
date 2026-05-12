// AdminLayout.jsx — shared layout for admin panel
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';

const NAV = [
  { to: '/admin',         label: '📊 Дашборд',  exact: true },
  { to: '/admin/users',   label: '👥 Пользователи' },
  { to: '/admin/moments', label: '✦ Моменты' },
  { to: '/admin/logs',    label: '📋 Логи' },
];

export default function AdminLayout({ children }) {
  const nav = useNavigate();
  const { user } = useAuth();

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
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,.55)',
    textDecoration: 'none',
    borderLeft: '3px solid transparent',
    transition: 'all .15s',
  };

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
          {NAV.map(({ to, label, exact }) => (
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
              {label}
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
