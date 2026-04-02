import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:3001';

export default function Welcome() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch the logged-in user's name from the JWT cookie
  useEffect(() => {
    axios
      .get(`${API}/me`, { withCredentials: true })
      .then(res => {
        setUsername(res.data.user.username);
        setIsAdmin(res.data.user.is_admin);
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  const handleLogout = async () => {
    await axios.post(`${API}/logout`, {}, { withCredentials: true });
    navigate('/login');
  };

  return (
    <div className="welcome-wrapper">
      <div className="welcome-card">
        <div className="welcome-avatar">👤</div>
        <h1 className="welcome-title">
          Hello, <span>{username || '…'}</span>!
        </h1>
        <p className="welcome-body">
          You have successfully authenticated. This is your secure dashboard.
        </p>

        <div className="badge-row">
          <span className="badge badge-purple">🛡️ Authenticated</span>
          <span className="badge badge-pink">⚡ SHA-256</span>
          <span className="badge badge-green">✓ JWT Session</span>
          {isAdmin && <span className="badge badge-admin">👑 Admin</span>}
        </div>

        {isAdmin && (
          <Link to="/admin" className="btn-admin">
            🛡️ Open Admin Panel
          </Link>
        )}

        <button className="btn-logout" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
