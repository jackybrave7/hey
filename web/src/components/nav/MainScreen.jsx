import { useNavigate } from 'react-router-dom';

export function MainScreen() {
  const nav = useNavigate();
  const items = [
    { label:'Контакты',        path:'/contacts' },
    { label:'Сообщения',       path:'/chats' },
    { label:'История звонков', path:'/calls' },
    { label:'Настройки',       path:'/settings' },
  ];
  return (
    <div className="screen">
      <div className="topbar">
        <span className="topbar-title">Главная</span>
        <div onClick={() => nav('/me')} style={{width:32,height:32,borderRadius:'50%',background:'#F9F0F0',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,
          color:'#7A6AAA',cursor:'pointer',marginRight:8}}>Я</div>
        <div className="topbar-dots">{[0,1,2].map(i=><div key={i} className="topbar-dot"/>)}</div>
      </div>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'28px 26px',display:'flex',flexDirection:'column'}}>
        {items.map(item => (
          <div key={item.label}>
            <div onClick={() => nav(item.path)} style={{color:'#F9F0F0',fontSize:21,padding:'24px 0',
              cursor:'pointer',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.6'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              {item.label}
            </div>
            <div className="divider"/>
          </div>
        ))}
      </div>
    </div>
  );
}
