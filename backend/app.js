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
    // Vite tự đổi qua port khác (5174, 5175...) nếu 5173 đang bận — chấp nhận
    // mọi localhost khi không phải production để tránh phải sửa tay mỗi lần.
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
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
app.use('/api/mock-exams', require('./routes/api/mockExams'));
app.use('/api/reading',    require('./routes/api/reading'));
app.use('/api/flashcards', require('./routes/api/flashcards'));
app.use('/api/ai',         require('./routes/api/ai'));
app.use('/api/grammar',    require('./routes/api/grammar'));
app.use('/api/writing',    require('./routes/api/writing'));
app.use('/api/listening',      require('./routes/api/listening'));
app.use('/api/learning-path',  require('./routes/api/learningPath'));
app.use('/api/teacher-applications', require('./routes/api/teacherApplications'));
app.use('/api/study-lists',    require('./routes/api/studyLists'));
app.use('/api/grammar-points', require('./routes/api/grammarPoints'));
app.use('/api/subscription',   require('./routes/api/subscription'));
app.use('/api/payment',        require('./routes/api/paymentQr'));
app.use('/api/webhooks',       require('./routes/api/webhooks'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  // Production: không lộ message gốc (Supabase/Postgres) ra client; dev giữ nguyên để debug.
  const message = process.env.NODE_ENV === 'production'
    ? 'Đã có lỗi xảy ra.'
    : (err.message || 'Internal server error');
  res.status(500).json({ error: message });
});

module.exports = app;
