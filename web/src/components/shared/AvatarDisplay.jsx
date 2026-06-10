// web/src/components/shared/AvatarDisplay.jsx
import { mediaUrl as toMediaUrl } from '../../lib/mediaUrl';

export function AvatarDisplay({ avatar, name, size = 52, fontSize = 20, radius = '50%', style = {} }) {
  const letter = (name || '?')[0].toUpperCase();
  const isImg  = avatar && (avatar.startsWith('/') || avatar.startsWith('http') || avatar.startsWith('data:'));
  const isEmoji = avatar && avatar.length <= 4 && !isImg;
  return (
    <div style={{
      width:size, height:size, borderRadius:radius,
      background:'rgba(200,160,210,.45)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize, color:'#F9F0F0', fontWeight:600, flexShrink:0,
      overflow:'hidden', ...style
    }}>
      {isImg
        ? <img src={toMediaUrl(avatar)} alt="" referrerPolicy="no-referrer"
            decoding="async" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        : isEmoji ? avatar : letter}
    </div>
  );
}
