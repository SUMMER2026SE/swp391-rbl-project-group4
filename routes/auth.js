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

router.get('/reset-password',   authController.getResetPassword);
router.post('/reset-password',  authController.postResetPassword);

module.exports = router;
