import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import TopBar from '../shared/TopBar';
import { fmtTime, fmtDate } from '../../lib/formatTime';

export function CallDetailScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation();
  const c = state?.call;

  useEffect(() => { if (!c) nav('/calls', { replace: true }); }, []);
  if (!c) return null;

  const isOut  = c.caller_id === user?.id;
  const other  = isOut ? { name: c.callee_name } : { name: c.caller_name };
  const missed = c.status === 'missed';
  const statusLabel = missed ? 'Пропущенный' : c.status === 'declined' ? 'Отклонённый' : 'Принятый';
  const typeLabel   = c.type === 'video' ? '📹 Видеозвонок' : '📞 Голосовой';

  function fmtDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? `${m} мин ${s} с` : `${s} с`;
  }

  async function openChat() {
    const partnerId = isOut ? c.callee_id : c.caller_id;
    try {
      const conv = await api.openConversation(partnerId);
      nav(`/chat/${conv.id}`);
    } catch(e) { heyToast(e.message, 'error'); }
  }

  const row = (label, value) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
      padding:'14px 0',borderBottom:'1px solid rgba(249,240,240,.08)'}}>
      <span style={{color:'rgba(249,240,240,.5)',fontSize:14}}>{label}</span>
      <span style={{color:'#F9F0F0',fontSize:14,fontWeight:500}}>{value}</span>
    </div>
  );

  return (
    <div className="screen">
      <TopBar title="Детали звонка" onBack={() => nav(-1)}/>
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',flex:1,display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'36px 0 24px'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(200,160,210,.45)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:32,marginBottom:14}}>
          {(other.name||'?')[0].toUpperCase()}
        </div>
        <div style={{color:'#F9F0F0',fontSize:20,fontWeight:600}}>{other.name}</div>
        <div style={{color: missed ? '#e74c3c' : '#2ecc71', fontSize:13,marginTop:6}}>
          {isOut ? '↗ Исходящий' : '↙ Входящий'} · {statusLabel}
        </div>
      </div>

      <div style={{padding:'0 24px',flex:1}}>
        {row('Тип', typeLabel)}
        {row('Дата', `${fmtDate(c.created_at)}, ${fmtTime(c.created_at)}`)}
        {row('Длительность', fmtDuration(c.duration))}
      </div>

      <div style={{padding:'24px'}}>
        <button className="pill" onClick={openChat} style={{width:'100%'}}>
          Написать сообщение
        </button>
      </div>
      </div>{/* /maxWidth wrapper */}
    </div>
  );
}
