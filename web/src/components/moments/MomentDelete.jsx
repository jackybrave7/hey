// MomentDelete.jsx — подтверждение удаления Момента.
// Раньше требовалось ввести слово «удалить» — пользователь просил
// убрать лишний шаг и оставить чистый поп-ап с одной кнопкой
// подтверждения и Esc/тапом-вне-окна для отмены.
import { useEffect, useState } from 'react';

export default function MomentDelete({ moment, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try { await onConfirm(); }
    catch { setDeleting(false); }
  }

  // Esc — отмена, Enter — подтвердить.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter') { e.preventDefault(); handleDelete(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleting]);

  const overlay = {
    position:'fixed', inset:0, zIndex:900,
    background:'rgba(0,0,0,.7)', backdropFilter:'blur(12px)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
  };
  const box = {
    background:'rgba(22,15,50,.98)', backdropFilter:'blur(24px)',
    borderRadius:24, width:'min(100%,380px)',
    boxShadow:'0 8px 48px rgba(0,0,0,.6)',
    border:'1px solid rgba(255,255,255,.1)',
    padding:'28px 24px',
    display:'flex', flexDirection:'column', gap:18,
  };

  return (
    <div style={overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🗑</div>
          <div style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:8 }}>
            Удалить момент навсегда?
          </div>
          <div style={{ color:'rgba(255,255,255,.55)', fontSize:14, lineHeight:1.55 }}>
            Это действие нельзя отменить. Момент и все реакции на него будут удалены безвозвратно.
          </div>
        </div>

        {/* Превью текста, чтобы видеть какой именно момент удаляем */}
        {moment?.text && (
          <div style={{ background:'rgba(255,255,255,.06)', borderRadius:14,
            padding:'12px 16px', borderLeft:'3px solid rgba(255,80,80,.4)' }}>
            <div style={{ color:'rgba(255,255,255,.72)', fontSize:13, lineHeight:1.5,
              overflow:'hidden', display:'-webkit-box',
              WebkitLineClamp:3, WebkitBoxOrient:'vertical' }}>
              {moment.text}
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} disabled={deleting}
            style={{ flex:1, padding:'13px', borderRadius:14,
              background:'rgba(255,255,255,.08)', border:'none',
              color:'rgba(255,255,255,.7)', fontSize:15, fontWeight:600,
              cursor: deleting ? 'wait' : 'pointer', fontFamily:'inherit' }}>
            Отмена
          </button>
          <button onClick={handleDelete} disabled={deleting} autoFocus
            style={{ flex:1, padding:'13px', borderRadius:14,
              background:'rgba(200,50,50,.9)', border:'none',
              color:'white', fontSize:15, fontWeight:700,
              cursor: deleting ? 'wait' : 'pointer', fontFamily:'inherit',
              opacity: deleting ? .7 : 1, transition:'opacity .15s' }}>
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
