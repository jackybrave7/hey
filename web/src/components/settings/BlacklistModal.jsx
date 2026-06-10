import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import Icon from '../Icon';

function BlacklistModal({ onClose }) {
  const [blocked,  setBlocked]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [customConfirm, confirmModal] = useConfirm();

  useEffect(() => {
    api.getBlocked().then(list => { setBlocked(list); setLoading(false); }).catch(console.error);
  }, []);

  async function handleUnblock(u) {
    if (!await customConfirm(
      `Разблокировать ${u.name}?\nОни смогут снова писать вам сообщения.`
    )) return;
    await api.unblockUser(u.id).catch(console.error);
    setBlocked(prev => prev.filter(b => b.id !== u.id));
  }

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:600,
      background:'rgba(0,0,0,.6)',backdropFilter:'blur(12px)',
      display:'flex',alignItems:'center',justifyContent:'center'
    }} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:'rgba(30,22,58,.98)',backdropFilter:'blur(24px)',
        borderRadius:24,width:'min(94vw,440px)',maxHeight:'78vh',
        display:'flex',flexDirection:'column',
        boxShadow:'0 28px 72px rgba(0,0,0,.6)',
        border:'1px solid rgba(249,240,240,.11)',overflow:'hidden'
      }}>
        {/* Header */}
        <div style={{
          display:'flex',alignItems:'center',gap:12,
          padding:'20px 22px 16px',
          borderBottom:'1px solid rgba(249,240,240,.09)',flexShrink:0
        }}>
          <span style={{display:'inline-flex',color:'rgba(249,240,240,.85)'}}><Icon name="ban" size={20} /></span>
          <span style={{color:'#F9F0F0',fontSize:17,fontWeight:700,flex:1}}>Чёрный список</span>
          <button onClick={onClose} style={{
            background:'none',border:'none',color:'rgba(249,240,240,.4)',
            fontSize:22,cursor:'pointer',lineHeight:1,padding:4
          }}>✕</button>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:'auto'}}>
          {loading && (
            <div style={{color:'rgba(249,240,240,.3)',fontSize:14,textAlign:'center',padding:'40px 20px'}}>
              Загрузка…
            </div>
          )}
          {!loading && blocked.length === 0 && (
            <div style={{color:'rgba(249,240,240,.35)',fontSize:14,textAlign:'center',padding:'48px 20px',lineHeight:1.6}}>
              Чёрный список пуст.<br/>
              <span style={{fontSize:12,opacity:.6}}>Заблокированные пользователи появятся здесь.</span>
            </div>
          )}
          {blocked.map((b, i) => (
            <div key={b.id} style={{
              display:'flex',alignItems:'center',gap:12,
              padding:'14px 22px',
              borderBottom: i < blocked.length-1 ? '1px solid rgba(249,240,240,.07)' : 'none',
              transition:'background .12s'
            }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.04)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <AvatarDisplay avatar={b.avatar} name={b.name} size={46} fontSize={18}
                style={{background:'rgba(160,60,60,.4)',flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:'rgba(255,200,200,.9)',fontSize:15,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</div>
                <div style={{color:'rgba(249,240,240,.35)',fontSize:12,marginTop:2}}>{b.phone}</div>
              </div>
              <button onClick={() => handleUnblock(b)} style={{
                flexShrink:0,padding:'8px 16px',borderRadius:12,fontSize:13,cursor:'pointer',
                background:'rgba(50,150,75,.25)',border:'1px solid rgba(70,190,100,.3)',
                color:'rgba(110,220,140,.9)',transition:'background .15s',whiteSpace:'nowrap'
              }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(50,150,75,.45)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(50,150,75,.25)'}>
                Разблокировать
              </button>
            </div>
          ))}
        </div>
      </div>
      {confirmModal}
    </div>
  );
}

export default BlacklistModal;
