// ServerStatusBanner.jsx — фиксированный sticky-баннер сверху, который
// появляется когда хотя бы один запрос упал по таймауту / сети / 5xx,
// и автоматически прячется при первом успешном ответе сервера.
//
// Идея простая: api.req() диспатчит 'hey:server-issue' / 'hey:server-ok'.
// Мы держим состояние и показываем баннер вверху страницы пока всё плохо.
import { useEffect, useState, useRef } from 'react';

const MESSAGES = {
  timeout: 'Сервер долго отвечает. Уже разбираемся — попробуй обновить через минуту.',
  network: 'Нет связи с сервером. Проверь интернет — если у тебя всё ок, мы уже занимаемся.',
  '5xx':   'Технические работы на сервере. Уже разбираемся — попробуй через минуту.',
};

export default function ServerStatusBanner() {
  const [issue, setIssue] = useState(null); // null | 'timeout' | 'network' | '5xx'
  const okHideTimer = useRef(null);

  useEffect(() => {
    function onIssue(e) {
      // Сразу показываем (новая причина может перебить старую)
      setIssue(e.detail || 'timeout');
      // Сбрасываем отложенный hide, если он был
      if (okHideTimer.current) { clearTimeout(okHideTimer.current); okHideTimer.current = null; }
    }
    function onOk() {
      // Прячем не моментально, чтобы юзер успел заметить, что всё восстановилось
      if (okHideTimer.current) clearTimeout(okHideTimer.current);
      okHideTimer.current = setTimeout(() => { setIssue(null); }, 600);
    }
    window.addEventListener('hey:server-issue', onIssue);
    window.addEventListener('hey:server-ok', onOk);
    return () => {
      window.removeEventListener('hey:server-issue', onIssue);
      window.removeEventListener('hey:server-ok', onOk);
      if (okHideTimer.current) clearTimeout(okHideTimer.current);
    };
  }, []);

  if (!issue) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, rgba(220,90,90,.95), rgba(200,80,80,.95))',
      color: 'white',
      padding: '10px 16px',
      paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
      fontSize: 13,
      fontWeight: 500,
      textAlign: 'center',
      boxShadow: '0 4px 14px rgba(0,0,0,.25)',
      borderBottom: '1px solid rgba(255,160,160,.4)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      lineHeight: 1.4,
    }}>
      <span style={{ fontSize: 16 }}>⚠</span>
      <span style={{ flex: 1, maxWidth: 600 }}>{MESSAGES[issue] || MESSAGES.timeout}</span>
      <button onClick={() => window.location.reload()}
        style={{
          background: 'rgba(255,255,255,.18)',
          border: '1px solid rgba(255,255,255,.3)',
          color: 'white',
          padding: '5px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}>
        ↻ Обновить
      </button>
    </div>
  );
}
