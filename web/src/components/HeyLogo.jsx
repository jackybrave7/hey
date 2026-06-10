// HEY logo — raster mark from /hey-logo.png (authoritative shape).

export default function HeyLogo({
  size = 24,
  style,
  className,
  title,
}) {
  return (
    <img
      src="/hey-logo.png"
      width={size}
      height={size}
      alt={title || ''}
      draggable={false}
      style={{ display: 'block', flexShrink: 0, ...style }}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    />
  );
}
