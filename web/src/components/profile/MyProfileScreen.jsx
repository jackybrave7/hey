import { useState, useEffect, useRef } from 'react';
import { useConfirm } from '../shared/Confirm';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { uploadAvatar } from '../../lib/uploadMedia';
import { validatePhone, formatPhoneInput, caretAfterNthDigit } from '../../lib/phoneFormat';
import { heyToast } from '../shared/Toast';
import { AvatarPicker } from '../shared/AvatarPicker';
import { FieldLine, EmailVerifyHint, BioWithLinks } from '../shared/profileUi';
import Icon from '../Icon';
import HeyLogo from '../HeyLogo';
import MoodEmoji from '../moments/MoodEmoji';
import SuperStatusCard from '../super/SuperStatusCard';
import OnboardingTour from '../OnboardingTour';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import MomentCard from '../moments/MomentCard';
import { useSalesPressure } from '../../lib/publicSettings';
import { MediaImage } from '../shared/MediaImage';
import { mediaUrl } from '../../lib/mediaUrl';
import { ImageLightbox } from '../shared/ImageLightbox';
import { TabHeaderTitle } from '../shared/TabHeaderTitle';
import { personalInviteUrl } from '../../lib/inviteLink';

function ArchiveMomentThumb({ m }) {
  const hasImg = m.media_url && m.media_type === 'image';
  const isVideo = m.media_url && m.media_type === 'video';
  const isAudio = m.media_url && m.media_type === 'audio';
  const embed = m.embedded_video;

  if (hasImg) {
    return (
      <MediaImage src={m.media_url} alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: m.media_position || '50% 50%' }}/>
    );
  }
  if (isVideo) {
    return (
      <>
        <video src={mediaUrl(m.media_url)} muted playsInline preload="metadata"
          onContextMenu={e => e.preventDefault()}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: m.media_position || '50% 50%' }}/>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(249,240,240,.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#2a1a3e',
          boxShadow: '0 4px 14px rgba(0,0,0,.4)',
          zIndex: 2, pointerEvents: 'none',
        }}>▶</div>
      </>
    );
  }
  if (isAudio) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#1a0a38,#2a1858)',
        fontSize: 44, color: 'rgba(249,240,240,.7)' }}>🎵</div>
    );
  }
  if (embed?.thumbnail_url) {
    return (
      <>
        <MediaImage src={embed.thumbnail_url} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.22)', pointerEvents: 'none' }}/>
      </>
    );
  }
  if (embed) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#1e0a40,#4a1a80,#7030b0)',
        fontSize: 36, opacity: .5 }}>🎬</div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <MoodEmoji type={m.mood_emoji || 'calm'} size={64}/>
    </div>
  );
}

