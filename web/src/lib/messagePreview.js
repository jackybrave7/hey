/** ID чата из WS-сообщения (camelCase или snake_case). */
export function messageConversationId(message) {
  return message?.conversationId || message?.conversation_id || null;
}

/** Системная плашка группы (вход/выход/удаление) — не обычное сообщение. */
export function isSystemChatEvent(message) {
  return !!message?.attachment?.system_event;
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
  if (att.type === 'audio') return '🎙 Голосовое сообщение';
  if (att.type === 'file') return `📎 ${att.name || 'Файл'}`;
  if (att.type === 'moment') return '✨ Момент';
  return null;
}
