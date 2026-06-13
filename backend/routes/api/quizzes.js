'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/quizController');

router.use(requireAuth);
router.get('/',               c.list);
router.get('/:id',            c.getOne);
router.post('/:id/attempt',   c.submitAttempt);
router.post('/:id/proctor-snapshot', c.uploadProctorSnapshot);
router.get('/:id/results',    c.getResults);

module.exports = router;
