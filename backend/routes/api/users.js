'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/userController');

router.use(requireAuth);

router.get('/profile',         c.getProfile);
router.put('/profile',         c.updateProfile);
router.post('/avatar',         c.uploadMiddleware, c.uploadAvatar);
router.post('/change-password', c.changePassword);
router.get('/dashboard',        c.getDashboard);

module.exports = router;
