'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/adminController');
const news = require('../../controllers/newsController');
const { supabaseAdmin } = require('../../config/supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Chỉ chấp nhận file hình ảnh.')),
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac','audio/x-m4a','video/mp4','video/webm'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file âm thanh/video.'));
  },
});

router.use(requireAuth, requireAdmin);

// ── System status ─────────────────────────────────────────────────────────────
router.get('/system-status', async (_req, res) => {
  const ping = async (fn) => {
    const t = Date.now();
    try { const r = await fn(); return { ok: true, latency: Date.now() - t, ...r }; }
    catch (e) { return { ok: false, latency: Date.now() - t, error: e.message }; }
  };

  const [db, ai] = await Promise.all([
    ping(async () => {
      const { error } = await supabaseAdmin.from('vocabulary').select('id').limit(1);
      if (error) throw new Error(error.message);
      const { count: vCount } = await supabaseAdmin.from('vocabulary').select('*', { count: 'exact', head: true });
      const { count: kCount } = await supabaseAdmin.from('kanji').select('*', { count: 'exact', head: true });
      return { vocabCount: vCount || 0, kanjiCount: kCount || 0 };
    }),
    ping(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const r = await fetch('https://mkp-api.fptcloud.com/v1/models', {
          headers: { 'Authorization': 'Bearer ' + process.env.FPT_AI_API_KEY },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return { model: process.env.FPT_AI_MODEL, httpStatus: r.status };
      } finally { clearTimeout(timeout); }
    }),
  ]);

  const uptimeSec = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  res.json({
    timestamp: new Date().toISOString(),
    backend: {
      ok: true,
      latency: 0,
      uptime: uptimeSec,
      uptimeLabel: formatUptime(uptimeSec),
      nodeVersion: process.version,
      memoryMB: Math.round(mem.rss / 1024 / 1024),
      heapMB: Math.round(mem.heapUsed / 1024 / 1024),
    },
    database: db,
    ai: { ...ai, model: process.env.FPT_AI_MODEL },
  });
});

function formatUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return d + 'n ' + h + 'g ' + m + 'p';
  if (h > 0) return h + 'g ' + m + 'p';
  return m + 'p ' + (sec % 60) + 'g';
}

// Stats & Activity
router.get('/stats',    c.getStats);
router.get('/activity', c.getRecentActivity);

// Request metrics theo giờ (lưu lượng + hiệu năng) cho chart dashboard
router.get('/metrics', (req, res) => {
  const { getMetrics } = require('../../middleware/metrics');
  const hours = Math.min(Math.max(Number(req.query.hours) || 12, 1), 24);
  res.json({ buckets: getMetrics(hours) });
});

// Users
router.get('/users',                  c.listUsers);
router.get('/users/:id',              c.getUser);
router.put('/users/:id',              c.updateUser);
router.put('/users/:id/password',     c.resetUserPassword);
router.delete('/users/:id',           c.deleteUser);

// Courses
router.post('/courses/upload-cover',      upload.single('image'), c.uploadCourseCover);
router.get('/courses',                    c.listCourses);
router.post('/courses',                   c.createCourse);
router.put('/courses/:id',                c.updateCourse);
router.delete('/courses/:id',             c.deleteCourse);
router.get('/courses/:courseId/builder',  c.getCourseBuilder);

// Units ("Bài học")
router.post('/units',            c.createUnit);
router.put('/units/:id',         c.updateUnit);
router.delete('/units/:id',      c.deleteUnit);
router.patch('/units/reorder',   c.reorderUnits);

// Lessons
router.get('/lessons',               c.listLessons);
router.get('/lessons/:id',           c.getLesson);
router.post('/lessons',              c.createLesson);
router.put('/lessons/:id',           c.updateLesson);
router.delete('/lessons/:id',        c.deleteLesson);
router.patch('/lessons/reorder',     c.reorderLessons);

// Vocabulary
router.get('/vocabulary',         c.listVocab);
router.post('/vocabulary/import', c.importVocab);
router.post('/vocabulary',        c.createVocab);
router.put('/vocabulary/:id',     c.updateVocab);
router.delete('/vocabulary/:id',  c.deleteVocab);

