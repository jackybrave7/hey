// MomentDilemma.jsx — конфликт при создании нового Момента (уже есть активный)
import { useState } from 'react';
import { api } from '../../api';
import SuperPromoBanner from '../super/SuperPromoBanner';
import { mediaUrl } from '../../lib/mediaUrl';

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString('ru', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
}

export default function MomentDilemma({ existing, pendingData, onResolved, onClose, currentUser }) {
  const [loading, setLoading] = useState(null); // 'archive' | 'delete'
  const [error, setError] = useState('');

  async function handleArchiveAndCreate() {
    setLoading('archive');
    setError('');
    try {
      await api.archiveMoment(existing.id);
      const result = await api.createMoment(pendingData);
      onResolved(result);
    } catch(err) {
      setError(err.message || 'Ошибка');
      setLoading(null);
    }
  }

  async function handleDeleteAndCreate() {
    setLoading('delete');
    setError('');
    try {
      await api.deleteMoment(existing.id);
      const result = await api.createMoment(pendingData);
      onResolved(result);
    } catch(err) {
      setError(err.message || 'Ошибка');
      setLoading(null);
    }
  }

  const overlay = {
    position:'fixed',inset:0,zIndex:850,
    background:'rgba(0,0,0,.72)',backdropFilter:'blur(16px)',
    display:'flex',alignItems:'center',justifyContent:'center',
    padding:'20px',
  };
  const sheet = {
    background:'rgba(22,15,50,.98)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(100%,520px)',
    maxHeight:'90vh',display:'flex',flexDirection:'column',
    boxShadow:'0 8px 48px rgba(0,0,0,.6)',
    border:'1px solid rgba(249,240,240,.1)',
    overflow:'hidden',
  };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={sheet}>
        {/* Header */}
        <div style={{padding:'14px 20px 12px',borderBottom:'1px solid rgba(249,240,240,.08)',
          display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:28}}>📦</div>
          <div>
            <div style={{color:'#F9F0F0',fontSize:16,fontWeight:700}}>У тебя уже есть активный момент</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13,marginTop:2}}>
              Бесплатный аккаунт — 1 активный момент
            </div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',
            color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
          {/* Existing moment preview */}
          <div style={{background:'rgba(249,240,240,.06)',borderRadius:16,padding:'14px 16px',
            border:'1px solid rgba(249,240,240,.1)'}}>
            <div style={{color:'rgba(249,240,240,.4)',fontSize:11,marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>
              Текущий момент
            </div>
            {existing.media_url && existing.media_type === 'image' && (
              <img src={mediaUrl(existing.media_url)} alt=""
                style={{width:'100%',height:100,objectFit:'cover',
                  objectPosition: existing.media_position || '50% 50%',
                  borderRadius:10,marginBottom:8,display:'block'}}/>
            )}
            <div style={{color:'rgba(249,240,240,.85)',fontSize:14,lineHeight:1.5,
              overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>
              {existing.text}
            </div>
            <div style={{color:'rgba(249,240,240,.3)',fontSize:11,marginTop:8}}>
              {fmtDate(existing.created_at)}
            </div>
          </div>

          {/* Option 1: Archive */}
          <button onClick={handleArchiveAndCreate} disabled={!!loading}
            style={{
              width:'100%',padding:'16px',borderRadius:16,cursor: loading ? 'not-allowed' : 'pointer',
              background: loading === 'archive' ? 'rgba(95, 64, 128,.6)' : 'rgba(95, 64, 128,.85)',
              border:'1px solid rgba(180,140,255,.3)',
              color:'#F9F0F0',fontSize:15,fontWeight:700,
              display:'flex',alignItems:'center',gap:12,
              transition:'all .2s',opacity: loading && loading !== 'archive' ? 0.5 : 1,
              boxShadow: !loading ? '0 4px 20px rgba(95, 64, 128,.35)' : 'none',
            }}>
            <span style={{fontSize:22}}>📦</span>
            <div style={{textAlign:'left'}}>
              <div>{loading === 'archive' ? 'Архивируем…' : 'В архив старый, опубликовать новый'}</div>
              <div style={{fontSize:12,fontWeight:400,opacity:.75,marginTop:2}}>
                Старый Момент сохранится в архиве
              </div>
            </div>
          </button>

          {/* Option 2: Delete permanently */}
          <button onClick={handleDeleteAndCreate} disabled={!!loading}
            style={{
              width:'100%',padding:'16px',borderRadius:16,cursor: loading ? 'not-allowed' : 'pointer',
              background: loading === 'delete' ? 'rgba(160,40,40,.7)' : 'rgba(200,50,50,.15)',
              border:'1px solid rgba(255,80,80,.25)',
              color: loading === 'delete' ? '#F9F0F0' : 'rgba(255,120,120,.9)',
              fontSize:15,fontWeight:600,
              display:'flex',alignItems:'center',gap:12,
              transition:'all .2s',opacity: loading && loading !== 'delete' ? 0.5 : 1,
            }}>
            <span style={{fontSize:22}}>🗑</span>
            <div style={{textAlign:'left'}}>
              <div>{loading === 'delete' ? 'Удаляем…' : 'Удалить старый и создать новый'}</div>
              <div style={{fontSize:12,fontWeight:400,opacity:.7,marginTop:2}}>
                Это действие нельзя отменить
              </div>
            </div>
          </button>

          {error && (
            <div style={{color:'rgba(255,140,140,.85)',fontSize:13,
              background:'rgba(200,50,50,.12)',borderRadius:10,padding:'10px 14px'}}>
              {error}
            </div>
          )}

          {/* SUPER promo — only for non-super users */}
          {!currentUser?.is_super && <SuperPromoBanner />}
        </div>
      </div>
    </div>
  );
}
