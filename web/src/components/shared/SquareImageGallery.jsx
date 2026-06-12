import { squareGalleryLayout } from '../../lib/squareGalleryLayout';
import { MediaImage } from './MediaImage';

/**
 * Квадратная галерея: умная сетка с span'ами, контейнер 1:1.
 */
function GalleryImage({ src, native, onClick, style }) {
  const imgStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    ...style,
  };
  if (native) {
    return <img src={src} alt="" onClick={onClick} style={imgStyle} draggable={false} />;
  }
  return (
    <MediaImage
      src={src}
      alt=""
      onClick={onClick}
      style={imgStyle}
      draggable={false}
    />
  );
}

export function SquareImageGallery({
  urls,
  onImageClick,
  maxWidth = 360,
  gap = 4,
  style,
  native = false,
  imageOpacity,
  renderCellExtra,
}) {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return null;

  const layout = squareGalleryLayout(list.length);
  const visible = layout.overlayIndex != null ? list.slice(0, layout.visibleCount) : list;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
        gap,
        width: '100%',
        maxWidth,
        aspectRatio: '1 / 1',
        ...style,
      }}
    >
      {layout.cells.map((slot) => {
        const url = visible[slot.index];
        if (!url) return null;
        const showOverlay = layout.overlayIndex === slot.index && layout.overlayLabel;
        const opacity = imageOpacity?.(slot.index);

        return (
          <div
            key={slot.index}
            style={{
              gridColumn: `${slot.col} / span ${slot.colSpan}`,
              gridRow: `${slot.row} / span ${slot.rowSpan}`,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 8,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <GalleryImage
              src={url}
              native={native}
              onClick={onImageClick ? () => onImageClick(url, list, slot.index) : undefined}
              style={{
                cursor: onImageClick ? 'zoom-in' : 'default',
                opacity: opacity != null ? opacity : 1,
                transition: opacity != null ? 'opacity .2s' : undefined,
              }}
            />
            {showOverlay && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F9F0F0',
                  fontSize: 22,
                  fontWeight: 800,
                  pointerEvents: 'none',
                }}
              >
                {layout.overlayLabel}
              </div>
            )}
            {renderCellExtra?.(slot.index)}
          </div>
        );
      })}
    </div>
  );
}
