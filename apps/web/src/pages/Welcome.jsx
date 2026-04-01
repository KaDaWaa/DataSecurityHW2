import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:3001';

export default function Welcome() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  // Fetch the logged-in user's name from the JWT cookie
  useEffect(() => {
    axios
      .get(`${API}/me`, { withCredentials: true })
      .then(res => setUsername(res.data.user.username))
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
        </div>

        <button className="btn-logout" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
