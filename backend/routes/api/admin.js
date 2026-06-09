'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/adminController');
const { supabaseAdmin } = require('../../config/supabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Chỉ chấp nhận file hình ảnh.')),
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

// Users
router.get('/users',                  c.listUsers);
router.get('/users/:id',              c.getUser);
router.put('/users/:id',              c.updateUser);
router.put('/users/:id/password',     c.resetUserPassword);
router.delete('/users/:id',           c.deleteUser);

// Courses
router.get('/courses',                    c.listCourses);
router.post('/courses',                   c.createCourse);
router.put('/courses/:id',                c.updateCourse);
router.delete('/courses/:id',             c.deleteCourse);
router.get('/courses/:courseId/builder',  c.getCourseBuilder);

// Modules
router.get('/modules',               c.listModules);
router.post('/modules',              c.createModule);
router.put('/modules/:id',           c.updateModule);
router.delete('/modules/:id',        c.deleteModule);
router.patch('/modules/reorder',     c.reorderModules);
router.get('/modules/:moduleId/lessons', c.listModuleLessons);

// Lessons
router.get('/lessons',               c.listLessons);
router.post('/lessons',              c.createLesson);
router.put('/lessons/:id',           c.updateLesson);
router.delete('/lessons/:id',        c.deleteLesson);
router.patch('/lessons/reorder',     c.reorderLessons);

// Vocabulary
router.post('/vocabulary/import', c.importVocab);
router.post('/vocabulary',        c.createVocab);
router.put('/vocabulary/:id',     c.updateVocab);
router.delete('/vocabulary/:id',  c.deleteVocab);

// Kanji
router.post('/kanji/import', c.importKanji);
router.post('/kanji',        c.createKanji);
router.put('/kanji/:id',     c.updateKanji);
router.delete('/kanji/:id',  c.deleteKanji);

// Content submissions
router.get('/submissions',                    c.listSubmissions);
router.post('/submissions/vocab/:id/review',  c.reviewVocab);
router.post('/submissions/kanji/:id/review',  c.reviewKanji);

// Quizzes
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

module.exports = router;
