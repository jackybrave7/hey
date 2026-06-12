import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// /join/:code → регистрация с invite_code (старые короткие ссылки).
export default function PersonalInviteJoin() {
  const { code } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    if (code) nav(`/register?invite=${encodeURIComponent(code)}`, { replace: true });
    else nav('/register', { replace: true });
  }, [code, nav]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(249,240,240,.6)', fontSize: 14,
    }}>
      Переходим к регистрации…
    </div>
  );
}
