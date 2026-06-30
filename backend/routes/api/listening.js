'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c               = require('../../controllers/listeningController');

router.use(requireAuth);

router.get('/',                     c.list);
router.post('/score-pronunciation', c.scorePronunciation);
router.get('/:id',                  c.getOne);

module.exports = router;
