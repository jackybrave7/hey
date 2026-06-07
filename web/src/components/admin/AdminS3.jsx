// AdminS3.jsx — единая галерея всего что лежит на S3 для админа.
// Показывает все объекты под chat/, moments/, avatars/, group-icons/
// с разбивкой по категориям, превью картинок и пометкой «сирота» для
// тех ключей, на которые в БД больше никто не ссылается.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useConfirm } from '../Screens';

function formatBytes(n) {
  if (!n) return '0 B';
  const u = ['B','KB','MB','GB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
}
function formatAge(ts) {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + ' с';
  const m = Math.floor(s / 60); if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60); if (h < 24) return h + ' ч';
  const d = Math.floor(h / 24); if (d < 30) return d + ' дн';
  return Math.floor(d / 30) + ' мес';
}

const CATEGORIES = [
  { v: 'all',         l: 'Все' },
  { v: 'chat-image',  l: '💬 Чат · изображения' },
  { v: 'chat-audio',  l: '🎤 Чат · аудио' },
  { v: 'chat-file',   l: '📎 Чат · файлы' },
  { v: 'moment',      l: '✦ Моменты' },
  { v: 'avatar',      l: '🧑 Аватары' },
  { v: 'group-icon',  l: '🫂 Иконы групп' },
];

