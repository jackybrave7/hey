const { WebSocketServer } = require('ws');
const { wsAuth } = require('./auth');
const db = require('./db/db');
const { detectVideoUrl, detectGroupInviteUrl, fetchByProvider } = require('./linkPreview');
const awo = require('./awo');

const clients = new Map();

function broadcast(userIds, payload) {
  const data = JSON.stringify(payload);
  userIds.forEach(uid => {
    clients.get(uid)?.forEach(ws => {
      if (ws.readyState === 1) ws.send(data);
    });
  });
}

// Only broadcast to contacts who are currently connected (saves frames)
function broadcastOnlineContacts(userId, payload) {
  const owners = db.getContactOwners(userId).filter(uid => clients.has(uid));
  broadcast(owners, payload);
}

module.exports = function setupWS(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    // permessage-deflate: 50–90% bandwidth reduction on text/JSON
    perMessageDeflate: {
      zlibDeflateOptions: { level: 6 },
      threshold: 512,        // only compress frames > 512 bytes
      concurrencyLimit: 10,
    },
  });

  // ── Heartbeat — terminate zombie connections every 30s ────────────────────
  const PING_INTERVAL = 30_000;
  const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL);
  wss.on('close', () => clearInterval(pingInterval));

  wss.on('connection', (ws, req) => {
    const user = wsAuth(req);
    if (!user) { ws.close(4001, 'Unauthorized'); return; }

    // Heartbeat init
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    db.setOnline(user.id, true);
    broadcastOnlineContacts(user.id, { type: 'presence:change', userId: user.id, online: true });

    ws.on('message', raw => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      switch (msg.type) {

        case 'message:send': {
          const { conversationId, text, attachment, tempId, replyToId } = msg;
          if (!conversationId || (!text?.trim() && !attachment)) return;
          if (!db.isMember(conversationId, user.id)) return;

          // Fetch members ONCE — used for both block-check and broadcast
          const members = db.getConversationMembers(conversationId);
          const conv = db.getConversationById(conversationId);
          if (conv?.type === 'direct') {
            const recipientId = members.find(id => id !== user.id);
            if (recipientId && (db.isBlocked(recipientId, user.id) || db.isBlocked(user.id, recipientId))) return;
            // Запрет отправки сообщений системному пользователю
            if (recipientId === db.SYSTEM_USER_ID && user.id !== db.SYSTEM_USER_ID) {
              return ws.send(JSON.stringify({
                type: 'error',
                tempId,
                error: 'HEY-заведующий не отвечает на сообщения',
              }));
            }
            // Запрет отправки сообщений админ-заблокированному пользователю
            if (recipientId) {
              const recipient = db.findUserById(recipientId);
              if (recipient?.is_blocked) {
                return ws.send(JSON.stringify({
                  type: 'error',
                  tempId,
                  error: 'Пользователь заблокирован администрацией',
                }));
              }
            }
          }

          // Если в тексте есть видео-ссылка и она уже в кеше — прикрепляем
          // превью к message сразу. Если нет — отправляем сообщение, потом
          // в фоне fetch'им и отдельным WS-событием апдейтим у всех клиентов.
          const trimmedText = text?.trim() || null;
          const videoHit    = trimmedText ? detectVideoUrl(trimmedText) : null;
          const cachedPreview = videoHit ? db.getLinkPreviewCached(videoHit.url) : null;

          // Превью /gjoin/<token>: ссылка приглашения в группу. Решаем
          // синхронно (HMAC + lookup в БД), без внешних fetch'ей. Если
          // токен валиден и приглашающий ещё админ — кладём в link_preview
          // объект { type: 'group_invite', group, inviter, url }.
          let invitePreview = null;
          if (!cachedPreview && trimmedText) {
            const hit = detectGroupInviteUrl(trimmedText);
            if (hit) {
              try {
                const data = awo.verifyGroupInvite(hit.token);
                if (data) {
                  const conv2 = db.getConversationById(data.groupId);
                  if (conv2?.type === 'group' && db.isGroupAdmin(conv2.id, data.inviterId)) {
                    const inv = db.findUserById(data.inviterId);
                    const memberCount = db.getGroupMembers(conv2.id, false).length;
                    invitePreview = {
                      type: 'group_invite',
                      url: hit.url,
                      token: hit.token,
                      group:   { id: conv2.id, name: conv2.name, icon: conv2.icon, member_count: memberCount },
                      inviter: inv ? { id: inv.id, name: inv.name, avatar: inv.avatar } : null,
                    };
                  }
                }
              } catch { /* инвалидный токен — превью не вешаем */ }
            }
          }

          const saved = db.createMessage({
            conversationId, senderId: user.id,
            text: trimmedText,
            attachment: attachment || null,
            replyToId: replyToId || null,
            linkPreview: cachedPreview || invitePreview || null,
          });
          const full = { ...saved, sender_name: user.name, tempId, conversationId };
          broadcast(members, { type: 'message:new', message: full });

          // Async-fetch для cache-miss. Не блокирует отправку сообщения.
          if (videoHit && !cachedPreview) {
            (async () => {
              try {
                const data = await fetchByProvider(videoHit);
                if (!data) return;
                db.setLinkPreviewCached(videoHit.url, data);
                db.updateMessageLinkPreview(saved.id, data);
                broadcast(members, {
                  type: 'message:link-preview',
                  conversationId,
                  messageId: saved.id,
                  link_preview: data,
                });
              } catch (e) {
                console.error('[link-preview async]', e.message);
              }
            })();
          }

          // Реферальный учёт: если это был первый message за всю жизнь —
          // подтверждаем реферал и засчитываем приглашающему. Идемпотентно
          // (после первого вызова функция вернёт null).
          try {
            const referralResult = db.confirmReferralIfPending(user.id);
            if (referralResult?.credit?.superGranted) {
              const expiryDate = new Date(referralResult.credit.superExpiresAt * 1000)
                .toLocaleDateString('ru', { day:'numeric', month:'long', year:'numeric' });
              broadcast([referralResult.inviterId], {
                type: 'system:notification',
                text: `✨ Поздравляем! Ты пригласил 3 друзей и получил HEY СУПЕР на 3 месяца. До ${expiryDate}.`,
                kind: 'super_granted',
              });
            }
            if (referralResult?.credit?.newBadge) {
              broadcast([referralResult.inviterId], {
                type: 'system:notification',
                text: `🏅 Получен значок «${referralResult.credit.newBadge.label}» за ${referralResult.credit.newBadge.count} приглашённых.`,
                kind: 'badge_granted',
                badge: referralResult.credit.newBadge.key,
              });
            }
          } catch (e) { console.error('[REFERRAL_CONFIRM]', e.message); }

          // Push шлём ВСЕМ получателям (кроме отправителя). Service Worker
          // на клиенте сам решит показать или нет: если приложение в фокусе
          // — игнорирует push (юзер увидел через WS), если в фоне/закрыто —
          // показывает уведомление. Раньше push шёл только оффлайн-юзерам
          // (без WS-коннекта), но в TWA приложение в фоне держит WS живым,
          // поэтому push никогда не доходил — юзер пропускал сообщения.
          const pushRecipients = [];
          members.forEach(uid => {
            if (uid === user.id) return;
            if (clients.has(uid)) {
              db.updateMessageStatus(saved.id, 'delivered');
              broadcast([user.id], { type: 'message:status', id: saved.id, status: 'delivered' });
            }
            pushRecipients.push(uid);
          });

          // Web Push — всегда, SW на клиенте сам подавит дубли
          if (pushRecipients.length) {
            const push = require('./push');
            const conv = db.getConversationById(conversationId);
            const isGroup = conv?.type === 'group';
            const title = isGroup
              ? `${user.name} в «${conv.name || 'группе'}»`
              : (user.name || 'HEY');
            let body = (text?.trim() || '').slice(0, 140);
            if (!body) {
              const a = attachment;
              body = a?.type === 'image'  || a?.type === 'images' ? '🖼 Фото'
                   : a?.type === 'audio'  ? '🎙 Голосовое сообщение'
                   : a?.type === 'file'   ? `📎 ${a.name || 'Файл'}`
                   : 'Новое сообщение';
            }
            const payload = {
              title, body,
              // ?msg=<id> — клиентский ChatScreen прочитает param и сразу
              // скроллит к этому сообщению (с автоподгрузкой старых пакетов,
              // если оно глубоко в истории).
              url: `/chat/${conversationId}?msg=${saved.id}`,
              tag: `msg:${conversationId}`,
              messageId: saved.id,
            };
            pushRecipients.forEach(async uid => {
              const subs = db.getPushSubscriptions(uid);
              if (!subs.length) return;
              const gone = await push.sendPushToUser(subs, payload);
              if (gone.length) db.removePushSubscriptions(gone);
            });
          }
          break;
        }

        case 'message:read': {
          // Batch read: mark all unread messages up to this one as read (one DB query)
          const { messageId, conversationId } = msg;
          const updated = db.markMessagesReadUpTo(conversationId, user.id, messageId);
          if (!updated.length) break;
          // Group by sender and broadcast status_batch
          const bySender = {};
          updated.forEach(m => {
            (bySender[m.sender_id] ??= []).push(m.id);
          });
          Object.entries(bySender).forEach(([senderId, ids]) => {
            broadcast([senderId], { type: 'message:status_batch', ids, status: 'read' });
          });
          break;
        }

        case 'typing:start':
        case 'typing:stop': {
          const members = db.getConversationMembers(msg.conversationId)
            .filter(uid => uid !== user.id);
          broadcast(members, {
            type: msg.type, conversationId: msg.conversationId,
            userId: user.id, userName: user.name,
          });
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
            type: 'reaction:update', messageId, conversationId, reactions,
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
        broadcastOnlineContacts(user.id, { type: 'presence:change', userId: user.id, online: false });
      }
    });
  });

  return { broadcast, clients };
};
