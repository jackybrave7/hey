// IntegrationsLayout.jsx — layout для бизнес-пользователей (НЕ под /admin/*).
// Простой шапка с back-кнопкой, без админ-сайдбара.
import { useNavigate } from 'react-router-dom';

export default function IntegrationsLayout({ children, title = 'Мои интеграции' }) {
  const nav = useNavigate();
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--grad, #0e0820)',
      paddingBottom: 40,
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(14,8,32,.95)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(249,240,240,.08)',
      }}>
        <div style={{
          maxWidth: 960, margin: '0 auto',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => nav('/me')}
            style={{
              background: 'rgba(249,240,240,.08)',
              border: '1px solid rgba(249,240,240,.14)',
              color: 'rgba(225,220,245,.95)',
              borderRadius: 10, padding: '6px 12px',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            ‹ К профилю
          </button>
          <div style={{ color:'#F9F0F0', fontSize: 16, fontWeight: 700 }}>
            {title}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}
