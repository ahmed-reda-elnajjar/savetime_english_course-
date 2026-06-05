const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { uploadImage, uploadVideo } = require('../middleware/upload');

// GET /api/courses - public list with filters
router.get('/', optionalAuth, (req, res) => {
  const { search, category, level, page = 1, limit = 12, featured } = req.query;
  const offset = (page - 1) * limit;
  let where = ['c.is_published = 1'];
  const params = [];
  if (search) { where.push('(c.title LIKE ? OR c.description LIKE ? OR c.instructor_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (category) { where.push('c.category = ?'); params.push(category); }
  if (level) { where.push('c.level = ?'); params.push(level); }
  if (featured === 'true') { where.push('c.is_featured = 1'); }
  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM courses c ${whereStr}`).get(...params).count;
  const courses = db.prepare(`SELECT c.*, CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END as enrolled FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ? ${whereStr} ORDER BY c.is_featured DESC, c.total_students DESC LIMIT ? OFFSET ?`).all(req.user?.id || 0, ...params, parseInt(limit), offset);
  res.json({ success: true, data: { courses, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } } });
});

// GET /api/courses/categories
router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT category, COUNT(*) as count FROM courses WHERE is_published = 1 GROUP BY category ORDER BY count DESC').all();
  res.json({ success: true, data: { categories: cats } });
});

// GET /api/courses/:slug
router.get('/:slug', optionalAuth, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE slug = ? AND is_published = 1').get(req.params.slug);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  const lessons = db.prepare('SELECT id, uuid, title, description, order_index, is_preview FROM lessons WHERE course_id = ? ORDER BY order_index').all(course.id);
  const enrolled = req.user ? db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id) : null;
  for (const lesson of lessons) {
    const videos = db.prepare('SELECT id, uuid, title, duration, order_index, is_free, thumbnail FROM videos WHERE lesson_id = ? ORDER BY order_index').all(lesson.id);
    lesson.videos = videos;
  }
  res.json({ success: true, data: { course, lessons, enrollment: enrolled } });
});

// POST /api/courses - admin only
router.post('/', authenticate, requireAdmin, uploadImage.single('thumbnail'), (req, res) => {
  try {
    const { title, description, short_description, level, duration, price, original_price, instructor_name, category, tags, language, certificate } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const thumbnail = req.file ? `/uploads/images/${req.file.filename}` : null;
    const isPublished = req.body.is_published !== undefined ? parseInt(req.body.is_published) : 1;
    const isFeatured = (req.body.is_featured === '1' || req.body.is_featured === 1) ? 1 : 0;
    const result = db.prepare(`INSERT INTO courses (uuid, title, slug, description, short_description, thumbnail, level, duration, price, original_price, instructor_id, instructor_name, category, tags, language, certificate, is_published, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), title, slug, description, short_description, thumbnail, level || 'beginner', duration, parseFloat(price) || 0, parseFloat(original_price) || 0, req.user.id, instructor_name, category, tags || '[]', language || 'English', certificate ? 1 : 0, isPublished, isFeatured);
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'Course created', data: { course } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/courses/:id - admin only
router.put('/:id', authenticate, requireAdmin, uploadImage.single('thumbnail'), (req, res) => {
  try {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const fields = ['title', 'description', 'short_description', 'level', 'duration', 'price', 'original_price', 'instructor_name', 'category', 'tags', 'language', 'is_published', 'is_featured'];
    const updates = {};
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.file) updates.thumbnail = `/uploads/images/${req.file.filename}`;
    updates.updated_at = Math.floor(Date.now() / 1000);
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE courses SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);
    const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Course updated', data: { course: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/courses/:id - admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Course deleted' });
});

// POST /api/courses/:id/lessons - admin
router.post('/:id/lessons', authenticate, requireAdmin, (req, res) => {
  const { title, description, order_index, is_preview } = req.body;
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  const result = db.prepare('INSERT INTO lessons (uuid, course_id, title, description, order_index, is_preview) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), req.params.id, title, description, order_index || 0, is_preview ? 1 : 0);
  db.prepare('UPDATE courses SET total_lessons = total_lessons + 1 WHERE id = ?').run(req.params.id);
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: { lesson } });
});

// GET /api/courses/:id/videos - list all videos for a course (admin)
router.get('/id/:id/videos', authenticate, requireAdmin, (req, res) => {
  const videos = db.prepare(`SELECT v.*, l.title as lesson_title FROM videos v JOIN lessons l ON l.id = v.lesson_id WHERE l.course_id = ? ORDER BY v.order_index`).all(req.params.id);
  res.json({ success: true, data: { videos } });
});

// POST /api/courses/:id/videos - upload a video straight to a course (admin).
// Auto-creates a lesson if the course has none, so admins don't need to manage
// lessons manually (Coursera-style simple upload).
router.post('/:id/videos', authenticate, requireAdmin, uploadVideo.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Video file required' });
    const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const { title, duration, is_free } = req.body;
    let lesson = db.prepare('SELECT id FROM lessons WHERE course_id = ? ORDER BY order_index LIMIT 1').get(req.params.id);
    if (!lesson) {
      const lr = db.prepare('INSERT INTO lessons (uuid, course_id, title, description, order_index, is_preview) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), req.params.id, 'Course Lessons', '', 0, 1);
      lesson = { id: lr.lastInsertRowid };
      db.prepare('UPDATE courses SET total_lessons = total_lessons + 1 WHERE id = ?').run(req.params.id);
    }
    const order = db.prepare('SELECT COUNT(*) as c FROM videos WHERE lesson_id = ?').get(lesson.id).c;
    const free = (is_free === '1' || is_free === 1 || is_free === true) ? 1 : 0;
    const result = db.prepare(`INSERT INTO videos (uuid, lesson_id, title, filename, original_name, file_size, duration, order_index, is_free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), lesson.id, title || req.file.originalname, req.file.filename, req.file.originalname, req.file.size, duration || null, order, free);
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'Video uploaded', data: { video } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
