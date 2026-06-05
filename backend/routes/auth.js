const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 12);
    const stmt = db.prepare('INSERT INTO users (uuid, name, email, password, phone) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(uuidv4(), name.trim(), email.toLowerCase(), hashed, phone || null);
    const user = db.prepare('SELECT id, uuid, name, email, role, avatar FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'Registration successful', data: { token: signToken(user), user } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const { password: _, ...safeUser } = user;
    res.json({ success: true, message: 'Login successful', data: { token: signToken(user), user: safeUser } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, uuid, name, email, role, avatar, phone, bio, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, data: { user } });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, bio } = req.body;
    db.prepare('UPDATE users SET name = ?, phone = ?, bio = ?, updated_at = unixepoch() WHERE id = ?')
      .run(name || req.user.name, phone || null, bio || null, req.user.id);
    const updated = db.prepare('SELECT id, uuid, name, email, role, avatar, phone, bio FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, message: 'Profile updated', data: { user: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed', error: err.message });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    const hashed = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ?, updated_at = unixepoch() WHERE id = ?').run(hashed, req.user.id);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to change password', error: err.message });
  }
});

module.exports = router;
