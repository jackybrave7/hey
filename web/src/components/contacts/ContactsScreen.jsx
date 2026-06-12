import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { validatePhone } from '../../lib/phoneFormat';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import { AvatarDisplay } from '../shared/AvatarDisplay';
import ChatContextMenu from '../chat/ChatContextMenu';
import { openUserCard } from '../../lib/openUserCard';
import { ContactCardModal } from './ContactCardModal';
import ImportContactsModal from './ImportContactsModal';
import InviteModal from './InviteModal';
import InviteByPhoneModal from './InviteByPhoneModal';
import Icon from '../Icon';

export function ContactsScreen() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [contacts,      setContacts]      = useState([]);
  const [blocked,       setBlocked]       = useState([]);
  const [query,         setQuery]         = useState('');
  const [inviteTarget,  setInviteTarget]  = useState(null); // phone not found — show invite popup
  const [card,          setCard]          = useState(null);
  const [showImport,    setShowImport]    = useState(false);
  const [showInvite,    setShowInvite]    = useState(false);
  const [customConfirm, confirmModal]     = useConfirm();

  useEffect(() => {
    api.getContacts().then(setContacts).catch(console.error);
    api.getBlocked().then(setBlocked).catch(console.error);
  }, []);

  // ── Global поиск отключён — приватность.
  // Найти пользователя можно только если он уже в контактах,
  // или ввести номер телефона и нажать «+».

  // ── Add contact by phone (+ button) ─────────────────────────────────────
  // Сначала lookup → показываем карточку пользователя → подтверждение →
  // фактическое добавление. Карточка переиспользует ContactCardModal
  // с isContact=false, поэтому в ней доступна кнопка «👤 Добавить в контакты».
  async function addContact() {
    const q = query.trim();
    if (!q) return;
    const looksLikePhone = /^[\d\s\-\+\(\)]{7,}$/.test(q);
    if (!looksLikePhone) return;
    const pv = validatePhone(q);
    if (!pv.ok) { heyToast(pv.msg, 'error'); return; }
    try {
      const profile = await api.lookupUserByPhone(pv.normalized);
      // Открываем карточку через тот же state, что используется для тапа
      // по контакту — но isContact=false ⇒ показывается кнопка «Добавить».
      setCard(profile);
    } catch(e) {
      // Пользователь не найден — предлагаем пригласить.
      if (e.message?.includes('не найден') || e.message?.includes('404') || e.status === 404) {
        setInviteTarget(pv.normalized);
      } else {
        heyToast(e.message, 'error');
      }
    }
  }

  async function openChat(contactId) {
    setCard(null);
    try {
      const conv = await api.openConversation(contactId);
      nav(`/chat/${conv.id}`);
    } catch(e) { heyToast(e.message, 'error'); }
  }

  async function handleBlock(contact) {
    if (!await customConfirm(`Заблокировать ${contact.nickname || contact.name}? Они не смогут отправлять вам сообщения.`, { danger: true })) return;
    await api.blockUser(contact.id).catch(console.error);
    setBlocked(prev => [...prev, { id: contact.id, name: contact.name, phone: contact.phone, avatar: contact.avatar }]);
    setCard(null);
  }

  async function handleUnblock(userId) {
    await api.unblockUser(userId).catch(console.error);
    setBlocked(prev => prev.filter(b => b.id !== userId));
    setCard(null);
  }

  function handleNotesChange(contactId, notes) {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes } : c));
  }

  const isBlockedId = (id) => blocked.some(b => b.id === id);
  // Показываем только незаблокированных
  const visibleContacts = contacts.filter(c => !isBlockedId(c.id));

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--grad)',
      paddingBottom:80,
      display:'flex',flexDirection:'column',
    }}>
      {/* Sticky header — full-width bg, content limited to 680 */}
      <div className="tab-header">
        <div className="tab-header-inner">
          <div className="tab-header-title">
            <Icon name="users" size={20}/> Контакты
          </div>
          <ChatContextMenu
            ariaLabel="Меню контактов"
            items={[
              { label: 'Импорт контактов', icon: <Icon name="download" size={15}/>, onClick: () => setShowImport(true) },
              { label: 'Пригласить друга', icon: <Icon name="share" size={15}/>, onClick: () => setShowInvite(true) },
            ]}
            trigger={
              <div className="topbar-dots">
                {[0,1,2].map(i => <div key={i} className="topbar-dot"/>)}
              </div>
            }
          />
        </div>
      </div>

      {/* Content limited to 680 */}
      <div style={{maxWidth:680,margin:'0 auto',width:'100%',flex:1,display:'flex',flexDirection:'column'}}>
      {/* Search / Add input */}
      <div style={{padding:'12px 20px',display:'flex',gap:8,flexShrink:0}}>
        <input className="glass-input" placeholder="Поиск или номер телефона"
          value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addContact()} style={{flex:1}}/>
        <button className="pill" onClick={addContact} style={{padding:'13px 20px',fontSize:20}}>+</button>
      </div>

      {/* Invite popup when phone not found */}
      {inviteTarget && (
        <InviteByPhoneModal phone={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}

      {/* List — фильтруется по query */}
      {(() => {
        const q = query.trim().toLowerCase();
        const isSearching = q.length >= 3;

        // Локальные совпадения по контактам
        const localMatches = q
          ? visibleContacts.filter(c =>
              (c.nickname || '').toLowerCase().includes(q) ||
              (c.name     || '').toLowerCase().includes(q) ||
              (c.phone    || '').includes(query.trim())
            )
          : visibleContacts;

        const hasAny = localMatches.length > 0;
        const looksLikePhone = /^[\d\s\-+()]{7,}$/.test(query.trim());

        return (
          <div style={{flex:1}}>
            {/* Поиск активен — показываем только локальные совпадения */}
            {isSearching ? (
              <>
                {/* Локальные совпадения (свои контакты) */}
                {localMatches.map(c => (
                  <div key={'local-'+c.id}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',
                      cursor:'pointer',borderBottom:'1px solid rgba(249,240,240,.06)',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.04)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div onClick={() => setCard(c)} style={{cursor:'pointer',flexShrink:0}}>
                      <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name}/>
                    </div>
                    <div style={{flex:1,minWidth:0}} onClick={() => openChat(c.id)}>
                      <div style={{color:'#F9F0F0',fontSize:15,fontWeight:600}}>{c.nickname||c.name}</div>
                      {!c.is_system && <div style={{color:'rgba(249,240,240,.45)',fontSize:13}}>{c.phone}</div>}
                    </div>
                    <span style={{color:'rgba(249,240,240,.25)',fontSize:18,flexShrink:0}}>›</span>
                  </div>
                ))}

                {/* Ничего не нашлось */}
                {!hasAny && (
                  <div style={{
                    padding:'24px 20px',textAlign:'center',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:10,
                  }}>
                    <div style={{fontSize:32,opacity:.5}}>🤷</div>
                    <div style={{color:'rgba(249,240,240,.45)',fontSize:14}}>
                      Никого не нашли по «{query.trim()}»
                    </div>
                    {looksLikePhone ? (
                      <button onClick={addContact}
                        style={{
                          marginTop:6,padding:'10px 18px',borderRadius:50,
                          background:'rgba(95, 64, 128,.75)',border:'none',color:'#F9F0F0',
                          fontSize:13,fontWeight:600,cursor:'pointer',
                          display:'flex',alignItems:'center',gap:8,
                        }}>
                        <span style={{fontSize:18}}>+</span> Добавить как контакт
                      </button>
                    ) : (
                      <div style={{color:'rgba(249,240,240,.3)',fontSize:12}}>
                        Введи имя ещё точнее или номер телефона
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Обычный режим — все контакты */}
                {visibleContacts.length === 0 && (
                  <div style={{color:'rgba(249,240,240,.4)',textAlign:'center',marginTop:60,fontSize:15}}>
                    Контакты не найдены.<br/>Добавьте первый по номеру телефона.
                  </div>
                )}
                {visibleContacts.map(c => (
                  <div key={c.id}
                    style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',
                      cursor:'pointer',borderBottom:'1px solid rgba(249,240,240,.06)',transition:'background .12s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.04)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div onClick={() => setCard(c)}
                      style={{cursor:'pointer',transition:'transform .15s',flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.06)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                      <AvatarDisplay avatar={c.avatar} name={c.nickname||c.name}/>
                    </div>
                    <div style={{flex:1,minWidth:0}} onClick={() => openChat(c.id)}>
                      <div style={{color:'#F9F0F0',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        {c.nickname || c.name}
                        {c.online && !c.is_deleted ? <div className="online-dot"/> : null}
                        {c.is_deleted && (
                          <span style={{fontSize:11,color:'rgba(249,240,240,.35)',fontWeight:400,
                            background:'rgba(249,240,240,.08)',borderRadius:6,padding:'2px 8px',fontStyle:'italic'}}>
                            удалил аккаунт
                          </span>
                        )}
                      </div>
                      {!c.is_deleted && !c.is_system && <div style={{color:'rgba(249,240,240,.45)',fontSize:13}}>{c.phone}</div>}
                      {c.notes && !c.is_deleted && <div style={{color:'rgba(249,240,240,.3)',fontSize:12,marginTop:2,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.notes}</div>}
                    </div>
                    <button onClick={() => setCard(c)}
                      style={{background:'none',border:'none',color:'rgba(249,240,240,.3)',
                        fontSize:20,cursor:'pointer',padding:'4px 8px',lineHeight:1,
                        transition:'color .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.color='rgba(249,240,240,.7)'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(249,240,240,.3)'}>
                      ›
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })()}

      {/* Contact card modal */}
      {card && (() => {
        // Берём актуальную запись из списка контактов — в ней есть notes/nickname,
        // которых нет в ответе lookup/profile при открытии по номеру.
        const resolvedCard = contacts.find(c => c.id === card.id) || card;
        // Если карточка пришла из lookup (по телефону) — этот юзер ещё НЕ в
        // контактах: показываем кнопку «Добавить» вместо «В чат».
        const cardIsContact = resolvedCard.is_contact !== undefined
          ? !!resolvedCard.is_contact
          : !!visibleContacts.find(c => c.id === resolvedCard.id);
        return (
          <ContactCardModal
            key={resolvedCard.id}
            contact={resolvedCard}
            isBlocked={isBlockedId(resolvedCard.id)}
            isContact={cardIsContact}
            onClose={() => setCard(null)}
            onChat={() => openChat(resolvedCard.id)}
            onAddContact={async () => {
              try {
                const c = await api.addContact({ userId: resolvedCard.id });
                setContacts(prev => prev.find(x => x.id === c.id) ? prev : [...prev, c]);
                setQuery('');
                setCard(null);
                heyToast('✓ Добавлено в контакты', 'success');
              } catch (e) { heyToast(e.message || 'Не удалось добавить', 'error'); }
            }}
            onRemoveContact={async () => {
              if (!await customConfirm('Удалить из контактов? Чат и переписка останутся.', { confirmLabel: 'Удалить' })) return;
              try { await api.deleteContact(resolvedCard.id); setContacts(prev => prev.filter(c => c.id !== resolvedCard.id)); setCard(null); }
              catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
            }}
            onBlock={() => handleBlock(resolvedCard)}
            onUnblock={() => handleUnblock(resolvedCard.id)}
            onNotesChange={handleNotesChange}
            onOpenMoment={(m) => { setCard(null); nav(`/moments/${m.id}`); }}
          />
        );
      })()}

      {showImport && (
        <ImportContactsModal
          onClose={() => setShowImport(false)}
          onImported={contact => setContacts(prev =>
            prev.some(c => c.id === contact.id) ? prev : [...prev, contact]
          )}
        />
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} />
      )}

      {confirmModal}
      </div>{/* end 680 wrapper */}
    </div>
  );
}
