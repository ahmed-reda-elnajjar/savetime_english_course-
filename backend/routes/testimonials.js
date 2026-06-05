const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  const { featured, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE is_approved = 1';
  if (featured === 'true') where += ' AND is_featured = 1';
  const total = db.prepare(`SELECT COUNT(*) as count FROM testimonials ${where}`).get().count;
  const items = db.prepare(`SELECT * FROM testimonials ${where} ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?`).all(parseInt(limit), offset);
  res.json({ success: true, data: { testimonials: items, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
});

router.post('/', authenticate, (req, res) => {
  const { student_name, student_title, content, rating, course_id, before_achievement, after_achievement } = req.body;
  if (!content) return res.status(400).json({ success: false, message: 'Content required' });
  const course = course_id ? db.prepare('SELECT title FROM courses WHERE id = ?').get(course_id) : null;
  const result = db.prepare(`INSERT INTO testimonials (uuid, user_id, student_name, student_title, content, rating, course_id, course_name, before_achievement, after_achievement, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(uuidv4(), req.user.id, student_name || req.user.name, student_title, content, rating || 5, course_id || null, course?.title || null, before_achievement, after_achievement);
  res.status(201).json({ success: true, message: 'Testimonial submitted for review', data: { id: result.lastInsertRowid } });
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { student_name, student_title, content, rating, is_featured, is_approved, before_achievement, after_achievement } = req.body;
  db.prepare(`UPDATE testimonials SET student_name = COALESCE(?, student_name), student_title = COALESCE(?, student_title), content = COALESCE(?, content), rating = COALESCE(?, rating), is_featured = COALESCE(?, is_featured), is_approved = COALESCE(?, is_approved), before_achievement = COALESCE(?, before_achievement), after_achievement = COALESCE(?, after_achievement) WHERE id = ?`)
    .run(student_name, student_title, content, rating, is_featured, is_approved, before_achievement, after_achievement, req.params.id);
  res.json({ success: true, message: 'Testimonial updated' });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Testimonial deleted' });
});

router.get('/admin/all', authenticate, requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC').all();
  res.json({ success: true, data: { testimonials: items } });
});

module.exports = router;
