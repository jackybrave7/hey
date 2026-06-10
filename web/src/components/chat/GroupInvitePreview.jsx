import { useNavigate } from 'react-router-dom';

function GroupInvitePreview({ data, isOut }) {
  const nav = useNavigate();
  const g = data?.group;
  if (!g) return null;
  const ic = g.icon || '';
  const isImg = ic && (ic.startsWith('http') || ic.startsWith('/') || ic.startsWith('data:'));
  // Извлекаем путь /gjoin/... из абсолютной ссылки, чтобы переход
  // оставался в SPA-роутере (а не делал full reload).
  function openInvite() {
    try {
      const u = new URL(data.url);
      nav(u.pathname);
    } catch { window.location.href = data.url; }
  }
  return (
    <div onClick={openInvite}
      style={{
        marginBottom: 8, padding:'10px 12px', borderRadius: 12,
        background: isOut ? 'rgba(249,240,240,.16)' : 'rgba(95, 64, 128,.10)',
        border: '1px solid ' + (isOut ? 'rgba(249,240,240,.25)' : 'rgba(180,140,220,.30)'),
        display:'flex', alignItems:'center', gap: 12,
        cursor:'pointer', transition:'background .15s',
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: isImg ? '#0a0518' : 'rgba(95, 64, 128,.45)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize: 22, color:'#F9F0F0', fontWeight: 700,
        overflow:'hidden', border:'1px solid rgba(249,240,240,.12)',
      }}>
        {isImg
          ? <img src={ic} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
          : (ic || '👥')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: isOut ? '#F9F0F0' : '#2a2040', fontSize: 14, fontWeight: 700,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {g.name || 'Группа'}
        </div>
        <div style={{
          color: isOut ? 'rgba(249,240,240,.7)' : 'rgba(50,30,90,.55)',
          fontSize: 11, marginTop: 2,
        }}>
          👥 {g.member_count || 0} · Приглашение в группу
        </div>
      </div>
      <span style={{ color: isOut ? 'rgba(249,240,240,.6)' : 'rgba(50,30,90,.45)',
        fontSize: 18, flexShrink: 0 }}>›</span>
    </div>
  );
}
export default GroupInvitePreview;
