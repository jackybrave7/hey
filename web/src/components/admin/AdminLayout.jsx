// AdminLayout.jsx — shared layout for admin panel
//
// Адаптивная раскладка:
//   • Десктоп (≥ 760px): фиксированный сайдбар 220px слева + контент справа.
//   • Мобила  (< 760px): топбар c ☰ + drawer слева (overlay), контент на всю
//     ширину. Drawer закрывается по клику на ссылку / по тапу на затемнение.
import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { api } from '../../api';

const NAV = [
  { to: '/admin',         label: '📊 Дашборд',          exact: true },
  { to: '/admin/users',   label: '👥 Пользователи' },
  { to: '/admin/groups',  label: '🫂 Группы' },
  { to: '/admin/moments', label: '✦ Моменты' },
  { to: '/admin/reports',   label: '🚩 Жалобы',         countKey: 'openReports' },
  { to: '/admin/feedbacks', label: '✉ Обращения',      countKey: 'openFeedbacks' },
  { to: '/admin/waitlist',  label: '📨 Заявки на регистрацию', countKey: 'pendingWaitlist' },
  { to: '/admin/system',    label: '📢 HEY-заведующий' },
  { to: '/admin/s3',        label: '🗂 S3 галерея' },
  { to: '/admin/awo',     label: '🎓 АВО / Школы' },
  { to: '/admin/business-requests', label: '💼 Бизнес-заявки', countKey: 'pendingBusiness' },
  { to: '/admin/test-users', label: '🧪 Тестовые юзеры' },
  { to: '/admin/logs',     label: '📋 Логи' },
  { to: '/admin/settings', label: '⚙ Настройки' },
];

const COUNT_POLL_MS = 30000;
const MOBILE_BREAKPOINT = 760;

export default function AdminLayout({ children }) {
  const nav      = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [counts, setCounts]   = useState({ openReports: 0, pendingBusiness: 0, openFeedbacks: 0, pendingWaitlist: 0 });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Реагируем на ресайз/поворот экрана: переключаем mobile-режим живьём.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // При навигации закрываем drawer (если он был открыт).
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Когда drawer открыт — блокируем скролл body.
  useEffect(() => {
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = drawerOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev || ''; };
  }, [drawerOpen, isMobile]);

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
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const linkBase = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 20px',
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

  // Содержимое сайдбара одно и то же — отличается только обёртка.
  const sidebarBody = (
    <>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.07)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 800, letterSpacing: -.3 }}>
            ⚙ HEY Admin
          </div>
          <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 11, marginTop: 2 }}>
            {user?.name}
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setDrawerOpen(false)} aria-label="Закрыть меню"
            style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:10,
              width:32, height:32, color:'white', fontSize:18, cursor:'pointer' }}>×</button>
        )}
      </div>

      <nav style={{ flex: 1, paddingTop: 8, overflowY:'auto' }}>
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
            width: '100%', padding: '11px', borderRadius: 10,
            background: 'rgba(255,255,255,.07)', border: 'none',
            color: 'rgba(255,255,255,.5)', fontSize: 13, cursor: 'pointer',
          }}
        >
          ← К приложению
        </button>
      </div>
    </>
  );

  // ─── Desktop layout ─────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--grad, #0e0820)' }}>
        <div style={{
          width: 220, flexShrink: 0,
          background: 'rgba(14,8,32,.98)',
          borderRight: '1px solid rgba(255,255,255,.08)',
          display: 'flex', flexDirection: 'column',
          minHeight: '100vh',
        }}>
          {sidebarBody}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }} className="adm-page-shell">
          {children}
        </div>
      </div>
    );
  }

  // ─── Mobile layout ──────────────────────────────────────────────────────
  // Подсветка активного пункта в топбаре — текущий лейбл.
  const active = NAV.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grad, #0e0820)',
      display:'flex', flexDirection:'column' }}>
      {/* Top bar */}
      <div style={{
        position:'sticky', top:0, zIndex:50,
        display:'flex', alignItems:'center', gap:10,
        padding:'10px 14px',
        background:'rgba(14,8,32,.96)', backdropFilter:'blur(14px)',
        borderBottom:'1px solid rgba(255,255,255,.08)',
      }}>
        <button onClick={() => setDrawerOpen(true)} aria-label="Открыть меню"
          style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:10,
            width:38, height:38, color:'white', fontSize:18, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          ☰
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:'white', fontSize:15, fontWeight:700,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {active?.label || '⚙ HEY Admin'}
          </div>
        </div>
        <button onClick={() => nav('/main')} aria-label="К приложению"
          style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:10,
            padding:'8px 12px', color:'rgba(255,255,255,.7)', fontSize:13, cursor:'pointer',
            flexShrink:0 }}>
          ← Назад
        </button>
      </div>

      {/* Content */}
      <div style={{ flex:1, minHeight:0 }} className="adm-page-shell">
        {children}
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{
            position:'fixed', inset:0, zIndex:100,
            background:'rgba(0,0,0,.5)', backdropFilter:'blur(2px)',
            animation:'admDrawerFade .15s ease-out',
          }}/>
      )}
      <div style={{
        position:'fixed', top:0, bottom:0, left:0, zIndex:101,
        width:'min(280px, 84vw)',
        background:'rgba(14,8,32,.98)',
        borderRight:'1px solid rgba(255,255,255,.08)',
        boxShadow:'4px 0 24px rgba(0,0,0,.4)',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform .22s ease-out',
        display:'flex', flexDirection:'column',
      }}>
        {sidebarBody}
      </div>
    </div>
  );
}
