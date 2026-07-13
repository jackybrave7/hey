import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  messageConversationId,
  messagePreviewText,
  messageDeletedLabel,
  messageDeletedPreview,
  messageDeletedByAdmin,
} from '../src/lib/messagePreview.js';

describe('messagePreview', () => {
  it('messageConversationId supports snake_case and camelCase', () => {
    assert.equal(messageConversationId({ conversation_id: 'a' }), 'a');
    assert.equal(messageConversationId({ conversationId: 'b' }), 'b');
  });

  it('messagePreviewText for attachments', () => {
    assert.equal(messagePreviewText({ text: 'hello' }), 'hello');
    assert.equal(messagePreviewText({ attachment: { type: 'image' } }), '🖼 Фото');
    assert.equal(messagePreviewText({ attachment: { type: 'video' } }), '🎬 Видео');
    assert.equal(messagePreviewText({ attachment: { type: 'audio' } }), '🎙 Голосовое сообщение');
    assert.equal(messagePreviewText({ attachment: { type: 'file', name: 'doc.pdf' } }), '📎 doc.pdf');
    assert.equal(messagePreviewText({ attachment: { type: 'moment' } }), '✨ Момент');
  });

  it('messagePreviewText for group system events', () => {
    const left = messagePreviewText({
      attachment: { system_event: { type: 'member_left', userName: 'Anna' } },
    });
    assert.match(left, /Anna/);
  });

  it('deleted message labels', () => {
    const msg = { is_deleted: 1, sender_id: 'u1', sender_name: 'Bob' };
    assert.equal(messageDeletedPreview(msg), 'Удалённое сообщение');
    assert.match(messageDeletedLabel(msg, 'u2'), /Bob/);
    assert.equal(messageDeletedLabel(msg, 'u1'), 'Вы удалили сообщение');
  });

  it('messageDeletedByAdmin detects admin deletion', () => {
    const msg = {
      is_deleted: 1,
      sender_id: 'u1',
      deleted_by_id: 'admin1',
    };
    assert.equal(messageDeletedByAdmin(msg), true);
    assert.equal(
      messageDeletedLabel(msg, 'u1'),
      'Удалено администратором группы',
    );
  });
});
