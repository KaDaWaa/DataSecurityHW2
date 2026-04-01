import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:3001';

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'fail'

  useEffect(() => {
    axios
      .get(`${API}/me`, { withCredentials: true })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('fail'));
  }, []);

  if (status === 'checking') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#8b8fa8'
      }}>
        Verifying session…
      </div>
    );
  }

  if (status === 'fail') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
