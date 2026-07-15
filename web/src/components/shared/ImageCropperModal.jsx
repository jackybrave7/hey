import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';

function outputMime() {
  const preferJpeg = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  return preferJpeg
    ? { mime: 'image/jpeg', ext: 'jpg', quality: 0.88 }
    : { mime: 'image/webp', ext: 'webp', quality: 0.9 };
}

export const CHAT_ASPECT_PRESETS = [
  { id: 'original', label: 'Исходный', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
];

const MAX_CROP_W = 300;
const MAX_CROP_H = 340;

function fitCropBox(ratio) {
  const r = ratio || 1;
  let w;
  let h;
  if (r >= 1) {
    w = Math.min(MAX_CROP_W, MAX_CROP_H * r);
    h = w / r;
  } else {
    h = Math.min(MAX_CROP_H, MAX_CROP_W / r);
    w = h * r;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

function outputDimensions(cropW, cropH, outputSize) {
  const aspect = cropW / cropH;
  if (aspect >= 1) {
    return { outW: outputSize, outH: Math.max(1, Math.round(outputSize / aspect)) };
  }
  return { outH: outputSize, outW: Math.max(1, Math.round(outputSize * aspect)) };
}

/**
 * Универсальный кроппер: поворот, масштаб, обрезка.
 * shape: circle — аватар; square — квадрат; free — с выбором пропорций.
 */
export function ImageCropperModal({
  file,
  onCancel,
  onDone,
  title = 'Редактировать',
  shape = 'square',
  cropSize = 280,
  outputSize = 1920,
  aspectPresets = null,
}) {
  const presets = aspectPresets ?? (shape === 'free' ? CHAT_ASPECT_PRESETS : null);

  const srcUrl = useMemo(() => {
    if (!file || !(file instanceof Blob)) return null;
    return URL.createObjectURL(file);
  }, [file]);
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [aspectId, setAspectId] = useState(presets?.[0]?.id || 'original');

  useEffect(() => {
    setAspectId(presets?.[0]?.id || 'original');
    setPos({ x: 0, y: 0 });
    setScale(1);
    setRotation(0);
    setImgLoaded(false);
    setImgSize({ w: 0, h: 0 });
  }, [file, presets]);

  const targetRatio = useMemo(() => {
    if (shape === 'circle' || shape === 'square') return 1;
    const preset = presets?.find(p => p.id === aspectId);
    if (preset?.ratio != null) return preset.ratio;
    if (!imgSize.w || !imgSize.h) return 1;
    const rotated = rotation % 180 !== 0;
    const bboxW = rotated ? imgSize.h : imgSize.w;
    const bboxH = rotated ? imgSize.w : imgSize.h;
    return bboxW / bboxH;
  }, [shape, presets, aspectId, imgSize, rotation]);

  const cropBox = useMemo(() => {
    if (shape === 'circle' || shape === 'square') {
      return { w: cropSize, h: cropSize };
    }
    return fitCropBox(targetRatio);
  }, [shape, cropSize, targetRatio]);

  const cropW = cropBox.w;
  const cropH = cropBox.h;

  const baseScale = useMemo(() => {
    if (!imgSize.w || !imgSize.h) return 1;
    const rotated = rotation % 180 !== 0;
    const w = rotated ? imgSize.h : imgSize.w;
    const h = rotated ? imgSize.w : imgSize.h;
    return Math.max(cropW / w, cropH / h);
  }, [imgSize, rotation, cropW, cropH]);

  function onImgLoad(e) {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    setPos({ x: 0, y: 0 });
    setScale(1);
    setImgLoaded(true);
  }

  function rotateBy(delta) {
    setRotation(r => ((r + delta) % 360 + 360) % 360);
    setPos({ x: 0, y: 0 });
  }

  function selectAspect(id) {
    setAspectId(id);
    setPos({ x: 0, y: 0 });
    setScale(1);
  }

  const pointers = useRef(new Map());
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
      let outW;
      let outH;
      if (shape === 'circle' || shape === 'square') {
        outW = outputSize;
        outH = outputSize;
      } else {
        ({ outW, outH } = outputDimensions(cropW, cropH, outputSize));
      }
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      const rotated = rotation % 180 !== 0;
      const naturalW = imgSize.w;
      const naturalH = imgSize.h;
      const bboxW = rotated ? naturalH : naturalW;
      const bboxH = rotated ? naturalW : naturalH;
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = bboxW;
      rotCanvas.height = bboxH;
      const rctx = rotCanvas.getContext('2d');
      rctx.save();
      rctx.translate(bboxW / 2, bboxH / 2);
      rctx.rotate((rotation * Math.PI) / 180);
      rctx.drawImage(imgRef.current, -naturalW / 2, -naturalH / 2);
      rctx.restore();

      const total = baseScale * scale;
      const dispW = bboxW * total;
      const dispH = bboxH * total;
      const cx = cropW / 2 + pos.x;
      const cy = cropH / 2 + pos.y;
      const left = cx - dispW / 2;
      const top  = cy - dispH / 2;
      const srcX = (0   - left) / total;
      const srcY = (0   - top)  / total;
      const srcW = cropW / total;
      const srcH = cropH / total;

      if (shape === 'circle') {
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(rotCanvas, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      const { mime, ext, quality } = outputMime();
      const blob = await new Promise(r => canvas.toBlob(r, mime, quality));
      const croppedFile = new File([blob], `image.${ext}`, { type: mime });
      onDone(URL.createObjectURL(blob), croppedFile);
    } finally { setSaving(false); }
  }

  const total = baseScale * scale;
  const rotated = rotation % 180 !== 0;
  const dispW = (rotated ? imgSize.h : imgSize.w) * total;
  const dispH = (rotated ? imgSize.w : imgSize.h) * total;
  const cropRadius = shape === 'circle' ? '50%' : 12;
  const modalWidth = Math.min(420, Math.max(360, cropW + 44));

  return createPortal(
    <div onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:10000,
        background:'rgba(5,2,15,.96)', backdropFilter:'blur(16px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'rgba(38,28,68,.99)', borderRadius:22, padding:'24px 22px 18px',
          width:'100%', maxWidth:modalWidth, boxShadow:'0 30px 80px rgba(0,0,0,.7)',
          border:'1px solid rgba(249,240,240,.1)' }}>
        <div style={{ color:'#F9F0F0', fontSize:17, fontWeight:700, textAlign:'center', marginBottom:14 }}>
          {title}
        </div>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            position:'relative', width:cropW, height:cropH,
            margin:'0 auto', borderRadius:cropRadius, overflow:'hidden',
            background:'#0a0518', touchAction:'none', userSelect:'none',
            cursor: imgLoaded ? 'grab' : 'default',
            border:'2px solid rgba(249,240,240,.18)',
            boxShadow:'0 8px 30px rgba(0,0,0,.4)',
          }}>
          <img
            ref={imgRef}
            src={srcUrl || ''}
            onLoad={onImgLoad}
            draggable={false}
            alt=""
            style={{
              position:'absolute',
              left: (cropW - dispW) / 2 + pos.x,
              top:  (cropH - dispH) / 2 + pos.y,
              width:  rotated ? dispH : dispW,
              height: rotated ? dispW : dispH,
              transform: `translate(${rotated ? (dispW - dispH) / 2 : 0}px, ${rotated ? (dispH - dispW) / 2 : 0}px) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              pointerEvents:'none',
              maxWidth:'none',
            }}
          />
        </div>

        {presets && (
          <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', justifyContent:'center', gap:6 }}>
            {presets.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectAspect(p.id)}
                style={{
                  padding:'5px 10px', borderRadius:20, fontSize:12, cursor:'pointer',
                  border: aspectId === p.id ? '1px solid #a884e0' : '1px solid rgba(249,240,240,.15)',
                  background: aspectId === p.id ? 'rgba(140,110,220,.35)' : 'rgba(249,240,240,.08)',
                  color:'#F9F0F0', fontFamily:'inherit',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10 }}>
          <Icon name="image" size={16}/>
          <input type="range" min={1} max={5} step={0.01}
            value={scale}
            onChange={e => setScale(parseFloat(e.target.value))}
            style={{ flex:1, accentColor:'#a884e0' }}/>
          <Icon name="image" size={22}/>
        </div>

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
          Пропорции · перетащи · колесо / щипок — масштаб
        </div>

        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button type="button" onClick={onCancel} disabled={saving}
            style={{ flex:1, padding:'12px', borderRadius:12, border:'none',
              background:'rgba(249,240,240,.1)', color:'#F9F0F0', fontSize:14, fontWeight:600,
              cursor: saving ? 'wait' : 'pointer', fontFamily:'inherit' }}>
            Отмена
          </button>
          <button type="button" onClick={handleDone} disabled={saving || !imgLoaded}
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

/** @deprecated use ImageCropperModal with shape="circle" */
export function AvatarCropperModal(props) {
  return (
    <ImageCropperModal
      {...props}
      shape="circle"
      outputSize={512}
      title="Подгоните аватарку"
    />
  );
}
