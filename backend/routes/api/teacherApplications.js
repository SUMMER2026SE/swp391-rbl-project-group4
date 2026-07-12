'use strict';

const router = require('express').Router();
const multer = require('multer');
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/teacherApplicationController');

const ACCEPTED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || ACCEPTED.includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận PDF, ảnh hoặc file Word (DOCX).'));
  },
});

router.use(requireAuth);

router.get('/me', c.getMyApplication);
router.post('/', upload.array('documents', 6), c.submitApplication);

module.exports = router;
