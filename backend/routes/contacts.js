const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ success: false, message: 'Name, email and message required' });
  const result = db.prepare('INSERT INTO contact_messages (uuid, name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), name, email, phone || null, subject || 'General Inquiry', message);
  res.status(201).json({ success: true, message: 'Message sent successfully. We will get back to you soon!' });
});

router.get('/', authenticate, requireAdmin, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const total = db.prepare(`SELECT COUNT(*) as count FROM contact_messages ${where}`).get(...params).count;
  const messages = db.prepare(`SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  res.json({ success: true, data: { messages, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
});

router.put('/:id/status', authenticate, requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE contact_messages SET status = ?, replied_at = CASE WHEN ? = ? THEN unixepoch() ELSE replied_at END WHERE id = ?')
    .run(status, status, 'replied', req.params.id);
  res.json({ success: true, message: 'Status updated' });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Message deleted' });
});

module.exports = router;
