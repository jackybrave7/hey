// Определяет, открыт ли HEY как установленное приложение (PWA / TWA / APK).
export function detectInstalledAppKind() {
  if (typeof window === 'undefined') return null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (!standalone) return null;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'pwa';
}

export function reportInstalledAppIfNeeded(api) {
  const kind = detectInstalledAppKind();
  if (!kind || !api?.reportAppClient) return;
  try {
    api.reportAppClient(kind).catch(() => {});
  } catch {}
}
