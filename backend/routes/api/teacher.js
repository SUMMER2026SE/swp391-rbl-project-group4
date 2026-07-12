'use strict';

const router = require('express').Router();
const multer  = require('multer');
const { requireAuth, requireTeacher } = require('../../middleware/auth');
const c = require('../../controllers/teacherController');
const ac = require('../../controllers/adminController'); // tái dùng cho thao tác trên kho chung (vocab/kanji)
const qb = require('../../controllers/teacherQuestionBankController');
const lc = require('../../controllers/listeningController');
const nc = require('../../controllers/newsController');
const rp = require('../../controllers/revenuePoolController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Chỉ chấp nhận file hình ảnh.')),
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

router.use(requireAuth, requireTeacher);

router.get('/stats',            c.getStats);
router.get('/courses',          c.listCourses);
router.post('/courses',         c.createCourse);
router.put('/courses/:id',      c.updateCourse);
router.delete('/courses/:id',   c.deleteCourse);
router.post('/courses/upload-cover', upload.single('image'), ac.uploadCourseCover);

// Course content (Bài học/units + Mục/lessons) — chỉ trên khóa do chính mình tạo
router.get('/courses/:courseId/builder', c.getCourseBuilder);
router.post('/units',          c.createUnit);
router.put('/units/:id',       c.updateUnit);
router.delete('/units/:id',    c.deleteUnit);
router.get('/lessons/:id',     c.getLesson);
router.post('/lessons',        c.createLesson);
router.patch('/lessons/reorder', c.reorderLessons);
router.put('/lessons/:id',     c.updateLesson);
router.delete('/lessons/:id',  c.deleteLesson);
router.post('/lessons/upload-video', videoUpload.single('video'), ac.uploadLessonVideo);

// Trình soạn Từ vựng / Kanji của Mục — list/create/update dùng kho chung (admin handler),
// attach/detach kiểm tra sở hữu khóa (teacher handler).
router.get('/vocabulary',                              ac.listVocab);
router.post('/vocabulary',                             c.createVocabForLesson);
router.put('/vocabulary/:id',                          ac.updateVocab);
router.post('/vocabulary/upload-image',                upload.single('image'), ac.uploadVocabImage);
router.post('/lessons/:lessonId/vocabulary/attach',    c.attachVocab);
router.delete('/lessons/:lessonId/vocabulary/:vocabId', c.detachVocab);

router.get('/kanji',                                   ac.listKanji);
router.post('/kanji',                                  c.createKanjiForLesson);
router.put('/kanji/:id',                               ac.updateKanji);
router.post('/lessons/:lessonId/kanji/attach',         c.attachKanji);
router.delete('/lessons/:lessonId/kanji/:kanjiId',     c.detachKanji);

// Ngữ pháp (từ điển ngữ pháp chuẩn) — giáo viên thêm/sửa trực tiếp, không cần admin duyệt
router.get('/grammar-points',                                 ac.listGrammarPoints);
router.post('/grammar-points',                                c.createGrammarForLesson);
router.put('/grammar-points/:id',                             ac.updateGrammarPoint);
router.post('/lessons/:lessonId/grammar-points/attach',       c.attachGrammar);
router.delete('/lessons/:lessonId/grammar-points/:grammarId', c.detachGrammar);

// Bulk import vào Mục qua file — preview (parse + AI fallback, chưa ghi DB),
// xác nhận nhập qua các endpoint import bên dưới với lesson_id trên từng dòng.
const fic = require('../../controllers/importFileController');
const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(json|csv|xlsx|xls|docx)$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file .json, .csv, .xlsx, .xls, .docx.'));
  },
});
router.post('/lessons/:lessonId/vocabulary/import-file',     importFileUpload.single('file'), fic.previewVocabFile);
router.post('/lessons/:lessonId/kanji/import-file',          importFileUpload.single('file'), fic.previewKanjiFile);
router.post('/lessons/:lessonId/grammar-points/import-file', importFileUpload.single('file'), fic.previewGrammarFile);
router.post('/vocabulary/import',     ac.importVocab);
router.post('/kanji/import',          ac.importKanji);
router.post('/grammar-points/import', ac.importGrammarPoints);

