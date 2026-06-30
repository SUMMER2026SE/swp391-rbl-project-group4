'use strict';

const router = require('express').Router();
const multer  = require('multer');
const { requireAuth, requireTeacher } = require('../../middleware/auth');
const c = require('../../controllers/teacherController');
const ac = require('../../controllers/adminController'); // tái dùng cho thao tác trên kho chung (vocab/kanji)
const qb = require('../../controllers/teacherQuestionBankController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Chỉ chấp nhận file hình ảnh.')),
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
router.put('/lessons/:id',     c.updateLesson);
router.delete('/lessons/:id',  c.deleteLesson);

// Trình soạn Từ vựng / Kanji của Mục — list/create/update dùng kho chung (admin handler),
// attach/detach kiểm tra sở hữu khóa (teacher handler).
router.get('/vocabulary',                              ac.listVocab);
router.post('/vocabulary',                             ac.createVocab);
router.put('/vocabulary/:id',                          ac.updateVocab);
router.post('/lessons/:lessonId/vocabulary/attach',    c.attachVocab);
router.delete('/lessons/:lessonId/vocabulary/:vocabId', c.detachVocab);

router.get('/kanji',                                   ac.listKanji);
router.post('/kanji',                                  ac.createKanji);
router.put('/kanji/:id',                               ac.updateKanji);
router.post('/lessons/:lessonId/kanji/attach',         c.attachKanji);
router.delete('/lessons/:lessonId/kanji/:kanjiId',     c.detachKanji);

// My vocabulary
router.get('/my-vocab',                c.listMyVocab);
router.post('/my-vocab',               c.createMyVocab);
router.put('/my-vocab/:id',            c.updateMyVocab);
router.delete('/my-vocab/:id',         c.deleteMyVocab);
router.post('/my-vocab/:id/submit',    c.submitMyVocab);

// My kanji
router.get('/my-kanji',                c.listMyKanji);
router.post('/my-kanji',               c.createMyKanji);
router.put('/my-kanji/:id',            c.updateMyKanji);
router.delete('/my-kanji/:id',         c.deleteMyKanji);
router.post('/my-kanji/:id/submit',    c.submitMyKanji);

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

// Private reading passages
router.post('/reading-passages/upload', upload.single('image'), qb.uploadPassageImage);
router.get('/reading-passages',         qb.listPassages);
router.post('/reading-passages',        qb.createPassage);
router.put('/reading-passages/:id',     qb.updatePassage);
router.delete('/reading-passages/:id',  qb.deletePassage);

module.exports = router;
