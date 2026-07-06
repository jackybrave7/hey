import Icon from '../components/Icon';

/** Короткая метка типа по имени / MIME — для иконки в одноцветном стиле. */
export function resolveFileLabel(name, mime) {
  const ext = (name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  const m = (mime || '').toLowerCase();

  if (ext === 'pdf' || m.includes('pdf')) return 'PDF';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext) || m.includes('word') || m.includes('msword')) return 'DOC';
  if (['xls', 'xlsx', 'ods'].includes(ext) || m.includes('sheet') || m.includes('excel')) return 'XLS';
  if (ext === 'csv' || m.includes('csv')) return 'CSV';
  if (['ppt', 'pptx', 'odp'].includes(ext) || m.includes('presentation') || m.includes('powerpoint')) return 'PPT';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || m.includes('zip') || m.includes('compressed')) return 'ZIP';
  if (ext === 'txt' || m === 'text/plain') return 'TXT';
  if (['json', 'xml', 'html', 'htm'].includes(ext)) return ext.toUpperCase().slice(0, 4);
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'cpp', 'java'].includes(ext)) return ext.toUpperCase().slice(0, 3);
  if (ext) return ext.toUpperCase().slice(0, 4);
  return null;
}

/** Минималистичная одноцветная иконка документа с меткой типа (PDF, DOC…). */
export function fileTypeIcon(name, mime, size = 28) {
  const label = resolveFileLabel(name, mime);
  const fontSize = label
    ? (label.length <= 3 ? size * 0.28 : size * 0.22)
    : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      {label ? (
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}

export function AttachmentPreview({ type, name, size = 12 }) {
  const map = {
    image: ['image', 'Фото'],
    images: ['image', 'Фото'],
    video: ['image', 'Видео'],
    audio: ['mic', 'Голосовое'],
  };
  if (type === 'file') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {fileTypeIcon(name, null, size + 4)}
        <span>{name || 'Файл'}</span>
      </span>
    );
  }
  const entry = map[type];
  if (!entry) return 'Вложение';
  const [icon, label] = entry;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={size} />
      <span>{label}</span>
    </span>
  );
}
