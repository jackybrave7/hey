// Dispatch event to open contact card from anywhere
export function openUserCard(userId) {
  if (!userId) return;
  window.dispatchEvent(new CustomEvent('hey:open-user-card', { detail: userId }));
}
