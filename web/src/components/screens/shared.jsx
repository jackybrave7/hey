// web/src/components/screens/shared.jsx — toast/confirm (eager, маленький)
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Toast (in-app уведомления) — заменяет native alert()
// Использование: heyToast('Сохранено') или heyToast('Ошибка', 'error')
// ─────────────────────────────────────────────────────────────────────────────

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

// ConfirmModal + useConfirm
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmModal({ message, hint, requireWord, promptInput, promptPlaceholder, danger, confirmLabel, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef();
  useEffect(() => { if (requireWord || promptInput) setTimeout(() => inputRef.current?.focus(), 60); }, []);
  const canConfirm = !requireWord || typed.trim().toLowerCase() === requireWord.toLowerCase();
  const submit = () => {
    if (!canConfirm) return;
    onConfirm(promptInput ? typed.trim() : true);
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,
      background:'rgba(0,0,0,.52)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
        borderRadius:22,padding:'28px 26px 22px',width:'min(92vw,380px)',
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(255,255,255,.13)',
        display:'flex',flexDirection:'column',gap:18
      }}>
        <div style={{color:'white',fontSize:15,lineHeight:1.6}}>{message}</div>

        {requireWord && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{color:'rgba(255,255,255,.5)',fontSize:13}}>
              Введите <span style={{color:'rgba(255,160,160,.85)',fontWeight:600}}>«{requireWord}»</span> для подтверждения
            </div>
            <input ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
              placeholder={requireWord}
              onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape') onCancel(); }}
              style={{
                background:'rgba(255,255,255,.1)',border:'1px solid rgba(255,255,255,.2)',
                borderRadius:12,padding:'10px 14px',color:'white',fontSize:14,
                fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
                transition:'border-color .15s'
              }}
              onFocus={e=>e.target.style.borderColor='rgba(255,180,180,.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.2)'}/>
          </div>
        )}

        {promptInput && !requireWord && (
          <textarea ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
            placeholder={promptPlaceholder || 'Введите текст…'}
            rows={3}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submit(); } if(e.key==='Escape') onCancel(); }}
            style={{
              background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.18)',
              borderRadius:12,padding:'10px 14px',color:'white',fontSize:14,
              fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
              resize:'vertical',transition:'border-color .15s',lineHeight:1.5,
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.6)'}
            onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.18)'}/>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancel}
            style={{padding:'10px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
              background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.14)',
              color:'rgba(255,255,255,.8)',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.16)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.09)'}>
            Отмена
          </button>
          <button onClick={submit}
            style={{
              padding:'10px 22px',borderRadius:14,fontSize:14,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              background: canConfirm
                ? (danger ? 'rgba(210,50,50,.75)' : 'rgba(100,80,160,.8)')
                : 'rgba(255,255,255,.07)',
              border:'1px solid ' + (canConfirm
                ? (danger ? 'rgba(255,100,100,.4)' : 'rgba(180,140,220,.4)')
                : 'rgba(255,255,255,.1)'),
              color: canConfirm ? 'white' : 'rgba(255,255,255,.3)',
              transition:'all .2s',fontWeight: canConfirm ? 600 : 400
            }}
            onMouseEnter={e=>{ if(canConfirm) e.currentTarget.style.opacity='.85'; }}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            {confirmLabel || (requireWord ? 'Удалить' : 'Подтвердить')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = (message, options = {}) => new Promise(resolve => {
    resolveRef.current = resolve;
    setDialog({ message, ...options });
  });

  // Стилизованный аналог window.prompt — возвращает строку или null если отмена
  const promptText = (message, options = {}) => new Promise(resolve => {
    resolveRef.current = resolve;
    setDialog({ message, promptInput: true, ...options });
  });

  const handleConfirm = (val) => {
    // Для promptInput val — строка; для обычного confirm — true
    resolveRef.current?.(val === undefined ? true : val);
    setDialog(null);
  };
  const handleCancel  = () => {
    // Для promptInput возвращаем null (как у window.prompt), для confirm — false
    resolveRef.current?.(dialog?.promptInput ? null : false);
    setDialog(null);
  };

  const modal = dialog ? (
    <ConfirmModal
      message={dialog.message}
      hint={dialog.hint}
      requireWord={dialog.requireWord}
      promptInput={dialog.promptInput}
      promptPlaceholder={dialog.promptPlaceholder}
      confirmLabel={dialog.confirmLabel}
      danger={dialog.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return [confirm, modal, promptText];
}
