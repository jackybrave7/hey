// AdminReports.jsx — список жалоб от пользователей
import { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';
import { useAuth } from '../../AuthContext';
import MomentDetailPopup from '../moments/MomentDetailPopup';
import { useBulkSelection, Checkbox, BulkActionBar } from './bulk';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru', {
    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit',
  });
}

const STATUS_LABELS = {
  open:      { l: 'Открыта',   color: 'rgba(255,200,100,.95)' },
  resolved:  { l: 'Решена',    color: 'rgba(100,220,140,.95)' },
  dismissed: { l: 'Отклонена', color: 'rgba(180,180,180,.85)' },
};
const TARGET_LABELS = {
  moment:  '✦ Момент',
  user:    '👤 Пользователь',
  message: '💬 Сообщение',
};

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [status, setStatus]   = useState('open');
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');
  const [customConfirm, confirmModal, customPrompt] = useConfirm();
  const { user: adminUser } = useAuth();
  // momentPopup = null | { moments: [m], idx: 0 } — для inline-просмотра
  const [momentPopup, setMomentPopup] = useState(null);
  const [loadingMoment, setLoadingMoment] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulk = useBulkSelection();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminGetReports(status);
      setReports(data);
    } catch (e) {
      showToast('Ошибка: ' + e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [status]);

  async function openMomentPopup(momentId) {
    setLoadingMoment(true);
    try {
      const m = await api.getMoment(momentId);
      setMomentPopup({ moments: [m], idx: 0 });
    } catch (e) {
      showToast('Момент недоступен: ' + (e.message || 'удалён'));
    }
    setLoadingMoment(false);
  }

  async function handleAdminDeleteMoment(moment, hard = false) {
    const reason = await customPrompt(
      <>
        <div style={{fontWeight:600,marginBottom:8}}>
          {hard ? '💣 ПОЛНОСТЬЮ стереть момент?' : 'Удалить момент?'}
        </div>
        <div style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:4}}>
          «{(moment.text || '').slice(0, 120)}{(moment.text || '').length > 120 ? '…' : ''}»
        </div>
        {hard && (
          <div style={{color:'rgba(255,160,160,.85)',fontSize:12,marginTop:8,lineHeight:1.5}}>
            Удалит строку из БД и медиа из S3. Восстановить нельзя.
          </div>
        )}
      </>,
      {
        promptPlaceholder: 'Причина удаления (необязательно)',
        confirmLabel: hard ? '💣 Стереть' : 'Удалить',
        danger: true,
      }
    );
    if (reason === null) return;
    try {
      await api.adminDeleteMoment(moment.id, reason || undefined, hard ? true : undefined);
      showToast(hard ? '✓ Момент стёрт' : '✓ Момент удалён');
      setMomentPopup(null);
      // adminDeleteMoment в БД авто-резолвит все открытые жалобы на этот момент.
      load();
    } catch (e) {
      showToast('Ошибка: ' + e.message);
    }
  }

  const openIds = useMemo(
    () => reports.filter(r => r.status === 'open').map(r => r.id),
    [reports]
  );
  const headerCheckState = useMemo(() => {
    if (!openIds.length || !bulk.count) return { checked: false, indeterminate: false };
    const allSelected = openIds.every(id => bulk.has(id));
    return { checked: allSelected, indeterminate: !allSelected };
  }, [openIds, bulk]);

  async function applyBulkAction(action) {
    const ids = bulk.ids().filter(id => openIds.includes(id));
    if (!ids.length) { showToast('Можно групповым действием закрыть только открытые жалобы'); return; }
    const label = action === 'resolved' ? 'отметить как решённые' : 'отклонить';
    const ok = await customConfirm(
      `${action === 'resolved' ? 'Принять меры' : 'Отклонить'} по ${ids.length} ${ids.length === 1 ? 'жалобе' : 'жалобам'}?`,
      { danger: action !== 'resolved', confirmLabel: action === 'resolved' ? '✓ Принять меры' : 'Отклонить' }
    );
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await api.adminBatchReports(ids, action);
      showToast(`✓ ${label}: ${res.processed}`);
      bulk.clear();
      load();
    } catch (e) { showToast('Ошибка: ' + e.message); }
    setBulkBusy(false);
  }

  async function resolve(r, action) {
    const label = action === 'resolved' ? 'отметить как решённую' : 'отклонить';
    if (!await customConfirm(`Действительно ${label} эту жалобу?`, { danger: action !== 'resolved' })) return;
    try {
      await api.adminResolveReport(r.id, action);
      showToast(action === 'resolved' ? '✓ Решена' : '✓ Отклонена');
      load();
    } catch (e) {
      showToast('Ошибка: ' + e.message);
    }
  }

  const TABS = [
    { v: 'open',      l: 'Открытые' },
    { v: 'resolved',  l: 'Решённые' },
    { v: 'dismissed', l: 'Отклонённые' },
    { v: 'all',       l: 'Все' },
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        🚩 Жалобы
      </h1>
      <p style={{ color: 'rgba(225,220,245,.85)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Что прислали пользователи через «Пожаловаться» на моменты и юзеров
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setStatus(t.v)}
            style={{
              padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: status === t.v ? 'rgba(140,110,220,.85)' : 'rgba(20,12,40,.5)',
              border: status === t.v ? '1px solid rgba(180,140,255,.5)' : '1px solid rgba(255,255,255,.12)',
              color: status === t.v ? 'white' : 'rgba(225,220,245,.85)',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'rgba(225,220,245,.75)', fontSize: 14 }}>Загрузка…</div>
      ) : reports.length === 0 ? (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          background: 'rgba(20,12,40,.5)', borderRadius: 14,
          border: '1px dashed rgba(255,255,255,.15)',
          color: 'rgba(225,220,245,.85)', fontSize: 14,
        }}>
          {status === 'open' ? '✓ Открытых жалоб нет' : 'Пусто'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {openIds.length > 0 && (
            <div style={{
              display:'flex', alignItems:'center', gap: 10,
              padding:'8px 14px', borderRadius: 10,
              background:'rgba(255,255,255,.04)',
              border:'1px solid rgba(255,255,255,.08)',
              color:'rgba(225,220,245,.75)', fontSize: 12,
            }}>
              <Checkbox
                checked={headerCheckState.checked}
                indeterminate={headerCheckState.indeterminate}
                onClick={() => headerCheckState.checked ? bulk.clear() : bulk.selectAll(openIds)}
                title="Выделить все открытые"
              />
              <span>Выделить все открытые ({openIds.length})</span>
            </div>
          )}
          {reports.map(r => {
            const st = STATUS_LABELS[r.status] || STATUS_LABELS.open;
            const canBulk = r.status === 'open';
            const isSelected = bulk.has(r.id);
            return (
              <div key={r.id} style={{
                background: isSelected ? 'rgba(120,90,200,.18)' : 'rgba(20,12,40,.65)',
                border: isSelected ? '1px solid rgba(180,140,255,.45)' : '1px solid rgba(255,255,255,.14)',
                borderRadius: 14, padding: 16,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 14px rgba(0,0,0,.15)',
                position:'relative',
              }}>
                {canBulk && (
                  <div style={{ position:'absolute', top: 14, right: 14 }}>
                    <Checkbox checked={isSelected} onClick={() => bulk.toggle(r.id)} title="Выделить"/>
                  </div>
                )}
                {/* Meta */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    background: 'rgba(255,255,255,.08)', borderRadius: 6,
                    padding: '3px 9px', fontSize: 11, fontWeight: 700,
                    color: 'rgba(240,235,255,.95)',
                  }}>
                    {TARGET_LABELS[r.target_type] || r.target_type}
                  </span>
                  <span style={{
                    background: 'rgba(0,0,0,.25)', borderRadius: 6,
                    padding: '3px 9px', fontSize: 11, fontWeight: 700,
                    color: st.color,
                  }}>
                    {st.l}
                  </span>
                  <span style={{ color: 'rgba(225,220,245,.75)', fontSize: 12 }}>
                    {fmtDate(r.created_at)}
                  </span>
                </div>

                {/* Reporter */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  color: 'rgba(225,220,245,.85)', fontSize: 13,
                }}>
                  <span style={{ color: 'rgba(225,220,245,.75)' }}>от</span>
                  <strong style={{ color: 'rgba(220,200,255,.95)', fontWeight: 600 }}>
                    {r.reporter_name || r.reporter_id?.slice(0, 8) || '—'}
                  </strong>
                  {r.target_user_name && (
                    <>
                      <span style={{ color: 'rgba(225,220,245,.75)' }}>·  на</span>
                      <strong style={{ color: 'rgba(255,180,180,.95)', fontWeight: 600 }}>
                        {r.target_user_name}
                      </strong>
                    </>
                  )}
                </div>

                {/* Target ID */}
                <div style={{
                  color: 'rgba(225,220,245,.7)', fontSize: 11,
                  fontFamily: 'monospace', marginBottom: 12,
                }}>
                  {r.target_type} → <code>{r.target_id}</code>
                </div>

                {/* Reason */}
                <div style={{
                  background: 'rgba(0,0,0,.25)', borderRadius: 10, padding: '12px 14px',
                  color: 'rgba(240,235,255,.95)', fontSize: 14, lineHeight: 1.55,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14,
                }}>
                  {r.reason}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status === 'open' && (
                    <>
                      <button onClick={() => resolve(r, 'resolved')}
                        style={{
                          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                          background: 'rgba(60,180,100,.25)', color: 'rgba(140,240,180,.95)',
                        }}>
                        ✓ Принять меры
                      </button>
                      <button onClick={() => resolve(r, 'dismissed')}
                        style={{
                          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', border: '1px solid rgba(255,255,255,.15)',
                          background: 'rgba(255,255,255,.08)', color: 'rgba(240,235,255,.95)',
                          fontFamily: 'inherit',
                        }}>
                        Отклонить
                      </button>
                    </>
                  )}
                  {/* «Открыть» доступно всегда — даже для решённых/отклонённых
                      жалоб, чтобы админ мог посмотреть заблокированный контент
                      (если он не удалён). */}
                  {r.target_type === 'moment' && (
                    <button onClick={() => openMomentPopup(r.target_id)}
                      disabled={loadingMoment}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: loadingMoment ? 'wait' : 'pointer', border: '1px solid rgba(180,140,220,.3)',
                        background: 'rgba(120,90,200,.25)', color: 'rgba(220,200,255,.95)',
                        fontFamily: 'inherit',
                      }}>
                      {loadingMoment ? '…' : '→ Открыть момент'}
                    </button>
                  )}
                  {r.target_user_id && (
                    <a href={`/admin/users/${r.target_user_id}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        textDecoration: 'none',
                        background: 'rgba(120,90,200,.25)', color: 'rgba(220,200,255,.95)',
                        border: '1px solid rgba(180,140,220,.3)',
                      }}>
                      → Карточка юзера ↗
                    </a>
                  )}
                </div>
                {r.status !== 'open' && r.resolved_at && (
                  <div style={{ color: 'rgba(225,220,245,.8)', fontSize: 12, marginTop:10,
                    display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span>
                      {r.status === 'resolved' ? '✓ Приняты меры' : '◇ Отклонена'}
                    </span>
                    <span>·</span>
                    <span>{fmtDate(r.resolved_at)}</span>
                    {r.resolved_by_name && (
                      <>
                        <span>·</span>
                        <span>
                          администратор{' '}
                          <strong style={{color:'rgba(200,180,255,.95)', fontWeight:600}}>
                            {r.resolved_by_name}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,15,50,.97)', border: '1px solid rgba(255,255,255,.15)',
          borderRadius: 50, padding: '10px 20px', color: 'white', fontSize: 14, fontWeight: 600,
          zIndex: 1000, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          {toast}
        </div>
      )}
      <BulkActionBar
        count={bulk.count}
        busy={bulkBusy}
        onClear={bulk.clear}
        onAction={(a) => applyBulkAction(a.key)}
        actions={[
          { key: 'resolved',  label: '✓ Принять меры', accent: true },
          { key: 'dismissed', label: '◇ Отклонить' },
        ]}
      />
      {confirmModal}

      {momentPopup && (
        <>
          <MomentDetailPopup
            moments={momentPopup.moments}
            initialIndex={momentPopup.idx}
            currentUser={adminUser}
            onClose={() => setMomentPopup(null)}
            onDelete={handleAdminDeleteMoment}
          />
          {/* Поскольку в попапе админа не считают автором, кнопка «···»
              у него скрыта. Рисуем явную admin-панель поверх для удаления
              чужого момента прямо отсюда. */}
          <div style={{
            position:'fixed', top: 18, left: '50%', transform:'translateX(-50%)',
            zIndex: 10001, display:'flex', gap:10, alignItems:'center',
            background:'rgba(220,60,60,.92)', color:'white',
            border:'1px solid rgba(255,180,180,.5)',
            borderRadius: 50, padding:'8px 14px 8px 16px',
            boxShadow:'0 6px 22px rgba(0,0,0,.5)',
            fontSize: 13, fontWeight: 700,
          }}>
            <span>⚙ Админ</span>
            <button onClick={() => handleAdminDeleteMoment(momentPopup.moments[momentPopup.idx], false)}
              title="Мягкое удаление (status=deleted)"
              style={{
                background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.35)',
                color:'white', borderRadius:50, padding:'6px 12px',
                fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>
              🗑 Удалить
            </button>
            <button onClick={() => handleAdminDeleteMoment(momentPopup.moments[momentPopup.idx], true)}
              title="Полное удаление (БД + S3)"
              style={{
                background:'rgba(255,255,255,.32)', border:'1px solid rgba(255,255,255,.5)',
                color:'white', borderRadius:50, padding:'6px 12px',
                fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              }}>
              💣 Стереть
            </button>
          </div>
        </>
      )}
    </div>
  );
}
