const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// POST /api/enrollments - enroll in course
router.post('/', authenticate, (req, res) => {
  const { course_id } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND is_published = 1').get(course_id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  const existing = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course_id);
  if (existing) return res.status(400).json({ success: false, message: 'Already enrolled' });
  const result = db.prepare('INSERT INTO enrollments (uuid, user_id, course_id, amount_paid) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), req.user.id, course_id, course.price);
  db.prepare('UPDATE courses SET total_students = total_students + 1 WHERE id = ?').run(course_id);
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Enrolled successfully', data: { enrollment } });
});

// GET /api/enrollments/my - student's courses
router.get('/my', authenticate, (req, res) => {
  const enrollments = db.prepare(`
    SELECT e.*, c.title, c.slug, c.thumbnail, c.level, c.instructor_name, c.total_lessons, c.duration
    FROM enrollments e JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ? ORDER BY e.enrolled_at DESC
  `).all(req.user.id);
  res.json({ success: true, data: { enrollments } });
});

// PUT /api/enrollments/:id/progress - update progress
router.put('/:id/progress', authenticate, (req, res) => {
  const { lesson_id, video_id, progress_seconds, completed } = req.body;
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
  if (video_id) {
    db.prepare(`INSERT INTO video_progress (user_id, video_id, progress_seconds, completed, updated_at)
      VALUES (?, ?, ?, ?, unixepoch()) ON CONFLICT(user_id, video_id)
      DO UPDATE SET progress_seconds = ?, completed = ?, updated_at = unixepoch()`)
      .run(req.user.id, video_id, progress_seconds || 0, completed ? 1 : 0, progress_seconds || 0, completed ? 1 : 0);
  }
  if (lesson_id && completed) {
    const completedLessons = JSON.parse(enrollment.completed_lessons || '[]');
    if (!completedLessons.includes(lesson_id)) {
      completedLessons.push(lesson_id);
      const course = db.prepare('SELECT total_lessons FROM courses WHERE id = ?').get(enrollment.course_id);
      const progress = Math.round((completedLessons.length / (course.total_lessons || 1)) * 100);
      const completedAt = progress >= 100 ? Math.floor(Date.now() / 1000) : null;
      db.prepare('UPDATE enrollments SET completed_lessons = ?, progress = ?, completed_at = ? WHERE id = ?')
        .run(JSON.stringify(completedLessons), progress, completedAt, enrollment.id);
    }
  }
  res.json({ success: true, message: 'Progress updated' });
});

// GET /api/enrollments/all - admin
router.get('/all', authenticate, requireAdmin, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) as count FROM enrollments').get().count;
  const enrollments = db.prepare(`
    SELECT e.*, u.name as student_name, u.email as student_email, c.title as course_title
    FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
    ORDER BY e.enrolled_at DESC LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);
  res.json({ success: true, data: { enrollments, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
});

module.exports = router;
