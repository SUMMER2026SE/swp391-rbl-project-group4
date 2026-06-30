'use strict';

const router = require('express').Router();
const auth   = require('../../middleware/auth');
const c      = require('../../controllers/listeningController');

router.use(auth);

router.get('/',                     c.list);
router.post('/score-pronunciation', c.scorePronunciation);
router.get('/:id',                  c.getOne);

module.exports = router;
