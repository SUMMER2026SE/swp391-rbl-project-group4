'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/adminController');
const reading = require('../../controllers/readingController');
const ta = require('../../controllers/teacherApplicationController');
const rp = require('../../controllers/revenuePoolController');
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

// Tài liệu văn bản (.txt/.docx) — dùng để trích nội dung bài đọc, xử lý trong RAM không lưu file.
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    (name.endsWith('.txt') || name.endsWith('.docx'))
      ? cb(null, true)
      : cb(new Error('Chỉ chấp nhận file .txt hoặc .docx.'));
  },
});

// Video bài học — 50MB: trần upload mỗi file của Supabase gói free, đồng bộ với bucket lesson-videos.
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['video/mp4', 'video/webm'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file video MP4/WebM.'));
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
router.patch('/courses/:id/publish',      c.publishCourse);
router.delete('/courses/:id',             c.deleteCourse);
router.get('/courses/:courseId/builder',  c.getCourseBuilder);

// Units ("Bài học")
router.post('/units',            c.createUnit);
router.put('/units/:id',         c.updateUnit);
router.delete('/units/:id',      c.deleteUnit);
router.patch('/units/reorder',   c.reorderUnits);

// Lessons
router.get('/lessons',               c.listLessons);
// Bài đọc gắn với Mục (reading_module.articles) — đặt trước '/lessons/:id'
router.get('/lessons/reading/:id',        reading.adminLessonReadingGet);
router.put('/lessons/:lessonId/reading',  reading.adminLessonReadingUpsert);
router.get('/lessons/:id',           c.getLesson);
router.post('/lessons',              c.createLesson);
router.put('/lessons/:id',           c.updateLesson);
router.delete('/lessons/:id',        c.deleteLesson);
router.patch('/lessons/reorder',     c.reorderLessons);
router.post('/lessons/upload-video', videoUpload.single('video'), c.uploadLessonVideo);
router.post('/lessons/:id/transcribe-video', c.transcribeLessonVideo);

// Vocabulary
router.get('/vocabulary',         c.listVocab);
router.post('/vocabulary/import', c.importVocab);
router.post('/vocabulary',        c.createVocab);
router.post('/vocabulary/upload-image', upload.single('image'), c.uploadVocabImage);
router.put('/vocabulary/:id',     c.updateVocab);
router.delete('/vocabulary/:id',  c.deleteVocab);

// Kanji
router.get('/kanji',         c.listKanji);
router.post('/kanji/import', c.importKanji);
router.post('/kanji',        c.createKanji);
router.put('/kanji/:id',     c.updateKanji);
router.delete('/kanji/:id',  c.deleteKanji);

// Grammar Points (từ điển ngữ pháp chuẩn — khác với /grammar quản lý lesson_grammar)
router.get('/grammar-points',         c.listGrammarPoints);
router.post('/grammar-points/import', c.importGrammarPoints);
router.post('/grammar-points',        c.createGrammarPoint);
router.put('/grammar-points/:id',     c.updateGrammarPoint);
router.delete('/grammar-points/:id',  c.deleteGrammarPoint);

// Gắn/gỡ từ vựng & kanji có sẵn vào Mục (bảng nối nhiều–nhiều)
router.post('/lessons/:lessonId/vocabulary/attach',     c.attachVocab);
router.delete('/lessons/:lessonId/vocabulary/:vocabId', c.detachVocab);
router.post('/lessons/:lessonId/kanji/attach',          c.attachKanji);
router.delete('/lessons/:lessonId/kanji/:kanjiId',      c.detachKanji);
router.post('/lessons/:lessonId/grammar-points/attach',          c.attachGrammar);
router.delete('/lessons/:lessonId/grammar-points/:grammarId',    c.detachGrammar);

// Bulk import vào Mục qua file (Word/Excel/CSV/JSON) — chỉ parse + preview, chưa ghi DB.
// Xác nhận nhập dùng lại /vocabulary/import, /kanji/import, /grammar-points/import
// với lesson_id trên từng dòng.
const fic = require('../../controllers/importFileController');
const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(json|csv|xlsx|xls|docx)$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file .json, .csv, .xlsx, .xls, .docx.'));
  },
});
router.post('/lessons/:lessonId/vocabulary/import-file', importFileUpload.single('file'), fic.previewVocabFile);
router.post('/lessons/:lessonId/kanji/import-file',      importFileUpload.single('file'), fic.previewKanjiFile);
router.post('/lessons/:lessonId/grammar-points/import-file', importFileUpload.single('file'), fic.previewGrammarFile);

// Import file trực tiếp vào ngân hàng chung (không cần lessonId)
router.post('/vocabulary/import-file',     importFileUpload.single('file'), fic.previewVocabFile);
router.post('/kanji/import-file',          importFileUpload.single('file'), fic.previewKanjiFile);
router.post('/grammar-points/import-file', importFileUpload.single('file'), fic.previewGrammarFile);

// Study lists — admin quản lý bài đăng của giáo viên
const sl = require('../../controllers/studyListController');
router.get('/study-lists',     c.adminListStudyLists);
router.put('/study-lists/:id', sl.update);
router.put('/study-lists/:id/lock', c.lockStudyList);
router.delete('/study-lists/:id', sl.remove);

// Content submissions
router.get('/submissions',                    c.listSubmissions);
router.post('/submissions/vocab/:id/review',  c.reviewVocab);
router.post('/submissions/kanji/:id/review',  c.reviewKanji);

// Teacher applications
router.get('/teacher-applications',             ta.adminListApplications);
router.post('/teacher-applications/:id/review', ta.adminReviewApplication);

