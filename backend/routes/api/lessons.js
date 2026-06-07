'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/lessonController');

router.use(requireAuth);
router.get('/:id', c.getOne);

module.exports = router;
