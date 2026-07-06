'use strict';

const router  = require('express').Router();
const multer  = require('multer');
const { requireAuth } = require('../../middleware/auth');
const c       = require('../../controllers/listeningController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/',                     c.list);
router.get('/user-audio',           c.listUserAudio);
router.post('/user-audio',          upload.single('audio'), c.uploadAudio);
router.delete('/user-audio/:id',    c.deleteUserAudio);
router.post('/score-pronunciation', c.scorePronunciation);
router.get('/:id',                  c.getOne);

module.exports = router;
