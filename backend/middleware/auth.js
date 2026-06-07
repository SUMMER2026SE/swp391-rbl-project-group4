'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Extract Bearer token → validate with Supabase → attach req.user
exports.requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.user_metadata?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: admin only' });
  next();
};

exports.requireTeacher = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const role = req.user.user_metadata?.role;
  if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ error: 'Forbidden: teacher access required' });
  next();
};
