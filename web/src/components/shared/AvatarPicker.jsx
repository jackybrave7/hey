// web/src/components/shared/AvatarPicker.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';
import { heyToast } from './Toast';


export function AvatarPicker({ avatar, onChange, size = 136, disabled = false }) {
  const fileRef = useRef();
  const [cropFile, setCropFile] = useState(null);

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
      onClick={() => !disabled && fileRef.current.click()}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: avatar ? 'transparent' : 'rgba(130,112,158,.42)',
        border: '3px solid rgba(249,240,240,.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', overflow: 'hidden', position: 'relative',
        transition: 'opacity .2s'
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '.8'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
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
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      {cropFile && (
        <AvatarCropperModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={(url, file) => { setCropFile(null); onChange(url, file); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AvatarCropperModal — выбор положения и масштаба перед загрузкой
// ─────────────────────────────────────────────────────────────────────────────
export function AvatarCropperModal({ file, onCancel, onDone }) {
  const srcUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(srcUrl), [srcUrl]);

  const CROP = 280; // диаметр окна кропа в px
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  // pos.{x,y} — смещение центра картинки относительно центра окна, в px-на-экране
  const [pos, setPos] = useState({ x: 0, y: 0 });
  // user-scale: множитель поверх baseScale (1 = картинка полностью покрывает окно)
  const [scale, setScale] = useState(1);
  // rotation — поворот в градусах (0/90/180/270). Применяется как CSS-transform
  // к img и как ctx.rotate в canvas при экспорте.
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);

  // baseScale — масштаб, при котором меньшая сторона картинки точно совпадает
  // с окном кропа (cover-fit). Дальше scale=1.0 = base, можно увеличивать.
  // При повороте на 90/270° меняем местами w и h при расчёте.
  const baseScale = useMemo(() => {
    if (!imgSize.w || !imgSize.h) return 1;
    const rotated = rotation % 180 !== 0;
    const w = rotated ? imgSize.h : imgSize.w;
    const h = rotated ? imgSize.w : imgSize.h;
    return Math.max(CROP / w, CROP / h);
  }, [imgSize, rotation]);

  function onImgLoad(e) {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setPos({ x: 0, y: 0 });
    setScale(1);
    setRotation(0);
    setImgLoaded(true);
  }

  // При повороте — сбрасываем pos, чтобы картинка осталась по центру окна.
  function rotateBy(delta) {
    setRotation(r => ((r + delta) % 360 + 360) % 360);
    setPos({ x: 0, y: 0 });
  }

  // ── Pointer tracking (drag + pinch) ────────────────────────────────────────
  const pointers = useRef(new Map()); // pointerId → {x,y}
  const startRef = useRef(null);

  function snapshotStart() {
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      startRef.current = { mode: 'pan', pos: { ...pos }, anchor: pts[0] };
    } else if (pts.length >= 2) {
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const d  = Math.hypot(dx, dy) || 1;
      startRef.current = { mode: 'pinch', pos: { ...pos }, scale, mid: { x: mx, y: my }, dist: d };
    } else startRef.current = null;
  }

  function onPointerDown(e) {
    e.target.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshotStart();
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const s = startRef.current;
    if (!s) return;
    if (s.mode === 'pan' && pts.length === 1) {
      setPos({
        x: s.pos.x + (pts[0].x - s.anchor.x),
        y: s.pos.y + (pts[0].y - s.anchor.y),
      });
    } else if (s.mode === 'pinch' && pts.length >= 2) {
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const newDist = Math.hypot(dx, dy) || 1;
      const newScale = Math.max(1, Math.min(5, s.scale * (newDist / s.dist)));
      setScale(newScale);
      const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      setPos({
        x: s.pos.x + (newMid.x - s.mid.x),
        y: s.pos.y + (newMid.y - s.mid.y),
      });
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    snapshotStart();
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setScale(s => Math.max(1, Math.min(5, s * delta)));
  }

  async function handleDone() {
    if (!imgRef.current || !imgLoaded) return;
    setSaving(true);
    try {
      const OUT = 512;
      const canvas = document.createElement('canvas');
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext('2d');

      // Стратегия: рендерим повёрнутую картинку на промежуточный canvas
      // bbox-size (с учётом rotation), затем cropping уже как обычно.
      // Это позволяет переиспользовать ту же геометрию pos/scale, что в UI.
      const rotated = rotation % 180 !== 0;
      const naturalW = imgSize.w;
      const naturalH = imgSize.h;
      const bboxW = rotated ? naturalH : naturalW;
      const bboxH = rotated ? naturalW : naturalH;
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = bboxW; rotCanvas.height = bboxH;
      const rctx = rotCanvas.getContext('2d');
      rctx.save();
      rctx.translate(bboxW / 2, bboxH / 2);
      rctx.rotate((rotation * Math.PI) / 180);
      rctx.drawImage(imgRef.current, -naturalW / 2, -naturalH / 2);
      rctx.restore();

      const total = baseScale * scale;
      const dispW = bboxW * total;
      const dispH = bboxH * total;
      const cx = CROP / 2 + pos.x;
      const cy = CROP / 2 + pos.y;
      const left = cx - dispW / 2;
      const top  = cy - dispH / 2;
      const srcX = (0   - left) / total;
      const srcY = (0   - top)  / total;
      const srcW = CROP / total;
      const srcH = CROP / total;
      ctx.drawImage(rotCanvas, srcX, srcY, srcW, srcH, 0, 0, OUT, OUT);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.9));
      const croppedFile = new File([blob], 'avatar.webp', { type: 'image/webp' });
      onDone(URL.createObjectURL(blob), croppedFile);
    } finally { setSaving(false); }
  }

  const total = baseScale * scale;
  // bbox после поворота: для 90/270 размеры меняются местами.
  const rotated = rotation % 180 !== 0;
  const dispW = (rotated ? imgSize.h : imgSize.w) * total;
  const dispH = (rotated ? imgSize.w : imgSize.h) * total;

  // createPortal — чтобы overlay вышел за любую возможную stacking-context
  // ловушку (родительский filter/transform/will-change в форме профиля),
  // из-за которой position:fixed раньше «прятался» под формой.
  return createPortal(
    <div onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:10000,
        background:'rgba(5,2,15,.96)', backdropFilter:'blur(16px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'rgba(38,28,68,.99)', borderRadius:22, padding:'24px 22px 18px',
          width:'100%', maxWidth:360, boxShadow:'0 30px 80px rgba(0,0,0,.7)',
          border:'1px solid rgba(249,240,240,.1)' }}>
        <div style={{ color:'#F9F0F0', fontSize:17, fontWeight:700, textAlign:'center', marginBottom:14 }}>
          Подгоните аватарку
        </div>

        {/* Окно кропа */}
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            position:'relative', width:CROP, height:CROP,
            margin:'0 auto', borderRadius:'50%', overflow:'hidden',
            background:'#0a0518', touchAction:'none', userSelect:'none',
            cursor: imgLoaded ? 'grab' : 'default',
            border:'2px solid rgba(249,240,240,.18)',
            boxShadow:'0 8px 30px rgba(0,0,0,.4)',
          }}>
          {/* Картинка повернута через CSS-transform; визуальные размеры
              (dispW/dispH) уже учитывают поворот в обёртке выше. Используем
              визуальный bbox после поворота, поэтому переводим в orig
              w/h обратно: при rotation 90/270 ширина img.style.width =
              dispH, чтобы после поворота это стало dispW. */}
          <img
            ref={imgRef}
            src={srcUrl}
            onLoad={onImgLoad}
            draggable={false}
            alt=""
            style={{
              position:'absolute',
              left: (CROP - dispW) / 2 + pos.x,
              top:  (CROP - dispH) / 2 + pos.y,
              width:  rotated ? dispH : dispW,
              height: rotated ? dispW : dispH,
              transform: `translate(${rotated ? (dispW - dispH) / 2 : 0}px, ${rotated ? (dispH - dispW) / 2 : 0}px) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              pointerEvents:'none',
              maxWidth:'none',
            }}
          />
        </div>

        {/* Слайдер масштаба */}
        <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10 }}>
          <Icon name="image" size={16}/>
          <input type="range" min={1} max={5} step={0.01}
            value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
            style={{ flex:1, accentColor:'#a884e0' }}/>
          <Icon name="image" size={22}/>
        </div>

        {/* Кнопки поворота */}
        <div style={{ marginTop:10, display:'flex', justifyContent:'center', gap:10 }}>
          <button type="button" onClick={() => rotateBy(-90)} title="Повернуть влево"
            style={{
              background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.15)',
              borderRadius:50, padding:'6px 14px', color:'#F9F0F0',
              fontSize:13, cursor:'pointer', fontFamily:'inherit',
              display:'inline-flex', alignItems:'center', gap:6,
            }}>
            <span style={{fontSize:16,lineHeight:1}}>↺</span>
            <span>Повернуть</span>
          </button>
          <button type="button" onClick={() => rotateBy(90)} title="Повернуть вправо"
            style={{
              background:'rgba(249,240,240,.08)', border:'1px solid rgba(249,240,240,.15)',
              borderRadius:50, padding:'6px 14px', color:'#F9F0F0',
              fontSize:13, cursor:'pointer', fontFamily:'inherit',
              display:'inline-flex', alignItems:'center', gap:6,
            }}>
            <span style={{fontSize:16,lineHeight:1}}>↻</span>
            <span>Повернуть</span>
          </button>
        </div>

        <div style={{ color:'rgba(249,240,240,.5)', fontSize:11, textAlign:'center', marginTop:8 }}>
          Перетащи картинку • колесо / щипок — масштаб
        </div>

        {/* Кнопки */}
        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ flex:1, padding:'12px', borderRadius:12, border:'none',
              background:'rgba(249,240,240,.1)', color:'#F9F0F0', fontSize:14, fontWeight:600,
              cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit' }}>
            Отмена
          </button>
          <button onClick={handleDone} disabled={saving || !imgLoaded}
            style={{ flex:1, padding:'12px', borderRadius:12, border:'none',
              background:'rgba(140,110,220,.85)', color:'#F9F0F0', fontSize:14, fontWeight:700,
              cursor: (saving||!imgLoaded) ? 'wait' : 'pointer', fontFamily:'inherit',
              opacity: (saving||!imgLoaded) ? .6 : 1 }}>
            {saving ? '…' : 'Готово'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
