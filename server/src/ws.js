const { WebSocketServer } = require('ws');
const { wsAuth } = require('./auth');
const db = require('./db/db');

const clients = new Map();

function broadcast(userIds, payload) {
  const data = JSON.stringify(payload);
  userIds.forEach(uid => {
    clients.get(uid)?.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  });
}

module.exports = function setupWS(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const user = wsAuth(req);
    if (!user) { ws.close(4001, 'Unauthorized'); return; }

    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    db.setOnline(user.id, true);
    broadcast(db.getContactOwners(user.id), { type:'presence:change', userId:user.id, online:true });

    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      switch (msg.type) {

        case 'message:send': {
          const { conversationId, text, attachment, tempId } = msg;
          if (!conversationId || (!text?.trim() && !attachment)) return;
          if (!db.isMember(conversationId, user.id)) return;
          // Block if any member has blocked the sender
          const conv = db.getConversationById(conversationId);
          if (conv?.type === 'direct') {
            const members = db.getConversationMembers(conversationId);
            const recipientId = members.find(id => id !== user.id);
            if (recipientId && (db.isBlocked(recipientId, user.id) || db.isBlocked(user.id, recipientId))) return;
          }
          const saved = db.createMessage({ conversationId, senderId: user.id, text: text?.trim() || null, attachment: attachment || null });
          const full = { ...saved, sender_name: user.name, tempId, conversationId };
          const members = db.getConversationMembers(conversationId);
          broadcast(members, { type:'message:new', message: full });
          members.forEach(uid => {
            if (uid !== user.id && clients.has(uid)) {
              db.updateMessageStatus(saved.id, 'delivered');
              broadcast([user.id], { type:'message:status', id: saved.id, status:'delivered' });
            }
          });
          break;
        }

        case 'message:read': {
          const { messageId, conversationId } = msg;
          db.updateMessageStatus(messageId, 'read');
          const m = db.getMessageById(messageId);
          if (m) broadcast([m.sender_id], { type:'message:status', id: messageId, status:'read' });
          break;
        }

        case 'typing:start':
        case 'typing:stop': {
          const members = db.getConversationMembers(msg.conversationId)
            .filter(uid => uid !== user.id);
          broadcast(members, { type: msg.type, conversationId: msg.conversationId,
            userId: user.id, userName: user.name });
          break;
        }

        case 'call:offer':
        case 'call:answer':
        case 'call:ice':
        case 'call:end':
        case 'call:decline': {
          broadcast([msg.toUserId], { ...msg, fromUserId: user.id, fromName: user.name });
          break;
        }

        case 'file:offer':
        case 'file:answer':
        case 'file:ice': {
          broadcast([msg.toUserId], { ...msg, fromUserId: user.id });
          break;
        }

        case 'reaction:toggle': {
          const { messageId, conversationId, emoji } = msg;
          if (!messageId || !conversationId || !emoji) return;
          if (!db.isMember(conversationId, user.id)) return;
          db.toggleReaction(messageId, user.id, emoji);
          const reactions = db.getMessageReactions(messageId);
          broadcast(db.getConversationMembers(conversationId), {
            type: 'reaction:update', messageId, conversationId, reactions
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      clients.get(user.id)?.delete(ws);
      if (!clients.get(user.id)?.size) {
        clients.delete(user.id);
        db.setOnline(user.id, false);
        broadcast(db.getContactOwners(user.id), { type:'presence:change', userId:user.id, online:false });
      }
    });
  });

  return { broadcast, clients };
};