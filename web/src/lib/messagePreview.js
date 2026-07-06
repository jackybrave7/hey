/** ID чата из WS-сообщения (camelCase или snake_case). */
export function messageConversationId(message) {
  return message?.conversationId || message?.conversation_id || null;
}

/** Системная плашка группы (вход/выход/удаление) — не обычное сообщение. */
export function isSystemChatEvent(message) {
  return !!message?.attachment?.system_event;
}

/** Сообщение удалено админом группы (не автором). */
export function messageDeletedByAdmin(message) {
  if (!message?.deleted_by_id || message.deleted_by_id === message.sender_id) return false;
  return !!(message?.is_deleted || message?.attachment_type === 'deleted');
}

/** Подпись к удалённому сообщению в чате. */
export function messageDeletedLabel(message, currentUserId) {
  if (!message?.is_deleted) return '';
  if (messageDeletedByAdmin(message)) return 'Удалено администратором группы';
  if (message.sender_id === currentUserId) return 'Вы удалили сообщение';
  return `${message.sender_name || 'Участник'} удалил(а) сообщение`;
}

/** Краткая подпись для цитаты / превью удалённого сообщения. */
export function messageDeletedPreview(message) {
  const deleted = message?.is_deleted || message?.attachment_type === 'deleted';
  if (!deleted) return null;
  if (messageDeletedByAdmin(message)) return 'Удалено администратором группы';
  return 'Удалённое сообщение';
}

/** Текст для превью в списке чатов / push / inline-notification. */
export function messagePreviewText(message) {
  if (!message) return null;
  const text = (message.text || '').trim();
  if (text) return text;

  const att = message.attachment;
  const ev = att?.system_event;
  if (ev?.type === 'member_left') {
    return `${ev.userName || 'Участник'} покинул(а) группу`;
  }
  if (ev?.type === 'member_removed') {
    return ev.byUserName
      ? `${ev.byUserName} удалил(а) ${ev.userName || 'участника'} из группы`
      : `${ev.userName || 'Участник'} удалён(а) из группы`;
  }
  if (ev) return 'Событие в группе';

  if (!att) return null;
  if (att.type === 'image' || att.type === 'images') return '🖼 Фото';
  if (att.type === 'video') return '🎬 Видео';
  if (att.type === 'audio') return '🎙 Голосовое сообщение';
  if (att.type === 'file') return `📎 ${att.name || 'Файл'}`;
  if (att.type === 'moment') return '✨ Момент';
  return null;
}
