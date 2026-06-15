'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/lessonController');

router.use(requireAuth);
router.get('/:id', c.getOne);
router.post('/:id/complete', c.complete);

module.exports = router;
