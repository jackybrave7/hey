const ICON_BASE = '/chat-menu-icons/archive/';

export const CHAT_MENU_ICON_FILES = {
  search: 'search icon.svg',
  media: 'media icon.svg',
  archive: 'archive icon.svg',
  pin: 'pin icon.svg',
  export: 'export icon.svg',
  clear: 'history clean icon.svg',
  delete: 'delete icon.svg',
  copy: 'copy icon.svg',
  back: 'arrow icon.svg',
  menu: 'menu 3 points icon.svg',
};

export default function ChatMenuIcon({ name, size = 15, style, className, opacity }) {
  const file = CHAT_MENU_ICON_FILES[name];
  if (!file) return null;
  return (
    <img
      src={`${ICON_BASE}${encodeURIComponent(file)}`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
      style={{ display: 'block', flexShrink: 0, opacity, ...style }}
    />
  );
}
