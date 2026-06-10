// SuperBadge.jsx — логотип HEY для СУПЕР-пользователей (в углу аватарки)
import HeyLogo from '../HeyLogo';

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
      background: 'linear-gradient(135deg, #c8a8ff 0%, #5F4080 100%)',
      border: '2px solid #F9F0F0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 2,
    }}>
      <HeyLogo size={Math.round(clamped * 0.62)} color="#F9F0F0" />
    </div>
  );
}
