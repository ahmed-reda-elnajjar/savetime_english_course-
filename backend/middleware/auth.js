const jwt = require('jsonwebtoken');
const { db } = require('../database');

// Token can come from the Authorization header (API calls) or a ?token= query
// param (needed for <video> / <img> tags, which can't send custom headers).
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  if (req.query && req.query.token) return req.query.token;
  return null;
};

const authenticate = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, uuid, name, email, role, avatar, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const optionalAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, uuid, name, email, role, avatar FROM users WHERE id = ?').get(decoded.id);
    if (user) req.user = user;
  } catch {}
  next();
};

module.exports = { authenticate, requireAdmin, optionalAuth };
