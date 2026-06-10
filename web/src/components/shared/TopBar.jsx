// web/src/components/shared/TopBar.jsx
export default function TopBar({ title, onBack, right, avatar, online }) {
  return (
    <div className="topbar">
      <div className="topbar-inner">
        {onBack && <button className="back-btn" onClick={onBack}>‹</button>}
        {avatar && (
          <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(210,185,225,.55)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
            {avatar}
          </div>
        )}
        <span className="topbar-title">{title}</span>
        {online && <div className="online-dot" />}
        {right ?? <div className="topbar-dots">{[0,1,2].map(i=><div key={i} className="topbar-dot"/>)}</div>}
      </div>
    </div>
  );
}
