'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Request metrics (đếm lưu lượng + đo thời gian phản hồi) ──────────────────
app.use('/api', require('./middleware/metrics').metricsMiddleware);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/api/auth'));
app.use('/api/users',      require('./routes/api/users'));
app.use('/api/courses',    require('./routes/api/courses'));
app.use('/api/lessons',    require('./routes/api/lessons'));
app.use('/api/vocabulary', require('./routes/api/vocabulary'));
app.use('/api/kanji',      require('./routes/api/kanji'));
app.use('/api/dictionary', require('./routes/api/dictionary'));
app.use('/api/quizzes',    require('./routes/api/quizzes'));
app.use('/api/admin',      require('./routes/api/admin'));
app.use('/api/teacher',    require('./routes/api/teacher'));
app.use('/api/classes',    require('./routes/api/classes'));
app.use('/api/exams',      require('./routes/api/exams'));
app.use('/api/news',       require('./routes/api/news'));
app.use('/api/flashcards', require('./routes/api/flashcards'));
app.use('/api/ai',         require('./routes/api/ai'));
app.use('/api/grammar',    require('./routes/api/grammar'));
app.use('/api/writing',    require('./routes/api/writing'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
