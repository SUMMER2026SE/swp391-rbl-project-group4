'use strict';

const router = require('express').Router();
const { requireAuth, requireTeacher } = require('../../middleware/auth');
const c = require('../../controllers/examController');

router.use(requireAuth);

// ── Student: Take Assigned Exam (UC27) ──────────────────────────────────────
router.get('/student',                        c.listAssignedExams);
router.get('/student/:assignmentId',          c.getAssignedExam);
router.post('/student/:assignmentId/attempt', c.submitExamAttempt);
router.get('/student/:assignmentId/results',  c.myExamResults);

// ── Teacher: STATIC routes phải đứng TRƯỚC param routes (:id) ───────────────

// Questions (static segment "questions" → phải trước /teacher/:id)
router.post('/teacher/questions',     requireTeacher, c.createQuestion);
router.put('/teacher/questions/:id',  requireTeacher, c.updateQuestion);
router.delete('/teacher/questions/:id', requireTeacher, c.deleteQuestion);

// Assignments (static segment "assignments" → phải trước /teacher/:id)
router.put('/teacher/assignments/:id',    requireTeacher, c.updateAssignment);
router.delete('/teacher/assignments/:id', requireTeacher, c.deleteAssignment);

// Attempts (static segment "attempts" → phải trước /teacher/:id)
router.get('/teacher/attempts/:id',           requireTeacher, c.getAttempt);
router.put('/teacher/attempts/:id/grade',     requireTeacher, c.gradeAttempt);
router.post('/teacher/attempts/:id/ai-grade', requireTeacher, c.aiGradeAttempt);

// ── Teacher: Exam CRUD — param routes (:id) đứng SAU static routes ──────────
router.get('/teacher',        requireTeacher, c.listMyExams);
router.post('/teacher',       requireTeacher, c.createExam);
router.get('/teacher/:id',    requireTeacher, c.getExam);
router.put('/teacher/:id',    requireTeacher, c.updateExam);
router.delete('/teacher/:id', requireTeacher, c.deleteExam);

// Import questions from bank
router.post('/teacher/:quizId/import-from-bank', requireTeacher, c.importFromBank);

// Assignments per exam
router.get('/teacher/:id/assignments', requireTeacher, c.listAssignments);
router.post('/teacher/:id/assign',     requireTeacher, c.assignExam);

// Attempts per exam
router.get('/teacher/:id/attempts', requireTeacher, c.listAttempts);

module.exports = router;
