'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/placementController');

router.use(requireAuth);

router.get('/check-status',            c.checkStatus);
router.get('/config',                  c.getConfig);
router.post('/start',                  c.startAttempt);
router.get('/history',                 c.getHistory);
router.get('/:attemptId/result',       c.getResult);
router.put('/:attemptId/answer',       c.saveAnswer);
router.post('/:attemptId/submit',      c.submitAttempt);

module.exports = router;
