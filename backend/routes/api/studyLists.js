'use strict';

const router = require('express').Router();
const multer = require('multer');
const { requireAuth, requireTeacher, optionalAuth } = require('../../middleware/auth');
const c   = require('../../controllers/studyListController');
const fic = require('../../controllers/importFileController');

const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(json|csv|xlsx|xls|docx)$/i.test(file.originalname);
    ok ? cb(null, true) : cb(new Error('Chỉ chấp nhận file .json, .csv, .xlsx, .xls, .docx.'));
  },
});

// Public listing/detail — optionalAuth để khách xem được.
router.get('/',    optionalAuth, c.list);
router.get('/:id', optionalAuth, c.getOne);

// Tạo/sửa/xóa — giáo viên hoặc admin, xuất bản ngay không cần duyệt.
router.post('/',    requireAuth, requireTeacher, c.create);
router.put('/:id',  requireAuth, requireTeacher, c.update);
router.delete('/:id', requireAuth, requireTeacher, c.remove);

// Import file hàng loạt vào bài đăng (đặt TRƯỚC /:id/items để tránh conflict route)
router.post('/:id/vocabulary/import-file',     requireAuth, requireTeacher, importFileUpload.single('file'), fic.previewVocabFile);
router.post('/:id/kanji/import-file',          requireAuth, requireTeacher, importFileUpload.single('file'), fic.previewKanjiFile);
router.post('/:id/grammar-points/import-file', requireAuth, requireTeacher, importFileUpload.single('file'), fic.previewGrammarFile);
router.post('/:id/import',                     requireAuth, requireTeacher, c.importItems);

router.post('/:id/items',           requireAuth, requireTeacher, c.addItem);
router.delete('/:id/items/:itemId', requireAuth, requireTeacher, c.removeItem);

module.exports = router;