// Kanji
router.get('/kanji',         c.listKanji);
router.post('/kanji/import', c.importKanji);
router.post('/kanji',        c.createKanji);
router.put('/kanji/:id',     c.updateKanji);
router.delete('/kanji/:id',  c.deleteKanji);

// Gắn/gỡ từ vựng & kanji có sẵn vào Mục (bảng nối nhiều–nhiều)
router.post('/lessons/:lessonId/vocabulary/attach',     c.attachVocab);
router.delete('/lessons/:lessonId/vocabulary/:vocabId', c.detachVocab);
router.post('/lessons/:lessonId/kanji/attach',          c.attachKanji);
router.delete('/lessons/:lessonId/kanji/:kanjiId',      c.detachKanji);

// Content submissions
router.get('/submissions',                    c.listSubmissions);
router.post('/submissions/vocab/:id/review',  c.reviewVocab);
router.post('/submissions/kanji/:id/review',  c.reviewKanji);

// Quizzes
router.get('/quizzes',         c.listQuizzes);
router.post('/quizzes',        c.createQuiz);
router.put('/quizzes/:id',     c.updateQuiz);
router.delete('/quizzes/:id',  c.deleteQuiz);

// Quiz questions (admin view)
router.get('/quizzes/:quizId/questions',              c.listQuizQuestions);

// Questions (quiz-linked)
router.post('/questions',                             c.createQuestion);
router.put('/questions/:id',                          c.updateQuestion);
router.delete('/questions/:id',                       c.deleteQuestion);
router.post('/quizzes/:quizId/import-from-bank',      c.importFromBank);
router.get('/quizzes/:quizId/attempts',               c.listQuizAttempts);

// Question Bank (global)
router.get('/question-bank/stats',    c.questionBankStats);
router.get('/question-bank',          c.listQuestionBank);
router.post('/question-bank/bulk',    c.bulkCreateQuestionBank);
router.post('/question-bank/ai-generate', c.aiGenerateQuestions);
router.post('/question-bank',         c.createQuestionBank);
router.put('/question-bank/:id',      c.updateQuestionBank);
router.delete('/question-bank/:id',   c.deleteQuestionBank);

// Reading Passages
router.post('/reading-passages/upload', upload.single('image'), c.uploadPassageImage);
router.get('/reading-passages',        c.listPassages);
router.post('/reading-passages',       c.createPassage);
router.put('/reading-passages/:id',    c.updatePassage);
router.delete('/reading-passages/:id', c.deletePassage);

// Listening Passages
router.post('/listening-passages/upload',          audioUpload.single('audio'), c.uploadListeningAudio);
router.get('/listening-passages',                  c.listListeningPassages);
router.post('/listening-passages',                 c.createListeningPassage);
router.post('/listening-passages/:id/transcribe',  c.transcribeListeningPassage);
router.put('/listening-passages/:id',              c.updateListeningPassage);
router.delete('/listening-passages/:id',           c.deleteListeningPassage);

// Listening Dialogues (hội thoại luyện nghe UC20-22)
const lc = require('../../controllers/listeningController');
router.get('/listening/dialogues',              lc.adminListDialogues);
router.post('/listening/dialogues',             lc.adminCreateDialogue);
router.put('/listening/dialogues/:id',          lc.adminUpdateDialogue);
router.delete('/listening/dialogues/:id',       lc.adminDeleteDialogue);
router.post('/listening/dialogues/:id/lines',   lc.adminAddLine);
router.put('/listening/lines/:lineId',          lc.adminUpdateLine);
router.delete('/listening/lines/:lineId',       lc.adminDeleteLine);

// News (Luyện đọc báo)
router.post('/news/generate-segments', news.generateSegments);
router.get('/news',                    news.adminList);
router.get('/news/:id',                news.adminGetOne);
router.post('/news',                   news.create);
router.put('/news/:id',                news.update);
router.delete('/news/:id',             news.remove);

module.exports = router;
