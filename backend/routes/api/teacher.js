'use strict';

const router = require('express').Router();
const { requireAuth, requireTeacher } = require('../../middleware/auth');
const c = require('../../controllers/teacherController');

router.use(requireAuth, requireTeacher);

router.get('/stats',            c.getStats);
router.get('/courses',          c.listCourses);
router.post('/courses',         c.createCourse);
router.put('/courses/:id',      c.updateCourse);
router.delete('/courses/:id',   c.deleteCourse);

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

module.exports = router;
