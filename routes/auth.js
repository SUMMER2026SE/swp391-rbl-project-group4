const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middleware/auth');

router.get('/login',     redirectIfAuth, authController.getLogin);
router.post('/login',    authController.postLogin);

router.get('/register',  redirectIfAuth, authController.getRegister);
router.post('/register', authController.postRegister);

router.get('/logout',    authController.getLogout);

router.get('/forgot-password',  redirectIfAuth, authController.getForgotPassword);
router.post('/forgot-password', redirectIfAuth, authController.postForgotPassword);

router.get('/reset-password', authController.getResetPassword);

// Google OAuth callback (EJS app)
router.get('/auth/callback',        authController.getAuthCallback);
router.post('/auth/google-session',  authController.postGoogleSession);

module.exports = router;
