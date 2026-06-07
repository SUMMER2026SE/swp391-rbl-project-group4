'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/adminController');

router.use(requireAuth, requireAdmin);

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
router.get('/courses',         c.listCourses);
router.post('/courses',        c.createCourse);
router.put('/courses/:id',     c.updateCourse);
router.delete('/courses/:id',  c.deleteCourse);

// Lessons
router.get('/lessons',         c.listLessons);
router.post('/lessons',        c.createLesson);
router.put('/lessons/:id',     c.updateLesson);
router.delete('/lessons/:id',  c.deleteLesson);

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

// Questions
router.post('/questions',        c.createQuestion);
router.put('/questions/:id',     c.updateQuestion);
router.delete('/questions/:id',  c.deleteQuestion);

module.exports = router;