// My vocabulary (shared pool, filtered by created_by)
router.get('/my-vocab',                    c.listMyVocab);
router.post('/my-vocab/import-file',       importFileUpload.single('file'), fic.previewVocabFile);
router.post('/my-vocab/import',            c.importMyVocab);
router.post('/my-vocab',                   c.createMyVocab);
router.put('/my-vocab/:id',                c.updateMyVocab);
router.delete('/my-vocab/:id',             c.deleteMyVocab);

// My kanji (shared pool, filtered by created_by)
router.get('/my-kanji',                    c.listMyKanji);
router.post('/my-kanji/import-file',       importFileUpload.single('file'), fic.previewKanjiFile);
router.post('/my-kanji/import',            c.importMyKanji);
router.post('/my-kanji',                   c.createMyKanji);
router.put('/my-kanji/:id',                c.updateMyKanji);
router.delete('/my-kanji/:id',             c.deleteMyKanji);

// ── Quiz của Mục (lesson quiz) — sở hữu kiểm tra qua khóa do chính mình tạo ──
router.get('/quizzes',                            c.listLessonQuizzes);
router.post('/quizzes',                           c.createLessonQuiz);
router.put('/quizzes/:id',                        c.updateLessonQuiz);
router.delete('/quizzes/:id',                     c.deleteLessonQuiz);
router.get('/quizzes/:quizId/questions',          c.listLessonQuizQuestions);
router.post('/quizzes/:quizId/import-from-bank',  c.importLessonQuizFromBank);
router.get('/quizzes/:quizId/attempts',           c.listLessonQuizAttempts);
router.post('/questions',                         c.createLessonQuizQuestion);
router.put('/questions/:id',                      c.updateLessonQuizQuestion);
router.delete('/questions/:id',                   c.deleteLessonQuizQuestion);

// ── Private question bank ─────────────────────────────────────────────────────
router.get('/question-bank/stats',          qb.questionBankStats);
router.get('/question-bank',                qb.listQuestionBank);
router.post('/question-bank/bulk',          qb.bulkCreateQuestionBank);
router.post('/question-bank/ai-generate',   qb.aiGenerateQuestions);
router.post('/question-bank/import-from-global', qb.importFromGlobal);
router.post('/question-bank',               qb.createQuestionBank);
router.put('/question-bank/:id',            qb.updateQuestionBank);
router.delete('/question-bank/:id',         qb.deleteQuestionBank);

// Admin global bank (read-only)
router.get('/global-question-bank',         qb.listGlobalBank);

// ── Luyện nghe (own dialogues) ────────────────────────────────────────────────
router.get('/my-listening',                    lc.listMyDialogues);
router.post('/my-listening',                   lc.createMyDialogue);
router.put('/my-listening/:id',                lc.updateMyDialogue);
router.delete('/my-listening/:id',             lc.deleteMyDialogue);
router.post('/my-listening/:id/lines',         lc.addMyLine);
router.put('/my-listening/lines/:lineId',      lc.updateMyLine);
router.delete('/my-listening/lines/:lineId',   lc.deleteMyLine);

// ── Luyện đọc (own reading articles) — tái dùng AI-gen helper của news ────────
router.get('/my-reading',                      nc.teacherList);
router.get('/my-reading/:id',                  nc.teacherGetOne);
router.post('/my-reading',                     nc.teacherCreate);
router.put('/my-reading/:id',                  nc.teacherUpdate);
router.delete('/my-reading/:id',               nc.teacherRemove);
router.post('/my-reading/generate-article',    nc.generateArticle);
router.post('/my-reading/generate-segments',   nc.generateSegments);
router.post('/my-reading/generate-questions',  nc.generateQuestions);
router.post('/my-reading/generate-vocab-grammar', nc.generateVocabGrammar);

// ── Thu nhập từ quỹ chia sẻ doanh thu ─────────────────────────────────────────
router.get('/earnings',                        rp.teacherEarnings);

// Private reading passages
router.post('/reading-passages/upload', upload.single('image'), qb.uploadPassageImage);
router.get('/reading-passages',         qb.listPassages);
router.post('/reading-passages',        qb.createPassage);
router.put('/reading-passages/:id',     qb.updatePassage);
router.delete('/reading-passages/:id',  qb.deletePassage);

module.exports = router;
