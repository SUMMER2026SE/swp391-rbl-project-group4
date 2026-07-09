'use strict';

// Routes làm bài thi thử JLPT (student). Đề do admin quản lý ở /api/admin/mock-*.
const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/mockExamController');

router.use(requireAuth);

// Cố định trước các route động /:id để "me"/"attempts" không bị nuốt thành id
router.get('/me/history', c.getHistory);
router.get('/me/stats',   c.getStats);

router.get('/attempts/:attemptId/current', c.getCurrent);
router.put('/attempts/:attemptId/answers', c.saveAnswers);
router.post('/attempts/:attemptId/sections/:position/submit', c.submitSection);
router.get('/attempts/:attemptId/result', c.getResult);
router.get('/attempts/:attemptId/review', c.getReview);

router.get('/',                  c.listExams);
router.get('/:id',               c.getExamMeta);
router.post('/:id/attempts',     c.startAttempt);
router.get('/:id/leaderboard',   c.getLeaderboard);

module.exports = router;
