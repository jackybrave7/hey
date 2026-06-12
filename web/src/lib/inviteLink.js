export function personalInviteUrl(code) {
  if (!code) return '';
  return `${location.origin}/register?invite=${encodeURIComponent(code)}`;
}
