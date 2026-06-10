import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import TopBar from '../shared/TopBar';
import { fmtTime, fmtDate } from '../../lib/formatTime';

export function CallsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [calls, setCalls] = useState([]);

  useEffect(() => { api.getCalls().then(setCalls).catch(console.error); }, []);

  return (
    <div className="screen">
      <TopBar title="История звонков" onBack={() => nav(-1)}/>
      <div style={{flex:1,overflowY:'auto',maxWidth:680,margin:'0 auto',width:'100%',padding:'0 18px'}}>
        {calls.length === 0 && (
          <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',marginTop:60,fontSize:15}}>
            История звонков пуста
          </div>
        )}
        {calls.map(c => {
          const isOut = c.caller_id === user?.id;
          const other = isOut
            ? { name: c.callee_name, avatar: c.callee_avatar }
            : { name: c.caller_name, avatar: c.caller_avatar };
          const missed = c.status === 'missed';
          return (
            <div key={c.id}
              style={{display:'flex',alignItems:'center',gap:13,padding:'15px 0',
                borderBottom:'1px solid rgba(170,130,190,.3)',cursor:'pointer'}}
              onClick={() => nav(`/calls/${c.id}`, { state: { call: c } })}>
              <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(200,160,210,.45)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                {other.avatar || (other.name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{color:'#F9F0F0',fontSize:15,fontWeight:500,display:'flex',alignItems:'center',gap:6}}>
                  {other.name}
                  <span style={{color: missed ? '#e74c3c' : '#2ecc71', fontSize:17}}>
                    {isOut ? '↗' : '↙'}
                  </span>
                </div>
                <div style={{color:'rgba(249,240,240,.5)',fontSize:13,marginTop:3}}>
                  {fmtDate(c.created_at)}, {fmtTime(c.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
