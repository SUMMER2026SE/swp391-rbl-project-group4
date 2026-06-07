'use strict';

const router = require('express').Router();
const { requireAuth, requireTeacher, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/classController');

// Student: join / view own classes
router.post('/join',       requireAuth, c.joinClass);
router.get('/my',          requireAuth, c.listMyEnrollments);
router.delete('/my/:id',   requireAuth, c.leaveClass);

// Teacher: manage own classes
router.get('/teacher',                         requireAuth, requireTeacher, c.listMyClasses);
router.post('/teacher',                        requireAuth, requireTeacher, c.createClass);
router.put('/teacher/:id',                     requireAuth, requireTeacher, c.updateClass);
router.delete('/teacher/:id',                  requireAuth, requireTeacher, c.deleteClass);
router.get('/teacher/:id/students',            requireAuth, requireTeacher, c.getClassStudents);
router.put('/teacher/enrollments/:enrollmentId', requireAuth, requireTeacher, c.updateEnrollmentStatus);

// Admin
router.get('/admin',       requireAuth, requireAdmin, c.adminListClasses);
router.get('/admin/:id',   requireAuth, requireAdmin, c.adminGetClassDetail);

module.exports = router;
