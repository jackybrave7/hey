const listeners = new Map();
let activeId = null;

export function subscribeAudioPlayer(id, onStop) {
  listeners.set(id, onStop);
  return () => {
    listeners.delete(id);
    if (activeId === id) activeId = null;
  };
}

export function claimAudioPlayback(id) {
  for (const [otherId, stop] of listeners) {
    if (otherId !== id) stop();
  }
  activeId = id;
}

export function releaseAudioPlayback(id) {
  if (activeId === id) activeId = null;
}
