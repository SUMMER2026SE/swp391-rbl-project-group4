'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/readingController');

// Student: luyện đọc (chỉ bài đã publish)
router.get('/',          requireAuth, c.list);
router.get('/:id',       requireAuth, c.getOne);
router.post('/:id/chat', requireAuth, c.chatWithArticle);

module.exports = router;
