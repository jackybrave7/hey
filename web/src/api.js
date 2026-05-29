// web/src/api.js

const BASE = '/api';
const REQUEST_TIMEOUT_MS = 15000; // 15с — отсечка «сервер не отвечает»

function getToken() {
  return localStorage.getItem('hey_token');
}

// Простой сигнал о проблемах со связью — слушает ServerStatusBanner.
// reason: 'timeout' (запрос > 15с) | 'network' (fetch вообще упал) | '5xx'
function notifyServerIssue(reason) {
  try { window.dispatchEvent(new CustomEvent('hey:server-issue', { detail: reason })); } catch {}
}
function notifyServerOk() {
  try { window.dispatchEvent(new CustomEvent('hey:server-ok')); } catch {}
}

async function req(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    // AbortError при таймауте, TypeError при сетевой ошибке
    if (e?.name === 'AbortError') {
      notifyServerIssue('timeout');
      throw new Error('Сервер не отвечает');
    }
    notifyServerIssue('network');
    throw new Error('Нет связи с сервером');
  }
  clearTimeout(timer);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Dispatch special events for specific error codes
    if (err.code === 'BLOCKED') {
      localStorage.removeItem('hey_token');
      window.dispatchEvent(new CustomEvent('hey:blocked'));
    }
    if (err.code === 'MUST_CHANGE_PASSWORD') {
      window.dispatchEvent(new CustomEvent('hey:must-change-password'));
    }
    // 5xx — баннер. 4xx — не баннер, это валидная бизнес-ошибка.
    if (res.status >= 500) notifyServerIssue('5xx');
    else notifyServerOk(); // 4xx значит сервер живой
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  notifyServerOk();
  return res.json();
}

