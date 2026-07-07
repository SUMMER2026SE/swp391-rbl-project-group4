'use strict';

const router = require('express').Router();
const { requireAuth, requireTeacher, optionalAuth } = require('../../middleware/auth');
const c = require('../../controllers/studyListController');

// Public listing/detail — optionalAuth để khách xem được (thực tế StudentRoute chặn phía frontend).
router.get('/',    optionalAuth, c.list);
router.get('/:id', optionalAuth, c.getOne);

// Tạo/sửa/xóa — giáo viên hoặc admin, xuất bản ngay không cần duyệt.
router.post('/',                  requireAuth, requireTeacher, c.create);
router.put('/:id',                requireAuth, requireTeacher, c.update);
router.delete('/:id',             requireAuth, requireTeacher, c.remove);
router.post('/:id/items',         requireAuth, requireTeacher, c.addItem);
router.delete('/:id/items/:itemId', requireAuth, requireTeacher, c.removeItem);

module.exports = router;
