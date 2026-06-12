import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, socket } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import ChatContextMenu, { AnchoredContextMenu } from '../chat/ChatContextMenu';
import { renderPreviewWithEmoji } from '../chat/chatRender';
import Highlight from '../shared/Highlight';
import Icon from '../Icon';
import { fmtTime } from '../../lib/formatTime';

export function ConversationsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [convs, setConvs] = useState([]);
  // Popup for incoming request — shows requester's profile card
  const [requestCard, setRequestCard] = useState(null); // { conv, profile } | null
  const [requestCardLoading, setRequestCardLoading] = useState(false);
  const [requestCardAction, setRequestCardAction] = useState(null); // 'accept' | 'decline' | null
  const [showArchive, setShowArchive] = useState(false);

  const reload = () => api.getConversations().then(setConvs).catch(console.error);

  useEffect(() => { reload(); }, []);
  useEffect(() => socket.on('message:new', ({ message }) => {
    setConvs(prev => {
      const exists = prev.find(c => c.id === message.conversationId);
      if (!exists) { reload(); return prev; }
      return prev
        .map(c => {
          if (c.id !== message.conversationId) return c;
          if (c.is_request && c.request_from !== user?.id) return c; // don't update locked request
          return {
            ...c,
            last_text: (() => {
              if (message.text) return message.text;
              // Системное событие группы — генерим читаемое превью.
              const ev = message.attachment?.system_event;
              if (ev?.type === 'member_left') {
                return `${ev.userName || 'Участник'} покинул(а) группу`;
              }
              if (ev?.type === 'member_removed') {
                return ev.byUserName
                  ? `${ev.byUserName} удалил(а) ${ev.userName || 'участника'}`
                  : `${ev.userName || 'Участник'} удалён(а) из группы`;
              }
              return null;
            })(),
            last_at: message.created_at,
            last_sender_id: message.sender_id,
            last_sender_name: message.sender_name || c.last_sender_name || null,
            unread_count: message.sender_id === user?.id ? c.unread_count : c.unread_count + 1,
          };
        })
        .sort((a, b) => b.last_at - a.last_at);
    });
  }), [user?.id]);
  // Удалённые чаты (другой стороной или админом группы) убираем из списка
  useEffect(() => socket.on('conversation:deleted', ({ conversationId }) => {
    setConvs(prev => prev.filter(c => c.id !== conversationId));
  }), []);
  // Приглашения в группы — могут прилететь как новые «чаты» в списке
  useEffect(() => socket.on('group:invited', () => { reload(); }), []);
  useEffect(() => socket.on('group:invite_accepted', () => { reload(); }), []);
  useEffect(() => socket.on('group:invite_declined', ({ conversationId }) => {
    setConvs(prev => prev.filter(c => c.id !== conversationId));
  }), []);
  useEffect(() => socket.on('group:member_removed', ({ conversationId, userId, kicked_by_name, group_name }) => {
    if (userId === user?.id) {
      setConvs(prev => prev.filter(c => c.id !== conversationId));
      // Сервер прокидывает имя кикнувшего + название группы — показываем
      // тост, иначе чат просто молча исчезает из списка.
      if (kicked_by_name) {
        heyToast(`${kicked_by_name} удалил вас из группы «${group_name || ''}»`, 'info');
      }
    }
  }), [user?.id]);

  // ── Поиск по чатам ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false); // показывать ли инпут поиска
  const [searchMsgs, setSearchMsgs] = useState(null); // null | array
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchMsgs(null); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try { setSearchMsgs(await api.searchAllMessages(q)); }
      catch { setSearchMsgs([]); }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Локальный фильтр по имени / телефону / тексту последнего сообщения
  const q = search.trim().toLowerCase();
  const matchConv = (c) => {
    if (!q) return true;
    return (
      (c.name      || '').toLowerCase().includes(q) ||
      (c.last_text || '').toLowerCase().includes(q)
    );
  };

  const normalConvs  = convs.filter(c => !c.is_request).filter(matchConv);
  const requestConvs = convs.filter(c => c.is_request && c.request_from !== user?.id).filter(matchConv);
  const pinnedConvs  = normalConvs.filter(c => c.is_pinned);
  const regularConvs = normalConvs.filter(c => !c.is_pinned);
  const [pinToast, setPinToast] = useState(null);

  function flashPinToast(payload) {
    setPinToast(payload);
    setTimeout(() => setPinToast(null), 2500);
  }

  // Карта convId → conv для быстрого доступа из поисковых результатов
  const convsById = useMemo(() => Object.fromEntries(convs.map(c => [c.id, c])), [convs]);

  async function archive(c) {
    try {
      await api.archiveConversation(c.id);
      setConvs(prev => prev.filter(x => x.id !== c.id));
      flashPinToast({ text: 'В архиве', iconName: 'archive' });
    } catch (e) { heyToast(e.message || 'Не удалось', 'error'); }
  }

  async function togglePin(c) {
    const wasPinned = c.is_pinned;
    try {
      if (wasPinned) {
        await api.unpinConversation(c.id);
        setConvs(prev => {
          const updated = prev.map(x => x.id === c.id ? { ...x, is_pinned: false } : x);
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return b.last_at - a.last_at;
          });
        });
        flashPinToast({ text: 'Откреплено', iconName: 'unpin' });
      } else {
        await api.pinConversation(c.id);
        setConvs(prev => {
          const updated = prev.map(x => x.id === c.id ? { ...x, is_pinned: true } : x);
          return updated.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return b.last_at - a.last_at;
          });
        });
        flashPinToast({ text: 'Закреплено', iconName: 'pin' });
      }
    } catch(err) {
      flashPinToast({ text: err.message || 'Ошибка' });
    }
  }

  function ConvRow({ c, isRequest }) {
    const [convMenu, setConvMenu] = useState(null); // { left, top } | null
    const longPressTimer = useRef(null);
    const longPressFired = useRef(false);
    const canMenu = !isRequest && !c.is_group_invite;

    function openConvMenu(x, y) {
      setConvMenu({ left: x, top: y });
    }

    async function handleRowClick() {
      if (isRequest) {
        if (!c.partner_id) { nav(`/chat/${c.id}`); return; }
        setRequestCardLoading(true);
        try {
          const profile = await api.getUserProfile(c.partner_id);
          setRequestCard({ conv: c, profile });
        } catch {
          nav(`/chat/${c.id}`);
        } finally {
          setRequestCardLoading(false);
        }
      } else {
        setConvs(prev => prev.map(x => x.id === c.id ? { ...x, unread_count: 0 } : x));
        nav(`/chat/${c.id}`);
      }
    }

    return (
      <>
      <div
        onClick={(e) => {
          if (longPressFired.current) {
            longPressFired.current = false;
            e.preventDefault();
            return;
          }
          handleRowClick();
        }}
        onContextMenu={(e) => {
          if (!canMenu) return;
          e.preventDefault();
          openConvMenu(e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          if (!canMenu || e.pointerType === 'mouse') return;
          longPressFired.current = false;
          const x = e.clientX, y = e.clientY;
          longPressTimer.current = setTimeout(() => {
            longPressFired.current = true;
            openConvMenu(x, y);
          }, 500);
        }}
        onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
        onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
        onPointerCancel={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 20px',
          cursor:'pointer',borderBottom:'1px solid rgba(249,240,240,.06)',transition:'background .12s',
          background: c.is_pinned ? 'rgba(95, 64, 128,.06)' : 'transparent',
          WebkitTouchCallout: 'none', userSelect: 'none'}}
        onMouseEnter={e=>{ e.currentTarget.style.background = c.is_pinned ? 'rgba(95, 64, 128,.1)' : 'rgba(249,240,240,.04)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.background = c.is_pinned ? 'rgba(95, 64, 128,.06)' : 'transparent'; }}>
        {c.type === 'monolog' ? (
          <div style={{width:52,height:52,borderRadius:14,flexShrink:0,
            background:'linear-gradient(135deg,#5F4080,#8060c0)',
            display:'flex',alignItems:'center',justifyContent:'center',color:'#F9F0F0'}}>
            <Icon name="edit" size={22}/>
          </div>
        ) : c.type === 'group' ? (
          <div style={{width:52,height:52,borderRadius:14,flexShrink:0,overflow:'hidden',
            background: (c.icon && (c.icon.startsWith('http') || c.icon.startsWith('/') || c.icon.startsWith('data:')))
              ? '#0a0518' : 'rgba(200,160,210,.35)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,color:'#F9F0F0'}}>
            {(c.icon && (c.icon.startsWith('http') || c.icon.startsWith('/') || c.icon.startsWith('data:')))
              ? <img src={c.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : (c.icon || <Icon name="users" size={22}/>)}
          </div>
        ) : (
          <AvatarDisplay avatar={c.avatar} name={c.name} size={52}/>
        )}
        <div style={{flex:1,minWidth:0}}>
          <div style={{color:'#F9F0F0',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
            {c.name||'Диалог'}
            {c.is_pinned && <span style={{opacity:.6,display:'inline-flex',alignItems:'center'}}><Icon name="pin" size={11}/></span>}
          </div>
          {isRequest ? (
            <div style={{color:'rgba(180,140,220,.8)',fontSize:13}}>хочет написать вам</div>
          ) : c.is_group_invite ? (
            <div style={{color:'rgba(220,190,255,1)',fontSize:13,fontWeight:500,whiteSpace:'nowrap',
              overflow:'hidden',textOverflow:'ellipsis',display:'flex',alignItems:'center',gap:6}}>
              {c.group_invited_by_id && (
                <AvatarDisplay avatar={c.group_invited_by_avatar} name={c.group_invited_by_name} size={18} fontSize={9}/>
              )}
              <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>
                {c.group_invited_by_name
                  ? `${c.group_invited_by_name} приглашает в группу`
                  : 'приглашение в группу'}
              </span>
            </div>
          ) : c.partner_is_deleted ? (
            <div style={{color:'rgba(249,240,240,.3)',fontSize:13,fontStyle:'italic'}}>
              Пользователь удалил аккаунт
            </div>
          ) : (
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {(() => {
                // Префикс отправителя в превью списка чатов:
                //  • своё сообщение — «Вы: »
                //  • в группе — «Имя: » (без этого непонятно кто написал)
                //  • в директе — без префикса
                //  • системные сообщения (HEY-заведующий, system_event плашки) — без префикса
                let prefix = '';
                if (c.last_sender_id === user?.id) prefix = 'Вы: ';
                else if (c.type === 'group' && c.last_sender_name &&
                         c.last_sender_id && !String(c.last_sender_id).startsWith('system_')) {
                  prefix = c.last_sender_name + ': ';
                }
                return <>{prefix}{c.last_text ? renderPreviewWithEmoji(c.last_text) : '…'}</>;
              })()}
            </div>
          )}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
          {isRequest ? (
            <div style={{
              background:'rgba(95, 64, 128,.5)',border:'1px solid rgba(180,140,220,.4)',
              borderRadius:20,padding:'3px 10px',fontSize:11,color:'rgba(220,200,255,.9)',fontWeight:600,
            }}>Запрос</div>
          ) : c.is_group_invite ? (
            <div style={{
              background:'rgba(110,70,200,.85)',border:'1px solid rgba(200,160,240,.6)',
              borderRadius:20,padding:'3px 10px',fontSize:11,color:'#F9F0F0',fontWeight:700,
              boxShadow:'0 2px 8px rgba(80,40,180,.3)',
              display:'inline-flex',alignItems:'center',gap:5,
            }}><Icon name="mail" size={12}/> Приглашение</div>
          ) : (
            <>
              {c.last_at ? (
                <div style={{color:'rgba(249,240,240,.35)',fontSize:11}}>{fmtTime(c.last_at)}</div>
              ) : null}
              {c.unread_count > 0 && (
                <div style={{
                  minWidth:20,height:20,borderRadius:10,padding:'0 6px',
                  background:'rgba(95, 64, 128,.9)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:11,color:'#F9F0F0',fontWeight:700,
                }}>
                  {c.unread_count > 99 ? '99+' : c.unread_count}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {convMenu && (
        <AnchoredContextMenu
          open
          position={{ left: convMenu.left, top: convMenu.top }}
          onClose={() => setConvMenu(null)}
          items={[
            {
              label: c.is_pinned ? 'Открепить' : 'Закрепить',
              iconName: 'pin',
              onClick: () => togglePin(c),
            },
            {
              label: 'В архив',
              iconName: 'archive',
              onClick: () => archive(c),
            },
          ]}
        />
      )}
      </>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad)', paddingBottom:80 }}>
      {/* Sticky header */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:'var(--topbar)',backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(249,240,240,.06)',
      }}>
        <div style={{maxWidth:680,margin:'0 auto',padding:'16px 20px 12px',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{color:'#F9F0F0',fontSize:20,fontWeight:800,letterSpacing:-.3,display:'flex',alignItems:'center',gap:8}}>
            <Icon name="chat" size={20} /> Чаты
          </div>
          <ChatContextMenu
            ariaLabel="Меню чатов"
            items={[
              { label:'Поиск по чатам', iconName:'search', onClick: () => {
                setSearchOpen(true);
                setTimeout(() => document.getElementById('hey-chats-search')?.focus(), 50);
              } },
              { label:'Новая группа', icon:<Icon name="users" size={15}/>, onClick: () => nav('/groups/new') },
              { label:'Архив', iconName:'archive', onClick: () => setShowArchive(true) },
            ]}
            trigger={
              <div className="topbar-dots">
                {[0,1,2].map(i => <div key={i} className="topbar-dot"/>)}
              </div>
            }
          />
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',width:'100%'}}>

        {/* Поиск по чатам и сообщениям — показывается по клику в три точки */}
        {searchOpen && (
        <div style={{padding:'12px 20px',position:'relative'}}>
          <input
            id="hey-chats-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по чатам, сообщениям"
            onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }}
            style={{
              width:'100%', boxSizing:'border-box',
              background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.14)',
              borderRadius:50, padding:'11px 70px 11px 18px',
              color:'#F9F0F0', fontSize:14, fontFamily:'inherit', outline:'none',
              transition:'border-color .15s',
            }}
            onFocus={e=>e.target.style.borderColor='rgba(180,140,220,.55)'}
            onBlur={e=>e.target.style.borderColor='rgba(249,240,240,.14)'}
          />
          {/* Кнопка закрыть поиск целиком */}
          <button onClick={() => { setSearch(''); setSearchOpen(false); }}
            title="Закрыть поиск"
            style={{
              position:'absolute',right:30,top:'50%',transform:'translateY(-50%)',
              background:'rgba(249,240,240,.08)',border:'1px solid rgba(249,240,240,.12)',
              color:'rgba(249,240,240,.7)',fontSize:13,cursor:'pointer',
              width:26,height:26,borderRadius:'50%',
              display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0,
            }}>
            ✕
          </button>
          {false && search && (
            <button onClick={() => setSearch('')}
              style={{
                position:'absolute',right:30,top:'50%',transform:'translateY(-50%)',
                width:24,height:24,borderRadius:'50%',background:'rgba(249,240,240,.1)',
                border:'none',color:'rgba(249,240,240,.7)',fontSize:14,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,padding:0,
              }}>✕</button>
          )}
        </div>
        )}

        {/* Подзаголовок про поиск по сообщениям */}
        {searchOpen && search.trim().length >= 2 && (
          <>
            {searchLoading && (
              <div style={{color:'rgba(249,240,240,.4)',fontSize:12,padding:'4px 22px'}}>
                Ищу в сообщениях…
              </div>
            )}

            {/* Найденные сообщения */}
            {!searchLoading && searchMsgs && searchMsgs.length > 0 && (
              <>
                <div style={{
                  padding:'10px 22px 4px',color:'rgba(249,240,240,.5)',
                  fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,
                }}>
                  В сообщениях · {searchMsgs.length}
                </div>
                {searchMsgs.slice(0, 20).map(m => {
                  const c = convsById[m.conversation_id];
                  if (!c) return null;
                  return (
                    <div key={m.id} onClick={() => nav(`/chat/${c.id}`)}
                      style={{
                        display:'flex',alignItems:'flex-start',gap:12,padding:'10px 20px',
                        cursor:'pointer',borderBottom:'1px solid rgba(249,240,240,.04)',
                        transition:'background .12s',
                      }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.04)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{fontSize:18,marginTop:2}}>💬</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{color:'rgba(220,200,255,.95)',fontSize:13,fontWeight:600,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {c.name || 'Диалог'}
                          <span style={{color:'rgba(249,240,240,.4)',fontWeight:400,marginLeft:8,fontSize:11}}>
                            · {new Date(m.created_at*1000).toLocaleDateString('ru',{day:'numeric',month:'short'})}
                          </span>
                        </div>
                        <div style={{color:'rgba(249,240,240,.7)',fontSize:13,marginTop:2,
                          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                          <Highlight text={m.text} q={search.trim()}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {searchMsgs.length > 20 && (
                  <div style={{padding:'8px 22px',color:'rgba(249,240,240,.4)',fontSize:11}}>
                    + ещё {searchMsgs.length - 20}
                  </div>
                )}
              </>
            )}

            {/* Заголовок «Чаты» когда есть и то и другое */}
            {(normalConvs.length > 0 || requestConvs.length > 0) && (
              <div style={{
                padding:'12px 22px 4px',color:'rgba(249,240,240,.5)',
                fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,
              }}>
                Чаты
              </div>
            )}
          </>
        )}

        {normalConvs.length === 0 && requestConvs.length === 0 && !search && (
          <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',marginTop:60,fontSize:15,padding:'0 20px'}}>
            Нет активных диалогов.<br/>Перейди в Контакты, чтобы начать переписку.
          </div>
        )}
        {normalConvs.length === 0 && requestConvs.length === 0 && search.trim().length >= 2 && (!searchMsgs || searchMsgs.length === 0) && !searchLoading && (
          <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',marginTop:40,fontSize:14,padding:'0 20px'}}>
            🤷 Ничего не нашли по «{search.trim()}»
          </div>
        )}

        {/* Pinned chats */}
        {pinnedConvs.length > 0 && (
          <div style={{
            padding:'14px 20px 6px',
            color:'rgba(249,240,240,.4)',fontSize:11,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'1px',
            display:'flex',alignItems:'center',gap:6,
          }}>
            <span>📌</span> Закреплённые
          </div>
        )}
        {pinnedConvs.map(c => <ConvRow key={c.id} c={c} isRequest={false}/>)}

        {/* Divider when both sections have items */}
        {pinnedConvs.length > 0 && regularConvs.length > 0 && (
          <div style={{
            padding:'14px 20px 6px',
            color:'rgba(249,240,240,.4)',fontSize:11,fontWeight:600,
            textTransform:'uppercase',letterSpacing:'1px',
          }}>
            Все чаты
          </div>
        )}
        {regularConvs.map(c => <ConvRow key={c.id} c={c} isRequest={false}/>)}

        {/* Requests section */}
        {requestConvs.length > 0 && (
          <>
            <div style={{
              padding:'16px 20px 8px',
              color:'rgba(249,240,240,.4)',fontSize:11,fontWeight:600,
              textTransform:'uppercase',letterSpacing:'1px',
              display:'flex',alignItems:'center',gap:8,
            }}>
              Запросы на переписку
              <span style={{
                background:'rgba(95, 64, 128,.6)',borderRadius:20,
                padding:'1px 8px',fontSize:11,color:'#F9F0F0',
              }}>{requestConvs.length}</span>
            </div>
            {requestConvs.map(c => <ConvRow key={c.id} c={c} isRequest={true}/>)}
          </>
        )}

      </div>

      {/* Pin toast */}
      {pinToast && (
        <div style={{
          position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(249,240,240,.15)',
          borderRadius:50,padding:'9px 18px',
          color:'#F9F0F0',fontSize:14,fontWeight:600,
          zIndex:1000,whiteSpace:'nowrap',
          boxShadow:'0 4px 20px rgba(0,0,0,.4)',
          pointerEvents:'none',
          display:'flex',alignItems:'center',gap:8,
        }}>
          {pinToast.iconName && (
            <Icon name={pinToast.iconName} size={16} stroke={2}/>
          )}
          {pinToast.text}
        </div>
      )}

      {/* Loading spinner while fetching profile */}
      {requestCardLoading && (
        <div style={{
          position:'fixed',inset:0,zIndex:600,
          background:'rgba(0,0,0,.5)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{color:'rgba(249,240,240,.6)',fontSize:14}}>Загрузка…</div>
        </div>
      )}

      {/* Request profile card popup */}
      {requestCard && (
        <div
          style={{
            position:'fixed',inset:0,zIndex:600,
            background:'rgba(0,0,0,.65)',backdropFilter:'blur(14px)',
            display:'flex',alignItems:'center',justifyContent:'center',
            padding:'20px',
          }}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setRequestCard(null); }}
        >
          <div style={{
            background:'rgba(28,18,58,.98)',backdropFilter:'blur(24px)',
            borderRadius:24,width:'min(100%,400px)',
            boxShadow:'0 12px 56px rgba(0,0,0,.6)',
            border:'1px solid rgba(249,240,240,.1)',
            overflow:'hidden',
          }}>
            {/* Header with avatar */}
            <div style={{
              background:'linear-gradient(160deg,rgba(92,60,160,.8),rgba(140,80,180,.6))',
              padding:'32px 24px 24px',
              display:'flex',flexDirection:'column',alignItems:'center',gap:14,
              position:'relative',
            }}>
              <button onClick={() => setRequestCard(null)} style={{
                position:'absolute',top:14,right:14,
                background:'rgba(249,240,240,.12)',border:'none',borderRadius:'50%',
                width:30,height:30,color:'#F9F0F0',fontSize:16,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
              }}>✕</button>

              <AvatarDisplay
                avatar={requestCard.profile.avatar}
                name={requestCard.profile.name}
                size={90} fontSize={38}
                style={{boxShadow:'0 8px 24px rgba(0,0,0,.35)',border:'3px solid rgba(249,240,240,.2)'}}
              />
              <div style={{textAlign:'center'}}>
                <div style={{color:'#F9F0F0',fontSize:20,fontWeight:700,marginBottom:4}}>
                  {requestCard.profile.name}
                </div>
                <div style={{
                  display:'inline-block',
                  background:'rgba(95, 64, 128,.45)',border:'1px solid rgba(180,140,255,.3)',
                  borderRadius:20,padding:'3px 12px',fontSize:12,color:'rgba(220,200,255,.9)',
                }}>
                  хочет написать вам
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
              {/* Bio */}
              {requestCard.profile.bio && (
                <div style={{
                  background:'rgba(249,240,240,.06)',borderRadius:12,
                  border:'1px solid rgba(249,240,240,.09)',padding:'12px 14px',
                  color:'rgba(249,240,240,.75)',fontSize:14,lineHeight:1.6,
                }}>
                  {requestCard.profile.bio}
                </div>
              )}

              {/* Active moment preview if any */}
              {requestCard.profile.active_moment && (
                <div style={{
                  background:'rgba(249,240,240,.06)',borderRadius:12,
                  border:'1px solid rgba(249,240,240,.09)',padding:'12px 14px',
                }}>
                  <div style={{color:'rgba(249,240,240,.35)',fontSize:10,textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>
                    Текущий момент
                  </div>
                  <div style={{color:'rgba(249,240,240,.8)',fontSize:13,lineHeight:1.5,
                    overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                    {requestCard.profile.active_moment.text}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <button
                  disabled={!!requestCardAction}
                  onClick={async () => {
                    setRequestCardAction('decline');
                    try {
                      await api.declineRequest(requestCard.conv.id);
                      setConvs(prev => prev.filter(c => c.id !== requestCard.conv.id));
                      setRequestCard(null);
                    } catch {}
                    setRequestCardAction(null);
                  }}
                  style={{
                    flex:1,padding:'13px',borderRadius:14,fontSize:14,fontWeight:600,
                    background:'rgba(200,60,60,.45)',border:'1px solid rgba(255,140,140,.55)',
                    color:'rgba(255,225,225,1)',cursor:'pointer',
                    opacity: requestCardAction === 'decline' ? .6 : 1,
                    fontFamily:'inherit',
                  }}>
                  {requestCardAction === 'decline' ? '…' : 'Отклонить'}
                </button>
                <button
                  disabled={!!requestCardAction}
                  onClick={async () => {
                    setRequestCardAction('accept');
                    try {
                      await api.acceptRequest(requestCard.conv.id);
                      setConvs(prev => prev.map(c =>
                        c.id === requestCard.conv.id ? { ...c, is_request: false } : c
                      ));
                      const convId = requestCard.conv.id;
                      setRequestCard(null);
                      nav(`/chat/${convId}`);
                    } catch {}
                    setRequestCardAction(null);
                  }}
                  style={{
                    flex:2,padding:'13px',borderRadius:14,fontSize:14,fontWeight:700,
                    background:'rgba(95, 64, 128,.85)',border:'1px solid rgba(180,140,255,.4)',
                    color:'#F9F0F0',cursor:'pointer',
                    opacity: requestCardAction === 'accept' ? .6 : 1,
                    boxShadow:'0 2px 12px rgba(95, 64, 128,.35)',
                    fontFamily:'inherit',
                  }}>
                  {requestCardAction === 'accept' ? '…' : '👤 Добавить и начать переписку'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchive && (
        <ArchiveListModal
          onClose={() => setShowArchive(false)}
          onUnarchive={(c) => { setConvs(prev => [c, ...prev]); }}/>
      )}
    </div>
  );
}

function ArchiveListModal({ onClose, onUnarchive }) {
  const [list, setList]   = useState(null);
  const [busy, setBusy]   = useState(false);
  const [customConfirm, confirmModal] = useConfirm();
  const nav = useNavigate();

  useEffect(() => {
    api.getArchivedConversations().then(setList).catch(() => setList([]));
  }, []);

  async function restore(c) {
    setBusy(true);
    try {
      await api.unarchiveConversation(c.id);
      setList(prev => prev.filter(x => x.id !== c.id));
      onUnarchive?.(c);
      heyToast('Восстановлено', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
    setBusy(false);
  }

  async function removeForever(c) {
    const ok = await customConfirm(
      <>
        <div style={{fontWeight:700,marginBottom:8}}>Удалить чат «{c.name || 'Диалог'}» навсегда?</div>
        <div style={{color:'rgba(249,240,240,.65)',fontSize:13,lineHeight:1.6}}>
          Сообщения, медиа и реакции удалятся безвозвратно.
        </div>
      </>,
      { requireWord: 'УДАЛИТЬ', danger: true }
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteConversation(c.id);
      setList(prev => prev.filter(x => x.id !== c.id));
      heyToast('Удалено', 'success');
    } catch (e) { heyToast(e.message || 'Ошибка', 'error'); }
    setBusy(false);
  }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{position:'fixed',inset:0,zIndex:1000,
        background:'rgba(0,0,0,.55)',backdropFilter:'blur(10px)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'rgba(22,15,50,.98)',borderRadius:18,
        width:'min(94vw,520px)',maxHeight:'82vh',display:'flex',flexDirection:'column',
        border:'1px solid rgba(249,240,240,.14)',
        boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
        <div style={{padding:'16px 20px 14px',borderBottom:'1px solid rgba(249,240,240,.08)',
          display:'flex',alignItems:'center',gap:10}}>
          <Icon name="archive" size={20}/>
          <div style={{flex:1,color:'#F9F0F0',fontSize:17,fontWeight:700}}>Архивные чаты</div>
          <button onClick={onClose}
            style={{background:'none',border:'none',color:'rgba(249,240,240,.5)',
              cursor:'pointer',padding:0,display:'flex',alignItems:'center'}}>
            <Icon name="close" size={20}/>
          </button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 12px 12px'}}>
          {list === null && <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:30}}>Загрузка…</div>}
          {list && list.length === 0 && (
            <div style={{color:'rgba(225,220,245,.7)',textAlign:'center',padding:40,fontSize:14,lineHeight:1.5}}>
              Архив пуст.<br/>
              <span style={{fontSize:12,color:'rgba(225,220,245,.55)'}}>
                В чатах открой меню строки и выбери «В архив».
              </span>
            </div>
          )}
          {list && list.length > 0 && list.map(c => {
            // Аватарка: для группы — иконка/фото; для direct — аватар
            // партнёра (если он не удалён); для монолога — Icon edit.
            const groupIc = c.icon || '';
            const groupIcIsImg = c.type === 'group' && groupIc &&
              (groupIc.startsWith('http') || groupIc.startsWith('/') || groupIc.startsWith('data:'));
            const directAv = c.type === 'direct' && !c.partner_is_deleted ? c.avatar : null;
            const directAvIsImg = directAv &&
              (directAv.startsWith('http') || directAv.startsWith('/') || directAv.startsWith('data:'));
            return (
            <div key={c.id} style={{
              display:'flex',alignItems:'center',gap:12,padding:'10px 8px',
              borderRadius:10,
            }}>
              <div style={{width:40,height:40,
                borderRadius: c.type === 'group' ? 12 : '50%',
                overflow:'hidden',flexShrink:0,
                background:'rgba(95, 64, 128,.4)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:16,color:'#F9F0F0',fontWeight:700}}>
                {c.type === 'monolog'
                  ? <Icon name="edit" size={18}/>
                  : c.type === 'group'
                    ? (groupIcIsImg
                        ? <img src={groupIc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        : (groupIc || <Icon name="users" size={18}/>))
                    : directAvIsImg
                      ? <img src={directAv} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      : c.partner_is_deleted
                        ? <Icon name="user" size={18}/>
                        : (c.name?.[0]?.toUpperCase() || '?')}
              </div>
              <div style={{flex:1,minWidth:0,cursor:'pointer'}}
                onClick={() => { onClose(); nav('/chat/' + c.id); }}>
                <div style={{color:'#F9F0F0',fontSize:14,fontWeight:600,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {c.name || 'Диалог'}
                </div>
                <div style={{color:'rgba(225,220,245,.6)',fontSize:11,marginTop:2}}>
                  {c.last_text ? c.last_text.slice(0,60) : 'Нет сообщений'}
                </div>
              </div>
              <button onClick={() => restore(c)} disabled={busy}
                title="Восстановить"
                style={{background:'rgba(95, 64, 128,.25)',border:'1px solid rgba(180,140,220,.4)',
                  color:'rgba(220,200,255,1)',borderRadius:8,padding:'5px 10px',fontSize:11,
                  fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                ↺ Вернуть
              </button>
              <button onClick={() => removeForever(c)} disabled={busy}
                title="Удалить навсегда"
                style={{background:'rgba(200,60,60,.2)',border:'1px solid rgba(255,120,120,.45)',
                  color:'rgba(255,180,180,1)',borderRadius:8,padding:'5px 10px',fontSize:14,
                  cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>
                ✕
              </button>
            </div>
            );
          })}
        </div>
      </div>
      {confirmModal}
    </div>
  );
}
