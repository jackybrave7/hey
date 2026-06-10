// web/src/components/shared/Toast.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
export function heyToast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('hey:toast', { detail: { message, type } }));
}

export function ToastContainer() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onToast(e) {
      const id = Math.random().toString(36).slice(2, 9);
      const t  = { id, message: e.detail.message, type: e.detail.type || 'info' };
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 3500);
    }
    window.addEventListener('hey:toast', onToast);
    return () => window.removeEventListener('hey:toast', onToast);
  }, []);
  if (!items.length) return null;
  const colors = {
    info:    { bg:'rgba(28,18,58,.98)',  border:'rgba(180,140,220,.3)', text:'rgba(235,225,255,.95)' },
    success: { bg:'rgba(20,40,30,.98)',  border:'rgba(80,200,140,.4)',  text:'rgba(180,255,210,.98)' },
    error:   { bg:'rgba(50,20,28,.98)',  border:'rgba(255,100,100,.4)', text:'rgba(255,180,180,.98)' },
    warning: { bg:'rgba(50,40,18,.98)',  border:'rgba(255,180,80,.4)',  text:'rgba(255,220,150,.98)' },
  };
  return createPortal(
    <div style={{
      position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)',
      zIndex:99999, display:'flex', flexDirection:'column', gap:8, alignItems:'center',
      pointerEvents:'none',
    }}>
      {items.map(t => {
        const c = colors[t.type] || colors.info;
        return (
          <div key={t.id}
            style={{
              background:c.bg, border:`1px solid ${c.border}`,
              borderRadius:14, padding:'12px 20px',
              color:c.text, fontSize:14, fontWeight:500,
              boxShadow:'0 8px 32px rgba(0,0,0,.45)', backdropFilter:'blur(20px)',
              maxWidth:'min(92vw, 420px)', lineHeight:1.45,
              animation:'heyToastIn .25s ease-out',
              pointerEvents:'auto',
            }}>
            {t.message}
          </div>
        );
      })}
      <style>{`
        @keyframes heyToastIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
