const muted = new Set();
const listeners = new Set();

export function syncMutedConversations(conversations) {
  muted.clear();
  for (const c of conversations || []) {
    if (c.notifications_muted) muted.add(c.id);
  }
  notify();
}

export function setConversationMuted(convId, isMuted) {
  if (isMuted) muted.add(convId);
  else muted.delete(convId);
  notify();
}

export function isConversationMuted(convId) {
  return muted.has(convId);
}

function notify() {
  for (const fn of listeners) fn(muted);
}

export function onMutedConversationsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
