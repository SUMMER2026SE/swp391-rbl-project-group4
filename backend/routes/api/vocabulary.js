'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/vocabularyController');

router.use(requireAuth);
router.get('/',    c.list);
router.get('/:id', c.getOne);

module.exports = router;
