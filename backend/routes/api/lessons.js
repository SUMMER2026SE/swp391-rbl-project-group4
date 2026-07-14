'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/lessonController');
const reading = require('../../controllers/readingController');

router.use(requireAuth);
// Bài đọc gắn với Mục (dùng chung ReadingReader) — đặt trước '/:id'
router.get('/reading/:id',       reading.lessonReadingGet);
router.post('/reading/:id/chat', reading.lessonReadingChat);
router.get('/:id', c.getOne);
router.post('/:id/complete', c.complete);

module.exports = router;
