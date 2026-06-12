import { useState, useEffect } from 'react';
import { api } from '../../api';
import { personalInviteUrl } from '../../lib/inviteLink';
import Icon from '../Icon';

function InviteModal({ onClose }) {
  const [info, setInfo]   = useState(null);   // { code, referral_count }
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    api.getInvite().then(setInfo).catch(console.error);
  }, []);

  const inviteLink = info ? personalInviteUrl(info.code) : '…';

  const inviteText = info
    ? `Приглашаю тебя в HEY - мессенджер для приватного круга без рекламы: ${inviteLink}`
    : '';

  function copy() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function rotateLink() {
    if (rotating || !info) return;
    const ok = window.confirm(
      'Обновить пригласительную ссылку?\n\nСтарая перестанет работать — даже если вы уже отправили её кому-то. Уже приглашённые друзья останутся в статистике.',
    );
    if (!ok) return;
    setRotating(true);
    try {
      const next = await api.rotateInvite();
      setInfo(next);
      setCopied(false);
    } catch (e) {
      window.alert(e.message || 'Не удалось обновить ссылку');
    } finally {
      setRotating(false);
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(inviteText)}`;
  const tgHref = `https://t.me/share/url?text=${encodeURIComponent(inviteText)}`;

  const referralCount = info?.referral_count ?? 0;
  const goal = 3;
  const pct  = Math.min(referralCount / goal * 100, 100);

  const overlay = { position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const panel   = { background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,420px)',
    boxShadow:'0 24px 64px rgba(0,0,0,.55)',
    border:'1px solid rgba(249,240,240,.13)',overflow:'hidden' };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{padding:'22px 24px 18px',display:'flex',alignItems:'center',gap:12,
          borderBottom:'1px solid rgba(249,240,240,.1)'}}>
          <span style={{fontSize:22}}>🎉</span>
          <div>
            <div style={{color:'#F9F0F0',fontSize:17,fontWeight:700}}>Пригласить друга</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13}}>3 друга = Премиум на 3 месяца</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',
            color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'22px 24px',display:'flex',flexDirection:'column',gap:20}}>
          {/* Invite link */}
          <div>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:12,marginBottom:8,
              textTransform:'uppercase',letterSpacing:.5}}>Ваша персональная ссылка</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{flex:1,background:'rgba(249,240,240,.07)',borderRadius:12,
                padding:'11px 14px',color:'rgba(200,180,255,.9)',fontSize:13,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                border:'1px solid rgba(249,240,240,.12)',userSelect:'all'}}>
                {inviteLink}
              </div>
              <button onClick={copy}
                style={{padding:'11px 16px',borderRadius:12,whiteSpace:'nowrap',
                  background: copied ? 'rgba(60,180,100,.7)' : 'rgba(95, 64, 128,.7)',
                  border:'none',color:'#F9F0F0',fontSize:13,fontWeight:600,cursor:'pointer',
                  transition:'background .2s',flexShrink:0}}>
                {copied ? '✓ Скопировано' : 'Копировать'}
              </button>
            </div>
            <button
              type="button"
              onClick={rotateLink}
              disabled={rotating || !info}
              style={{
                marginTop: 10, width: '100%', padding: '10px 14px', borderRadius: 12,
                background: 'rgba(249,240,240,.06)', border: '1px solid rgba(249,240,240,.14)',
                color: 'rgba(235,228,245,.82)', fontSize: 13, fontWeight: 600,
                cursor: rotating || !info ? 'wait' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Icon name="refresh" size={15}/>
              {rotating ? 'Обновляем…' : 'Обновить ссылку'}
            </button>
            <div style={{ color: 'rgba(249,240,240,.42)', fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>
              Если ссылка ушла не туда — обновите её. Старая перестанет открывать регистрацию.
            </div>
          </div>

          {/* Share buttons */}
          <div>
            <div style={{color:'rgba(249,240,240,.5)',fontSize:12,marginBottom:10,
              textTransform:'uppercase',letterSpacing:.5}}>Поделиться</div>
            <div style={{display:'flex',gap:10}}>
              <a href={waHref} target="_blank" rel="noopener noreferrer"
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  padding:'13px 0',borderRadius:14,textDecoration:'none',
                  background:'rgba(37,211,102,.18)',border:'1px solid rgba(37,211,102,.3)',
                  color:'rgba(100,240,140,.9)',fontSize:14,fontWeight:600,
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(37,211,102,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(37,211,102,.18)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
              <a href={tgHref} target="_blank" rel="noopener noreferrer"
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  padding:'13px 0',borderRadius:14,textDecoration:'none',
                  background:'rgba(39,169,244,.18)',border:'1px solid rgba(39,169,244,.3)',
                  color:'rgba(100,200,255,.9)',fontSize:14,fontWeight:600,
                  transition:'background .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(39,169,244,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(39,169,244,.18)'}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Telegram
              </a>
            </div>
          </div>

          {/* Referral progress */}
          <div style={{background:'rgba(249,240,240,.05)',borderRadius:16,padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{color:'#F9F0F0',fontSize:14,fontWeight:600}}>Прогресс до Премиума</span>
              <span style={{color: referralCount >= goal ? 'rgba(100,240,140,.9)' : 'rgba(200,170,255,.8)',
                fontSize:14,fontWeight:700}}>
                {referralCount} / {goal}
              </span>
            </div>
            <div style={{height:8,background:'rgba(249,240,240,.1)',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,transition:'width .5s ease',
                background: pct >= 100
                  ? 'linear-gradient(90deg, rgba(60,200,100,.8), rgba(100,240,140,.9))'
                  : 'linear-gradient(90deg, rgba(95, 64, 128,.8), rgba(180,120,255,.9))',
                borderRadius:4}}/>
            </div>
            <div style={{color:'rgba(249,240,240,.4)',fontSize:12,marginTop:8}}>
              {referralCount >= goal
                ? '🎉 Вы получите Премиум аккаунт на 3 месяца!'
                : `Пригласите ещё ${goal - referralCount} ${goal - referralCount === 1 ? 'друга' : 'друзей'} — получите Премиум на 3 месяца`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InviteModal;
