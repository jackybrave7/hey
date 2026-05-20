// AchievementBadges.jsx — row of achievement badge icons
const BADGES = {
  connector:         { icon: '🔗', label: 'Связной' },
  circle_keeper:     { icon: '⭕', label: 'Хранитель круга' },
  community_founder: { icon: '⭐', label: 'Основатель сообщества' },
};

export default function AchievementBadges({ achievements }) {
  if (!achievements || achievements.length === 0) return null;

  const earned = achievements.filter(key => BADGES[key]);
  if (!earned.length) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {earned.map(key => {
        const badge = BADGES[key];
        return (
          <div
            key={key}
            title={badge.label}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(140,100,220,.7), rgba(80,40,160,.8))',
              border: '1.5px solid #f0c040',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
              cursor: 'default',
              flexShrink: 0,
            }}
          >
            {badge.icon}
          </div>
        );
      })}
    </div>
  );
}