export default function AdminS3() {
  const [items, setItems]       = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [cat, setCat]           = useState('all');
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [preview, setPreview]   = useState(null); // объект, открытый в просмотре
  const [busy, setBusy]         = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // ключи выбранных
  const [customConfirm, confirmModal] = useConfirm();
  const selectMode = selected.size > 0;

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.adminS3List();
      setItems(r.items || []);
      setTotalSize(r.totalSize || 0);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter(x =>
      (cat === 'all' || x.category === cat) &&
      (!onlyOrphans || x.isOrphan)
    );
  }, [items, cat, onlyOrphans]);

  // Подсчёт по категориям — для табов
  const counts = useMemo(() => {
    const c = { all: items.length, orphan: 0 };
    let sz = 0, orphSz = 0;
    for (const x of items) {
      c[x.category] = (c[x.category] || 0) + 1;
      sz += x.size || 0;
      if (x.isOrphan) { c.orphan++; orphSz += x.size || 0; }
    }
    c._size = sz; c._orphSize = orphSz;
    return c;
  }, [items]);

  async function deleteOne(item) {
    if (!await customConfirm(
      'Удалить с S3 безвозвратно?',
      { hint: item.key, danger: true, confirmLabel: 'Удалить' }
    )) return;
    setBusy(true);
    try {
      await api.adminS3DeleteObject(item.key);
      setItems(prev => prev.filter(x => x.key !== item.key));
      setSelected(prev => { const n = new Set(prev); n.delete(item.key); return n; });
      setPreview(null);
    } catch (e) { alert('Ошибка: ' + e.message); }
    setBusy(false);
  }

  function toggle(key) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }
  function selectAllVisible() {
    setSelected(prev => {
      const n = new Set(prev);
      for (const x of filtered) n.add(x.key);
      return n;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  async function deleteSelected() {
    const keys = [...selected];
    if (!keys.length) return;
    // Подсчёт сирот среди выбранных — чтоб admin видел сколько живых снесёт.
    let liveCount = 0;
    for (const k of keys) {
      const it = items.find(x => x.key === k);
      if (it && !it.isOrphan) liveCount++;
    }
    const hint = liveCount > 0
      ? `${keys.length} объектов · из них ${liveCount} живых (есть ссылки в БД — превью у юзеров сломается!)`
      : `${keys.length} объектов · все сироты`;
    if (!await customConfirm(
      'Удалить выбранные объекты с S3?',
      { hint, danger: true, confirmLabel: `Удалить ${keys.length}` }
    )) return;
    setBusy(true);
    try {
      const r = await api.adminS3DeleteObjects(keys);
      const deletedSet = new Set(keys.filter(k => !r.failed?.some(f => f.key === k)));
      setItems(prev => prev.filter(x => !deletedSet.has(x.key)));
      setSelected(new Set());
      if (r.errors > 0) alert(`Удалено ${r.deleted}, ошибок ${r.errors}. Подробности в консоли.`);
      if (r.failed?.length) console.warn('[s3-bulk] failed:', r.failed);
    } catch (e) { alert('Ошибка: ' + e.message); }
    setBusy(false);
  }

  async function runSweep() {
    if (!await customConfirm(
      'Запустить сборщик сирот?',
      { hint: 'Удалит с S3 все объекты которые не используются БД и старше 24ч.', confirmLabel: 'Запустить' }
    )) return;
    setBusy(true);
    try {
      const r = await api.adminS3Sweep();
      alert(`Сборщик отработал:\nпросканировано ${r.scanned}\nудалено ${r.deleted}\nживых ${r.skippedLive}\nсвежих <24ч ${r.skippedYoung}\nошибок ${r.errors}`);
      await load();
    } catch (e) { alert('Ошибка: ' + e.message); }
    setBusy(false);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:16, flexWrap:'wrap', marginBottom: 8 }}>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, margin: 0 }}>
          🗂 S3 галерея
        </h1>
        <div style={{ color:'rgba(255,255,255,.45)', fontSize: 13 }}>
          {items.length.toLocaleString('ru')} объектов · {formatBytes(counts._size)}
          {counts.orphan > 0 && (
            <span style={{ color:'rgba(255,180,140,.85)' }}>
              {' · '}сироты: {counts.orphan} ({formatBytes(counts._orphSize)})
            </span>
          )}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={load} disabled={loading}
            style={btnStyle()}>{loading ? 'Загрузка…' : '↻ Обновить'}</button>
          <button onClick={runSweep} disabled={busy || loading}
            style={btnStyle('danger')}>🧹 Запустить sweep</button>
        </div>
      </div>

      <p style={{ color: 'rgba(255,255,255,.45)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        Все объекты в S3-бакете. «Сирота» — ключ, на который ни одно живое сообщение,
        момент или аватар не ссылается; такие чистит ночной sweep (или ты прямо здесь).
      </p>

      {/* Bulk selection toolbar — рисуется когда что-то выбрано */}
      {selectMode && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
          padding:'10px 14px', borderRadius:12, marginBottom:14,
          background:'rgba(120,90,200,.18)',
          border:'1px solid rgba(180,140,220,.35)',
        }}>
          <span style={{ color:'white', fontSize:14, fontWeight:600 }}>
            Выбрано: {selected.size}
          </span>
          <button onClick={selectAllVisible} style={btnStyle()}>
            Выбрать всё видимое ({filtered.length})
          </button>
          <button onClick={clearSelection} style={btnStyle()}>Снять выделение</button>
          <button onClick={deleteSelected} disabled={busy} style={{ ...btnStyle('danger'), marginLeft:'auto' }}>
            🗑 Удалить выбранные ({selected.size})
          </button>
        </div>
      )}

      {/* Categories */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom: 14 }}>
        {CATEGORIES.map(c => (
          <button key={c.v} onClick={() => setCat(c.v)}
            style={tabStyle(cat === c.v)}>
            {c.l} <span style={{ opacity:.6 }}>{counts[c.v] || (c.v === 'all' ? items.length : 0)}</span>
          </button>
        ))}
        <label style={{ display:'inline-flex', alignItems:'center', gap:6, marginLeft:'auto',
          color:'rgba(255,255,255,.75)', fontSize:13, cursor:'pointer' }}>
          <input type="checkbox" checked={onlyOrphans} onChange={e => setOnlyOrphans(e.target.checked)}/>
          Только сироты
        </label>
      </div>

      {error && (
        <div style={{ color:'rgba(255,140,140,.95)', padding:12, background:'rgba(220,80,80,.12)',
          borderRadius:10, marginBottom:14 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color:'rgba(255,255,255,.5)', padding: 40, textAlign:'center' }}>Загрузка…</div>
      ) : !filtered.length ? (
        <div style={{ color:'rgba(255,255,255,.5)', padding: 40, textAlign:'center' }}>Ничего нет.</div>
      ) : (
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}>
          {filtered.map(item => (
            <Tile key={item.key} item={item}
              selected={selected.has(item.key)}
              selectMode={selectMode}
              onToggleSelect={() => toggle(item.key)}
              onClick={() => selectMode ? toggle(item.key) : setPreview(item)} />
          ))}
        </div>
      )}

      {preview && (
        <PreviewModal item={preview} onClose={() => setPreview(null)}
          onDelete={() => deleteOne(preview)} busy={busy} />
      )}
      {confirmModal}
    </div>
  );
}

function btnStyle(variant) {
  const bg = variant === 'danger' ? 'rgba(220,80,80,.7)' : 'rgba(120,90,200,.6)';
  return {
    padding:'9px 14px', borderRadius:10, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none', color:'white', background: bg,
  };
}
function tabStyle(active) {
  return {
    padding:'8px 12px', borderRadius:9, fontSize:13, fontWeight:600,
    cursor:'pointer', border:'none',
    background: active ? 'rgba(120,90,200,.7)' : 'rgba(255,255,255,.06)',
    color: active ? 'white' : 'rgba(255,255,255,.65)',
  };
}