export const api = {
  // Auth
  register: (data) => req('POST', '/register', data),
  login:    (data) => req('POST', '/login', data),
  logout:   ()     => req('POST', '/logout'),
  getUserInviteInfo: (id) => req('GET', `/users/${id}/invite-info`),
  getUserProfile:   (id) => req('GET', `/users/${id}/profile`),

  // Profile
  getMe:          ()     => req('GET', '/me'),
  updateMe:       (data) => req('PATCH', '/me', data),
  changePassword: (oldPassword, newPassword) => req('POST', '/me/password', { oldPassword, newPassword }),
  deleteAccount:    (password) => req('DELETE', '/me', { password }),
  getUserProfile:   (userId)  => req('GET', `/users/${userId}/profile`),

  // User search
  searchUsers: (q) => req('GET', `/users/search?q=${encodeURIComponent(q)}`),

  // Contacts
  getContacts:    ()       => req('GET', '/contacts'),
  addContact:     (data)   => req('POST', '/contacts', data),
  deleteContact:  (id)     => req('DELETE', `/contacts/${id}`),
  updateContactNotes: (id, notes) => req('PATCH', `/contacts/${id}/notes`, { notes }),
  updateContactNickname: (id, nickname) => req('PATCH', `/contacts/${id}/nickname`, { nickname }),

  // Blocks
  getBlocked:   ()       => req('GET', '/blocks'),
  blockUser:    (userId) => req('POST', '/blocks', { userId }),
  unblockUser:  (userId) => req('DELETE', `/blocks/${userId}`),

  // Conversations
  getConversations: ()       => req('GET', '/conversations'),
  getArchivedConversations: () => req('GET', '/conversations?archived=1'),
  openConversation: (userId) => req('POST', '/conversations', { userId }),
  getMessages:      (convId, before) =>
    req('GET', `/conversations/${convId}/messages${before ? `?before=${before}` : ''}`),
  clearMessages:    (convId)              => req('DELETE', `/conversations/${convId}/messages`),
  deleteConversation:(convId)             => req('DELETE', `/conversations/${convId}`),
  getPinnedMessage:  (convId)             => req('GET',    `/conversations/${convId}/pinned`),
  pinMessage:        (convId, messageId)  => req('POST',   `/conversations/${convId}/pinned-message`, { messageId }),
  unpinMessage:      (convId)             => req('DELETE', `/conversations/${convId}/pinned-message`),
  forwardMessage:    (messageId, toConvIds) => req('POST', `/messages/${messageId}/forward`, { toConvIds }),

  // Web Push
  getPushPublicKey:  ()                    => req('GET',  '/push/public-key'),
  pushSubscribe:     (subscription)        => req('POST', '/push/subscribe', subscription),
  pushUnsubscribe:   (endpoint)            => req('POST', '/push/unsubscribe', { endpoint }),
  pushTest:          ()                    => req('POST', '/push/test'),
  pinConversation:   (convId)             => req('POST',   `/conversations/${convId}/pin`),
  unpinConversation: (convId)             => req('DELETE', `/conversations/${convId}/pin`),
  archiveConversation:   (convId)         => req('POST',   `/conversations/${convId}/archive`),
  unarchiveConversation: (convId)         => req('DELETE', `/conversations/${convId}/archive`),
  acceptRequest:    (convId)              => req('POST',   `/conversations/${convId}/accept`),
  declineRequest:   (convId)              => req('DELETE', `/conversations/${convId}/request`),
  editMessage:      (convId, msgId, text) => req('PATCH',  `/conversations/${convId}/messages/${msgId}`, { text }),
  deleteMessage:    (convId, msgId)       => req('DELETE', `/conversations/${convId}/messages/${msgId}`),
  getPresignUrl:    (category, contentType, size) => req('POST', '/upload/presign', { category, contentType, size }),
  uploadImage:      (data)               => req('POST',   '/upload', { data }),

  // Groups
  createGroup:      (data)              => req('POST',   '/groups', data),
  updateGroup:      (id, data)          => req('PATCH',  `/groups/${id}`, data),
  getGroupMembers:  (id)                => req('GET',    `/groups/${id}/members`),
  addGroupMember:   (id, userId)        => req('POST',   `/groups/${id}/members`, { userId }),
  removeGroupMember:(id, userId)        => req('DELETE', `/groups/${id}/members/${userId}`),
  setGroupMemberAdmin:(id, userId, isAdmin) => req('PATCH', `/groups/${id}/members/${userId}/admin`, { is_admin: !!isAdmin }),
  setGroupHistoryVisibility:(id, value) => req('PATCH', `/groups/${id}/history-visibility`, { value }),
  getGroupInfo:     (id)                => req('GET',    `/groups/${id}`),
  acceptGroupInvite:(id)                => req('POST',   `/groups/${id}/accept`),
  declineGroupInvite:(id)               => req('POST',   `/groups/${id}/decline`),
  groupInviteLink:  (id)                => req('POST',   `/groups/${id}/invite-link`),
  groupInvitePreview:(token)            => req('GET',    `/group-invite/${encodeURIComponent(token)}`),
  groupInviteAccept:(token)             => req('POST',   `/group-invite/${encodeURIComponent(token)}/accept`),

  // Media & search
  getMedia:         (convId)            => req('GET',    `/conversations/${convId}/media`),
  searchMessages:   (convId, q)         => req('GET',    `/conversations/${convId}/search?q=${encodeURIComponent(q)}`),
  searchAllMessages:(q)                 => req('GET',    `/search/messages?q=${encodeURIComponent(q)}`),

  // Calls
  getCalls: ()     => req('GET', '/calls'),
  logCall:  (data) => req('POST', '/calls', data),

  // Invite / Referral
  getInvite:     ()     => req('GET', '/invite'),
  getInviteInfo: (code) => req('GET', `/invite/${code}`),

  // Feedback
  sendFeedback: (data) => req('POST', '/feedback', data),

  // Moments
  getMomentFeed:    (before)      => req('GET',    `/moments${before ? '?before=' + before : ''}`),
  getMyMoments:     (status)     => req('GET',    `/moments/my${status ? `?status=${status}` : ''}`),
  getSavedMoments:  ()           => req('GET',    '/moments/saved'),
  getMoment:        (id)         => req('GET',    `/moments/${id}`),
  getMomentReactors:(id)         => req('GET',    `/moments/${id}/reactors`),
  createMoment:     (data)       => req('POST',   '/moments', data),
  updateMoment:     (id, data)   => req('PATCH',  `/moments/${id}`, data),
  archiveMoment:    (id)         => req('POST',   `/moments/${id}/archive`),
  restoreMoment:    (id)         => req('POST',   `/moments/${id}/restore`),
  deleteMoment:     (id)         => req('DELETE', `/moments/${id}`, { confirm: 'удалить' }),
  reactMoment:      (id, reaction) => req('POST', `/moments/${id}/react`, { reaction }),
  unreactMoment:    (id)         => req('DELETE', `/moments/${id}/react`),

  // Waitlist
  joinWaitlist:     (email)     => req('POST', '/waitlist', { email, source: 'register-page' }),

  // Reports
  createReport:     (data)      => req('POST', '/reports', data),
  adminGetReports:  (status='open') => req('GET', `/admin/reports?status=${status}`),
  adminResolveReport: (id, action) => req('PATCH', `/admin/reports/${id}`, { action }),
  viewMoment:       (id)         => req('POST',   `/moments/${id}/view`),
  getDisciplines:   (userId)     => req('GET',    `/moments/disciplines/${userId}`),
  uploadMomentMedia: (data)      => req('POST',   '/moments/upload', { data }),
  reorderMoments:    (orderedIds) => req('POST',  '/moments/reorder', { orderedIds }),

  // Admin
  adminGetStats:           ()              => req('GET',    '/admin/stats'),
  adminGetUsers:           (params = {})   => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/admin/users${qs ? '?' + qs : ''}`);
  },
  adminGetUser:            (id)            => req('GET',    `/admin/users/${id}`),
  adminResetPassword:      (id)            => req('POST',   `/admin/users/${id}/reset-password`),
  adminBlockUser:          (id, reason)    => req('POST',   `/admin/users/${id}/block`, { reason }),
  adminUnblockUser:        (id)            => req('POST',   `/admin/users/${id}/unblock`),
  adminDeleteUser:         (id)            => req('DELETE', `/admin/users/${id}`),
  adminSystemMoment:       (data)          => req('POST',   '/admin/system/moment', data),
  adminSystemBroadcast:    (text, attachment) => req('POST', '/admin/system/broadcast', { text, attachment }),
  adminSystemListMoments:  ()              => req('GET',    '/admin/system/moments'),
  adminSystemListBroadcasts: ()            => req('GET',    '/admin/system/broadcasts'),
  adminSystemEditMoment:   (id, data)      => req('PATCH',  `/admin/system/moments/${id}`, data),
  adminSystemDeleteMoment: (id)            => req('DELETE', `/admin/system/moments/${id}`),
  adminSystemEditBroadcast:   (id, text)   => req('PATCH',  `/admin/system/broadcasts/${id}`, { text }),
  adminSystemDeleteBroadcast: (id)         => req('DELETE', `/admin/system/broadcasts/${id}`),
  adminMakeAdmin:          (id)            => req('POST',   `/admin/users/${id}/make-admin`),
  adminRevokeAdmin:        (id)            => req('POST',   `/admin/users/${id}/revoke-admin`),
  adminMakeSuper:          (id)            => req('POST',   `/admin/users/${id}/make-super`),
  adminRevokeSuper:        (id)            => req('POST',   `/admin/users/${id}/revoke-super`),
  // body: { mode: 'set'|'unlimited'|'revoke', expires_at?: unix }
  adminSetSuperExpiry:     (id, body)      => req('PATCH',  `/admin/users/${id}/super`, body),
  adminGetMoments:         (params = {})   => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/admin/moments${qs ? '?' + qs : ''}`);
  },
  adminDeleteMoment:       (id, reason)    => req('DELETE', `/admin/moments/${id}`, { reason }),
  adminGetLogs:            (limit)         => req('GET',    `/admin/logs${limit ? '?limit=' + limit : ''}`),

  // AWO / Школьная интеграция
  joinValidate:            (email, course, sig) =>
    req('GET', `/join/validate?email=${encodeURIComponent(email)}&course=${encodeURIComponent(course||'')}&sig=${encodeURIComponent(sig)}`),
  // Все awo-ручки принимают опциональный tenantId (если не передан → дефолтный)
  adminGetAwoSettings:     (tenantId)       => req('GET',    `/admin/awo/settings${tenantId?'?tenantId='+encodeURIComponent(tenantId):''}`),
  adminSetAwoSettings:     (data, tenantId) => req('PUT',    `/admin/awo/settings${tenantId?'?tenantId='+encodeURIComponent(tenantId):''}`, data),
  adminGetAwoCourseChats:  (tenantId)       => req('GET',    `/admin/awo/course-chats${tenantId?'?tenantId='+encodeURIComponent(tenantId):''}`),
  adminSetAwoCourseChat:   (course, chatId, tenantId) => req('POST',  `/admin/awo/course-chats${tenantId?'?tenantId='+encodeURIComponent(tenantId):''}`, { course, chat_id: chatId }),
  adminDeleteAwoCourseChat:(course, tenantId) => req('DELETE', `/admin/awo/course-chats/${encodeURIComponent(course)}${tenantId?'?tenantId='+encodeURIComponent(tenantId):''}`),
  adminGetGroupChats:      ()              => req('GET',    '/admin/group-chats'),
  adminGetAwoLog:          (limit, tenantId) => {
    const qs = [];
    if (limit)    qs.push('limit=' + limit);
    if (tenantId) qs.push('tenantId=' + encodeURIComponent(tenantId));
    return req('GET', '/admin/awo/log' + (qs.length ? '?' + qs.join('&') : ''));
  },
  adminAwoMakeJoinLink:    (email, course, tenantId) => req('POST',   '/admin/awo/join-link', { email, course, tenantId }),
  // Tenants CRUD
  adminListAwoTenants:     ()              => req('GET',    '/admin/awo/tenants'),
  adminCreateAwoTenant:    (name)          => req('POST',   '/admin/awo/tenants', { name }),
  adminDeleteAwoTenant:    (id)            => req('DELETE', `/admin/awo/tenants/${encodeURIComponent(id)}`),
  adminRotateAwoToken:     (id)            => req('POST',   `/admin/awo/tenants/${encodeURIComponent(id)}/rotate-token`),

  // Business access (заявка на бизнес-доступ)
  requestBusinessAccess:   (note)          => req('POST',   '/me/business/request', { note }),
  cancelBusinessRequest:   ()              => req('POST',   '/me/business/cancel'),
  adminListBusinessRequests: (status)      => req('GET',    `/admin/business-requests${status?'?status='+status:''}`),
  adminApproveBusiness:    (userId)        => req('POST',   `/admin/business-requests/${userId}/approve`),
  adminRejectBusiness:     (userId, reason)=> req('POST',   `/admin/business-requests/${userId}/reject`, { reason }),
  adminRevokeBusiness:     (userId, reason)=> req('POST',   `/admin/business-requests/${userId}/revoke`, { reason }),

  // Admin: Test users mode
  adminTestUsersStatus:    ()              => req('GET',    '/admin/test-users/status'),
  adminTestUsersToggle:    (enabled)       => req('POST',   '/admin/test-users/toggle', { enabled }),
  adminTestUsersReseed:    ()              => req('POST',   '/admin/test-users/reseed'),
  adminTestUsersClear:     ()              => req('DELETE', '/admin/test-users'),
};

