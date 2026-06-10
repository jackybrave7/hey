import { useState, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import HeyLogo from '../HeyLogo';
import MoodEmoji from './MoodEmoji';
import Icon from '../Icon';

export function MomentPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  // Пока тянем /me, не делаем preliminary redirect — иначе залогиненный
  // юзер случайно увидит публичную версию на доли секунды.
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', display:'flex',
      alignItems:'center', justifyContent:'center', color:'rgba(249,240,240,.4)' }}>
      Загрузка…
    </div>
  );
  // Залогиненные: открываем момент поверх ленты Моментов.
  if (user) return <Navigate to="/main" state={{ openMomentId: id }} replace />;
  // Анонимные: показываем standalone-страницу с моментом и CTA на
  // регистрацию. Реакции и переход в чат отключены — заходи в HEY.
  return <MomentPageLegacy key={id}/>;
}

function MomentPageLegacy() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myReaction, setMyReaction] = useState(null);
  const [reacting, setReacting] = useState(false);

  useEffect(() => {
    api.getMoment(id)
      .then(m => { setMoment(m); setMyReaction(m.myReaction || null); })
      .catch(() => setMoment(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    // Считаем просмотр только когда юзер залогинен и это не его момент
    if (moment && user && moment.user_id !== user.id) {
      api.viewMoment(moment.id).catch(() => {});
    }
  }, [moment?.id, user?.id]);

  async function handleReact(reaction) {
    if (reacting || !moment) return;
    setReacting(true);
    try {
      if (myReaction === reaction) {
        await api.unreactMoment(moment.id);
        setMyReaction(null);
      } else {
        const res = await api.reactMoment(moment.id, reaction);
        setMyReaction(reaction);
        if (reaction === 'talk' && res.chatId) {
          nav(`/chat/${res.chatId}`);
          return;
        }
      }
      const fresh = await api.getMoment(moment.id);
      setMoment(fresh);
    } catch {}
    setReacting(false);
  }

  async function handleChat() {
    try {
      const conv = await api.openConversation(moment.user_id);
      nav(`/chat/${conv.id}`);
    } catch {}
  }

  function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleDateString('ru', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }

  const isMine = moment?.user_id === user?.id;
  const REACTIONS = [
    { id: 'see',      label: 'Вижу',       iconName: 'eye' },
    { id: 'resonate', label: 'Резонирует', iconName: 'sparkle' },
    { id: 'talk',     label: 'Поговорить', iconName: 'chat' },
  ];

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', display:'flex',
      alignItems:'center', justifyContent:'center', color:'rgba(249,240,240,.4)', fontSize:14 }}>
      Загрузка…
    </div>
  );

  if (!moment) return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ fontSize:48 }}>🤷</div>
      <div style={{ color:'#F9F0F0', fontSize:18, fontWeight:700 }}>Момент не найден</div>
      <div style={{ color:'rgba(249,240,240,.4)', fontSize:13 }}>Он мог быть удалён или перенесён в архив</div>
      <button onClick={() => nav('/main')}
        style={{ padding:'10px 24px', borderRadius:50, background:'rgba(249,240,240,.12)',
          border:'1px solid rgba(249,240,240,.2)', color:'#F9F0F0', fontSize:14, cursor:'pointer' }}>
        На главную
      </button>
    </div>
  );

  const hasMedia = !!moment.media_url;

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', paddingBottom:40 }}>
      {/* Header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--topbar)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(249,240,240,.06)',
      }}>
        <div style={{ maxWidth:680, margin:'0 auto', padding:'14px 20px',
          display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => user ? nav(-1) : nav('/')} style={{
            background:'none', border:'none', color:'#F9F0F0', fontSize:24,
            cursor:'pointer', lineHeight:1, padding:'0 6px', opacity:.7 }}>‹</button>
          <div style={{ color:'#F9F0F0', fontSize:18, fontWeight:700, flex:1 }}>
            {user ? 'Момент' : '✦ HEY · Момент'}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 20px 0' }}>
        <div style={{
          background:'rgba(22,15,50,.98)', borderRadius:24,
          border:'1px solid rgba(249,240,240,.1)',
          overflow:'hidden',
          boxShadow:'0 8px 48px rgba(0,0,0,.4)',
        }}>
          {/* Media */}
          {hasMedia && (
            <div style={{ background:'#0a0518' }}>
              {moment.media_type === 'image' && (
                <img src={moment.media_url} alt=""
                  style={{ width:'100%', maxHeight:'55vw', objectFit:'contain', display:'block' }}/>
              )}
              {moment.media_type === 'video' && (
                <video src={moment.media_url} controls
                  style={{ width:'100%', display:'block', background:'#000' }}/>
              )}
              {moment.media_type === 'audio' && (
                <div style={{ padding:'28px 22px 24px', display:'flex', flexDirection:'column', gap:14,
                  background:'linear-gradient(135deg,#1a0a38,#2a1858)' }}>
                  <div style={{ fontSize:34, textAlign:'center', opacity:.9 }}>🎵</div>
                  <AudioPlayer url={moment.media_url}
                    duration={moment.media_duration} wide={true}/>
                </div>
              )}
            </div>
          )}

          <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
            {/* Author */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:40, height:40, borderRadius:'50%', flexShrink:0,
                background:'rgba(180,140,220,.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, color:'#F9F0F0', fontWeight:600,
                overflow:'hidden',
              }}>
                {moment.author_avatar
                  ? <img src={moment.author_avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : (moment.author_name||'?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color:'#F9F0F0', fontSize:15, fontWeight:600 }}>{moment.author_name}</div>
                <div style={{ color:'rgba(249,240,240,.4)', fontSize:12 }}>
                  {fmtDate(moment.created_at)}
                  {moment.edited && <span style={{ marginLeft:6, opacity:.6 }}>· редактировалось</span>}
                </div>
              </div>
            </div>

            {/* Text */}
            <div style={{ color:'rgba(249,240,240,.9)', fontSize:15, lineHeight:1.7,
              whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
              <TextWithLinks text={moment.text}/>
            </div>

            {/* Auto tags — под описанием */}
            {moment.auto_tags?.length > 0 && (
              <div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {moment.auto_tags.map(tag => (
                    <span key={tag} style={{
                      border:'1px dashed rgba(249,240,240,.25)', borderRadius:20,
                      padding:'3px 10px', fontSize:12, color:'rgba(249,240,240,.5)',
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{ color:'rgba(249,240,240,.25)', fontSize:10, marginTop:4 }}>подобрано автоматически</div>
              </div>
            )}

            {/* Search flag */}
            {moment.is_search && (
              <div style={{ background:'rgba(60,140,100,.18)', border:'1px solid rgba(80,180,120,.25)',
                borderRadius:12, padding:'10px 14px', color:'rgba(120,220,160,.9)', fontSize:13 }}>
                🤝 Автор ищет людей, идеи или возможности
              </div>
            )}

            {/* Analytics / Reactions */}
            {isMine ? (
              <div style={{ background:'rgba(249,240,240,.06)', borderRadius:14, padding:'12px 16px',
                display:'flex', gap:20 }}>
                <span style={{ color:'rgba(249,240,240,.6)', fontSize:14, display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="eye"     size={14}/>{moment.views || 0}</span>
                <span style={{ color:'rgba(249,240,240,.6)', fontSize:14, display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="sparkle" size={14}/>{moment.stats?.resonate || 0} резонирует</span>
                <span style={{ color:'rgba(249,240,240,.6)', fontSize:14, display:'inline-flex', alignItems:'center', gap:6 }}><Icon name="chat"    size={14}/>{moment.stats?.talk || 0}</span>
              </div>
            ) : user ? (
              <>
                <div>
                  <div style={{ color:'rgba(249,240,240,.45)', fontSize:12, marginBottom:10,
                    textTransform:'uppercase', letterSpacing:.5 }}>Отклик</div>
                  <div style={{ display:'flex', gap:8 }}>
                    {REACTIONS.map(r => (
                      <button key={r.id} onClick={() => handleReact(r.id)}
                        style={{
                          flex:1, padding:'11px 0', borderRadius:14, fontSize:13, fontWeight:600,
                          cursor:'pointer', transition:'all .18s',
                          background: myReaction===r.id ? 'rgba(95, 64, 128,.7)' : 'rgba(249,240,240,.08)',
                          border: myReaction===r.id ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(249,240,240,.12)',
                          color: myReaction===r.id ? '#F9F0F0' : 'rgba(249,240,240,.7)',
                        }}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}><Icon name={r.iconName} size={17}/></div>
                        <div style={{ fontSize:11, marginTop:2 }}>{r.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleChat}
                  style={{ width:'100%', padding:'13px', borderRadius:14,
                    background:'rgba(95, 64, 128,.75)', border:'none',
                    color:'#F9F0F0', fontSize:15, fontWeight:600, cursor:'pointer', marginTop:4 }}>
                  <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8}}><Icon name="chat" size={16}/> Написать {moment.author_name?.split(' ')[0]}</span>
                </button>
              </>
            ) : (
              /* Аноним — приглашение залогиниться/зарегистрироваться */
              <div style={{
                background:'linear-gradient(135deg, rgba(95, 64, 128,.18), rgba(180,140,220,.08))',
                border:'1px solid rgba(180,140,220,.3)',
                borderRadius:16, padding:'18px 18px',
                display:'flex', flexDirection:'column', gap:12,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <HeyLogo size={24} color="#F9F0F0" />
                  <div>
                    <div style={{color:'#F9F0F0',fontSize:15,fontWeight:700,marginBottom:2}}>
                      Это HEY — приватный мессенджер
                    </div>
                    <div style={{color:'rgba(249,240,240,.6)',fontSize:13,lineHeight:1.45}}>
                      Войди, чтобы поддержать момент и написать автору
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button onClick={() => nav('/login')}
                    style={{
                      flex:1,padding:'12px',borderRadius:12,
                      background:'rgba(95, 64, 128,.85)',border:'none',color:'#F9F0F0',
                      fontSize:14,fontWeight:700,cursor:'pointer',
                    }}>
                    Войти
                  </button>
                  <button onClick={() => nav('/register')}
                    style={{
                      flex:1,padding:'12px',borderRadius:12,
                      background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.15)',
                      color:'#F9F0F0',fontSize:14,fontWeight:600,cursor:'pointer',
                    }}>
                    Регистрация
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
