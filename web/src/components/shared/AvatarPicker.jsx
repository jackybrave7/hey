// web/src/components/shared/AvatarPicker.jsx
import { useState, useRef } from 'react';
import Icon from '../Icon';
import { heyToast } from './Toast';
import { ImageCropperModal } from './ImageCropperModal';


function avatarIsImage(av) {
  return av && (av.startsWith('/') || av.startsWith('http') || av.startsWith('data:'));
}

export function AvatarPicker({ avatar, onChange, size = 136, disabled = false, onView }) {
  const fileRef = useRef();
  const [cropFile, setCropFile] = useState(null);
  const canView = disabled && avatarIsImage(avatar) && !!onView;

  function handleFile(e) {
    const file = e.target.files[0];
    // Сбрасываем value, чтобы можно было выбрать ТОТ ЖЕ файл повторно
    // (например, после отмены кропа) — иначе onChange не сработает.
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { heyToast('Файл больше 10 МБ', 'error'); return; }
    setCropFile(file);
  }

  return (
    <div
      onClick={() => {
        if (!disabled) fileRef.current.click();
        else if (canView) onView();
      }}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatar ? 'transparent' : 'rgba(130,112,158,.42)',
        border: '3px solid rgba(249,240,240,.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: !disabled ? 'pointer' : (canView ? 'zoom-in' : 'default'),
        overflow: 'hidden', position: 'relative',
        transition: 'opacity .2s',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.opacity = '.8';
        else if (canView) {
          const hint = e.currentTarget.querySelector('.av-view-hint');
          if (hint) hint.style.opacity = '1';
        }
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.opacity = '1';
        else if (canView) {
          const hint = e.currentTarget.querySelector('.av-view-hint');
          if (hint) hint.style.opacity = '0';
        }
      }}
    >
      {avatar
        ? <img src={avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="avatar"/>
        : <span style={{fontSize: size * 0.32, color: 'rgba(249,240,240,.7)'}}>+</span>
      }
      {!disabled && (
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.35)',
          display:'flex', alignItems:'center', justifyContent:'center',
          opacity: 1, transition:'opacity .2s',
          borderRadius:'50%', fontSize:13, color:'#F9F0F0', textAlign:'center', padding:8
        }}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
            <Icon name="camera" size={Math.round(size*0.18)}/>
            <span style={{fontSize: Math.max(10, Math.round(size*0.09))}}>Сменить</span>
          </div>
        </div>
      )}
      {canView && (
        <div className="av-view-hint" style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.42)',
          display:'flex', alignItems:'center', justifyContent:'center',
          opacity:0, transition:'opacity .2s', borderRadius:'50%',
          color:'#F9F0F0', fontSize: Math.max(11, Math.round(size * 0.1)), fontWeight:600,
          pointerEvents:'none',
        }}>
          Увеличить
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      {cropFile && (
        <ImageCropperModal
          file={cropFile}
          shape="circle"
          outputSize={512}
          title="Подгоните аватарку"
          onCancel={() => setCropFile(null)}
          onDone={(url, file) => { setCropFile(null); onChange(url, file); }}
        />
      )}
    </div>
  );
}

export { AvatarCropperModal } from './ImageCropperModal';
