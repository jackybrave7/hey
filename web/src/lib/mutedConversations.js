const STORAGE_KEY = 'hey:muted-conversations';
const muted = new Set();
const listeners = new Set();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const id of arr) {
      if (typeof id === 'string' && id) muted.add(id);
    }
  } catch {}
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...muted]));
  } catch {}
}

loadFromStorage();

export function syncMutedConversations(conversations) {
  muted.clear();
  for (const c of conversations || []) {
    if (c.notifications_muted) muted.add(c.id);
  }
  saveToStorage();
  notify();
}

export function setConversationMuted(convId, isMuted) {
  if (isMuted) muted.add(convId);
  else muted.delete(convId);
  saveToStorage();
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
