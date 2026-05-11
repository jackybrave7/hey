// MoodEmoji.jsx — SVG-персонажи для карточек без медиа
export default function MoodEmoji({ type = 'calm', size = 130 }) {

  const emojis = {

    sleepy: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="#FFFFFF"/>
        <circle cx="50" cy="50" r="40" fill="#B8B8E0"/>
        {/* sleepy closed eyes */}
        <path d="M 32 46 Q 38 42 44 46" stroke="#3a2050" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <path d="M 56 46 Q 62 42 68 46" stroke="#3a2050" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        {/* cheek blush */}
        <ellipse cx="32" cy="58" rx="5" ry="3" fill="#D89AB8" opacity="0.45"/>
        <ellipse cx="68" cy="58" rx="5" ry="3" fill="#D89AB8" opacity="0.45"/>
        {/* small calm mouth */}
        <path d="M 44 64 Q 50 67 56 64" stroke="#3a2050" strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* z z */}
        <text x="68" y="22" fontFamily="sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF" opacity="0.85">z</text>
        <text x="76" y="16" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#FFFFFF" opacity="0.65">z</text>
      </svg>
    ),

    starstruck: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="#FFFFFF"/>
        <circle cx="50" cy="50" r="40" fill="#FFE0A0"/>
        {/* star eyes */}
        <path d="M 35 42 L 36.5 46 L 40.5 46 L 37.5 48.5 L 38.5 52.5 L 35 50 L 31.5 52.5 L 32.5 48.5 L 29.5 46 L 33.5 46 Z" fill="#3a2050"/>
        <path d="M 65 42 L 66.5 46 L 70.5 46 L 67.5 48.5 L 68.5 52.5 L 65 50 L 61.5 52.5 L 62.5 48.5 L 59.5 46 L 63.5 46 Z" fill="#3a2050"/>
        {/* pink cheeks */}
        <ellipse cx="30" cy="60" rx="6" ry="3.5" fill="#FF9AB8" opacity="0.55"/>
        <ellipse cx="70" cy="60" rx="6" ry="3.5" fill="#FF9AB8" opacity="0.55"/>
        {/* excited smile */}
        <path d="M 38 62 Q 50 72 62 62" stroke="#3a2050" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
        {/* sparkles */}
        <text x="14" y="28" fontSize="13" fill="#FFFFFF" opacity="0.85">✦</text>
        <text x="80" y="82" fontSize="11" fill="#FFFFFF" opacity="0.7">✦</text>
        <text x="84" y="32" fontSize="9" fill="#FFFFFF" opacity="0.6">✦</text>
      </svg>
    ),

    dreamy: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="#FFFFFF"/>
        <circle cx="50" cy="50" r="40" fill="#F0B8D0"/>
        {/* half-open dreamy eyes */}
        <ellipse cx="35" cy="48" rx="9" ry="6" fill="#E08898"/>
        <ellipse cx="65" cy="48" rx="9" ry="6" fill="#E08898"/>
        <ellipse cx="35" cy="50" rx="9" ry="4" fill="#F0B8D0"/>
        <ellipse cx="65" cy="50" rx="9" ry="4" fill="#F0B8D0"/>
        {/* cheeks */}
        <ellipse cx="30" cy="60" rx="6" ry="3.5" fill="#D870A0" opacity="0.35"/>
        <ellipse cx="70" cy="60" rx="6" ry="3.5" fill="#D870A0" opacity="0.35"/>
        {/* smile */}
        <path d="M 40 66 Q 50 74 60 66" stroke="#C060A0" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        {/* floating stars */}
        <circle cx="27" cy="32" r="3.5" fill="white" opacity="0.7"/>
        <circle cx="78" cy="26" r="2.5" fill="white" opacity="0.6"/>
        <circle cx="72" cy="18" r="1.8" fill="white" opacity="0.5"/>
      </svg>
    ),

    calm: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="#FFFFFF"/>
        <circle cx="50" cy="50" r="40" fill="#A8D8C0"/>
        {/* open calm eyes */}
        <ellipse cx="35" cy="48" rx="9" ry="7" fill="#78B898"/>
        <ellipse cx="65" cy="48" rx="9" ry="7" fill="#78B898"/>
        <circle cx="37" cy="46" r="3" fill="white" opacity="0.6"/>
        <circle cx="67" cy="46" r="3" fill="white" opacity="0.6"/>
        {/* cheeks */}
        <ellipse cx="30" cy="60" rx="6" ry="3" fill="#60C8A0" opacity="0.35"/>
        <ellipse cx="70" cy="60" rx="6" ry="3" fill="#60C8A0" opacity="0.35"/>
        {/* gentle smile */}
        <path d="M 40 66 Q 50 72 60 66" stroke="#3a6050" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      </svg>
    ),

    excited: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <circle cx="50" cy="50" r="46" fill="#FFFFFF"/>
        <circle cx="50" cy="50" r="40" fill="#F0C090"/>
        {/* round excited eyes */}
        <circle cx="35" cy="46" r="9" fill="#D08040"/>
        <circle cx="65" cy="46" r="9" fill="#D08040"/>
        <circle cx="37" cy="44" r="4" fill="white"/>
        <circle cx="67" cy="44" r="4" fill="white"/>
        {/* cheeks */}
        <ellipse cx="30" cy="60" rx="6" ry="3.5" fill="#E06020" opacity="0.35"/>
        <ellipse cx="70" cy="60" rx="6" ry="3.5" fill="#E06020" opacity="0.35"/>
        {/* big open smile */}
        <path d="M 33 66 Q 50 80 67 66" stroke="#C07030" strokeWidth="2.8" strokeLinecap="round" fill="none"/>
        {/* exclamation marks */}
        <text x="16" y="30" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#FFFFFF" opacity="0.8">!</text>
        <text x="80" y="34" fontFamily="sans-serif" fontSize="14" fontWeight="700" fill="#FFFFFF" opacity="0.8">!</text>
      </svg>
    ),
  };

  const gradients = {
    sleepy:     'linear-gradient(135deg,#3a2050,#6040a0,#9070d0)',
    starstruck: 'linear-gradient(135deg,#1e0a40,#4a1a80,#7030b0)',
    dreamy:     'linear-gradient(135deg,#5A1040,#8A2060,#C050A0)',
    calm:       'linear-gradient(135deg,#0A3A2A,#1A5A40,#2A7060)',
    excited:    'linear-gradient(135deg,#5A2000,#8A4010,#C06020)',
  };

  return (
    <div style={{
      width:'100%', height:'100%',
      background: gradients[type] || gradients.calm,
      display:'flex', alignItems:'center', justifyContent:'center',
      borderRadius:'inherit',
    }}>
      <div style={{
        filter:'drop-shadow(0 6px 20px rgba(0,0,0,.25))',
        display:'flex',alignItems:'center',justifyContent:'center',
      }}>
        {emojis[type] || emojis.calm}
      </div>
    </div>
  );
}
