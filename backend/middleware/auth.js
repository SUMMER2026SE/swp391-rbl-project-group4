'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Extract Bearer token → validate with Supabase → attach req.user
exports.requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
  }
  const token = header.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
  if (req.user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Bạn không có quyền truy cập.' });
  next();
};

exports.requireTeacher = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Bạn chưa đăng nhập.' });
  const role = req.user.user_metadata?.role;
  if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ error: 'Bạn không có quyền truy cập.' });
  next();
};

// Like requireAuth but never blocks: attach req.user only if a valid token is present.
// Lets guests hit public endpoints while still personalizing the response when logged in.
exports.optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && user) req.user = user;
  } catch { /* ignore — treat as guest */ }
  next();
};
