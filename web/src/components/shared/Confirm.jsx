// web/src/components/shared/Confirm.jsx
import { useState, useEffect, useRef } from 'react';
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
    <div style={{position:'fixed',inset:0,zIndex:12000,
      background:'rgba(0,0,0,.52)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'center',justifyContent:'center'}}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
        borderRadius:22,padding:'28px 26px 22px',width:'min(92vw,380px)',
        boxShadow:'0 24px 64px rgba(0,0,0,.55)',
        border:'1px solid rgba(249,240,240,.13)',
        display:'flex',flexDirection:'column',gap:18
      }}>
        <div style={{color:'#F9F0F0',fontSize:15,lineHeight:1.6}}>{message}</div>

        {requireWord && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:13}}>
              Введите <span style={{color:'rgba(255,160,160,.85)',fontWeight:600}}>«{requireWord}»</span> для подтверждения
            </div>
            <input ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
              placeholder={requireWord}
              onKeyDown={e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape') onCancel(); }}
              style={{
                background:'rgba(249,240,240,.1)',border:'1px solid rgba(249,240,240,.2)',
                borderRadius:12,padding:'10px 14px',color:'#F9F0F0',fontSize:14,
                fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
                transition:'border-color .15s'
              }}
              onFocus={e=>e.target.style.borderColor='rgba(255,180,180,.6)'}
              onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.2)'}/>
          </div>
        )}

        {promptInput && !requireWord && (
          <textarea ref={inputRef} value={typed} onChange={e=>setTyped(e.target.value)}
            placeholder={promptPlaceholder || 'Введите текст…'}
            rows={3}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submit(); } if(e.key==='Escape') onCancel(); }}
            style={{
              background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.18)',
              borderRadius:12,padding:'10px 14px',color:'#F9F0F0',fontSize:14,
              fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',
              resize:'vertical',transition:'border-color .15s',lineHeight:1.5,
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.6)'}
            onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.18)'}/>
        )}

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onCancel}
            style={{padding:'10px 22px',borderRadius:14,fontSize:14,cursor:'pointer',
              background:'rgba(249,240,240,.09)',border:'1px solid rgba(249,240,240,.14)',
              color:'rgba(249,240,240,.8)',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.16)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(249,240,240,.09)'}>
            Отмена
          </button>
          <button onClick={submit}
            style={{
              padding:'10px 22px',borderRadius:14,fontSize:14,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              background: canConfirm
                ? (danger ? 'rgba(210,50,50,.75)' : 'rgba(100,80,160,.8)')
                : 'rgba(249,240,240,.07)',
              border:'1px solid ' + (canConfirm
                ? (danger ? 'rgba(255,100,100,.4)' : 'rgba(180,140,220,.4)')
                : 'rgba(249,240,240,.1)'),
              color: canConfirm ? '#F9F0F0' : 'rgba(249,240,240,.3)',
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
