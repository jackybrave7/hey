import { useState } from 'react';
import { useAuth } from '../../AuthContext';

function InviteByPhoneModal({ phone, onClose }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user } = useAuth();

  const inviteLink = `${location.origin}/register?invite=${user?.id || ''}`;
  const waText = `Привет! Я пользуюсь HEY Messenger — быстрый и стильный мессенджер. Вступай: ${inviteLink}`;
  const waHref = `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(waText)}`;

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const overlay = { position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,.65)',
    backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 };
  const panel = { background:'rgba(28,18,56,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,400px)',
    boxShadow:'0 24px 64px rgba(0,0,0,.55)',border:'1px solid rgba(249,240,240,.13)',overflow:'hidden' };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{padding:'22px 24px 16px',display:'flex',alignItems:'center',gap:12,
          borderBottom:'1px solid rgba(249,240,240,.1)'}}>
          <span style={{fontSize:28}}>📲</span>
          <div style={{flex:1}}>
            <div style={{color:'#F9F0F0',fontSize:16,fontWeight:700}}>Пользователь не найден</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13,marginTop:2}}>
              Пригласи {phone} в HEY
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',
            color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:16}}>
          {/* Invite link */}
          <div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginBottom:8}}>
              Твоя персональная ссылка для приглашения
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(249,240,240,.07)',borderRadius:12,
                padding:'10px 14px',color:'rgba(200,180,255,.9)',fontSize:12,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                border:'1px solid rgba(249,240,240,.12)',userSelect:'all'}}>
                {inviteLink}
              </div>
              <button onClick={copyLink}
                style={{padding:'10px 16px',borderRadius:12,whiteSpace:'nowrap',flexShrink:0,
                  background: linkCopied ? 'rgba(60,180,100,.7)' : 'rgba(95, 64, 128,.7)',
                  border:'none',color:'#F9F0F0',fontSize:13,fontWeight:600,cursor:'pointer',
                  transition:'background .2s'}}>
                {linkCopied ? '✓' : '📋'}
              </button>
            </div>
          </div>

          {/* WhatsApp button */}
          <a href={waHref} target="_blank" rel="noopener noreferrer"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              padding:'14px',borderRadius:16,textDecoration:'none',
              background:'rgba(37,211,102,.18)',border:'1px solid rgba(37,211,102,.3)',
              color:'rgba(80,230,120,.9)',fontSize:15,fontWeight:600}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Написать в WhatsApp
          </a>

          <button onClick={onClose}
            style={{padding:'12px',borderRadius:16,border:'1px solid rgba(249,240,240,.15)',
              background:'none',color:'rgba(249,240,240,.5)',fontSize:14,cursor:'pointer'}}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteByPhoneModal;
