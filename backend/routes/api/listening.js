'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const { requireAuth } = require('../../middleware/auth');
const c       = require('../../controllers/listeningController');
const checkQuota = require('../../middleware/checkQuota');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/',                     c.list);
router.get('/user-audio',           c.listUserAudio);
router.post('/user-audio',          upload.single('audio'), c.uploadAudio);
router.delete('/user-audio/:id',    c.deleteUserAudio);
router.post('/score-pronunciation', checkQuota('listening_practice_monthly'), c.scorePronunciation);

// Nội dung tự tạo (tts/audio/video/youtube). Quota kiểm tra trong controller (admin bỏ qua).
router.get('/content/mine',            c.listMyContent);
router.post('/content',                upload.single('media'), c.createContent);
router.get('/content/:id',             c.getContent);
router.post('/content/:id/transcribe', c.transcribeContent);
router.put('/content/:id',             c.updateContent);
router.delete('/content/:id',          c.deleteContent);

router.get('/:id',                  c.getOne);

module.exports = router;
