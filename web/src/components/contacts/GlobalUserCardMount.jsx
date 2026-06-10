import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { heyToast } from '../shared/Toast';
import { useConfirm } from '../shared/Confirm';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import { ContactCardModal } from './ContactCardModal';

export function GlobalUserCardMount() {
  const [userId, setUserId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [blocked, setBlocked] = useState([]);
  // Открытие момента поверх карточки — закрытие возвращает в карточку
  const [openedMoments, setOpenedMoments] = useState(null); // { moments, index } | null
  const nav = useNavigate();
  const location = useLocation();
  const { user: me } = useAuth();
  const [customConfirm, confirmModal] = useConfirm();

  useEffect(() => {
    function onOpen(e) {
      const id = e.detail;
      if (!id || id === me?.id) return;  // на себя не открываем
      setUserId(id);
      api.getContacts().then(setContacts).catch(() => {});
      api.getBlocked().then(setBlocked).catch(() => {});
    }
    window.addEventListener('hey:open-user-card', onOpen);
    return () => window.removeEventListener('hey:open-user-card', onOpen);
  }, [me?.id]);

  // При смене URL (например юзер из карточки нажал «Написать» → переход
  // на /chat/:id) — закрываем весь стэк модалок. Карточка контакта
  // остаётся открытой при просмотре моментов того же юзера (внутрь
  // картинки/момента URL не меняется), но любая SPA-навигация на другой
  // route должна свернуть карточку.
  useEffect(() => {
    setUserId(null);
    setOpenedMoments(null);
  }, [location.pathname]);

  if (!userId) return null;
  const fromContacts = contacts.find(c => c.id === userId);
  const contactObj = fromContacts || { id: userId, name: '…', notes: null, nickname: null };
  const isContact   = !!fromContacts;
  const isBlocked   = blocked.some(b => b.id === userId);

  async function refreshLists() {
    try { setContacts(await api.getContacts()); } catch {}
    try { setBlocked(await api.getBlocked()); }   catch {}
  }

  return (<>
    {confirmModal}
    <ContactCardModal
      contact={contactObj}
      isBlocked={isBlocked}
      isContact={isContact}
      onClose={() => setUserId(null)}
      onChat={async () => {
        try {
          const conv = await api.openConversation(userId);
          setUserId(null);
          nav(`/chat/${conv.id}`);
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onAddContact={async () => {
        try {
          await api.addContact({ userId });
          await refreshLists();
          heyToast('✓ Добавлено в контакты', 'success');
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onRemoveContact={async () => {
        const ok = await customConfirm('Удалить из контактов? Чат и переписка останутся.',
            { confirmLabel: 'Удалить' });
        if (!ok) return;
        try {
          await api.deleteContact(userId);
          await refreshLists();
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onBlock={async () => {
        if (!await customConfirm('Заблокировать пользователя? Он не сможет писать тебе и видеть твои моменты.',
            { confirmLabel: 'Заблокировать', danger: true })) return;
        try {
          await api.blockUser(userId);
          await refreshLists();
          heyToast('Заблокирован', 'info');
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onUnblock={async () => {
        try {
          await api.unblockUser(userId);
          await refreshLists();
        } catch (e) { heyToast('Ошибка: ' + e.message, 'error'); }
      }}
      onNotesChange={() => refreshLists()}
      onOpenMoment={(m) => {
        // Открываем поверх карточки, не закрывая её. Передаём все active
        // moments юзера в попап чтобы юзер мог свайпать между ними.
        const fresh = contacts.find(c => c.id === userId);
        const all = (fresh?.active_moments || []).filter(x => x && x.id);
        const list = all.length ? all : [m];
        const idx = Math.max(0, list.findIndex(x => x.id === m.id));
        setOpenedMoments({ moments: list, index: idx });
      }}
    />
    {/* Moment popup поверх карточки — закрытие НЕ скрывает карточку */}
    {openedMoments && (
      <MomentDetailPopup
        moments={openedMoments.moments}
        initialIndex={openedMoments.index}
        currentUser={me}
        onClose={() => setOpenedMoments(null)}
        zIndex={11000} /* выше ContactCardModal (z:10500) — иначе попап
                          уезжает под открывшую его карточку */
      />
    )}
  </>);
}
