import ChatMenuIcon from './ChatMenuIcon';
import ChatFadeText from './ChatFadeText';
import ChatContextMenu from './ChatContextMenu';
import { fmtChatPresence } from './chatPresence';

export default function ChatTopBar({
  onBack,
  avatar,
  name,
  online,
  lastSeen,
  isGroup,
  isMonolog,
  isSystem,
  statusExtra,
  menuItems,
  onAvatarClick,
  onInfoClick,
}) {
  const showPresence = !isGroup && !isMonolog && !isSystem;
  const statusText = showPresence
    ? (statusExtra ?? fmtChatPresence(lastSeen, online))
    : (isGroup ? 'группа' : '');

  return (
    <header className="chat-topbar">
      <div className="chat-topbar-row">
        <button type="button" className="chat-topbar-back" onClick={onBack} aria-label="Назад">
          <ChatMenuIcon name="back" opacity={0.6} style={{ width: 19, height: 11, transform: 'rotate(-90deg)', display: 'block' }} />
        </button>

        <div className="chat-topbar-profile">
          <button
            type="button"
            className="chat-topbar-avatar-wrap"
            onClick={onAvatarClick}
            style={{ cursor: onAvatarClick ? 'pointer' : 'default' }}
          >
            {avatar}
          </button>

          <button
            type="button"
            className="chat-topbar-info"
            onClick={onInfoClick}
            style={{ cursor: onInfoClick ? 'pointer' : 'default' }}
          >
            <div className="chat-topbar-name-row">
              <ChatFadeText text={name || 'Диалог'} className="chat-topbar-name" />
              {showPresence && online && <span className="chat-topbar-online-dot" aria-hidden />}
            </div>
            {statusText ? (
              <ChatFadeText
                text={statusText}
                className="chat-topbar-status"
                marquee={showPresence && !online}
              />
            ) : null}
          </button>
        </div>

        <ChatContextMenu items={menuItems} />
      </div>
    </header>
  );
}
