require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();

// Security middleware
// CSP is configured permissively for inline scripts/handlers because the
// frontend uses inline <script> blocks and inline onclick/onsubmit handlers.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https:", "data:"],
      mediaSrc: ["'self'", "blob:", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
  credentials: true
}));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many requests, please try again later' } }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/videos', require('./routes/videos'));

// Public settings endpoint
app.get('/api/settings', (req, res) => {
  const { db } = require('./database');
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ success: true, data: { settings } });
});

// Public pricing endpoint
app.get('/api/pricing', (req, res) => {
  const { db } = require('./database');
  const plans = db.prepare('SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY price').all();
  res.json({ success: true, data: { plans } });
});

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large' });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

initializeDatabase();
app.listen(PORT, () => {
  console.log(`Save Time server running on http://localhost:${PORT}`);
  console.log(`Admin: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
});

module.exports = app;
