'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/readingSetController');

// Student routes (auth required, status must be 'published')
router.use(requireAuth);
router.get('/',    c.studentList);
router.get('/:id', c.studentGetOne);

module.exports = router;
