import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { detectLikelyFromRussia } from '../lib/isLikelyFromRussia';

const DISMISS_KEY = 'hey_vpn_ru_hint_dismissed';

export default function VpnRuBanner() {
  const { user } = useAuth();
  const location = useLocation();
  const [isRu, setIsRu] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [serverIssue, setServerIssue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectLikelyFromRussia().then((ok) => {
      if (!cancelled) setIsRu(ok);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onIssue() { setServerIssue(true); }
    function onOk() { setServerIssue(false); }
    window.addEventListener('hey:server-issue', onIssue);
    window.addEventListener('hey:server-ok', onOk);
    return () => {
      window.removeEventListener('hey:server-issue', onIssue);
      window.removeEventListener('hey:server-ok', onOk);
    };
  }, []);

  if (!user || !isRu) return null;
  if (dismissed && !serverIssue) return null;

  const tabPaths = ['/main', '/chats', '/contacts', '/me'];
  const aboveBottomNav = tabPaths.includes(location.pathname);
  const inChat = location.pathname.startsWith('/chat/');

  const positionStyle = aboveBottomNav
    ? { bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', top: 'auto' }
    : inChat
      ? { top: 'calc(64px + env(safe-area-inset-top, 0px))', bottom: 'auto' }
      : { top: 'calc(12px + env(safe-area-inset-top, 0px))', bottom: 'auto' };

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        ...positionStyle,
        zIndex: 9997,
        background: 'linear-gradient(135deg, rgba(45, 95, 75, .96), rgba(30, 70, 55, .96))',
        border: '1px solid rgba(140, 230, 170, .45)',
        borderRadius: 14,
        padding: '12px 14px',
        color: '#E8FFF0',
        fontSize: 13,
        lineHeight: 1.45,
        boxShadow: '0 8px 28px rgba(0,0,0,.35)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }} aria-hidden>ℹ️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {serverIssue ? 'Нет связи? Проверьте VPN' : 'HEY лучше работает без VPN'}
          </div>
          <div style={{ opacity: .92 }}>
            Если чат не открывается или зависает — отключите VPN или добавьте{' '}
            <strong style={{ fontWeight: 600 }}>hey-messenger.ru</strong> в исключения
            (split tunneling) в настройках VPN-приложения.
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Скрыть"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(249,240,240,.12)',
            color: '#E8FFF0',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
