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
    info:    { bg:'rgba(28,18,58,.98)',  border:'rgba(180,140,220,.32)', text:'#F9F0F0' },
    success: { bg:'rgba(32,22,68,.98)',  border:'rgba(200,170,255,.42)', text:'#F9F0F0' },
    error:   { bg:'rgba(38,16,36,.98)',  border:'rgba(230,120,150,.38)', text:'#F9F0F0' },
    warning: { bg:'rgba(38,28,18,.98)',  border:'rgba(230,180,110,.38)', text:'#F9F0F0' },
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
