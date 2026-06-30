'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/kanjiController');

router.use(requireAuth);
router.get('/',    c.list);
router.post('/score-writing', c.scoreWriting);
router.get('/:id', c.getOne);

module.exports = router;
