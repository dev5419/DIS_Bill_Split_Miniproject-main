import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/mysql.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = email.split('@')[0];

    await pool.query(
      'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      [id, email, passwordHash, displayName]
    );

    const token = generateToken({ id, email, display_name: displayName });
    res.json({ token, user: { uid: id, email, displayName } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];
    if (!user.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { uid: user.id, email: user.email, displayName: user.display_name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
});

// POST /api/auth/guest
router.post('/guest', async (req, res) => {
  try {
    const id = uuidv4();
    const guestName = `Guest_${id.substring(0, 6)}`;

    await pool.query(
      'INSERT INTO users (id, display_name, is_anonymous) VALUES (?, ?, TRUE)',
      [id, guestName]
    );

    const token = generateToken({ id, email: null, display_name: guestName });
    res.json({
      token,
      user: { uid: id, email: null, displayName: guestName }
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ message: 'Failed to create guest account' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.uid]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    res.json({
      uid: user.id,
      email: user.email || null,
      displayName: user.display_name || null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

export default router;
