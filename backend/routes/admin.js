const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticate, requireAdmin);

// GET /api/admin/analytics
router.get('/analytics', (req, res) => {
  const totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
  const totalCourses = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  const totalEnrollments = db.prepare('SELECT COUNT(*) as count FROM enrollments').get().count;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount_paid), 0) as total FROM enrollments').get().total;
  const unreadMessages = db.prepare("SELECT COUNT(*) as count FROM contact_messages WHERE status = 'unread'").get().count;
  const pendingTestimonials = db.prepare('SELECT COUNT(*) as count FROM testimonials WHERE is_approved = 0').get().count;
  const recentEnrollments = db.prepare(`SELECT e.enrolled_at, u.name as student, c.title as course, e.amount_paid FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id ORDER BY e.enrolled_at DESC LIMIT 10`).all();
  const monthlyRevenue = db.prepare(`SELECT strftime('%Y-%m', datetime(enrolled_at, 'unixepoch')) as month, COUNT(*) as enrollments, SUM(amount_paid) as revenue FROM enrollments WHERE enrolled_at >= unixepoch('now', '-12 months') GROUP BY month ORDER BY month`).all();
  const topCourses = db.prepare('SELECT title, total_students, price, rating FROM courses ORDER BY total_students DESC LIMIT 5').all();
  res.json({ success: true, data: { stats: { totalStudents, totalCourses, totalEnrollments, totalRevenue, unreadMessages, pendingTestimonials }, recentEnrollments, monthlyRevenue, topCourses } });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = ["role != 'admin'"];
  const params = [];
  if (search) { where.push('(name LIKE ? OR email LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (role) { where.push('role = ?'); params.push(role); }
  const whereStr = 'WHERE ' + where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereStr}`).get(...params).count;
  const users = db.prepare(`SELECT id, uuid, name, email, role, is_active, created_at, phone FROM users ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);
  res.json({ success: true, data: { users, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
});

// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const { name, is_active, role } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?, name), is_active = COALESCE(?, is_active), role = COALESCE(?, role), updated_at = unixepoch() WHERE id = ?')
    .run(name, is_active, role, req.params.id);
  res.json({ success: true, message: 'User updated' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});

// GET /api/admin/settings
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ success: true, data: { settings } });
});

// PUT /api/admin/settings
router.put('/settings', (req, res) => {
  const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = unixepoch()');
  for (const [key, value] of Object.entries(req.body)) {
    stmt.run(key, String(value), String(value));
  }
  res.json({ success: true, message: 'Settings saved' });
});

// GET/POST/PUT/DELETE pricing plans
router.get('/pricing', (req, res) => {
  const plans = db.prepare('SELECT * FROM pricing_plans ORDER BY price').all();
  res.json({ success: true, data: { plans } });
});

router.post('/pricing', (req, res) => {
  const { name, description, price, billing_cycle, features, is_popular } = req.body;
  const result = db.prepare('INSERT INTO pricing_plans (uuid, name, description, price, billing_cycle, features, is_popular) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), name, description, price, billing_cycle || 'monthly', JSON.stringify(features || []), is_popular ? 1 : 0);
  const plan = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: { plan } });
});

router.put('/pricing/:id', (req, res) => {
  const { name, description, price, billing_cycle, features, is_popular, is_active } = req.body;
  db.prepare('UPDATE pricing_plans SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), billing_cycle = COALESCE(?, billing_cycle), features = COALESCE(?, features), is_popular = COALESCE(?, is_popular), is_active = COALESCE(?, is_active) WHERE id = ?')
    .run(name, description, price, billing_cycle, features ? JSON.stringify(features) : null, is_popular, is_active, req.params.id);
  res.json({ success: true, message: 'Plan updated' });
});

router.delete('/pricing/:id', (req, res) => {
  db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Plan deleted' });
});

// Videos management
router.get('/videos', (req, res) => {
  const videos = db.prepare(`SELECT v.*, l.title as lesson_title, c.title as course_title FROM videos v JOIN lessons l ON l.id = v.lesson_id JOIN courses c ON c.id = l.course_id ORDER BY v.created_at DESC`).all();
  res.json({ success: true, data: { videos } });
});

router.delete('/videos/:id', (req, res) => {
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Video deleted' });
});

module.exports = router;
