// web/src/api.js

const BASE = '/api';

function getToken() {
  return localStorage.getItem('hey_token');
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
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
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (data) => req('POST', '/register', data),
  login:    (data) => req('POST', '/login', data),
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

  // Blocks
  getBlocked:   ()       => req('GET', '/blocks'),
  blockUser:    (userId) => req('POST', '/blocks', { userId }),
  unblockUser:  (userId) => req('DELETE', `/blocks/${userId}`),

  // Conversations
  getConversations: ()       => req('GET', '/conversations'),
  openConversation: (userId) => req('POST', '/conversations', { userId }),
  getMessages:      (convId, before) =>
    req('GET', `/conversations/${convId}/messages${before ? `?before=${before}` : ''}`),
  clearMessages:    (convId)              => req('DELETE', `/conversations/${convId}/messages`),
  deleteConversation:(convId)             => req('DELETE', `/conversations/${convId}`),
  pinConversation:   (convId)             => req('POST',   `/conversations/${convId}/pin`),
  unpinConversation: (convId)             => req('DELETE', `/conversations/${convId}/pin`),
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
  adminGetMoments:         (params = {})   => {
    const qs = new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString();
    return req('GET', `/admin/moments${qs ? '?' + qs : ''}`);
  },
  adminDeleteMoment:       (id, reason)    => req('DELETE', `/admin/moments/${id}`, { reason }),
  adminGetLogs:            (limit)         => req('GET',    `/admin/logs${limit ? '?limit=' + limit : ''}`),

  // AWO / Школьная интеграция
  joinValidate:            (email, course, sig) =>
    req('GET', `/join/validate?email=${encodeURIComponent(email)}&course=${encodeURIComponent(course||'')}&sig=${encodeURIComponent(sig)}`),
  adminGetAwoSettings:     ()              => req('GET',    '/admin/awo/settings'),
  adminSetAwoSettings:     (data)          => req('PUT',    '/admin/awo/settings', data),
  adminGetAwoCourseChats:  ()              => req('GET',    '/admin/awo/course-chats'),
  adminSetAwoCourseChat:   (course, chatId) => req('POST',  '/admin/awo/course-chats', { course, chat_id: chatId }),
  adminDeleteAwoCourseChat:(course)        => req('DELETE', `/admin/awo/course-chats/${encodeURIComponent(course)}`),
  adminGetGroupChats:      ()              => req('GET',    '/admin/group-chats'),
  adminGetAwoLog:          (limit)         => req('GET',    `/admin/awo/log${limit ? '?limit=' + limit : ''}`),
  adminAwoMakeJoinLink:    (email, course) => req('POST',   '/admin/awo/join-link', { email, course }),
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
