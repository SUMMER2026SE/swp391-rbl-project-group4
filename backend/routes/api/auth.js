'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/authController');

router.post('/register',        c.register);
router.post('/login',           c.login);
router.post('/forgot-password', c.forgotPassword);
router.get('/me',               requireAuth, c.getMe);

module.exports = router;
