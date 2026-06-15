'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/authController');

router.post('/register',        c.register);
router.post('/verify-otp',      c.verifyOtp);
router.post('/resend-otp',      c.resendOtp);
router.post('/login',           c.login);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password-otp', c.resetPasswordOtp);
router.get('/me',               requireAuth, c.getMe);

module.exports = router;
