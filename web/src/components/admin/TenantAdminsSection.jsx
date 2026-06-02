// TenantAdminsSection.jsx — управление со-админами школы (tenant).
// Шарится между админ-флоу и self-service ЛК. Видна только владельцу
// школы (или системному админу). Бэкенд этим занимается — клиент при
// 403 просто прячет блок.
import { useEffect, useState } from 'react';
import { api } from '../../api';

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('ru', {
    day: '2-digit', month: 'short', year: '2-digit'
  });
}

export default function TenantAdminsSection({ tenantId, notify }) {
  const [admins, setAdmins] = useState(null); // null = ещё не пробовали; [] = нет; массив = есть
  const [query, setQuery]   = useState('');
  const [matches, setMatches] = useState([]); // результаты /users/search?q=...
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [forbidden, setForbidden] = useState(false);

  async function load() {
    try {
      const rows = await api.awoListTenantAdmins(tenantId);
      setAdmins(rows);
      setForbidden(false);
    } catch (e) {
      // 403 — текущий юзер не владелец школы, прячем блок целиком.
      if (/403|Forbidden|Только владелец/i.test(e.message)) {
        setForbidden(true);
        setAdmins([]);
      } else {
        setError(e.message);
      }
    }
  }

  useEffect(() => { load(); }, [tenantId]);

  // Поиск с дебаунсом: от 3 символов дергаем /users/search?q= и
  // показываем дропдаун с совпадениями. Уже-добавленных соадминов
  // из списка отфильтровываем — нечего их повторно предлагать.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setMatches([]); setShowDrop(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await api.searchUsers(q);
        const existingIds = new Set((admins || []).map(a => a.id));
        setMatches(rows.filter(u => !existingIds.has(u.id)));
        setShowDrop(true);
      } catch (e) { /* swallow — поиск не критичен */ }
      setSearching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [query, admins]);

  async function addByUserId(userId) {
    setBusy(true); setError('');
    try {
      const rows = await api.awoAddTenantAdmin(tenantId, { userId });
      setAdmins(rows);
      setQuery('');
      setShowDrop(false);
      setMatches([]);
      notify?.('✓ Со-админ добавлен');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function addByQuery() {
    const q = query.trim();
    if (!q) return;
    setBusy(true); setError('');
    try {
      // Если в строке только цифры/«+» — пробуем как телефон. Иначе
      // подсказываем выбрать кого-то из списка.
      if (/^[+]?[\d\s()-]+$/.test(q)) {
        const rows = await api.awoAddTenantAdmin(tenantId, { phone: q });
        setAdmins(rows);
        setQuery('');
        setShowDrop(false);
        notify?.('✓ Со-админ добавлен');
      } else if (matches.length === 1) {
        await addByUserId(matches[0].id);
      } else if (matches.length > 1) {
        setError('Уточните запрос — найдено несколько пользователей. Выберите из списка.');
      } else {
        setError('Введите номер телефона или выберите пользователя из подсказок.');
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function remove(userId) {
    setBusy(true); setError('');
    try {
      const rows = await api.awoRemoveTenantAdmin(tenantId, userId);
      setAdmins(rows);
      notify?.('✓ Со-админ удалён');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (forbidden) return null;

  return (
    <div style={{
      background: 'rgba(20,12,40,.5)',
      border: '1px solid rgba(255,255,255,.12)',
      borderRadius: 14, padding: '16px 18px', marginBottom: 22,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 6 }}>
        <h2 style={{ color:'white', fontSize: 16, fontWeight: 700, margin: 0 }}>
          👥 Со-админы школы
        </h2>
      </div>
      <p style={{ color:'rgba(225,220,245,.7)', fontSize: 13, lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
        Со-админы могут заходить в эту же страницу школы и привязывать чаты к курсам,
        смотреть логи и менять настройки. Они не могут удалить школу и не могут
        управлять списком со-админов — это остаётся за владельцем.
      </p>

      {error && (
        <div style={{ color: 'rgba(255,140,140,.95)', background: 'rgba(200,50,50,.15)',
          borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ position:'relative', marginBottom: 14 }}>
        <div style={{ display:'flex', gap: 8 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { if (matches.length) setShowDrop(true); }}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            onKeyDown={e => e.key === 'Enter' && addByQuery()}
            placeholder="Имя или телефон (от 3 символов)"
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              background:'rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.18)',
              color: 'white', fontSize: 14, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button onClick={addByQuery} disabled={busy || !query.trim()}
            style={{
              padding: '10px 16px', borderRadius: 10, border: 'none',
              background: 'rgba(140,110,220,.85)', color: 'white',
              fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: busy || !query.trim() ? .55 : 1,
            }}>
            {busy ? '…' : '+ Добавить'}
          </button>
        </div>

        {/* Дропдаун с совпадениями. Не позиционируем абсолютно —
            оставляем в потоке, чтобы не перекрывать список соадминов
            и не мучиться с z-index в админ-разметке. */}
        {showDrop && query.trim().length >= 3 && (
          <div style={{
            marginTop: 6,
            background:'rgba(20,12,40,.95)', backdropFilter:'blur(14px)',
            border:'1px solid rgba(255,255,255,.14)',
            borderRadius: 10, padding: 4,
            maxHeight: 260, overflowY:'auto',
          }}>
            {searching && (
              <div style={{ padding:'10px 12px', color:'rgba(225,220,245,.55)', fontSize: 13 }}>
                Поиск…
              </div>
            )}
            {!searching && matches.length === 0 && (
              <div style={{ padding:'10px 12px', color:'rgba(225,220,245,.55)', fontSize: 13 }}>
                Никто не найден. Можно ввести полный номер и нажать «Добавить».
              </div>
            )}
            {!searching && matches.map(u => {
              const av = u.avatar;
              const isImg = av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));
              return (
                <button key={u.id}
                  onMouseDown={e => e.preventDefault()} // не сбрасываем фокус до onClick
                  onClick={() => addByUserId(u.id)}
                  disabled={busy}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap: 10,
                    padding:'8px 10px', borderRadius: 8,
                    background:'transparent', border:'none',
                    color:'white', cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition:'background .12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.07)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background:'rgba(120,90,200,.4)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontSize: 12, fontWeight: 700,
                    overflow:'hidden', flexShrink: 0,
                  }}>
                    {isImg
                      ? <img src={av} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                      : (u.name?.[0]?.toUpperCase() || '?')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: 12, color:'rgba(225,220,245,.55)' }}>{u.phone}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {admins === null && (
        <div style={{ color:'rgba(225,220,245,.5)', fontSize: 13 }}>Загрузка…</div>
      )}
      {admins && admins.length === 0 && (
        <div style={{ color:'rgba(225,220,245,.55)', fontSize: 13 }}>Пока нет со-админов.</div>
      )}
      {admins && admins.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {admins.map(a => {
            const av = a.avatar;
            const isImg = av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));
            return (
              <div key={a.id} style={{
                display:'flex', alignItems:'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.08)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(120,90,200,.4)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'white', fontSize: 14, fontWeight: 700,
                  overflow: 'hidden', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,.1)',
                }}>
                  {isImg
                    ? <img src={av} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                    : (a.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color:'white', fontWeight: 600 }}>{a.name}</div>
                  <div style={{ color:'rgba(225,220,245,.55)', fontSize: 12 }}>
                    {a.phone} · добавил {a.added_by_name || '—'} · {fmtDate(a.added_at)}
                  </div>
                </div>
                <button onClick={() => remove(a.id)} disabled={busy}
                  title="Удалить из админов"
                  style={{
                    background:'rgba(200,60,60,.2)', border:'1px solid rgba(255,120,120,.45)',
                    color:'rgba(255,180,180,1)',
                    borderRadius:8, padding:'5px 10px', fontSize:14,
                    cursor: busy ? 'wait' : 'pointer', fontFamily:'inherit', lineHeight: 1,
                  }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
