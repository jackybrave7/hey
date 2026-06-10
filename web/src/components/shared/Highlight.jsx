function Highlight({ text, q }) {
  if (!text) return null;
  if (!q) return text;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{
        background:'rgba(255,210,100,.35)', color:'rgba(255,235,170,1)',
        padding:'0 2px', borderRadius:3,
      }}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default Highlight;
