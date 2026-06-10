import Icon from '../components/Icon';

export function fileTypeIcon(name, mime, size = 28) {
  return <Icon name="file" size={size} />;
}

export function AttachmentPreview({ type, name, size = 12 }) {
  const map = {
    image: ['image', 'Фото'],
    images: ['image', 'Фото'],
    audio: ['mic', 'Голосовое'],
    file: ['file', name || 'Файл'],
  };
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
