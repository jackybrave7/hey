import HeyLogo from '../HeyLogo';

/** Единая метка загрузки: иконка приложения в стиле HEY. */
export default function BootMark({ tile = 112, logo = 60, animate = true }) {
  const radius = Math.round(tile * 0.24);
  return (
    <div
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        background: 'linear-gradient(135deg, #5F4080 0%, #7c45c7 60%, #a87ce4 100%)',
        border: '1px solid rgba(249,240,240,.14)',
        boxShadow: '0 16px 48px rgba(14,8,32,.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: animate ? 'heyBootPulse 1.8s ease-in-out infinite' : undefined,
      }}
    >
      <HeyLogo size={logo} title="HEY" />
      {animate && (
        <style>{`
          @keyframes heyBootPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.03); opacity: .92; }
          }
        `}</style>
      )}
    </div>
  );
}

export function BootScreen({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #5F4080 0%, #D0A8A8 66%, #5F4080 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: children ? 20 : 0,
      }}
    >
      <BootMark />
      {children}
    </div>
  );
}
