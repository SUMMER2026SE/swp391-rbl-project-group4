const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },   // 5 MB
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

router.get('/profile',                requireAuth, profileController.getProfile);
router.post('/profile',               requireAuth, profileController.postProfile);
router.post('/profile/avatar',        requireAuth, upload.single('avatar'), profileController.postAvatar);
router.post('/profile/change-password', requireAuth, profileController.postChangePassword);

module.exports = router;
