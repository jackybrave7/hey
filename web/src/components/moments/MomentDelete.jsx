// MomentDelete.jsx — подтверждение удаления навсегда
import { useState } from 'react';

export default function MomentDelete({ moment, onConfirm, onClose }) {
  const [word, setWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = word.trim().toLowerCase() === 'удалить';

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } catch {
      setDeleting(false);
    }
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:900,
    background:'rgba(0,0,0,.7)',backdropFilter:'blur(12px)',
    display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',
  };
  const box = {
    background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(100%,400px)',
    boxShadow:'0 8px 48px rgba(0,0,0,.6)',
    border:'1px solid rgba(255,255,255,.1)',
    padding:'28px 24px',
    display:'flex',flexDirection:'column',gap:18,
  };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={box}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:44,marginBottom:12}}>🗑</div>
          <div style={{color:'white',fontSize:18,fontWeight:700,marginBottom:8}}>
            Удалить момент навсегда?
          </div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:14,lineHeight:1.6}}>
            Это действие нельзя отменить. Момент и все реакции на него будут удалены безвозвратно.
          </div>
        </div>

        {/* Момент preview */}
        <div style={{background:'rgba(255,255,255,.06)',borderRadius:14,
          padding:'12px 16px',borderLeft:'3px solid rgba(255,80,80,.4)'}}>
          <div style={{color:'rgba(255,255,255,.7)',fontSize:13,lineHeight:1.5,
            overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
            {moment.text}
          </div>
        </div>

        {/* Confirm input */}
        <div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:13,marginBottom:8}}>
            Введи <strong style={{color:'rgba(255,120,120,.9)'}}>удалить</strong> для подтверждения:
          </div>
          <input
            value={word}
            onChange={e => setWord(e.target.value)}
            placeholder="удалить"
            autoFocus
            style={{
              width:'100%',boxSizing:'border-box',
              background:'rgba(255,255,255,.08)',
              border:`1px solid ${canDelete ? 'rgba(255,100,100,.6)' : 'rgba(255,255,255,.14)'}`,
              borderRadius:12,padding:'11px 14px',color:'white',fontSize:15,
              fontFamily:'inherit',outline:'none',
              transition:'border-color .15s',
            }}
            onKeyDown={e => { if(e.key === 'Enter') handleDelete(); }}
          />
        </div>

        {/* Buttons */}
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose}
            style={{flex:1,padding:'13px',borderRadius:14,
              background:'rgba(255,255,255,.08)',border:'none',
              color:'rgba(255,255,255,.7)',fontSize:15,fontWeight:600,cursor:'pointer'}}>
            Отмена
          </button>
          <button onClick={handleDelete} disabled={!canDelete || deleting}
            style={{
              flex:1,padding:'13px',borderRadius:14,
              background: canDelete ? 'rgba(200,50,50,.85)' : 'rgba(255,255,255,.07)',
              border:'none',
              color: canDelete ? 'white' : 'rgba(255,255,255,.3)',
              fontSize:15,fontWeight:700,
              cursor: canDelete && !deleting ? 'pointer' : 'not-allowed',
              transition:'all .2s',
            }}>
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
