const STORAGE_KEY = 'hey:archived-conversations';
const archived = new Set();
const listeners = new Set();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const id of arr) {
      if (typeof id === 'string' && id) archived.add(id);
    }
  } catch {}
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...archived]));
  } catch {}
}

loadFromStorage();

export function syncArchivedConversations(conversations) {
  archived.clear();
  for (const c of conversations || []) {
    if (c?.id) archived.add(c.id);
  }
  saveToStorage();
  notify();
}

export function setConversationArchived(convId, isArchived) {
  if (isArchived) archived.add(convId);
  else archived.delete(convId);
  saveToStorage();
  notify();
}

export function isConversationArchived(convId) {
  return archived.has(convId);
}

function notify() {
  for (const fn of listeners) fn(archived);
}

export function onArchivedConversationsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