function Tile({ item, onClick, selected, selectMode, onToggleSelect }) {
  const [imgErr, setImgErr] = useState(false);
  const isImg = item.kind === 'image' && !imgErr;
  return (
    <div onClick={onClick} style={{
      position:'relative', borderRadius:12, overflow:'hidden',
      background: selected ? 'rgba(120,90,200,.25)' : 'rgba(255,255,255,.04)',
      border: '2px solid ' + (selected ? 'rgba(180,140,220,.85)' : 'rgba(255,255,255,.07)'),
      cursor:'pointer', aspectRatio:'1/1', display:'flex',
      flexDirection:'column', justifyContent:'flex-end',
      transition: 'border-color .12s, background .12s',
    }}>
      {/* Чекбокс выбора: всегда виден когда есть выделение, иначе при ховере */}
      <div onClick={e => { e.stopPropagation(); onToggleSelect?.(); }}
        title={selected ? 'Снять' : 'Выбрать'}
        style={{
          position:'absolute', top:6, right:6, zIndex:2,
          width:24, height:24, borderRadius:'50%',
          background: selected ? 'rgba(180,140,220,.95)' : 'rgba(0,0,0,.5)',
          border: '1.5px solid ' + (selected ? 'white' : 'rgba(255,255,255,.55)'),
          color:'white', fontSize:14, fontWeight:800,
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer',
          opacity: selectMode || selected ? 1 : .55,
          transition:'opacity .12s',
        }}>{selected ? '✓' : ''}</div>
      {isImg && (
        <img src={item.url} alt="" loading="lazy" onError={() => setImgErr(true)}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}/>
      )}
      {!isImg && (
        <div style={{ position:'absolute', inset:0, display:'flex',
          alignItems:'center', justifyContent:'center', fontSize:34, opacity:.7 }}>
          {item.kind === 'video' ? '🎬' : item.kind === 'audio' ? '🎤' : '📄'}
        </div>
      )}
      {/* Бейдж orphan */}
      {item.isOrphan && (
        <div style={{ position:'absolute', top:6, left:6,
          padding:'2px 7px', borderRadius:6,
          background:'rgba(220,140,80,.92)', color:'white',
          fontSize:10, fontWeight:700, letterSpacing:.3 }}>
          СИРОТА
        </div>
      )}
      {/* Меta-плашка снизу */}
      <div style={{
        position:'relative', padding:'6px 8px',
        background:'linear-gradient(transparent, rgba(0,0,0,.78))',
        color:'rgba(255,255,255,.92)', fontSize:11, lineHeight:1.3,
        textShadow:'0 1px 2px rgba(0,0,0,.6)',
      }}>
        <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {item.key.split('/').pop()}
        </div>
        <div style={{ opacity:.7, display:'flex', justifyContent:'space-between' }}>
          <span>{formatBytes(item.size)}</span>
          <span>{formatAge(item.lastModified)}</span>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ item, onClose, onDelete, busy }) {
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex: 1000,
      background:'rgba(0,0,0,.82)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'rgba(20,12,40,.98)', borderRadius:14,
        border:'1px solid rgba(255,255,255,.1)',
        maxWidth: 900, width:'100%', maxHeight:'92vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,.08)',
          display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'white', fontSize:14, fontWeight:600,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {item.key}
            </div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:12, marginTop:2 }}>
              {formatBytes(item.size)} · {new Date(item.lastModified).toLocaleString('ru')}
              {item.isOrphan && <span style={{ color:'rgba(255,180,140,.9)' }}> · сирота</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.08)',
            border:'none', borderRadius:8, color:'white', width:32, height:32,
            fontSize:18, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflow:'auto', display:'flex',
          alignItems:'center', justifyContent:'center', padding:14, minHeight: 200 }}>
          {item.kind === 'image' && (
            <img src={item.url} alt=""
              style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:8 }}/>
          )}
          {item.kind === 'video' && (
            <video src={item.url} controls
              style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:8 }}/>
          )}
          {item.kind === 'audio' && (
            <audio src={item.url} controls style={{ width:'100%' }}/>
          )}
          {item.kind === 'file' && (
            <div style={{ color:'rgba(255,255,255,.7)', textAlign:'center' }}>
              <div style={{ fontSize:60 }}>📄</div>
              <a href={item.url} target="_blank" rel="noreferrer"
                style={{ color:'rgba(180,140,220,1)' }}>Открыть в новой вкладке</a>
            </div>
          )}
        </div>
        <div style={{ padding:'12px 18px', borderTop:'1px solid rgba(255,255,255,.08)',
          display:'flex', gap:10, justifyContent:'space-between', flexWrap:'wrap' }}>
          <a href={item.url} target="_blank" rel="noreferrer"
            style={{ color:'rgba(180,140,220,1)', fontSize:13, alignSelf:'center' }}>
            Прямая ссылка ↗
          </a>
          <button onClick={onDelete} disabled={busy}
            style={btnStyle('danger')}>🗑 Удалить с S3</button>
        </div>
      </div>
    </div>
  );
}
