// HEY widget — плавающий пузырь для встраивания в ЛК АвтоВебОфис.
// Использование:
//   <script>window.HEY_USER_EMAIL = "{email}";</script>
//   <script src="https://hey-messenger.ru/widget.js"></script>
// АВО подставит реальный email ученика вместо {email}.
//
// Безопасность: персональные данные (счётчик непрочитанных) показываются
// только если у браузера активна cookie-сессия HEY И email сессии совпадает
// с переданным. Иначе виджет в нейтральном виде «Открыть HEY».

(function () {
  if (window.__HEY_WIDGET_LOADED__) return;
  window.__HEY_WIDGET_LOADED__ = true;

  var HEY_ORIGIN  = 'https://hey-messenger.ru';
  var POLL_MS     = 60 * 1000;
  var email       = (window.HEY_USER_EMAIL || '').trim();
  var bubble, badge, statusDot;
  var lastUnread = null;

  // ── Создание DOM ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hey-widget-styles')) return;
    var s = document.createElement('style');
    s.id = 'hey-widget-styles';
    s.textContent =
      '.hey-widget-bubble{position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
        'width:60px;height:60px;border-radius:50%;cursor:pointer;' +
        'background:linear-gradient(135deg,#6b46c1 0%,#8b5cf6 50%,#a78bfa 100%);' +
        'box-shadow:0 8px 24px rgba(107,70,193,.45),0 2px 8px rgba(0,0,0,.2);' +
        'display:flex;align-items:center;justify-content:center;' +
        'transition:transform .18s ease, box-shadow .18s ease;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        'border:none;outline:none;padding:0;}' +
      '.hey-widget-bubble:hover{transform:translateY(-2px) scale(1.04);' +
        'box-shadow:0 12px 32px rgba(107,70,193,.55),0 4px 12px rgba(0,0,0,.25);}' +
      '.hey-widget-bubble:active{transform:translateY(0) scale(.98);}' +
      '.hey-widget-icon{color:#fff;font-size:28px;line-height:1;font-weight:800;' +
        'text-shadow:0 1px 2px rgba(0,0,0,.2);user-select:none;pointer-events:none;}' +
      '.hey-widget-badge{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;' +
        'padding:0 6px;border-radius:11px;background:#ef4444;color:#fff;' +
        'font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;' +
        'box-shadow:0 0 0 2px #fff,0 2px 6px rgba(239,68,68,.45);' +
        'line-height:1;letter-spacing:.2px;}' +
      '.hey-widget-badge.hey-widget-badge-visible{display:flex;}' +
      '.hey-widget-tooltip{position:absolute;bottom:calc(100% + 10px);right:0;' +
        'background:rgba(20,12,40,.95);color:#fff;font-size:12px;font-weight:500;' +
        'padding:7px 12px;border-radius:8px;white-space:nowrap;' +
        'opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease;' +
        'pointer-events:none;backdrop-filter:blur(8px);' +
        'box-shadow:0 4px 12px rgba(0,0,0,.3);}' +
      '.hey-widget-bubble:hover .hey-widget-tooltip{opacity:1;transform:translateY(0);}' +
      '@media (max-width:600px){' +
        '.hey-widget-bubble{width:54px;height:54px;bottom:18px;right:18px;}' +
        '.hey-widget-icon{font-size:25px;}' +
      '}';
    document.head.appendChild(s);
  }

  function buildBubble() {
    bubble = document.createElement('button');
    bubble.className = 'hey-widget-bubble';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Открыть HEY');

    var icon = document.createElement('span');
    icon.className = 'hey-widget-icon';
    icon.textContent = '✦';
    bubble.appendChild(icon);

    badge = document.createElement('span');
    badge.className = 'hey-widget-badge';
    badge.textContent = '0';
    bubble.appendChild(badge);

    var tip = document.createElement('span');
    tip.className = 'hey-widget-tooltip';
    tip.textContent = 'Открыть HEY';
    bubble.appendChild(tip);

    bubble.addEventListener('click', function () {
      window.open(HEY_ORIGIN, '_blank', 'noopener');
    });

    document.body.appendChild(bubble);
  }

  // ── Запрос непрочитанных ────────────────────────────────────────────────
  function fetchUnread() {
    if (!email) {
      setBadge(null); // нейтральное состояние
      return;
    }
    var url = HEY_ORIGIN + '/api/widget/unread?email=' + encodeURIComponent(email);
    fetch(url, { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.authenticated) {
          setBadge(null);
          return;
        }
        setBadge(typeof data.unread === 'number' ? data.unread : 0);
      })
      .catch(function () { setBadge(null); });
  }

  function setBadge(n) {
    if (!badge) return;
    if (n === null || n === 0) {
      badge.classList.remove('hey-widget-badge-visible');
      lastUnread = n;
      return;
    }
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.add('hey-widget-badge-visible');
    lastUnread = n;
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildBubble();
    fetchUnread();
    setInterval(fetchUnread, POLL_MS);
    // Когда вкладка возвращается в фокус — обновляем сразу
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) fetchUnread();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
