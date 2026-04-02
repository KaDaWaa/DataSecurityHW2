import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:3001';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audits'

  // Users tab state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [usersMsg, setUsersMsg] = useState('');

  // Audits tab state
  const [audits, setAudits] = useState([]);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditsError, setAuditsError] = useState('');

  // Verify the logged-in user is an admin
  useEffect(() => {
    axios
      .get(`${API}/me`, { withCredentials: true })
      .then(res => {
        const user = res.data.user;
        if (!user.is_admin) {
          navigate('/welcome', { replace: true });
        } else {
          setCurrentUser(user);
          fetchUsers();
        }
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const res = await axios.get(`${API}/users`, { withCredentials: true });
      setUsers(res.data.users);
    } catch {
      setUsersError('Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchAudits = async () => {
    setAuditsLoading(true);
    setAuditsError('');
    try {
      const res = await axios.get(`${API}/password-audits`, { withCredentials: true });
      setAudits(res.data.audits);
    } catch {
      setAuditsError('Failed to load password audit log.');
    } finally {
      setAuditsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'audits' && audits.length === 0) {
      fetchAudits();
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/users/${id}`, { withCredentials: true });
      setUsersMsg(`User "${username}" deleted.`);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      setUsersError(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const handleToggleAdmin = async (id, currentIsAdmin, username) => {
    const newStatus = !currentIsAdmin;
    const verb = newStatus ? 'Promote' : 'Demote';
    if (!window.confirm(`${verb} "${username}" to ${newStatus ? 'admin' : 'regular user'}?`)) return;
    try {
      const res = await axios.patch(
        `${API}/users/${id}/admin`,
        { is_admin: newStatus },
        { withCredentials: true }
      );
      setUsersMsg(`"${username}" is now ${newStatus ? 'an admin' : 'a regular user'}.`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_admin: res.data.user.is_admin } : u));
    } catch (err) {
      setUsersError(err.response?.data?.error || 'Failed to update user.');
    }
  };

  const handleLogout = async () => {
    await axios.post(`${API}/logout`, {}, { withCredentials: true });
    navigate('/login');
  };

  return (
    <div className="admin-wrapper">
      <div className="admin-container">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-left">
            <div className="admin-icon">🛡️</div>
            <div>
              <h1 className="admin-title">Admin Panel</h1>
              <p className="admin-subtitle">Logged in as <strong>{currentUser?.username}</strong></p>
            </div>
          </div>
          <div className="admin-header-right">
            <button className="btn-back" onClick={() => navigate('/welcome')}>← Dashboard</button>
            <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-number">{users.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{users.filter(u => u.is_admin).length}</span>
            <span className="stat-label">Admins</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{users.filter(u => !u.is_admin).length}</span>
            <span className="stat-label">Regular Users</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{audits.length || '—'}</span>
            <span className="stat-label">Audit Records</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleTabChange('users')}
          >
            👥 Users
          </button>
          <button
            className={`admin-tab ${activeTab === 'audits' ? 'active' : ''}`}
            onClick={() => handleTabChange('audits')}
          >
            🔒 Password Audits
          </button>
        </div>

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <>
            {usersError && (
              <div className="alert alert-error" onClick={() => setUsersError('')}>
                ⚠️ {usersError} <span className="alert-close">×</span>
              </div>
            )}
            {usersMsg && (
              <div className="alert alert-success" onClick={() => setUsersMsg('')}>
                ✓ {usersMsg} <span className="alert-close">×</span>
              </div>
            )}
            <div className="admin-table-wrapper">
              {usersLoading ? (
                <div className="admin-loading">
                  <div className="spinner" />
                  <p>Loading users…</p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className={user.is_admin ? 'row-admin' : ''}>
                        <td className="col-id">#{user.id}</td>
                        <td className="col-username">
                          <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
                          {user.username}
                          {user.id === currentUser?.id && <span className="you-badge">you</span>}
                        </td>
                        <td className="col-role">
                          {user.is_admin
                            ? <span className="role-badge role-admin">🛡️ Admin</span>
                            : <span className="role-badge role-user">👤 User</span>}
                        </td>
                        <td className="col-actions">
                          <button
                            className={`btn-action ${user.is_admin ? 'btn-demote' : 'btn-promote'}`}
                            onClick={() => handleToggleAdmin(user.id, user.is_admin, user.username)}
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? 'Cannot modify your own role' : ''}
                          >
                            {user.is_admin ? 'Demote' : 'Make Admin'}
                          </button>
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(user.id, user.username)}
                            disabled={user.id === currentUser?.id}
                            title={user.id === currentUser?.id ? 'Cannot delete your own account' : ''}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={4} className="empty-row">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Password Audits Tab ── */}
        {activeTab === 'audits' && (
          <>
            {auditsError && (
              <div className="alert alert-error" onClick={() => setAuditsError('')}>
                ⚠️ {auditsError} <span className="alert-close">×</span>
              </div>
            )}
            <div className="admin-table-wrapper">
              {auditsLoading ? (
                <div className="admin-loading">
                  <div className="spinner" />
                  <p>Loading audit log…</p>
                </div>
              ) : (
                <table className="admin-table audit-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Username</th>
                      <th>Password Hash (SHA-256)</th>
                      <th>Updated At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map(row => (
                      <tr key={row.id}>
                        <td className="col-id">#{row.id}</td>
                        <td className="col-username">
                          <span className="user-avatar">{row.username.charAt(0).toUpperCase()}</span>
                          {row.username}
                        </td>
                        <td className="col-hash">
                          <code className="hash-value">{row.password_hash}</code>
                        </td>
                        <td className="col-date">{formatDate(row.updated_at)}</td>
                      </tr>
                    ))}
                    {audits.length === 0 && (
                      <tr><td colSpan={4} className="empty-row">No audit records yet.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="audit-refresh">
              <button className="btn-back" onClick={fetchAudits}>↻ Refresh</button>
              <p className="admin-note">Showing all password change events, newest first.</p>
            </div>
          </>
        )}

        <p className="admin-note" style={{ marginTop: '12px' }}>
          💡 You cannot delete or modify your own account. Changes take effect immediately.
        </p>
      </div>
    </div>
  );
}
