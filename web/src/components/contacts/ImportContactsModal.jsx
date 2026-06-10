import { useState, useRef } from 'react';
import { api } from '../../api';
import { heyToast } from '../shared/Toast';

function ImportContactsModal({ onClose, onImported }) {
  const [stage, setStage]     = useState('pick');   // 'pick' | 'preview' | 'done'
  const [rows, setRows]       = useState([]);        // [{name, phone}]
  const [selected, setSelected] = useState(new Set());
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef               = useRef();

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const results = [];
    for (const line of lines) {
      const cols = line.split(/[,;\t]/).map(c => c.replace(/^"|"$/g, '').trim());
      // Try to detect phone column — look for a cell starting with + or containing digits 7+
      const phone = cols.find(c => /^\+?\d{7,}$/.test(c.replace(/[\s\-()]/g, '')));
      if (!phone) continue;
      // Name = first non-phone cell that has letters
      const name  = cols.find(c => c !== phone && /[a-zA-Zа-яёА-ЯЁ]/.test(c)) || '';
      results.push({ name: name || '—', phone });
    }
    return results;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const ext = file.name.split('.').pop().toLowerCase();

    try {
      if (ext === 'csv' || ext === 'txt') {
        const text = await file.text();
        const parsed = parseCSV(text);
        if (!parsed.length) { setError('Не удалось найти номера телефонов в файле.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
        // Dynamic import so xlsx doesn't bloat the initial bundle
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const textLines = data.map(row => row.join('\t')).join('\n');
        const parsed = parseCSV(textLines);
        if (!parsed.length) { setError('Не удалось найти номера телефонов в таблице.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else if (ext === 'vcf') {
        const text = await file.text();
        const vcards = text.split('BEGIN:VCARD').slice(1);
        const parsed = vcards.map(vc => {
          const fnMatch  = vc.match(/^FN[;:][^\r\n]*/m);
          const telMatch = vc.match(/^TEL[;:][^\r\n]*/m);
          const name  = fnMatch  ? fnMatch[0].replace(/^FN[;:][^:]*:?/, '').trim() : '—';
          const phone = telMatch ? telMatch[0].replace(/^TEL[;:][^:]*:?/, '').trim() : '';
          return phone ? { name, phone } : null;
        }).filter(Boolean);
        if (!parsed.length) { setError('Не найдено контактов в vCard-файле.'); return; }
        setRows(parsed);
        setSelected(new Set(parsed.map((_, i) => i)));
        setStage('preview');
      } else {
        setError('Поддерживаются файлы: CSV, XLSX, XLS, VCF');
      }
    } catch(err) {
      setError('Ошибка чтения файла: ' + err.message);
    }
  }

  function toggleRow(i) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function importSelected() {
    setLoading(true);
    const toImport = rows.filter((_, i) => selected.has(i));
    let imported = 0, failed = 0;
    for (const { name, phone } of toImport) {
      try {
        const contact = await api.addContact({ phone, nickname: name !== '—' ? name : undefined });
        onImported?.(contact);
        imported++;
      } catch { failed++; }
    }
    setLoading(false);
    setRows([{ name: `✓ Добавлено: ${imported}`, phone: failed ? `✗ Не найдено: ${failed}` : '' }]);
    setStage('done');
  }

  const overlay = { position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,.6)',
    backdropFilter:'blur(10px)',display:'flex',alignItems:'center',justifyContent:'center' };
  const panel   = { background:'rgba(38,28,68,.97)',backdropFilter:'blur(24px)',
    borderRadius:24,width:'min(94vw,480px)',maxHeight:'80vh',display:'flex',
    flexDirection:'column',boxShadow:'0 24px 64px rgba(0,0,0,.55)',
    border:'1px solid rgba(249,240,240,.13)' };
  const hdr     = { padding:'22px 24px 16px',borderBottom:'1px solid rgba(249,240,240,.1)',
    display:'flex',alignItems:'center',gap:12 };

  return (
    <div style={overlay} onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={hdr}>
          <span style={{fontSize:22}}>📥</span>
          <div>
            <div style={{color:'#F9F0F0',fontSize:17,fontWeight:700}}>Импорт контактов</div>
            <div style={{color:'rgba(249,240,240,.45)',fontSize:13}}>CSV · XLSX · VCF (vCard)</div>
          </div>
          <button onClick={onClose} style={{marginLeft:'auto',background:'none',border:'none',
            color:'rgba(249,240,240,.4)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
        </div>

        {stage === 'pick' && (
          <div style={{padding:28,display:'flex',flexDirection:'column',gap:20,alignItems:'center'}}>
            {/* Google Contacts hint */}
            <div style={{background:'rgba(249,240,240,.06)',borderRadius:16,padding:'16px 20px',
              color:'rgba(249,240,240,.55)',fontSize:13,lineHeight:1.7,width:'100%',boxSizing:'border-box'}}>
              <b style={{color:'rgba(249,240,240,.8)'}}>Google Контакты:</b><br/>
              Перейдите на <span style={{color:'rgba(160,140,220,.9)'}}>contacts.google.com</span> →
              Экспорт → Формат Google CSV → скачайте файл и загрузите сюда.
            </div>

            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods,.vcf,.txt"
              onChange={handleFile} style={{display:'none'}}/>
            <button onClick={() => fileRef.current?.click()}
              style={{padding:'14px 36px',borderRadius:50,background:'rgba(95, 64, 128,.75)',
                border:'none',color:'#F9F0F0',fontSize:15,fontWeight:600,cursor:'pointer',
                boxShadow:'0 4px 20px rgba(120,80,180,.35)',transition:'opacity .15s'}}
              onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              Выбрать файл
            </button>

            {error && <div style={{color:'rgba(255,140,140,.85)',fontSize:13,textAlign:'center'}}>{error}</div>}
          </div>
        )}

        {stage === 'preview' && (
          <>
            <div style={{padding:'12px 20px',borderBottom:'1px solid rgba(249,240,240,.08)',
              display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:'rgba(249,240,240,.5)',fontSize:13}}>
                Найдено: {rows.length} контактов. Выбрано: {selected.size}
              </span>
              <button onClick={() => {
                selected.size === rows.length
                  ? setSelected(new Set())
                  : setSelected(new Set(rows.map((_,i)=>i)));
              }} style={{marginLeft:'auto',background:'rgba(249,240,240,.08)',border:'none',
                borderRadius:10,padding:'6px 12px',color:'rgba(249,240,240,.7)',
                fontSize:12,cursor:'pointer'}}>
                {selected.size === rows.length ? 'Снять всё' : 'Выбрать всё'}
              </button>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {rows.map((r,i) => (
                <div key={i} onClick={() => toggleRow(i)}
                  style={{display:'flex',alignItems:'center',gap:12,
                    padding:'11px 20px',cursor:'pointer',
                    background: selected.has(i) ? 'rgba(95, 64, 128,.1)' : 'transparent',
                    borderBottom:'1px solid rgba(249,240,240,.06)',transition:'background .12s'}}>
                  <div style={{width:20,height:20,borderRadius:6,flexShrink:0,
                    background: selected.has(i) ? 'rgba(95, 64, 128,.8)' : 'rgba(249,240,240,.12)',
                    border:'1px solid rgba(249,240,240,.2)',display:'flex',
                    alignItems:'center',justifyContent:'center',fontSize:13,color:'#F9F0F0'}}>
                    {selected.has(i) ? '✓' : ''}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:'#F9F0F0',fontSize:14,fontWeight:500,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                    <div style={{color:'rgba(249,240,240,.45)',fontSize:12}}>{r.phone}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'16px 20px',borderTop:'1px solid rgba(249,240,240,.08)',
              display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={() => setStage('pick')}
                style={{padding:'11px 22px',borderRadius:14,background:'rgba(249,240,240,.09)',
                  border:'1px solid rgba(249,240,240,.15)',color:'rgba(249,240,240,.8)',
                  fontSize:14,cursor:'pointer'}}>
                Назад
              </button>
              <button onClick={importSelected} disabled={selected.size===0||loading}
                style={{padding:'11px 24px',borderRadius:14,
                  background: selected.size>0&&!loading ? 'rgba(95, 64, 128,.8)' : 'rgba(249,240,240,.07)',
                  border:'none',color: selected.size>0&&!loading ? '#F9F0F0' : 'rgba(249,240,240,.3)',
                  fontSize:14,fontWeight:600,cursor: selected.size>0&&!loading ? 'pointer' : 'not-allowed',
                  transition:'all .2s'}}>
                {loading ? 'Добавление…' : `Добавить ${selected.size}`}
              </button>
            </div>
          </>
        )}

        {stage === 'done' && (
          <div style={{padding:'40px 28px',display:'flex',flexDirection:'column',
            alignItems:'center',gap:20,textAlign:'center'}}>
            <div style={{fontSize:52}}>✅</div>
            <div style={{color:'#F9F0F0',fontSize:16,fontWeight:600}}>{rows[0]?.name}</div>
            {rows[0]?.phone && <div style={{color:'rgba(255,160,160,.8)',fontSize:14}}>{rows[0].phone}</div>}
            <button onClick={onClose}
              style={{padding:'12px 36px',borderRadius:50,background:'rgba(95, 64, 128,.75)',
                border:'none',color:'#F9F0F0',fontSize:15,fontWeight:600,cursor:'pointer'}}>
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportContactsModal;