// Revenue-share pool
router.get('/revenue-pool/config',          rp.getConfig);
router.put('/revenue-pool/config',          rp.updateConfig);
router.get('/revenue-pool',                 rp.getPeriod);
router.post('/revenue-pool/:period/finalize', rp.finalize);
router.post('/teacher-payouts/:id/paid',    rp.markPaid);

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

// Reading (Luyện đọc)
router.post('/reading/generate-article',       reading.generateArticle);
router.post('/reading/generate-segments',      reading.generateSegments);
router.post('/reading/generate-questions',     reading.generateQuestions);
router.post('/reading/generate-vocab-grammar', reading.generateVocabGrammar);
router.post('/reading/segment-manual',         reading.segmentManual);
router.post('/reading/parse-file', docUpload.single('file'), reading.parseFile);
router.get('/reading',                         reading.adminList);
router.get('/reading/:id',                     reading.adminGetOne);
router.post('/reading',                        reading.create);
router.put('/reading/:id',                     reading.update);
router.delete('/reading/:id',                  reading.remove);

// Subscription / payments (admin)
const sc = require('../../controllers/subscriptionController');
router.get('/subscriptions/users',        sc.adminGetUsersWithSubscription);
router.get('/subscriptions',              sc.adminGetSubscriptions);
router.post('/subscriptions/grant',       sc.adminGrantSubscription);
router.delete('/subscriptions/:userId',   sc.adminCancelSubscription);
router.get('/payments',                   sc.adminGetPayments);
router.post('/payments/reconcile', async (req, res) => {
  const { reconcilePendingOrders } = require('../../services/paymentMatchingService');
  try {
    const result = await reconcilePendingOrders();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// JLPT Mock Exams (thi thử JLPT — chỉ admin quản lý, teacher không có quyền)
const mock = require('../../controllers/adminMockExamController');
// Audio đề thi thử — 50MB: trần upload mỗi file của Supabase gói free
const mockAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','audio/aac','audio/x-m4a'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file âm thanh.'));
  },
});
router.post('/mock-exams/upload-audio',   mockAudioUpload.single('audio'), mock.uploadAudio);
router.post('/mock-exams/upload-image',   upload.single('image'), mock.uploadImage);
router.get('/mock-exams',                 mock.listExams);
router.post('/mock-exams',                mock.createExam);
router.get('/mock-exams/:id',             mock.getExam);
router.put('/mock-exams/:id',             mock.updateExam);
router.patch('/mock-exams/:id/publish',   mock.publishExam);
router.delete('/mock-exams/:id',          mock.deleteExam);
router.get('/mock-exams/:id/attempts',    mock.listExamAttempts);
router.post('/mock-exams/:examId/sections',        mock.createSection);
router.patch('/mock-sections/reorder',             mock.reorderSections);
router.put('/mock-sections/:id',                   mock.updateSection);
router.delete('/mock-sections/:id',                mock.deleteSection);
router.post('/mock-sections/:sectionId/groups',    mock.createGroup);
router.patch('/mock-groups/reorder',               mock.reorderGroups);
router.put('/mock-groups/:id',                     mock.updateGroup);
router.delete('/mock-groups/:id',                  mock.deleteGroup);
router.post('/mock-groups/:groupId/questions',           mock.createQuestions);
router.post('/mock-groups/:groupId/import-from-bank',    mock.importFromBank);
router.post('/mock-groups/:groupId/ai-generate',         mock.aiGenerateDrafts);
router.post('/mock-groups/:groupId/ai-regenerate-one',   mock.aiRegenerateOne);
router.patch('/mock-questions/reorder',            mock.reorderQuestions);
router.post('/mock-questions/:id/tts',             mock.generateQuestionAudio);
router.put('/mock-questions/:id',                  mock.updateQuestion);
router.delete('/mock-questions/:id',               mock.deleteQuestion);

// JLPT Question Bank (ngân hàng đề JLPT riêng — nguồn import cho đề thi thử)
const jb = require('../../controllers/jlptBankController');
router.get('/jlpt-bank/stats',              jb.stats);
router.get('/jlpt-bank/questions',          jb.listQuestions);
router.post('/jlpt-bank/questions',         jb.createQuestions);
router.post('/jlpt-bank/questions/:id/tts', jb.generateQuestionAudio);
router.put('/jlpt-bank/questions/:id',      jb.updateQuestion);
router.delete('/jlpt-bank/questions/:id',   jb.deleteQuestion);
router.get('/jlpt-bank/groups',             jb.listGroups);
router.post('/jlpt-bank/groups',            jb.createGroup);
router.put('/jlpt-bank/groups/:id',         jb.updateGroup);
router.delete('/jlpt-bank/groups/:id',      jb.deleteGroup);
router.post('/jlpt-bank/ai-generate',       jb.aiGenerate);

// Placement Test — Question Bank
const pc = require('../../controllers/placementController');
router.get('/placement/stats',                pc.adminGetStats);
router.get('/placement/config',               pc.adminGetConfig);
router.put('/placement/config',               pc.adminUpdateConfig);
router.get('/placement/questions',            pc.adminListQuestions);
router.get('/placement/questions/:id',        pc.adminGetQuestion);
router.post('/placement/questions',           pc.adminCreateQuestion);
router.put('/placement/questions/:id',        pc.adminUpdateQuestion);
router.patch('/placement/questions/:id/toggle', pc.adminToggleQuestion);
router.delete('/placement/questions/:id',     pc.adminDeleteQuestion);

module.exports = router;
