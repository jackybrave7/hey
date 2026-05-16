// SuperBadge.jsx — значок ✦ для СУПЕР-пользователей (в углу аватарки)
export default function SuperBadge({ size = 20 }) {
  const clamped = Math.min(Math.max(size, 14), 28);
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: clamped,
      height: clamped,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #c8a8ff 0%, #7858b0 100%)',
      border: '2px solid white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(clamped * 0.55),
      color: 'white',
      fontWeight: 700,
      lineHeight: 1,
      pointerEvents: 'none',
      zIndex: 2,
    }}>
      ✦
    </div>
  );
}
