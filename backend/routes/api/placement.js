'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/placementController');
const checkQuota = require('../../middleware/checkQuota');

router.use(requireAuth);

router.get('/check-status',            c.checkStatus);
router.get('/config',                  c.getConfig);
router.get('/levels',                  c.getLevels);
router.post('/start',                  checkQuota('placement_test_monthly'), c.startAttempt);
router.get('/history',                 c.getHistory);
router.get('/:attemptId/result',       c.getResult);
router.put('/:attemptId/answer',       c.saveAnswer);
router.post('/:attemptId/submit',      c.submitAttempt);

module.exports = router;
