// MomentActionMenu.jsx — нижнее меню ⋯ для своего Момента
export default function MomentActionMenu({ moment, onEdit, onArchive, onDelete, onClose }) {
  async function copyLink() {
    const url = `${location.origin}/moments/${moment.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback
    }
    onClose();
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:800,
    background:'rgba(0,0,0,.6)',backdropFilter:'blur(10px)',
    display:'flex',alignItems:'center',justifyContent:'center',
    padding:'20px',
  };
  const sheet = {
    background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(100%,520px)',
    boxShadow:'0 8px 48px rgba(0,0,0,.6)',
    border:'1px solid rgba(255,255,255,.1)',
    overflow:'hidden',
  };
  const item = (color='rgba(255,255,255,.88)') => ({
    display:'flex',alignItems:'center',gap:14,
    padding:'16px 20px',cursor:'pointer',
    borderBottom:'1px solid rgba(255,255,255,.06)',
    color, fontSize:15, fontWeight:500,
    transition:'background .15s',
  });

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={sheet}>
        {/* Moment preview */}
        <div style={{padding:'8px 20px 12px',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:12,marginBottom:4}}>Момент</div>
          <div style={{color:'rgba(255,255,255,.75)',fontSize:13,
            overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
            {moment.text}
          </div>
        </div>

        {/* Actions */}
        <div
          style={item()}
          onClick={() => { onEdit(); onClose(); }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <span style={{fontSize:20}}>✎</span>
          <span>Изменить момент</span>
        </div>

        <div
          style={item()}
          onClick={copyLink}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <span style={{fontSize:20}}>↗</span>
          <span>Поделиться ссылкой</span>
        </div>

        <div
          style={item()}
          onClick={() => { onArchive(); onClose(); }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <span style={{fontSize:20}}>📦</span>
          <span>В архив</span>
        </div>

        <div
          style={item('rgba(255,100,100,.9)')}
          onClick={() => { onDelete(); onClose(); }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(200,50,50,.1)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <span style={{fontSize:20}}>🗑</span>
          <span>Удалить навсегда</span>
        </div>

        {/* Cancel */}
        <div style={{padding:'8px 20px 24px'}}>
          <button onClick={onClose}
            style={{width:'100%',padding:'13px',borderRadius:14,
              background:'rgba(255,255,255,.08)',border:'none',
              color:'rgba(255,255,255,.6)',fontSize:15,fontWeight:600,cursor:'pointer'}}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
