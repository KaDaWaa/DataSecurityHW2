const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { client, initDb } = require('./db');

const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true, // allow cookies cross-origin
}));
app.use(express.json());
app.use(cookieParser());

initDb();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Middleware: verify JWT from cookie
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Register endpoint (safe, parameterized)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const hashedPassword = hashPassword(password);

  try {
    const insertResult = await client.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );
    const userId = insertResult.rows[0].id;
    // Record initial password in audit log
    await client.query(
      'INSERT INTO password_audits (user_id, username, password_hash) VALUES ($1, $2, $3)',
      [userId, username, hashedPassword]
    );
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

// ⚠️  Vulnerable Login endpoint – intentional SQL injection for demo
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const passedPassword = password || '';
  const hashedPassword = hashPassword(passedPassword);

  try {
    // VULNERABLE: string concatenation instead of parameterized query
    const queryStr = `SELECT * FROM users WHERE username = '${username}' AND password = '${hashedPassword}'`;
    console.log('[VULNERABLE QUERY]', queryStr);

    const result = await client.query(queryStr);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // Issue a JWT and set it as an HttpOnly cookie
      const token = jwt.sign(
        { id: user.id, username: user.username, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      res.cookie('token', token, {
        httpOnly: true,   // not accessible via JS – XSS safe
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
      });

      res.json({ message: 'Login successful', user: { username: user.username } });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Protected route – only accessible with a valid JWT cookie
app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Logout – clear the cookie
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Forgot password – reset password (blocks reuse of previous passwords)
app.post('/forgot-password', async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username and new password are required' });
  }

  try {
    // Look up the user
    const userResult = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (userResult.rows.length === 0) {
      // Generic message to avoid username enumeration
      return res.status(404).json({ error: 'Username not found' });
    }
    const userId = userResult.rows[0].id;
    const newHash = hashPassword(newPassword);

    // Check against all previous password hashes for this user
    const auditResult = await client.query(
      'SELECT password_hash FROM password_audits WHERE user_id = $1',
      [userId]
    );
    const previousHashes = auditResult.rows.map(r => r.password_hash);
    if (previousHashes.includes(newHash)) {
      return res.status(409).json({ error: 'You cannot reuse a previous password' });
    }

    // Update the password
    await client.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newHash, userId]
    );
    // Record in audit log
    await client.query(
      'INSERT INTO password_audits (user_id, username, password_hash) VALUES ($1, $2, $3)',
      [userId, username, newHash]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /users – list all users (admin only)
app.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await client.query(
      'SELECT id, username, is_admin FROM users ORDER BY id ASC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /users/:id – delete a user (admin only)
app.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /users/:id/admin – toggle admin status (admin only)
app.patch('/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_admin } = req.body;
  if (typeof is_admin !== 'boolean') {
    return res.status(400).json({ error: 'is_admin must be a boolean' });
  }
  try {
    const result = await client.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, username, is_admin',
      [is_admin, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /password-audits – full audit log (admin only)
app.get('/password-audits', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await client.query(
      'SELECT id, username, password_hash, updated_at FROM password_audits ORDER BY updated_at DESC'
    );
    res.json({ audits: result.rows });
  } catch (error) {
    console.error('Password audits error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
