import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import { BioWithLinks } from '../shared/profileUi';
import AchievementBadges from '../super/AchievementBadges';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import MomentCard from '../moments/MomentCard';
import Icon from '../Icon';
import HeyLogo from '../HeyLogo';

export function PublicProfileScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [momentPopupIdx, setMomentPopupIdx] = useState(null);

  useEffect(() => {
    api.getUserProfile(id)
      .then(p => { setProfile(p); setAdded(p.is_contact); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddContact() {
    if (!profile) return;
    setAdding(true);
    try {
      await api.addContact({ userId: profile.id });
      setAdded(true);
    } catch {}
    setAdding(false);
  }

  async function openChat() {
    try {
      const { id: convId } = await api.openConversation(profile.id);
      nav(`/chat/${convId}`);
    } catch {}
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',
      alignItems:'center',justifyContent:'center',color:'rgba(249,240,240,.4)',fontSize:14}}>
      Загрузка…
    </div>
  );

  if (notFound) return (
    <div style={{minHeight:'100vh',background:'var(--grad)',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:16}}>
      <div style={{fontSize:48}}>🤷</div>
      <div style={{color:'#F9F0F0',fontSize:18,fontWeight:700}}>Профиль не найден</div>
      <button onClick={() => nav(-1)}
        style={{padding:'10px 24px',borderRadius:50,background:'rgba(249,240,240,.12)',
          border:'1px solid rgba(249,240,240,.2)',color:'#F9F0F0',fontSize:14,cursor:'pointer'}}>
        Назад
      </button>
    </div>
  );

  const isOnline = profile?.presence?.online;
  const lastSeen = profile?.presence?.last_seen;
  const isMe = profile?.id === me?.id;

  function fmtLastSeen(ts) {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts * 1000) / 60000);
    if (diff < 1)  return 'только что';
    if (diff < 60) return `${diff} мин. назад`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h} ч. назад`;
    return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'short' });
  }

  const moment = profile?.active_moment;

  return (
    <div style={{minHeight:'100vh',background:'var(--grad)',paddingBottom:60}}>
      {/* Header */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(249,240,240,.06)',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'14px 20px',
          display:'flex',alignItems:'center',gap:12}}>
          <button onClick={() => nav(-1)} style={{
            background:'none',border:'none',color:'#F9F0F0',fontSize:24,
            cursor:'pointer',lineHeight:1,padding:'0 6px',opacity:.7}}>‹</button>
          <div style={{color:'#F9F0F0',fontSize:18,fontWeight:700,flex:1}}>{profile?.name}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',
              background: isOnline ? '#4ade80' : 'rgba(249,240,240,.25)'}}/>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:12,
              display:'flex',alignItems:'center',gap:4}}
              title={!me?.is_super && !isOnline ? 'Точное время визита видно в ✦ Super' : ''}>
              <span>
                {isOnline
                  ? 'онлайн'
                  : me?.is_super
                    ? (lastSeen ? fmtLastSeen(lastSeen) : 'не в сети')
                    : 'не в сети'}
              </span>
              {!isOnline && me?.is_super && lastSeen && (
                <span style={{
                  background:'rgba(180,140,255,.18)',
                  border:'1px solid rgba(180,140,255,.35)',
                  borderRadius:8,padding:'1px 5px',
                  display:'inline-flex',alignItems:'center',justifyContent:'center',
                  width:14,height:14,
                }}><HeyLogo size={9} color="rgba(220,200,255,.85)" /></span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',padding:'28px 24px 0'}}>

        {/* Avatar + name */}
        <div style={{display:'flex',gap:20,alignItems:'center',marginBottom:28}}>
          <div style={{
            width:84,height:84,borderRadius:'50%',flexShrink:0,
            background:'rgba(180,140,220,.35)',
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:36,overflow:'hidden',
            boxShadow:'0 4px 20px rgba(95, 64, 128,.3)',
          }}>
            {profile?.avatar
              ? <img src={profile.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (profile?.name?.[0] || '?')}
          </div>
          <div>
            <div style={{color:'#F9F0F0',fontSize:22,fontWeight:800,letterSpacing:-.3}}>{profile?.name}</div>
            {profile?.created_at && (
              <div style={{color:'rgba(249,240,240,.35)',fontSize:12,marginTop:4}}>
                В HEY с {new Date(profile.created_at * 1000).toLocaleDateString('ru',{month:'long',year:'numeric'})}
              </div>
            )}
            <AchievementBadges achievements={profile?.achievements} />
          </div>
        </div>

        {/* Bio — описание */}
        {profile?.bio && (
          <div style={{
            background:'rgba(249,240,240,.05)', borderRadius:14,
            border:'1px solid rgba(249,240,240,.08)', padding:'12px 16px',
            color:'rgba(249,240,240,.75)', fontSize:14, lineHeight:1.6,
            marginBottom:20,wordBreak:'break-word',whiteSpace:'pre-wrap',
          }}>
            <BioWithLinks text={profile.bio}/>
          </div>
        )}

        {/* Actions */}
        {!isMe && (
          <div style={{display:'flex',gap:10,marginBottom:28}}>
            <button onClick={openChat} style={{
              flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:700,cursor:'pointer',
              background:'rgba(95, 64, 128,.8)',border:'1px solid rgba(180,140,220,.4)',
              color:'#F9F0F0',transition:'all .18s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(140,110,220,.9)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(95, 64, 128,.8)'}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="chat" size={16}/> Написать</span>
            </button>
            {!added && (
              <button onClick={handleAddContact} disabled={adding} style={{
                flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:600,cursor:'pointer',
                background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.15)',
                color:'#F9F0F0',transition:'all .18s',
                opacity: adding ? .6 : 1,
              }}>
                {adding ? '…' : '➕ Добавить'}
              </button>
            )}
            {added && (
              <div style={{
                flex:1,padding:'12px',borderRadius:14,fontSize:14,fontWeight:600,
                background:'rgba(46,204,113,.15)',border:'1px solid rgba(46,204,113,.35)',
                color:'rgba(180,255,200,.8)',textAlign:'center',
              }}>✓ В контактах</div>
            )}
          </div>
        )}

        {/* Active moments — карточки квадратные как в ленте */}
        {(() => {
          const activeMoments = profile?.active_moments || (moment ? [moment] : []);
          if (activeMoments.length === 0) {
            return (
              <div style={{
                background:'rgba(249,240,240,.04)',borderRadius:16,
                padding:'24px',textAlign:'center',
                border:'2px dashed rgba(249,240,240,.1)',
                color:'rgba(249,240,240,.3)',fontSize:13,marginBottom:24,
              }}>
                Нет активного момента
              </div>
            );
          }
          return (
            <div style={{marginBottom:24}}>
              <div style={{color:'rgba(249,240,240,.4)',fontSize:11,textTransform:'uppercase',
                letterSpacing:.8,marginBottom:12}}>
                {activeMoments.length === 1 ? 'Активный момент' : `Активные моменты · ${activeMoments.length}`}
              </div>
              {/* Grid: 1 — на всю ширину; 2-3 — по две в ряд (для Super) */}
              <div style={{
                display:'grid',
                gridTemplateColumns: activeMoments.length === 1
                  ? 'minmax(0, 240px)'
                  : 'repeat(auto-fill, minmax(160px, 1fr))',
                gap:12,
              }}>
                {activeMoments.map((m, idx) => {
                  // Готовим объект для MomentCard — добавляем author_* поля из профиля
                  const enriched = {
                    ...m,
                    author_name:   profile.name,
                    author_avatar: profile.avatar,
                    author_is_super: profile.is_super,
                    user_id: profile.id,
                  };
                  return (
                    <div key={m.id} onClick={() => setMomentPopupIdx(idx)}>
                      <MomentCard
                        moment={enriched}
                        isMine={false}
                        onClick={() => setMomentPopupIdx(idx)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Moment detail popup */}
      {momentPopupIdx !== null && (() => {
        const list = (profile?.active_moments || (moment ? [moment] : []))
          .map(m => ({
            ...m,
            author_name: profile?.name,
            author_avatar: profile?.avatar,
            author_is_super: profile?.is_super,
            user_id: profile?.id,
          }));
        if (!list.length) return null;
        return (
          <MomentDetailPopup
            moments={list}
            initialIndex={momentPopupIdx}
            currentUser={me}
            onClose={() => setMomentPopupIdx(null)}
            onEdit={() => {}}
            onArchive={() => {}}
            onDelete={() => {}}
          />
        );
      })()}
    </div>
  );
}