export function MyProfileScreen() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [birthday, setBirthday] = useState('');
  const [email,    setEmail]    = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [avatar, setAvatar]     = useState('');
  const [avatarFile, setAvatarFile] = useState(null); // pending File to upload on save
  const [bio, setBio]           = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Invite link
  const [inviteCopied, setInviteCopied] = useState(false);
  const [avatarFull, setAvatarFull] = useState(false);

  // PWA install — слушаем beforeinstallprompt. На Android Chrome/Edge/Opera
  // событие приходит когда сайт удовлетворяет критериям installable (есть
  // manifest, service worker с fetch-handler'ом, HTTPS). Сохраняем prompt,
  // показываем карточку «Установить как приложение».
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true);
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installed = () => { setInstallPrompt(null); setIsStandalone(true); };
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      heyToast('✓ Устанавливаем…', 'success');
      setInstallPrompt(null);
    }
  }

  // Confirm dialog
  const [customConfirm, confirmModal] = useConfirm();

  // Esc — закрывает попапы по очереди, потом уходит на главную ленту.
  // Хук объявляем тут, а реальные state-ссылки подтягиваются ниже.
  // Подключим useEffect после объявления состояний (см. ниже).

  // Archive popup
  const [archiveSelected, setArchiveSelected] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false); // модалка со списком архивных моментов
  const [archiveFilter, setArchiveFilter] = useState(null); // null = «все», иначе строка-тег
  // Active moment popup
  const [activePopupIdx, setActivePopupIdx] = useState(null);

  // Saved moments (Поговорить)
  const [savedMoments, setSavedMoments]     = useState([]);
  const [savedLoading, setSavedLoading]     = useState(false);
  const [savedLoaded,  setSavedLoaded]      = useState(false);
  const [savedOpen,    setSavedOpen]        = useState(false);
  const [savedSelected, setSavedSelected]  = useState(null);

  // Esc: попап → редактирование → выход на ленту /main.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (document.activeElement?.isContentEditable) return;
      if (savedSelected)  { setSavedSelected(null); return; }
      if (archiveSelected){ setArchiveSelected(null); return; }
      if (savedOpen)      { setSavedOpen(false); return; }
      if (archiveOpen)    { setArchiveOpen(false); return; }
      if (editing)        { setEditing(false); return; }
      nav('/main');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, archiveOpen, savedOpen, archiveSelected, savedSelected, nav]);

  function toggleSaved() {
    setSavedOpen(v => {
      if (!v && !savedLoaded) {
        setSavedLoading(true);
        api.getSavedMoments().then(items => {
          setSavedMoments(items);
          setSavedLoading(false);
          setSavedLoaded(true);
        }).catch(() => setSavedLoading(false));
      }
      return !v;
    });
  }

  // Прелоад «Поговорить» при открытии профиля — чтобы счётчик показывался
  // сразу рядом с названием карточки, а не только после первого клика.
  useEffect(() => {
    if (savedLoaded) return;
    api.getSavedMoments()
      .then(items => { setSavedMoments(items); setSavedLoaded(true); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Moments state
  const [momentsTab,    setMomentsTab]   = useState('active');
  const [myMoments,     setMyMoments]    = useState([]);
  const [disciplines,   setDisciplines]  = useState([]);
  const [momentsLoaded, setMomentsLoaded] = useState(false);
  const [profileToast,  setProfileToast] = useState('');

  const showProfileToast = (msg) => {
    setProfileToast(msg);
    setTimeout(() => setProfileToast(''), 3000);
  };

  async function copyPersonalInviteLink() {
    let code = user?.invite_code;
    if (!code) {
      try {
        const r = await api.getInvite();
        code = r.code;
      } catch {
        showProfileToast('Не удалось получить ссылку');
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(personalInviteUrl(code));
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      showProfileToast('Не удалось скопировать ссылку');
    }
  }

  // ── Archive actions ────────────────────────────────────────────────────────
  async function restoreFromArchive(m) {
    const maxActive = user?.is_super ? 3 : 1;
    const curActive = myMoments.filter(x => x.status === 'active').length;
    if (curActive >= maxActive) {
      showProfileToast(maxActive === 1
        ? 'Сначала отправь активный момент в архив'
        : `Достигнут лимит (${maxActive} активных)`);
      return;
    }
    try {
      await api.restoreMoment(m.id);
      setMyMoments(prev => prev.map(x => x.id === m.id ? { ...x, status: 'active' } : x));
      showProfileToast('✦ Момент восстановлен');
    } catch(e) { showProfileToast('Ошибка: ' + e.message); }
  }

  async function deleteForever(m) {
    if (!await customConfirm('Удалить момент навсегда? Это действие нельзя отменить.', { danger: true })) return;
    try {
      await api.deleteMoment(m.id);
      setMyMoments(prev => prev.filter(x => x.id !== m.id));
      showProfileToast('Момент удалён');
    } catch(e) { showProfileToast('Ошибка: ' + e.message); }
  }

  // Init from user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setBirthday(user.birthday || '');
      setAvatar(user.avatar || '');
      setBio(user.bio || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Load moments
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [all, disc] = await Promise.all([
          api.getMyMoments('all'),
          api.getDisciplines(user.id),
        ]);
        setMyMoments(all);
        setDisciplines(disc);
      } catch {}
      setMomentsLoaded(true);
    };
    load();
  }, [user]);

  function startEdit() {
    setEditing(true);
    setSaved(false);
  }

  function cancelEdit() {
    setEditing(false);
    setPhoneErr('');
    setEmailErr('');
    // Reset to saved values
    setName(user.name || '');
    setPhone(user.phone || '');
    setBirthday(user.birthday || '');
    setAvatar(user.avatar || '');
    setAvatarFile(null);
    setBio(user.bio || '');
    setEmail(user.email || '');
  }

  async function saveProfile() {
    if (!name.trim()) return;
    // Email — опциональный, но если введён должен быть валидный
    const trimmedEmail = (email || '').trim();
    if (trimmedEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
        setEmailErr('Неверный формат email');
        return;
      }
    }
    // Проверяем лимит ссылок ДО запроса (повторно проверится на сервере)
    const urls = (bio || '').match(/https?:\/\/\S+/gi) || [];
    const maxLinks = user?.is_super ? 5 : 1;
    if (urls.length > maxLinks) {
      heyToast(user?.is_super
        ? `В описании можно до ${maxLinks} ссылок (у тебя ${urls.length}). Лишние нужно убрать.`
        : `В описании можно только 1 ссылку (у тебя ${urls.length}). В ✦ Super — до 5. Лишние нужно убрать.`, 'error');
      return;
    }
    setSaving(true);
    try {
      // Upload avatar to S3 if a new file was selected
      let finalAvatar = avatar || null;
      if (avatarFile) {
        finalAvatar = await uploadAvatar(avatarFile, { getPresignUrl: api.getPresignUrl });
        setAvatarFile(null);
      }
      // Телефон НЕ отправляем — он закреплён за аккаунтом и не меняется в профиле
      const updated = await api.updateMe({
        name: name.trim(),
        birthday: birthday || null,
        avatar: finalAvatar,
        bio: bio.trim() || null,
        email: trimmedEmail || null,
      });
      setUser(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { heyToast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  // Parse birthday for display boxes
  const bdayParts = birthday ? birthday.split('-') : ['', '', ''];
  const [bdayY, bdayM, bdayD] = bdayParts;

  return (
    <div style={{minHeight:'100vh',background:'var(--grad)',paddingBottom:80}}>

      {/* Sticky header */}
      <div className="tab-header">
        <div className="tab-header-inner">
          <TabHeaderTitle>
            <Icon name="user" size={20}/> Профиль
          </TabHeaderTitle>
          {editing ? (
            <div style={{display:'flex',gap:8}}>
              <button onClick={cancelEdit} style={{background:'rgba(22,15,50,.55)',border:'1px solid rgba(249,240,240,.28)',
                borderRadius:50,height:32,padding:'0 16px',color:'#F9F0F0',fontSize:13,fontWeight:600,cursor:'pointer',
                display:'inline-flex',alignItems:'center'}}>
                Отмена
              </button>
              <button onClick={saveProfile} disabled={saving} style={{
                height:32,padding:'0 18px',borderRadius:50,fontSize:13,fontWeight:700,cursor:'pointer',
                background: saving ? 'rgba(95, 64, 128,.5)' : 'rgba(75, 48, 108,.95)',
                border:'1px solid rgba(200,170,255,.45)',
                boxShadow: saving ? 'none' : '0 2px 10px rgba(0,0,0,.22)',
                color:'#F9F0F0',display:'inline-flex',alignItems:'center'}}>
                {saving ? '…' : 'Сохранить'}
              </button>
            </div>
          ) : (() => {
            // Три круглые иконки: 💜 сохранённые моменты · ⚙ настройки · ✎ редактирование.
            // Идея — компактный action-bar вместо одной кнопки «Изменить».
            const iconBtn = {
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(22,15,50,.55)',
              border: '1px solid rgba(249,240,240,.22)',
              color:'#F9F0F0', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
              padding: 0,
            };
            return (
              <div style={{ display:'flex', gap: 8 }}>
                <button
                  onClick={toggleSaved}
                  title="Поговорить"
                  style={iconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(32,22,68,.78)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,15,50,.55)'}>
                  <Icon name="chat" size={17}/>
                </button>
                <button
                  onClick={() => nav('/settings')}
                  title="Настройки"
                  style={iconBtn}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(32,22,68,.78)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,15,50,.55)'}>
                  <Icon name="settings" size={17}/>
                </button>
                <button
                  onClick={startEdit}
                  title="Редактировать профиль"
                  style={{ ...iconBtn,
                    background: 'rgba(95, 64, 128,.85)',
                    border: '1px solid rgba(180,140,255,.5)',
                    boxShadow: '0 2px 12px rgba(95, 64, 128,.4)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,110,220,.95)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(95, 64, 128,.85)'}>
                  <Icon name="edit" size={17}/>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',width:'100%',padding:'0 0 20px'}}>

      {saved && (
        <div style={{margin:'16px 20px 0',background:'rgba(46,204,113,.3)',border:'1px solid rgba(46,204,113,.5)',
          borderRadius:12,padding:'8px 14px',color:'#F9F0F0',fontSize:14,textAlign:'center'}}>
          ✓ Профиль сохранён
        </div>
      )}

      {/* Avatar + fields. Сверху отступ 28px чтобы между sticky-header'ом
          «Профиль» и аватаркой был воздух — иначе шапка липнет к фото. */}
      <div style={{display:'flex',gap:22,padding:'28px 26px 0',alignItems:'flex-start',minWidth:0}}>
        <AvatarPicker
          avatar={avatar}
          onChange={(url, file) => { setAvatar(url); setAvatarFile(file); }}
          onView={() => setAvatarFull(true)}
          size={130}
          disabled={!editing}
        />

        <div className={editing ? 'profile-edit-fields' : ''} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:16,paddingTop:8}}>

          {/* Имя */}
          {editing ? (
            <div>
              <div className="profile-field-label">Имя</div>
              <input className="ul-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Имя"/>
            </div>
          ) : (
            // Имя — главный акцент шапки профиля: крупный жирный белый.
            <div style={{color:'#F9F0F0',fontSize:24,fontWeight:800,lineHeight:1.15,
              letterSpacing:-.3,paddingBottom:4,marginTop:-4,
              wordBreak:'break-word',overflowWrap:'anywhere'}}>
              {name || '—'}
            </div>
          )}

          {/* Телефон — нельзя менять после регистрации */}
          {editing ? (
            <div>
              <div className="profile-field-label">
                Телефон <span style={{opacity:.75,fontSize:11,fontWeight:500}}>(нельзя изменить)</span>
              </div>
              <input className="ul-input" value={user?.phone || ''} readOnly disabled
                type="tel"
                style={{cursor:'not-allowed'}}/>
              <div className="profile-field-hint">
                Телефон используется для входа и остаётся как при регистрации.
                Для смены — напиши в Telegram-бот поддержки.
              </div>
            </div>
          ) : <FieldLine value={user?.phone || '—'}/>}

          {/* Email — опциональный */}
          {editing ? (
            <div>
              <div className="profile-field-label">
                Email <span style={{opacity:.75,fontSize:11,fontWeight:500}}>(необязательно)</span>
              </div>
              <input className="ul-input" value={email}
                onChange={e=>{ setEmail(e.target.value); setEmailErr(''); }}
                placeholder="you@example.com" type="email"/>
              {emailErr && <div style={{color:'#ffaaaa',fontSize:12,marginTop:4}}>{emailErr}</div>}
              <div className="profile-field-hint">
                Нужен для интеграции со школьными курсами (BL School и т.п.).
                Видишь только ты.
              </div>
            </div>
          ) : (user?.email ? (
            <div>
              <FieldLine value={user.email}/>
              {!user.email_verified && (
                <EmailVerifyHint/>
              )}
            </div>
          ) : null)}

          {/* Дата рождения */}
          {editing ? (
            <div>
              <div className="profile-field-label">Дата рождения</div>
              <input className="ul-input" value={birthday}
                onChange={e=>setBirthday(e.target.value)}
                placeholder="ГГГГ-ММ-ДД" type="date"
                style={{colorScheme:'dark'}}/>
            </div>
          ) : (
            (bdayD && bdayM && bdayY)
              ? <FieldLine value={`${bdayD}.${bdayM}.${bdayY}`}/>
              : null
          )}
        </div>
      </div>

      {/* Bio — full-width row below avatar block */}
      <div className={editing ? 'profile-edit-fields' : ''} style={{padding:'16px 26px 0'}}>
        {editing ? (() => {
          const urls = (bio || '').match(/https?:\/\/\S+/gi) || [];
          const maxLinks = user?.is_super ? 5 : 1;
          const overLimit = urls.length > maxLinks;
          return (
            <div>
              <div className="profile-field-label" style={{marginBottom:6,display:'flex',justifyContent:'space-between'}}>
                <span>О себе</span>
                <span style={{color: bio.length > 180 ? 'rgba(255,200,120,.95)' : 'rgba(249,240,240,.45)',fontWeight:500}}>{bio.length}/200</span>
              </div>
              <textarea
                className={`profile-edit-bio${overLimit ? ' over-limit' : ''}`}
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 200))}
                placeholder="Расскажи о себе — пару строк о том, чем занимаешься…"
                rows={6}
              />
              <div style={{
                marginTop:7,fontSize:12,
                color: overLimit ? 'rgba(255,170,170,1)' : 'rgba(235,225,255,.92)',
                display:'flex',alignItems:'center',gap:6,
              }}>
                <span>🔗</span>
                {overLimit ? (
                  <span>
                    <strong>Слишком много ссылок: {urls.length} из {maxLinks}.</strong>
                    {' '}Лишние нужно убрать.
                  </span>
                ) : (
                  <span>
                    Ссылок: <strong style={{color:'rgba(200,170,255,1)',fontWeight:800}}>{urls.length} из {maxLinks}</strong>
                    {!user?.is_super && <span style={{color:'rgba(249,240,240,.65)'}}> · в ✦ Super — до 5</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })() : user?.bio ? (
          // Bio выделяем отдельной плашкой — не самой яркой, но достаточной
          // чтобы взгляд считывал её как «карточку описания», а не сливался
          // с фоном профиля. Тонкая левая полоса добавляет акцент.
          <div style={{
            color:'#F9F0F0', fontSize:14.5, lineHeight:1.6,
            wordBreak:'break-word', whiteSpace:'pre-wrap',
            background:'rgba(22,15,50,.62)',
            border:'1px solid rgba(249,240,240,.2)',
            borderLeft:'3px solid rgba(180,140,255,.75)',
            borderRadius:12,
            padding:'12px 16px',
            boxShadow:'0 2px 12px rgba(0,0,0,.12)',
          }}>
            <BioWithLinks text={user.bio}/>
          </div>
        ) : null}
      </div>

      {/* Sections: SUPER banner + три карточки (Архив / Сохранённые / Пригласить) */}
      {!editing && (() => {
        // Подсчёты для бейджей в карточках
        const archivedCount = myMoments.filter(m => m.status === 'archived').length;
        const savedCount = savedLoaded ? savedMoments.length : null;
        // SuperStatusCard в state B уже содержит CTA «Пригласи 3 друзей —
        // получи 3 месяца СУПЕР». Дублировать ещё одну карточку «Пригласить
        // друга» в этом случае не нужно — выводим её только в остальных
        // состояниях (Super уже активен / бонус исчерпан).
        const superHasInviteCta = !user?.is_super && !user?.super_bonus_claimed;

        const Card = ({ icon, iconBg, title, subtitle, count, onClick, accent }) => (
          <button onClick={onClick} style={{
            display:'flex', alignItems:'center', gap: 14,
            width:'100%', padding:'14px 16px', borderRadius: 16,
            background: accent ? 'rgba(22,15,50,.78)' : 'rgba(22,15,50,.68)',
            border: accent ? '1px solid rgba(180,140,255,.48)' : '1px solid rgba(249,240,240,.2)',
            boxShadow: '0 2px 14px rgba(0,0,0,.18)',
            color:'#F9F0F0', cursor:'pointer', textAlign:'left',
            transition:'background .15s, border-color .15s', fontFamily:'inherit',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = accent
                ? 'rgba(32,22,68,.88)' : 'rgba(32,22,68,.82)';
              e.currentTarget.style.borderColor = accent
                ? 'rgba(200,170,255,.58)' : 'rgba(249,240,240,.28)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = accent
                ? 'rgba(22,15,50,.78)' : 'rgba(22,15,50,.68)';
              e.currentTarget.style.borderColor = accent
                ? 'rgba(180,140,255,.48)' : 'rgba(249,240,240,.2)';
            }}>
            <div style={{
              flexShrink: 0, width: 44, height: 44, borderRadius: 12,
              background: iconBg || 'rgba(95, 64, 128,.45)',
              border: '1px solid rgba(249,240,240,.14)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 22, color:'#F9F0F0',
            }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color:'#F9F0F0', fontSize: 15, fontWeight: 700 }}>{title}</div>
              <div style={{ color:'rgba(235,228,245,.82)', fontSize: 12, marginTop: 3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {subtitle}
              </div>
            </div>
            {count !== null && count !== undefined && (
              <span style={{ color:'rgba(245,238,255,.92)', fontSize: 14, fontWeight: 700 }}>{count}</span>
            )}
            <span style={{ color:'rgba(235,228,245,.72)', fontSize: 18, marginLeft: 6 }}>›</span>
          </button>
        );

        return (
          <div style={{ padding:'18px 26px 0', display:'flex', flexDirection:'column', gap: 12 }}>
            <Card
              icon={<Icon name="archive" size={22}/>}
              iconBg="rgba(255,200,150,.32)"
              title="Архив моих моментов"
              subtitle="Прошлые работы и публикации"
              count={archivedCount || null}
              onClick={() => setArchiveOpen(true)}
            />
            <Card
              icon={<Icon name="bookmark" size={22}/>}
              iconBg="rgba(255,200,120,.34)"
              title="Поговорить"
              subtitle="Закладки, что меня зацепило"
              // count=0 → не показываем число (как у архива). Раньше
              // юзеру светилась пустая «0» если ничего не сохранено.
              count={savedCount || null}
              onClick={() => { if (!savedOpen) toggleSaved(); else setSavedOpen(true); }}
            />
            {!superHasInviteCta && (
              <Card
                icon={<Icon name="link" size={22}/>}
                iconBg="rgba(180,140,255,.38)"
                title={inviteCopied ? '✓ Ссылка скопирована' : 'Пригласить друга'}
                subtitle="Поделиться ссылкой на HEY"
                count={null}
                accent={true}
                onClick={copyPersonalInviteLink}
              />
            )}

            {/* Install PWA — карточка появляется только если браузер сам
                поднял beforeinstallprompt (Android Chrome/Edge/Opera/Samsung).
                В iOS Safari prompt не приходит — там устанавливают через
                «Поделиться → На главный экран», поэтому скрываем. */}
            {installPrompt && !isStandalone && (
              <Card
                icon={<Icon name="download" size={22}/>}
                iconBg="rgba(140,200,140,.36)"
                title="Установить как приложение"
                subtitle="Иконка на главный экран, без бара браузера"
                count={null}
                accent={true}
                onClick={handleInstall}
              />
            )}

            {!!user?.is_admin && (
              <button onClick={() => nav('/admin')} style={{
                display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'13px 18px',borderRadius:14,cursor:'pointer',
                background:'rgba(95, 64, 128,.18)',border:'1px solid rgba(180,140,255,.3)',
                color:'rgba(200,180,255,.95)',fontSize:14,fontWeight:600,
                transition:'background .15s', marginTop: 4,
              }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(95, 64, 128,.32)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(95, 64, 128,.18)'}>
                <span style={{display:'inline-flex',alignItems:'center',gap:10}}><Icon name="settings" size={18}/> Панель администратора</span>
                <span style={{opacity:.5}}>›</span>
              </button>
            )}

            {/* SUPER status banner — переносим в конец списка карточек.
                Раньше висел над «Архив / Поговорить / Пригласить», но
                юзер просил убрать оттуда — это статус, а не действие,
                и место ему внизу, после операционных карточек. */}
            <SuperStatusCard user={user} onInvite={copyPersonalInviteLink}/>
          </div>
        );
      })()}

      {/* Moments section — старая «Мои моменты» убрана. Доступ к активным
          моментам идёт через ленту /main, к архиву — через карточку «Архив
          моих моментов» выше. Сохраняем JSX скрытым, чтобы переменные не
          теряли потребителей и build не падал. */}
      {!editing && false && (
        <div style={{padding:'28px 20px 0'}}>
          <div style={{color:'rgba(249,240,240,.4)',fontSize:11,textTransform:'uppercase',
            letterSpacing:.8,marginBottom:14}}>Мои моменты</div>

          {/* Tabs */}
          {(() => {
            const activeMoments = myMoments.filter(m => m.status === 'active');
            const archivedMoments = myMoments.filter(m => m.status === 'archived');
            const maxActive = user?.is_super ? 3 : 1;
            return (<>
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            {/* «Активные» — обычный таб (всегда активен) */}
            <button
              style={{
                padding:'7px 18px',borderRadius:50,fontSize:13,fontWeight:600,cursor:'default',
                background:'rgba(95, 64, 128,.8)',
                border:'1px solid rgba(180,140,255,.4)',
                color:'#F9F0F0',
              }}>
              {activeMoments.length > 0 ? `Активные (${activeMoments.length})` : 'Активные'}
            </button>
            {/* «Архив» — открывает поп-ап */}
            {archivedMoments.length > 0 && (
              <button onClick={() => setArchiveOpen(true)}
                style={{
                  padding:'7px 16px',borderRadius:50,fontSize:13,fontWeight:600,cursor:'pointer',
                  background:'rgba(249,240,240,.08)',
                  border:'1px solid rgba(249,240,240,.1)',
                  color:'rgba(249,240,240,.6)',
                  transition:'all .18s',
                  display:'flex',alignItems:'center',gap:6,
                }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(249,240,240,.14)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(249,240,240,.08)'}>
                <span>📦 Архив ({archivedMoments.length})</span>
                <span style={{opacity:.5}}>›</span>
              </button>
            )}
          </div>

          {/* Active tab */}
          {momentsTab === 'active' && (
            <div>
              {activeMoments.length === 0 ? (
                <div style={{background:'rgba(249,240,240,.04)',borderRadius:16,
                  padding:'24px',textAlign:'center',border:'2px dashed rgba(249,240,240,.1)'}}>
                  <div style={{marginBottom:10,display:'flex',justifyContent:'center'}}><HeyLogo size={28} color="rgba(249,240,240,.55)" /></div>
                  <div style={{color:'rgba(249,240,240,.6)',fontSize:14,fontWeight:600}}>
                    Нет активных моментов
                  </div>
                  <div style={{color:'rgba(249,240,240,.35)',fontSize:12,marginTop:6}}>
                    Опубликуй первый момент на главном экране
                  </div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns: activeMoments.length > 1 ? '1fr 1fr' : '1fr',gap:10}}>
                  {activeMoments.map((active, i) => (
                    <div key={active.id}
                      onClick={() => setActivePopupIdx(i)}
                      style={{background:'rgba(249,240,240,.06)',borderRadius:16,
                        border:'1px solid rgba(249,240,240,.1)',overflow:'hidden',
                        cursor:'pointer',transition:'background .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.1)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(249,240,240,.06)'}>
                      {active.media_url && active.media_type === 'image' ? (
                        <MediaImage src={active.media_url} alt=""
                          style={{width:'100%',height: activeMoments.length > 1 ? 100 : 140,objectFit:'cover',
                            objectPosition: active.media_position || '50% 50%',display:'block'}}/>
                      ) : (
                        <div style={{width:'100%',height: activeMoments.length > 1 ? 80 : 0,
                          background:'linear-gradient(135deg,rgba(80,40,140,.4),rgba(120,60,200,.3))',
                          display: activeMoments.length > 1 ? 'flex' : 'none',
                          alignItems:'center',justifyContent:'center'}}><HeyLogo size={28} color="rgba(249,240,240,.25)" /></div>
                      )}
                      <div style={{padding: activeMoments.length > 1 ? '10px 12px' : '14px 16px'}}>
                        <div style={{color:'rgba(249,240,240,.85)',fontSize: activeMoments.length > 1 ? 12 : 14,lineHeight:1.5,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp: activeMoments.length > 1 ? 3 : 4,WebkitBoxOrient:'vertical'}}>
                          {active.text}
                        </div>
                        <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eye"     size={12}/>{active.views || 0}</span>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="waves" size={12}/>{active.stats?.resonate || 0}</span>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="chat"    size={12}/>{active.stats?.talk || 0}</span>
                        </div>
                        <button onClick={async e => {
                          e.stopPropagation();
                          try {
                            await api.archiveMoment(active.id);
                            setMyMoments(prev => prev.map(m => m.id === active.id ? {...m, status:'archived'} : m));
                            showProfileToast('📦 Момент отправлен в архив');
                          } catch(e2) { showProfileToast('Ошибка: ' + e2.message); }
                        }} style={{marginTop:8,width:'100%',padding:'7px',borderRadius:10,
                          background:'rgba(249,240,240,.07)',border:'none',
                          color:'rgba(249,240,240,.5)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                          📦 В архив
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeMoments.length < maxActive && activeMoments.length > 0 && (
                <div style={{marginTop:10,color:'rgba(249,240,240,.3)',fontSize:12,textAlign:'center'}}>
                  {user?.is_super
                    ? `Можно добавить ещё ${maxActive - activeMoments.length} момент(а) — перейди в ленту`
                    : null}
                </div>
              )}
            </div>
          )}</>) })()}

          {/* Archive — теперь в поп-апе (см. ниже {archiveOpen && ...}) */}
          {false && (() => {
            const archived = myMoments.filter(m => m.status === 'archived');
            return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {archived.map(m => {
                  const hasImg = m.media_url && m.media_type === 'image';
                  const isAudio = m.media_url && m.media_type === 'audio';
                  return (
                    <div key={m.id} onClick={() => setArchiveSelected(m)}
                      style={{background:'rgba(249,240,240,.06)',borderRadius:16,
                        border:'1px solid rgba(249,240,240,.1)',overflow:'hidden',
                        cursor:'pointer',transition:'background .15s',
                        display:'flex',flexDirection:'column'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(249,240,240,.1)'}
                      onMouseLeave={e=>e.currentTarget.style.background='rgba(249,240,240,.06)'}>
                      {/* Hero: фото / mood / аудио-иконка */}
                      {hasImg ? (
                        <MediaImage src={m.media_url} alt=""
                          style={{width:'100%',height:100,objectFit:'cover',
                            objectPosition: m.media_position || '50% 50%',display:'block'}}/>
                      ) : isAudio ? (
                        <div style={{width:'100%',height:100,
                          background:'linear-gradient(135deg,#1a0a38,#2a1858)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:36,color:'rgba(249,240,240,.7)'}}>🎵</div>
                      ) : (
                        <div style={{width:'100%',height:100,overflow:'hidden'}}>
                          <MoodEmoji type={m.mood_emoji || 'calm'} size={56}/>
                        </div>
                      )}
                      <div style={{padding:'10px 12px',flex:1,display:'flex',flexDirection:'column',gap:8}}>
                        <div style={{color:'rgba(249,240,240,.85)',fontSize:12,lineHeight:1.45,
                          overflow:'hidden',display:'-webkit-box',
                          WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
                          {m.text}
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="eye"     size={12}/>{m.views || 0}</span>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="waves" size={12}/>{m.stats?.resonate || 0}</span>
                          <span style={{fontSize:11,color:'rgba(249,240,240,.4)',display:'inline-flex',alignItems:'center',gap:4}}><Icon name="chat"    size={12}/>{m.stats?.talk || 0}</span>
                        </div>
                        <div style={{color:'rgba(249,240,240,.3)',fontSize:11,
                          display:'flex',alignItems:'center',gap:4}}>
                          📦 {m.archived_at
                            ? new Date(m.archived_at * 1000).toLocaleDateString('ru', {day:'numeric',month:'short'})
                            : 'в архиве'}
                        </div>
                        {/* Actions */}
                        <div style={{display:'flex',gap:6,marginTop:4}}>
                          <button onClick={(e) => { e.stopPropagation(); restoreFromArchive(m); }}
                            style={{
                              flex:1,padding:'7px 4px',borderRadius:10,
                              background:'rgba(95, 64, 128,.5)',border:'1px solid rgba(180,140,220,.3)',
                              color:'#F9F0F0',fontSize:11,fontWeight:600,cursor:'pointer',
                              transition:'background .15s',whiteSpace:'nowrap',
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(95, 64, 128,.7)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(95, 64, 128,.5)'}>
                            ↩ Восстановить
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteForever(m); }}
                            style={{
                              padding:'7px 9px',borderRadius:10,
                              background:'rgba(255,80,80,.12)',border:'1px solid rgba(255,80,80,.3)',
                              color:'rgba(255,140,140,.95)',fontSize:13,cursor:'pointer',
                              transition:'background .15s',flexShrink:0,
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,80,80,.22)'}
                            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,80,80,.12)'}
                            title="Удалить навсегда">
                            <Icon name="trash" size={15}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        </div>
      )}


      {/* Confirm dialog */}
      {confirmModal}

      {/* Toast */}
      {profileToast && (
        <div style={{
          position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',
          background:'rgba(30,20,60,.95)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(249,240,240,.15)',
          borderRadius:50,padding:'10px 20px',
          color:'#F9F0F0',fontSize:14,fontWeight:600,
          zIndex:1000,whiteSpace:'nowrap',
        }}>
          {profileToast}
        </div>
      )}

      {/* Active moment popup */}
      {activePopupIdx !== null && (() => {
        const activeMoments = myMoments.filter(m => m.status === 'active')
          .map(m => ({ ...m, author_name: user?.name, author_avatar: user?.avatar }));
        if (!activeMoments.length) return null;
        return (
          <MomentDetailPopup
            moments={activeMoments}
            initialIndex={activePopupIdx}
            currentUser={user}
            onClose={() => setActivePopupIdx(null)}
            onEdit={() => {}}
            onArchive={(m) => {
              setMyMoments(prev => prev.map(x => x.id === m.id ? {...x, status:'archived'} : x));
              setActivePopupIdx(null);
              showProfileToast('📦 Момент отправлен в архив');
            }}
            onDelete={(m) => {
              setMyMoments(prev => prev.filter(x => x.id !== m.id));
              setActivePopupIdx(null);
              showProfileToast('Момент удалён');
            }}
            onMomentUpdated={(fresh) => {
              setMyMoments(prev => prev.map(x => x.id === fresh.id ? { ...x, ...fresh } : x));
            }}
          />
        );
      })()}

      {/* Saved moment popup */}
      {savedSelected && (
        <MomentDetailPopup
          moments={[savedSelected]}
          initialIndex={0}
          currentUser={user}
          onClose={() => setSavedSelected(null)}
          onEdit={() => {}}
          onArchive={() => {}}
          onDelete={() => {}}
        />
      )}

      {/* Saved moments — список всех сохранённых (закладки чужих работ) */}
      {savedOpen && createPortal(
        <div onMouseDown={e => { if (e.target === e.currentTarget) setSavedOpen(false); }}
          style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
            backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{
            width:'min(94vw,640px)', maxHeight:'88vh',
            background:'rgba(38,28,68,.97)', backdropFilter:'blur(24px)',
            borderRadius: 18, boxShadow:'0 24px 64px rgba(0,0,0,.55)',
            border:'1px solid rgba(249,240,240,.12)',
            display:'flex', flexDirection:'column', overflow:'hidden',
          }}>
            <div style={{ padding:'16px 20px 12px', display:'flex', alignItems:'center', gap:10,
              borderBottom:'1px solid rgba(249,240,240,.08)', flexShrink:0 }}>
              <Icon name="bookmark" size={22} style={{ color:'rgba(220,200,255,.9)' }}/>
              <div style={{ flex: 1 }}>
                <div style={{ color:'#F9F0F0', fontSize: 17, fontWeight: 700 }}>Поговорить</div>
                <div style={{ color:'rgba(249,240,240,.45)', fontSize: 12, marginTop: 1 }}>
                  {savedLoading ? 'загрузка…' :
                    `${savedMoments.length} ${savedMoments.length === 1 ? 'момент' :
                      (savedMoments.length % 10 >= 2 && savedMoments.length % 10 <= 4 &&
                       (savedMoments.length % 100 < 10 || savedMoments.length % 100 >= 20) ? 'момента' : 'моментов')}`}
                </div>
              </div>
              <button onClick={() => setSavedOpen(false)}
                style={{ background:'none', border:'none', color:'rgba(249,240,240,.5)',
                  fontSize: 24, cursor:'pointer', lineHeight: 1, padding: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY:'auto', padding: 14 }}>
              {savedLoading ? (
                <div style={{ textAlign:'center', padding:'40px 20px',
                  color:'rgba(249,240,240,.3)', fontSize: 14 }}>Загрузка…</div>
              ) : savedMoments.length === 0 ? (
                <div style={{ background:'rgba(249,240,240,.04)', borderRadius: 16,
                  padding:'30px 20px', textAlign:'center', border:'2px dashed rgba(249,240,240,.12)' }}>
                  <div style={{ marginBottom: 12, display:'flex', justifyContent:'center',
                    color:'rgba(220,200,255,.5)' }}>
                    <Icon name="bookmark" size={36} stroke={1.5}/>
                  </div>
                  <div style={{ color:'rgba(249,240,240,.8)', fontSize: 14, fontWeight: 600 }}>
                    Пока пусто
                  </div>
                  <div style={{ color:'rgba(249,240,240,.5)', fontSize: 12, marginTop: 6,
                    display:'inline-flex', alignItems:'center', gap:4, justifyContent:'center' }}>
                    Отмечай моменты иконкой{' '}
                    <Icon name="bookmark" size={13} stroke={1.8}
                      style={{ color:'rgba(220,200,255,.75)', verticalAlign:'middle' }}/>
                    {' '}— они появятся здесь
                  </div>
                </div>
              ) : (
                <div style={{ display:'grid',
                  gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                  {savedMoments.map(m => (
                    <div key={m.id} onClick={() => setSavedSelected(m)}
                      style={{ background:'rgba(249,240,240,.06)', borderRadius: 14,
                        border:'1px solid rgba(249,240,240,.1)', overflow:'hidden',
                        cursor:'pointer', aspectRatio:'1/1', position:'relative' }}>
                      {m.media_url && m.media_type === 'image' ? (
                        <MediaImage src={m.media_url} alt=""
                          style={{ width:'100%', height:'100%', objectFit:'cover',
                            objectPosition: m.media_position || '50% 50%' }}/>
                      ) : (
                        <div style={{ width:'100%', height:'100%', display:'flex',
                          alignItems:'center', justifyContent:'center',
                          background:'linear-gradient(135deg,#1e0a40,#3a1060)' }}>
                          <HeyLogo size={28} color="rgba(249,240,240,.55)" />
                        </div>
                      )}
                      <div style={{ position:'absolute', bottom: 0, left: 0, right: 0,
                        background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)',
                        padding:'6px 8px', fontSize: 11, color:'rgba(249,240,240,.85)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {m.author_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Archive list popup — модалка со всеми архивными моментами (может быть много) */}
      {archiveOpen && (() => {
        const archived = myMoments.filter(m => m.status === 'archived');
        return createPortal(
          <div onMouseDown={e => { if (e.target === e.currentTarget) setArchiveOpen(false); }}
            style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,.6)',
              backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{
              width:'min(94vw,640px)',maxHeight:'88vh',
              background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
              borderRadius:18,
              boxShadow:'0 24px 64px rgba(0,0,0,.55)',
              border:'1px solid rgba(249,240,240,.12)',
              display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'16px 20px 12px',display:'flex',alignItems:'center',gap:10,
                borderBottom:'1px solid rgba(249,240,240,.08)',flexShrink:0}}>
                <span style={{fontSize:22}}>📦</span>
                <div style={{flex:1}}>
                  <div style={{color:'#F9F0F0',fontSize:17,fontWeight:700}}>Архив моментов</div>
                  <div style={{color:'rgba(249,240,240,.45)',fontSize:12,marginTop:1}}>
                    {archived.length} {archived.length === 1 ? 'момент' :
                      (archived.length % 10 >= 2 && archived.length % 10 <= 4 && (archived.length % 100 < 10 || archived.length % 100 >= 20) ? 'момента' : 'моментов')}
                  </div>
                </div>
                <button onClick={() => setArchiveOpen(false)}
                  style={{background:'none',border:'none',color:'rgba(249,240,240,.5)',
                    fontSize:24,cursor:'pointer',lineHeight:1,padding:0}}>✕</button>
              </div>
              {/* Discipline chips — фильтр по тегам внутри попапа */}
              {disciplines.length > 0 && archived.length > 0 && (
                <div style={{padding:'12px 16px 4px',borderBottom:'1px solid rgba(249,240,240,.05)',flexShrink:0}}>
                  <div style={{color:'rgba(249,240,240,.4)',fontSize:10,fontWeight:700,
                    letterSpacing:.8,textTransform:'uppercase',marginBottom:8}}>
                    Дисциплины
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {[{ tag: null, label: `Все · ${archived.length}` },
                      ...disciplines.map(d => ({ tag: d.tag, label: `${d.tag} · ${d.count}` }))
                     ].map(({ tag, label }) => {
                      const active = archiveFilter === tag;
                      return (
                        <button key={tag ?? '__all__'}
                          onClick={() => setArchiveFilter(tag)}
                          style={{
                            background: active ? 'rgba(140,100,220,.55)' : 'rgba(249,240,240,.06)',
                            border: active ? '1px solid rgba(200,160,255,.55)' : '1px solid rgba(249,240,240,.12)',
                            borderRadius:50,padding:'5px 12px',fontSize:12,fontWeight:600,
                            color: active ? '#F9F0F0' : 'rgba(235,215,255,.85)',
                            cursor:'pointer',fontFamily:'inherit',
                          }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{flex:1,overflowY:'auto',padding:14,minHeight:0}}>
                {archived.length === 0 ? (
                  <div style={{background:'rgba(249,240,240,.04)',borderRadius:16,
                    padding:'30px 20px',textAlign:'center',border:'2px dashed rgba(249,240,240,.1)'}}>
                    <div style={{fontSize:32,marginBottom:10,opacity:.6}}>📦</div>
                    <div style={{color:'rgba(249,240,240,.6)',fontSize:14,fontWeight:600}}>
                      Архив пуст
                    </div>
                    <div style={{color:'rgba(249,240,240,.35)',fontSize:12,marginTop:6}}>
                      Архивные моменты появятся здесь после того, как ты сам уберёшь их с публикации
                    </div>
                  </div>
                ) : (() => {
                  const filtered = archiveFilter
                    ? archived.filter(m => (m.auto_tags || []).includes(archiveFilter))
                    : archived;
                  if (!filtered.length) {
                    return (
                      <div style={{color:'rgba(249,240,240,.45)',fontSize:13,textAlign:'center',padding:30}}>
                        В этой дисциплине пусто
                      </div>
                    );
                  }
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
                      {filtered.map(m => (
                          <div key={m.id} onClick={() => setArchiveSelected(m)}
                            style={{
                              position:'relative', aspectRatio:'1/1',
                              background:'rgba(249,240,240,.06)', borderRadius:14,
                              border:'1px solid rgba(249,240,240,.1)', overflow:'hidden',
                              cursor:'pointer', transition:'transform .15s, box-shadow .15s',
                            }}
                            onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.02)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(0,0,0,.4)'; }}
                            onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='none'; }}>
                            <ArchiveMomentThumb m={m} />
                            {/* Bottom overlay: title + actions */}
                            <div style={{
                              position:'absolute',left:0,right:0,bottom:0,
                              background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.78) 70%)',
                              padding:'24px 10px 10px',
                              display:'flex',flexDirection:'column',gap:6,
                            }}>
                              <div style={{color:'#F9F0F0',fontSize:12,fontWeight:600,lineHeight:1.35,
                                overflow:'hidden',display:'-webkit-box',
                                WebkitLineClamp:2,WebkitBoxOrient:'vertical',
                                textShadow:'0 1px 3px rgba(0,0,0,.6)'}}>
                                {m.text || '✦'}
                              </div>
                              <div style={{display:'flex',gap:6}}>
                                <button onClick={(e) => { e.stopPropagation(); restoreFromArchive(m); }}
                                  title="Восстановить в активные"
                                  style={{
                                    flex:1,padding:'6px 4px',borderRadius:8,
                                    background:'rgba(95, 64, 128,.7)',border:'1px solid rgba(180,140,220,.5)',
                                    color:'#F9F0F0',fontSize:11,fontWeight:600,cursor:'pointer',
                                    fontFamily:'inherit',whiteSpace:'nowrap',
                                  }}>
                                  ↩
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); deleteForever(m); }}
                                  title="Удалить навсегда"
                                  style={{
                                    padding:'6px 10px',borderRadius:8,
                                    background:'rgba(220,60,60,.5)',border:'1px solid rgba(255,140,140,.4)',
                                    color:'#F9F0F0',fontSize:12,cursor:'pointer',fontFamily:'inherit',
                                  }}>
                                  <Icon name="trash" size={12}/>
                                </button>
                              </div>
                            </div>
                          </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Archive moment popup */}
      {archiveSelected && (() => {
        const archivedMoments = myMoments.filter(m => m.status === 'archived')
          .map(m => ({ ...m, author_name: user?.name, author_avatar: user?.avatar }));
        const archIdx = archivedMoments.findIndex(m => m.id === archiveSelected.id);
        const maxActive = user?.is_super ? 3 : 1;
        const activeCount = myMoments.filter(m => m.status === 'active').length;
        return (
          <MomentDetailPopup
            moments={archivedMoments}
            initialIndex={archIdx >= 0 ? archIdx : 0}
            currentUser={user}
            onClose={() => setArchiveSelected(null)}
            onEdit={() => {}}
            onArchive={() => {}}
            onDelete={(m) => {
              setMyMoments(prev => prev.filter(x => x.id !== m.id));
              setArchiveSelected(null);
              showProfileToast('Момент удалён');
            }}
            onRestore={async (m) => {
              const curActive = myMoments.filter(x => x.status === 'active').length;
              if (curActive >= maxActive) {
                showProfileToast(maxActive === 1
                  ? 'Сначала отправь текущий момент в архив'
                  : `Достигнут лимит (${maxActive} активных)`);
                return;
              }
              try {
                await api.restoreMoment(m.id);
                setMyMoments(prev => prev.map(x =>
                  x.id === m.id ? { ...x, status: 'active' } : x
                ));
                setArchiveSelected(null);
                showProfileToast('✦ Момент восстановлен');
              } catch(e) { showProfileToast('Ошибка: ' + e.message); }
            }}
          />
        );
      })()}

      </div>{/* end 680 inner wrapper */}

      {avatarFull && avatar && (
        <ImageLightbox
          urls={[avatar]}
          index={0}
          onClose={() => setAvatarFull(false)}
          zIndex={650}
        />
      )}
    </div>
  );
}