// ── WebSocket ────────────────────────────────────────────────────────────────

class HeySocket {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.connected = false;
    this.token = null;
    this.queue = [];        // pending outbound messages while disconnected
    this.intentionalClose = false;
    this.reconnectDelay = 1000; // exponential backoff: 1s → 2s → 4s … 30s
  }

  connect(token) {
    this.token = token;
    this.intentionalClose = false;
    clearTimeout(this.reconnectTimer);
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      try { this.ws.close(); } catch {}
    }
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000; // reset on successful connect
      this._emit('connected');
      // Flush queued messages
      while (this.queue.length && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(this.queue.shift());
      }
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._emit(msg.type, msg);
        this._emit('*', msg);
      } catch {}
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._emit('disconnected');
      if (!this.intentionalClose && this.token) {
        clearTimeout(this.reconnectTimer);
        // Exponential backoff with jitter — prevents thundering herd on server restart
        const jitter = Math.random() * 500;
        this.reconnectTimer = setTimeout(
          () => this.connect(this.token),
          this.reconnectDelay + jitter
        );
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      }
    };

    this.ws.onerror = () => { /* close handler runs reconnect */ };
  }

  disconnect() {
    this.intentionalClose = true;
    this.token = null;
    this.reconnectDelay = 1000;
    clearTimeout(this.reconnectTimer);
    this.queue = [];
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }

  send(type, payload) {
    const data = JSON.stringify({ type, ...payload });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      // Queue and trigger reconnect if needed
      this.queue.push(data);
      if (this.token && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(this.token), 0);
      }
    }
  }

  // Message actions
  sendMessage(conversationId, text, tempId, attachment, replyToId) {
    this.send('message:send', { conversationId, text, tempId, attachment, replyToId });
  }

  // Send "read up to this message" — server marks all prior unread as read in one query
  markRead(messageId, conversationId) {
    this.send('message:read', { messageId, conversationId });
  }

  startTyping(conversationId) {
    // Skip typing events when tab is in the background (Discord-style passive sessions)
    if (document.visibilityState === 'hidden') return;
    this.send('typing:start', { conversationId });
  }

  stopTyping(conversationId) {
    this.send('typing:stop', { conversationId });
  }

  // Listeners
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb); // returns unsubscribe fn
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const socket = new HeySocket();
