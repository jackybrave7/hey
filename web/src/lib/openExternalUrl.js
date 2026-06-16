import { detectInstalledAppKind } from './appClient';

export function isAndroidInstalledApp() {
  return detectInstalledAppKind() === 'android';
}

/** Открыть http(s)-ссылку: в TWA — системный браузер, иначе новая вкладка. */
export function openExternalUrl(rawUrl) {
  let abs;
  try {
    abs = new URL(rawUrl, window.location.href).href;
  } catch {
    return false;
  }
  if (!/^https?:\/\//i.test(abs)) return false;

  if (!isAndroidInstalledApp()) {
    window.open(abs, '_blank', 'noopener,noreferrer');
    return true;
  }

  const parsed = new URL(abs);
  const scheme = parsed.protocol.replace(':', '');
  const intentPath = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  const intent =
    `intent://${intentPath}` +
    '#Intent;' +
    `scheme=${scheme};` +
    'action=android.intent.action.VIEW;' +
    'category=android.intent.category.BROWSABLE;' +
    `S.browser_fallback_url=${encodeURIComponent(abs)};end`;

  window.location.assign(intent);
  return true;
}

function shouldInterceptAnchor(anchor) {
  if (!anchor || anchor.dataset?.keepInApp === 'true') return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  if (anchor.hasAttribute('download')) return false;

  let url;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (!/^https?:$/i.test(url.protocol)) return false;

  const sameOrigin = url.origin === window.location.origin;
  if (!sameOrigin) return true;
  return anchor.target === '_blank';
}

/** Клики по внешним ссылкам и window.open → системный браузер в Android TWA. */
export function installAndroidExternalLinkHandler() {
  if (!isAndroidInstalledApp()) return () => {};

  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || !shouldInterceptAnchor(a)) return;
    e.preventDefault();
    e.stopPropagation();
    openExternalUrl(a.href);
  };

  document.addEventListener('click', onClick, true);

  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      openExternalUrl(url);
      return null;
    }
    return nativeOpen(url, target, features);
  };

  return () => {
    document.removeEventListener('click', onClick, true);
    window.open = nativeOpen;
  };
}
