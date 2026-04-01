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

// Register endpoint (safe, parameterized)
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const hashedPassword = hashPassword(password);

  try {
    await client.query(
      'INSERT INTO users (username, password) VALUES ($1, $2)',
      [username, hashedPassword]
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
        { id: user.id, username: user.username },
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

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
