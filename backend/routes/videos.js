const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');
const { uploadVideo, uploadImage } = require('../middleware/upload');

// GET /api/videos/lesson/:lessonId - get videos for a lesson
router.get('/lesson/:lessonId', authenticate, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(lesson.course_id);
  const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, lesson.course_id);
  const isAdmin = req.user.role === 'admin';
  if (!enrolled && !isAdmin && !lesson.is_preview) {
    return res.status(403).json({ success: false, message: 'Enrollment required' });
  }
  const videos = db.prepare('SELECT * FROM videos WHERE lesson_id = ? ORDER BY order_index').all(req.params.lessonId);
  const progress = db.prepare('SELECT video_id, progress_seconds, completed FROM video_progress WHERE user_id = ?').all(req.user.id);
  const progressMap = Object.fromEntries(progress.map(p => [p.video_id, p]));
  const videosWithProgress = videos.map(v => ({ ...v, userProgress: progressMap[v.id] || null }));
  res.json({ success: true, data: { videos: videosWithProgress, lesson, course } });
});

// POST /api/videos - upload video (admin)
router.post('/', authenticate, requireAdmin, uploadVideo.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Video file required' });
  const { lesson_id, title, description, order_index, is_free } = req.body;
  const lesson = db.prepare('SELECT id FROM lessons WHERE id = ?').get(lesson_id);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
  const result = db.prepare(`INSERT INTO videos (uuid, lesson_id, title, description, filename, original_name, file_size, order_index, is_free) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), lesson_id, title || req.file.originalname, description, req.file.filename, req.file.originalname, req.file.size, order_index || 0, is_free ? 1 : 0);
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Video uploaded', data: { video } });
});

// GET /api/videos/stream/:id - stream video (free/preview is public; others gated)
router.get('/stream/:id', optionalAuth, (req, res) => {
  const video = db.prepare('SELECT v.*, l.course_id, l.is_preview FROM videos v JOIN lessons l ON l.id = v.lesson_id WHERE v.id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
  const isPublic = video.is_free || video.is_preview;
  if (!isPublic) {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, video.course_id);
    if (!enrolled && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Enrollment required to watch this video' });
    }
  }
  const videoPath = path.join(__dirname, '../../uploads/videos', video.filename);
  if (!fs.existsSync(videoPath)) return res.status(404).json({ success: false, message: 'Video file not found' });
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${fileSize}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunkSize, 'Content-Type': 'video/mp4' });
    file.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4' });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// PUT /api/videos/:id - update video info
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { title, description, order_index, is_free } = req.body;
  db.prepare('UPDATE videos SET title = COALESCE(?, title), description = COALESCE(?, description), order_index = COALESCE(?, order_index), is_free = COALESCE(?, is_free), updated_at = unixepoch() WHERE id = ?')
    .run(title, description, order_index, is_free, req.params.id);
  res.json({ success: true, message: 'Video updated' });
});

// DELETE /api/videos/:id
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
  const videoPath = path.join(__dirname, '../../uploads/videos', video.filename);
  if (fs.existsSync(videoPath)) { try { fs.unlinkSync(videoPath); } catch {} }
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Video deleted' });
});

module.exports = router;
