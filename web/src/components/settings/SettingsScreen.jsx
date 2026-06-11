import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../lib/push';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import TopBar from '../shared/TopBar';
import Icon from '../Icon';
import FeedbackModal from './FeedbackModal';
import BlacklistModal from './BlacklistModal';

export function SettingsScreen() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [showNotif,     setShowNotif]     = useState(false);
  const [notifPerm, setNotifPerm] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Password change
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [showPwds,     setShowPwds]     = useState(false); // показывать ли пароли в текст-режиме
  const [oldPwd,   setOldPwd]   = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [newPwd2,  setNewPwd2]  = useState('');
  const [pwdErr,   setPwdErr]   = useState('');
  const [pwdSaving,setPwdSaving]= useState(false);
  const [toast,    setToast]    = useState('');

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword,    setDeletePassword]    = useState('');
  const [deleteErr,         setDeleteErr]         = useState('');
  const [deleting,          setDeleting]          = useState(false);

  // Esc — закрыть верхнюю модалку
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (showDeleteAccount) { setShowDeleteAccount(false); return; }
      if (showPwdModal)      { setShowPwdModal(false);      return; }
      if (showBlacklist)     { setShowBlacklist(false);     return; }
      if (showFeedback)      { setShowFeedback(false);      return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteAccount, showPwdModal, showBlacklist, showFeedback]);

  async function submitDeleteAccount() {
    setDeleteErr('');
    if (!deletePassword) { setDeleteErr('Введите пароль'); return; }
    setDeleting(true);
    try {
      await api.deleteAccount(deletePassword);
      // WS event 'account:deleted' will trigger logout in AuthContext
    } catch(e) {
      setDeleteErr(e.message || 'Ошибка');
      setDeleting(false);
    }
  }

  function showSettingsToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const [pushBusy, setPushBusy] = useState(false);

  async function enablePush() {
    if (!isPushSupported()) {
      showSettingsToast('Браузер не поддерживает push-уведомления');
      return;
    }
    setPushBusy(true);
    try {
      const res = await subscribeToPush();
      setNotifPerm(Notification.permission);
      if (res.ok) showSettingsToast('✓ Push-уведомления включены');
      else if (res.reason === 'denied') showSettingsToast('Разрешите уведомления в настройках браузера');
      else showSettingsToast('Не удалось включить: ' + res.reason);
    } catch (e) {
      showSettingsToast('Ошибка: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      showSettingsToast('Push отключены на этом устройстве');
    } catch (e) {
      showSettingsToast('Ошибка: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function testPush() {
    setPushBusy(true);
    try {
      const r = await api.pushTest();
      if (r.sent > 0) showSettingsToast(`✓ Тест отправлен (${r.sent})`);
      else showSettingsToast('Нет активных подписок');
    } catch (e) {
      showSettingsToast('Ошибка теста: ' + (e.message || ''));
    }
    setPushBusy(false);
  }

  async function submitPasswordChange() {
    setPwdErr('');
    if (!oldPwd || !newPwd || !newPwd2) { setPwdErr('Заполните все поля'); return; }
    if (newPwd !== newPwd2) { setPwdErr('Новые пароли не совпадают'); return; }
    if (newPwd.length < 8) { setPwdErr('Пароль минимум 8 символов'); return; }
    setPwdSaving(true);
    try {
      await api.changePassword(oldPwd, newPwd);
      setShowPwdModal(false);
      setOldPwd(''); setNewPwd(''); setNewPwd2('');
      showSettingsToast('✓ Пароль изменён');
    } catch(e) { setPwdErr(e.message || 'Ошибка'); }
    setPwdSaving(false);
  }

  // Shared row style
  function Row({ icon, label, sub, onClick, chevron = true, danger = false }) {
    return (
      <button onClick={onClick} style={{
        width:'100%', display:'flex', alignItems:'center', gap:14,
        padding:'13px 18px', background:'none', border:'none',
        color: danger ? 'rgba(255,170,170,1)' : '#F9F0F0',
        fontSize:14, fontWeight: danger ? 600 : 500,
        cursor:'pointer', textAlign:'left', fontFamily:'inherit',
        transition:'background .12s',
      }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.05)'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,flexShrink:0,color:danger?'rgba(255,170,170,1)':'rgba(249,240,240,.85)'}}>{typeof icon === 'string' ? <span style={{fontSize:18}}>{icon}</span> : icon}</span>
        <div style={{flex:1}}>
          <div>{label}</div>
          {sub && <div style={{fontSize:12,color:'rgba(249,240,240,.65)',marginTop:1}}>{sub}</div>}
        </div>
        {chevron && <span style={{color:'rgba(249,240,240,.5)',fontSize:18}}>›</span>}
      </button>
    );
  }

  const cardStyle = {
    background:'rgba(249,240,240,.06)', borderRadius:16,
    border:'1px solid rgba(249,240,240,.08)', overflow:'hidden',
  };
  const dividerStyle = { borderBottom:'1px solid rgba(249,240,240,.05)' };
  const sectionLabelStyle = {
    color:'rgba(249,240,240,.7)', fontSize:11, fontWeight:700,
    textTransform:'uppercase', letterSpacing:.8, marginBottom:8, paddingLeft:4,
  };

  return (
    <div style={{minHeight:'100vh', background:'var(--grad)', paddingBottom:80}}>

      {/* Sticky header */}
      <div style={{
        position:'sticky', top:0, zIndex:10,
        background:'var(--topbar)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid rgba(249,240,240,.06)',
      }}>
        <div style={{maxWidth:680, margin:'0 auto', padding:'14px 20px',
          display:'flex', alignItems:'center', gap:12}}>
          <button onClick={() => nav(-1)} style={{
            background:'rgba(249,240,240,.1)', border:'none', borderRadius:50,
            width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
            color:'#F9F0F0', fontSize:20, cursor:'pointer', flexShrink:0, lineHeight:1,
            fontFamily:'inherit',
          }}>‹</button>
          <div style={{color:'#F9F0F0', fontSize:20, fontWeight:800, letterSpacing:-.3}}>Настройки</div>
        </div>
      </div>

      <div style={{maxWidth:680, margin:'0 auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:20}}>

        {/* Аккаунт */}
        <div>
          <div style={sectionLabelStyle}>Аккаунт</div>
          <div style={cardStyle}>
            <div style={dividerStyle}>
              <Row icon={<Icon name="phone" size={18} />} label="Телефон" sub={user?.phone || '—'} onClick={() => {}} chevron={false}/>
            </div>
            <Row icon={<Icon name="lock" size={18} />} label="Сменить пароль"
              onClick={() => { setShowPwdModal(true); setPwdErr(''); }}/>
          </div>
        </div>

        {/* Приложение */}
        <div>
          <div style={sectionLabelStyle}>Приложение</div>
          <div style={cardStyle}>

            {/* Оповещения — раскрываемая строка */}
            <div style={dividerStyle}>
              <button onClick={() => setShowNotif(v => !v)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:14,
                padding:'13px 18px', background:'none', border:'none',
                color:'#F9F0F0', fontSize:14, fontWeight:500, cursor:'pointer',
                textAlign:'left', fontFamily:'inherit', transition:'background .12s',
              }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.05)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,color:'rgba(249,240,240,.85)'}}><Icon name="bell" size={18}/></span>
                <div style={{flex:1}}>
                  <div>Оповещения</div>
                  <div style={{fontSize:12, marginTop:1, fontWeight:500,
                    color: notifPerm==='granted' ? 'rgba(110,235,150,.95)' :
                           notifPerm==='denied'  ? 'rgba(255,160,160,.95)' : 'rgba(249,240,240,.6)'}}>
                    {notifPerm==='granted' ? 'Включены' :
                     notifPerm==='denied'  ? 'Заблокированы в браузере' : 'Не настроены'}
                  </div>
                </div>
                <span style={{color:'rgba(249,240,240,.3)', fontSize:18, transition:'transform .2s',
                  display:'inline-block',
                  transform: showNotif ? 'rotate(90deg)' : 'none'}}>›</span>
              </button>
              {showNotif && (
                <div style={{padding:'4px 18px 14px', display:'flex', flexDirection:'column', gap:10}}>
                  <div style={{color:'rgba(249,240,240,.78)', fontSize:13, lineHeight:1.6}}>
                    Получайте push-уведомления о новых сообщениях, даже когда HEY свёрнут или вкладка закрыта.
                  </div>
                  <button onClick={() => nav('/help#notifications')}
                    style={{
                      alignSelf:'flex-start',
                      background:'rgba(95, 64, 128,.18)',
                      border:'1px solid rgba(180,140,220,.35)',
                      borderRadius:10, padding:'7px 14px',
                      color:'rgba(220,200,255,.95)', fontSize:12, fontWeight:600,
                      cursor:'pointer', fontFamily:'inherit',
                      display:'flex', alignItems:'center', gap:6,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(95, 64, 128,.32)'}
                    onMouseLeave={e => e.currentTarget.style.background='rgba(95, 64, 128,.18)'}>
                    <Icon name="book" size={14}/>
                    <span>Подробная инструкция по браузерам</span>
                    <span style={{opacity:.6}}>→</span>
                  </button>
                  {notifPerm === 'unsupported' && (
                    <div style={{color:'rgba(255,210,120,.95)', fontSize:13}}>
                      Браузер не поддерживает уведомления
                    </div>
                  )}
                  {notifPerm === 'denied' && (
                    <div style={{color:'rgba(255,160,160,.95)', fontSize:13, fontWeight:500}}>
                      Разрешите уведомления в настройках браузера для этого сайта и перезагрузите страницу.
                    </div>
                  )}
                  {(notifPerm === 'default' || (notifPerm === 'granted' && !pushBusy)) && (
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      <button onClick={enablePush} disabled={pushBusy} style={{
                        background:'rgba(95, 64, 128,.75)', border:'none',
                        borderRadius:50, padding:'9px 20px', color:'#F9F0F0',
                        fontSize:13, fontWeight:600, cursor: pushBusy ? 'wait' : 'pointer',
                        fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                      }}>
                        {pushBusy ? 'Подключаю…' :
                         notifPerm === 'granted' ? 'Переподключить' : 'Включить уведомления'}
                      </button>
                      {notifPerm === 'granted' && (
                        <>
                          <button onClick={testPush} disabled={pushBusy} style={{
                            background:'rgba(249,240,240,.1)', border:'1px solid rgba(249,240,240,.18)',
                            borderRadius:50, padding:'9px 16px', color:'rgba(249,240,240,.85)',
                            fontSize:13, cursor: pushBusy ? 'wait' : 'pointer',
                            fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                          }}>
                            ✉ Тест
                          </button>
                          <button onClick={disablePush} disabled={pushBusy} style={{
                            background:'rgba(200,60,60,.45)', border:'1px solid rgba(255,140,140,.55)',
                            borderRadius:50, padding:'9px 16px', color:'rgba(255,180,180,.95)',
                            fontSize:13, cursor: pushBusy ? 'wait' : 'pointer',
                            fontFamily:'inherit', opacity: pushBusy ? .6 : 1,
                          }}>
                            Отключить
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {notifPerm === 'granted' && (
                    <div style={{display:'flex', alignItems:'center', gap:8, marginTop:4}}>
                      <div style={{width:8, height:8, borderRadius:'50%', background:'#2ecc71',
                        boxShadow:'0 0 6px rgba(46,204,113,.5)'}}/>
                      <span style={{color:'rgba(249,240,240,.65)', fontSize:12}}>
                        Подписка активна. Отключить можно отдельно на этом устройстве.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={dividerStyle}>
              <Row icon={<Icon name="ban" size={18}/>} label="Чёрный список" onClick={() => setShowBlacklist(true)}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="book" size={18}/>} label="Руководство" sub="Все функции HEY с поиском"
                onClick={() => nav('/help')}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="file" size={18}/>} label="Пользовательское соглашение"
                sub="Правила использования HEY" onClick={() => nav('/terms')}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="lock" size={18}/>} label="Персональные данные"
                sub="Политика обработки данных" onClick={() => nav('/privacy')}/>
            </div>
            <div style={dividerStyle}>
              <Row icon={<Icon name="chat" size={18}/>} label="Написать разработчику" onClick={() => setShowFeedback(true)}/>
            </div>
            {/* Бизнес-аккаунт: только если у юзера ещё нет approved + он не админ */}
            {/* HEY для бизнеса — единая ссылка, страница сама показывает
                нужный action по статусу заявки */}
            {!user?.is_admin && user?.business_status === 'approved' ? (
              <Row icon={<Icon name="users" size={18}/>} label="Мои школы (АВО)"
                sub="Интеграции с АвтоВебОфис" onClick={() => nav('/integrations/awo')}/>
            ) : !user?.is_admin && (user?.tenants_accessible || 0) > 0 ? (
              // Со-админ хотя бы одной школы, но не business-approved
              // (его добавил владелец). Даём прямой путь в /integrations/awo —
              // там tenant-list уже отфильтрован по доступу.
              <Row icon={<Icon name="users" size={18}/>}
                label="Школы, где я админ"
                sub="Доступ к настройкам и привязкам"
                onClick={() => nav('/integrations/awo')}/>
            ) : !user?.is_admin && (
              <Row icon={<Icon name="users" size={18}/>}
                label="HEY для бизнеса"
                sub={
                  user?.business_status === 'pending' ? '🕓 Заявка на рассмотрении'
                  : user?.business_status === 'rejected' ? '⚠ Заявка отклонена — подать заново'
                  : 'Подключение АВО, свои школы и курсы'
                }
                onClick={() => nav('/business')}/>
            )}
          </div>
        </div>

        {/* Выйти */}
        <button onClick={async () => {
          if (await customConfirm('Выйти из аккаунта?')) { logout(); nav('/login'); }
        }} style={{
          padding:'14px', borderRadius:14, cursor:'pointer',
          background:'rgba(200,60,60,.42)', border:'1px solid rgba(255,140,140,.55)',
          color:'rgba(255,225,225,1)', fontSize:15, fontWeight:600,
          transition:'background .15s', fontFamily:'inherit',
        }}
          onMouseEnter={e=>e.currentTarget.style.background='rgba(200,60,60,.62)'}
          onMouseLeave={e=>e.currentTarget.style.background='rgba(200,60,60,.42)'}>
          Выйти из аккаунта
        </button>

        {/* Удалить аккаунт */}
        <button onClick={() => { setShowDeleteAccount(true); setDeletePassword(''); setDeleteErr(''); }}
          style={{
            padding:'14px', borderRadius:14, cursor:'pointer',
            background:'rgba(255,50,50,.08)', border:'1px solid rgba(255,80,80,.4)',
            color:'rgba(255,160,160,.95)', fontSize:13, fontWeight:600,
            transition:'all .15s', fontFamily:'inherit',
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,50,50,.18)'; e.currentTarget.style.color='rgba(255,180,180,1)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,50,50,.08)'; e.currentTarget.style.color='rgba(255,160,160,.95)'; }}>
          Удалить аккаунт и все данные
        </button>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)', backdropFilter:'blur(20px)',
          border:'1px solid rgba(249,240,240,.15)',
          borderRadius:50, padding:'10px 20px',
          color:'#F9F0F0', fontSize:14, fontWeight:600,
          zIndex:1000, whiteSpace:'nowrap',
        }}>
          {toast}
        </div>
      )}

      {showBlacklist && <BlacklistModal onClose={() => setShowBlacklist(false)} />}
      {showFeedback  && <FeedbackModal  onClose={() => setShowFeedback(false)}  />}

      {confirmModal}

      {/* Delete account modal */}
      {showDeleteAccount && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.72)',
          backdropFilter:'blur(16px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setShowDeleteAccount(false); }}>
          <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
            borderRadius:22,width:'min(100%,420px)',padding:'28px 24px',
            boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(255,100,100,.2)'}}>
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{fontSize:36,marginBottom:10}}>⚠️</div>
              <div style={{color:'rgba(255,140,140,.95)',fontSize:18,fontWeight:700,marginBottom:8}}>
                Удалить аккаунт?
              </div>
              <div style={{color:'rgba(249,240,240,.5)',fontSize:13,lineHeight:1.6}}>
                Профиль сразу пропадёт: имя, телефон, аватар, био — скроются;
                собеседники увидят «Пользователь удалил аккаунт», моменты уйдут из ленты.
                <br/><br/>
                <span style={{color:'rgba(180,220,140,.85)'}}>
                  💡 <strong>У тебя 30 дней передумать.</strong> Если за это время войдёшь
                  с тем же телефоном и паролем — аккаунт восстановится со всеми данными.
                  По истечении 30 дней — необратимое удаление со стиранием медиа.
                </span>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{color:'rgba(249,240,240,.5)',fontSize:12,marginBottom:6}}>
                Введите пароль для подтверждения:
              </div>
              <input
                type="password"
                value={deletePassword}
                onChange={e => { setDeletePassword(e.target.value); setDeleteErr(''); }}
                placeholder="Пароль"
                autoFocus
                style={{
                  width:'100%', boxSizing:'border-box',
                  background:'rgba(249,240,240,.07)',
                  border:`1px solid ${deleteErr ? 'rgba(255,100,100,.6)' : 'rgba(249,240,240,.14)'}`,
                  borderRadius:12, padding:'11px 14px', color:'#F9F0F0', fontSize:14,
                  fontFamily:'inherit', outline:'none',
                }}
              />
              {deleteErr && (
                <div style={{color:'rgba(255,140,140,.85)',fontSize:12,marginTop:6}}>{deleteErr}</div>
              )}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setShowDeleteAccount(false)} style={{
                flex:1, padding:'12px', borderRadius:12,
                background:'rgba(249,240,240,.08)', border:'none',
                color:'rgba(249,240,240,.6)', fontSize:14, fontWeight:600, cursor:'pointer',
                fontFamily:'inherit',
              }}>
                Отмена
              </button>
              <button onClick={submitDeleteAccount} disabled={!deletePassword || deleting} style={{
                flex:1, padding:'12px', borderRadius:12,
                background: deletePassword && !deleting ? 'rgba(220,50,50,.85)' : 'rgba(249,240,240,.07)',
                border:'none',
                color: deletePassword && !deleting ? '#F9F0F0' : 'rgba(249,240,240,.3)',
                fontSize:14, fontWeight:700, cursor: deletePassword && !deleting ? 'pointer' : 'not-allowed',
                fontFamily:'inherit',
              }}>
                {deleting ? 'Удаляем…' : 'Удалить навсегда'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password change modal */}
      {showPwdModal && (
        <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.6)',
          backdropFilter:'blur(10px)',display:'flex',alignItems:'center',
          justifyContent:'center',padding:'20px'}}
          onMouseDown={e=>{ if(e.target===e.currentTarget) setShowPwdModal(false); }}>
          <div style={{background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
            borderRadius:24,width:'min(100%,420px)',
            boxShadow:'0 8px 48px rgba(0,0,0,.6)',border:'1px solid rgba(249,240,240,.1)',
            overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',padding:'16px 20px',
              borderBottom:'1px solid rgba(249,240,240,.08)'}}>
              <span style={{color:'#F9F0F0',fontSize:17,fontWeight:700,flex:1,display:'inline-flex',alignItems:'center',gap:8}}>
                <Icon name="lock" size={18} /> Смена пароля
              </span>
              <button onClick={()=>setShowPwdModal(false)} style={{background:'none',border:'none',
                color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
            </div>
            <div style={{padding:'18px 20px',display:'flex',flexDirection:'column',gap:14}}>
              {[
                { label:'Текущий пароль', value:oldPwd,  set:setOldPwd  },
                { label:'Новый пароль',   value:newPwd,  set:setNewPwd  },
                { label:'Повторите новый',value:newPwd2, set:setNewPwd2 },
              ].map(f => (
                <div key={f.label}>
                  <div style={{color:'rgba(249,240,240,.5)',fontSize:12,marginBottom:5}}>{f.label}</div>
                  <div style={{position:'relative'}}>
                    <input type={showPwds ? 'text' : 'password'} value={f.value}
                      onChange={e=>f.set(e.target.value)}
                      className="ul-input" placeholder="••••••••"
                      style={{paddingRight:38}}
                      onKeyDown={e=>e.key==='Enter'&&submitPasswordChange()}/>
                    {f.label === 'Текущий пароль' && (
                      <button type="button" onClick={() => setShowPwds(s => !s)}
                        title={showPwds ? 'Скрыть пароли' : 'Показать пароли'}
                        style={{
                          position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                          background:'none', border:'none', cursor:'pointer',
                          color:'rgba(249,240,240,.55)', fontSize:18, lineHeight:1,
                          padding:6, borderRadius:6,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color='rgba(249,240,240,.9)'}
                        onMouseLeave={e => e.currentTarget.style.color='rgba(249,240,240,.55)'}>
                        <Icon name={showPwds ? 'eye-off' : 'eye'} size={18}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pwdErr && (
                <div style={{color:'rgba(255,140,140,.9)',fontSize:13,
                  background:'rgba(200,50,50,.12)',borderRadius:10,padding:'8px 12px'}}>
                  {pwdErr}
                </div>
              )}
            </div>
            <div style={{padding:'4px 20px 20px'}}>
              <button onClick={submitPasswordChange} disabled={pwdSaving}
                style={{width:'100%',padding:'13px',borderRadius:50,fontSize:15,fontWeight:700,
                  cursor:pwdSaving?'not-allowed':'pointer',border:'none',color:'#F9F0F0',
                  background:pwdSaving?'rgba(249,240,240,.1)':'rgba(95, 64, 128,.85)',
                  transition:'all .2s',fontFamily:'inherit',
                  boxShadow:pwdSaving?'none':'0 4px 20px rgba(95, 64, 128,.35)'}}>
                {pwdSaving ? 'Сохраняем…' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
