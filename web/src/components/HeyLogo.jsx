// HEY logo — векторная метка из дизайн-кита (icons/logo icon.svg).

const LOGO_PATH = 'M30.79,62.65h2.39a.26.26,0,0,0,.26-.21,39,39,0,0,1,29-29,.28.28,0,0,0,.21-.26V30.74a.28.28,0,0,0-.21-.26,39,39,0,0,1-29-28.92.26.26,0,0,0-.26-.21H30.78a.28.28,0,0,0-.27.21,39,39,0,0,1-29,28.91.28.28,0,0,0-.21.27v2.47a.28.28,0,0,0,.21.27,39,39,0,0,1,29,29A.28.28,0,0,0,30.79,62.65Z';

export default function HeyLogo({
  size = 24,
  color = '#F9F0F0',
  style,
  className,
  title,
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, ...style }}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      draggable={false}
    >
      <path fill={color} d={LOGO_PATH} />
    </svg>
  );
}
