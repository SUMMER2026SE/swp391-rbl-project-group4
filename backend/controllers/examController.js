'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');
const { isCorrect } = require('./quizController');

// Sau khi DB tách schema: quiz ở exam_module, exam_assignments ở classroom_module.
// (classes / class_enrollments / users / teacher_question_bank vẫn ở public)
const examDb  = supabaseAdmin.schema('exam_module');
const classDb = supabaseAdmin.schema('classroom_module');

const EXAM_FIELDS = 'id,title,title_ja,description,type,time_limit,is_published,is_exam,teacher_id,created_at';

// Fetch an exam (quizzes row with is_exam=true) owned by this teacher, or null
async function getOwnedExam(id, teacherId) {
    const { data } = await examDb.from('quizzes')
        .select('*').eq('id', id).eq('teacher_id', teacherId).eq('is_exam', true).single();
    return data || null;
}

// ─────────────────────── Teacher: Exam CRUD (UC41 / UC42 / UC43) ────────────

// GET /api/exams/teacher
exports.listMyExams = async (req, res) => {
    try {
        const { data: exams, error } = await examDb.from('quizzes')
            .select(EXAM_FIELDS)
            .eq('teacher_id', req.user.id).eq('is_exam', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!exams || exams.length === 0) return res.json([]);

        const examIds = exams.map(e => e.id);
        const [{ data: assignments }, { data: pending }] = await Promise.all([
            classDb.from('exam_assignments').select('id,exam_id').in('exam_id', examIds),
            examDb.from('quiz_attempts').select('id,quiz_id').in('quiz_id', examIds).eq('status', 'pending_review'),
        ]);
        const assignCounts = {};
        (assignments || []).forEach(a => { assignCounts[a.exam_id] = (assignCounts[a.exam_id] || 0) + 1; });
        const pendingCounts = {};
        (pending || []).forEach(p => { pendingCounts[p.quiz_id] = (pendingCounts[p.quiz_id] || 0) + 1; });

        res.json(exams.map(e => ({
            ...e,
            assignment_count: assignCounts[e.id] || 0,
            pending_review_count: pendingCounts[e.id] || 0,
        })));
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải danh sách đề thi.' });
    }
};

// POST /api/exams/teacher  — tạo đề thi (nền tảng cho UC42-46)
exports.createExam = async (req, res) => {
    const { title, title_ja, description, time_limit, mode } = req.body;
    if (!title) return res.status(400).json({ error: 'Tiêu đề đề thi là bắt buộc.' });
    try {
        const { data, error } = await examDb.from('quizzes')
            .insert({
                title, title_ja: title_ja || null, description: description || null,
                time_limit: time_limit || null, type: 'multiple_choice',
                mode: mode === 'proctored' ? 'proctored' : 'normal',
                is_exam: true, is_published: true, teacher_id: req.user.id,
            })
            .select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể tạo đề thi.' });
    }
};

// GET /api/exams/teacher/:id
exports.getExam = async (req, res) => {
    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });
        const { data: questions } = await examDb.from('quiz_questions')
            .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,order_index')
            .eq('quiz_id', req.params.id).order('order_index');
        res.json({ ...exam, questions: questions || [] });
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải đề thi.' });
    }
};

// PUT /api/exams/teacher/:id  (UC42 — Chỉnh sửa đề thi)
exports.updateExam = async (req, res) => {
    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });
        const allowed = ['title', 'title_ja', 'description', 'time_limit', 'mode'];
        const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const { data, error } = await examDb.from('quizzes').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể cập nhật đề thi.' });
    }
};

// DELETE /api/exams/teacher/:id  (UC43 — Xoá đề thi)
exports.deleteExam = async (req, res) => {
    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });
        await examDb.from('quizzes').delete().eq('id', req.params.id);
        res.json({ message: 'Đã xóa đề thi.' });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa đề thi.' });
    }
};

// ─────────────────────── Teacher: Exam Questions ────────────────────────────

// POST /api/exams/teacher/questions
exports.createQuestion = async (req, res) => {
    const {
        quiz_id, question, options, correct_answer, correct_answer_data,
        explanation, order_index, question_type, bank_question_id,
    } = req.body;
    if (!quiz_id) return res.status(400).json({ error: 'Thiếu quiz_id.' });
    const exam = await getOwnedExam(quiz_id, req.user.id);
    if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

    const typ = question_type || 'single_choice';
    if (!bank_question_id && !question) return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
    try {
        const { data, error } = await examDb.from('quiz_questions')
            .insert({
                quiz_id,
                question:            question || null,
                options:             options || null,
                correct_answer:      correct_answer || null,
                correct_answer_data: correct_answer_data || null,
                explanation:         explanation || null,
                order_index:         order_index ?? 0,
                question_type:       typ,
                bank_question_id:    bank_question_id || null,
            })
            .select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể tạo câu hỏi.' });
    }
};

// PUT /api/exams/teacher/questions/:id
exports.updateQuestion = async (req, res) => {
    try {
        const { data: q } = await examDb.from('quiz_questions').select('quiz_id').eq('id', req.params.id).single();
        if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
        const exam = await getOwnedExam(q.quiz_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        const allowed = [
            'question', 'options', 'correct_answer', 'correct_answer_data',
            'explanation', 'order_index', 'question_type', 'bank_question_id',
        ];
        const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const { data, error } = await examDb.from('quiz_questions').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể cập nhật câu hỏi.' });
    }
};

// DELETE /api/exams/teacher/questions/:id
exports.deleteQuestion = async (req, res) => {
    try {
        const { data: q } = await examDb.from('quiz_questions').select('quiz_id').eq('id', req.params.id).single();
        if (!q) return res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
        const exam = await getOwnedExam(q.quiz_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        await examDb.from('quiz_questions').delete().eq('id', req.params.id);
        res.json({ message: 'Đã xóa câu hỏi.' });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa câu hỏi.' });
    }
};

// POST /api/exams/teacher/:quizId/import-from-bank  — nhập câu hỏi từ ngân hàng đề riêng
exports.importFromBank = async (req, res) => {
    const { quizId } = req.params;
    const { question_ids, source = 'mine' } = req.body; // source: 'mine' (riêng) | 'global' (chung)
    if (!Array.isArray(question_ids) || !question_ids.length)
        return res.status(400).json({ error: 'Không có câu hỏi được chọn.' });

    const exam = await getOwnedExam(quizId, req.user.id);
    if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

    try {
        const { data: existing } = await examDb
            .from('quiz_questions').select('order_index').eq('quiz_id', quizId).order('order_index', { ascending: false }).limit(1);
        let nextIdx = existing && existing.length ? existing[0].order_index + 1 : 0;

        // Lấy câu hỏi từ ngân hàng riêng (của GV) hoặc ngân hàng chung (đã duyệt)
        let q = source === 'global'
            ? examDb.from('question_bank').select('*').in('id', question_ids).eq('status', 'approved')
            : examDb.from('teacher_question_bank').select('*').in('id', question_ids).eq('teacher_id', req.user.id);
        const { data: bankRows, error: fetchErr } = await q;
        if (fetchErr) throw fetchErr;

        const rows = (bankRows || []).map((bq, i) => ({
            quiz_id:             quizId,
            bank_question_id:    bq.id,
            question_type:       bq.question_type || 'single_choice',
            question:            bq.question_text,
            options:             bq.options,
            correct_answer:      typeof bq.correct_answer === 'string' ? bq.correct_answer : null,
            correct_answer_data: typeof bq.correct_answer !== 'string' ? bq.correct_answer : null,
            explanation:         bq.explanation || null,
            order_index:         nextIdx + i,
        }));

        const { data, error } = await examDb.from('quiz_questions').insert(rows).select();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể nhập câu hỏi.' });
    }
};

// ─────────────────────── Teacher: Assign to Class (UC44) ────────────────────

// GET /api/exams/teacher/:id/assignments
exports.listAssignments = async (req, res) => {
    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        const { data: assignments, error } = await classDb.from('exam_assignments')
            .select('*').eq('exam_id', req.params.id).order('created_at', { ascending: false });
        if (error) throw error;
        if (!assignments || assignments.length === 0) return res.json([]);

        const classIds = [...new Set(assignments.map(a => a.class_id))];
        const { data: classes } = await supabaseAdmin.from('classes').select('id,name').in('id', classIds);
        const cMap = Object.fromEntries((classes || []).map(c => [c.id, c]));

        res.json(assignments.map(a => ({ ...a, class: cMap[a.class_id] || {} })));
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải danh sách giao đề.' });
    }
};

// POST /api/exams/teacher/:id/assign
exports.assignExam = async (req, res) => {
    const { class_id, start_time, end_time, max_attempts } = req.body;
    if (!class_id) return res.status(400).json({ error: 'Vui lòng chọn lớp học.' });
    if (start_time && end_time && new Date(start_time) >= new Date(end_time))
        return res.status(400).json({ error: 'Thời gian bắt đầu phải trước thời gian kết thúc.' });

    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        const { data: cls } = await supabaseAdmin.from('classes').select('teacher_id').eq('id', class_id).single();
        if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền với lớp học này.' });

        const { data, error } = await classDb.from('exam_assignments')
            .insert({
                exam_id: req.params.id, class_id,
                assigned_by: req.user.id, target_type: 'class',
                start_time: start_time || null, end_time: end_time || null,
                max_attempts: max_attempts || 1,
            })
            .select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể giao đề thi.' });
    }
};

// PUT /api/exams/teacher/assignments/:id
exports.updateAssignment = async (req, res) => {
    try {
        const { data: a } = await classDb.from('exam_assignments').select('exam_id').eq('id', req.params.id).single();
        if (!a) return res.status(404).json({ error: 'Không tìm thấy lượt giao đề.' });
        const exam = await getOwnedExam(a.exam_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        const allowed = ['start_time', 'end_time', 'max_attempts'];
        const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
        const start = updates.start_time !== undefined ? updates.start_time : undefined;
        const end   = updates.end_time   !== undefined ? updates.end_time   : undefined;
        if (start && end && new Date(start) >= new Date(end))
            return res.status(400).json({ error: 'Thời gian bắt đầu phải trước thời gian kết thúc.' });

        const { data, error } = await classDb.from('exam_assignments').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể cập nhật.' });
    }
};

// DELETE /api/exams/teacher/assignments/:id
exports.deleteAssignment = async (req, res) => {
    try {
        const { data: a } = await classDb.from('exam_assignments').select('exam_id').eq('id', req.params.id).single();
        if (!a) return res.status(404).json({ error: 'Không tìm thấy lượt giao đề.' });
        const exam = await getOwnedExam(a.exam_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        await classDb.from('exam_assignments').delete().eq('id', req.params.id);
        res.json({ message: 'Đã hủy giao đề.' });
    } catch (err) {
        res.status(500).json({ error: 'Không thể xóa.' });
    }
};

// ─────────────────────── Teacher: Results & Grading (UC45 / UC46) ───────────

// GET /api/exams/teacher/:id/attempts
exports.listAttempts = async (req, res) => {
    try {
        const exam = await getOwnedExam(req.params.id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với đề thi này.' });

        const { data: attempts, error } = await examDb.from('quiz_attempts')
            .select('id,user_id,assignment_id,score,total_questions,manual_score,status,attempt_number,completed_at,graded_at,violation_count')
            .eq('quiz_id', req.params.id).order('completed_at', { ascending: false });
        if (error) throw error;
        if (!attempts || attempts.length === 0) return res.json([]);

        const userIds = [...new Set(attempts.map(a => a.user_id))];
        const assignmentIds = [...new Set(attempts.map(a => a.assignment_id).filter(Boolean))];
        const [{ data: users }, { data: assignments }] = await Promise.all([
            supabaseAdmin.from('users').select('id,full_name,email').in('id', userIds),
            assignmentIds.length > 0
                ? classDb.from('exam_assignments').select('id,class_id').in('id', assignmentIds)
                : Promise.resolve({ data: [] }),
        ]);
        const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));

        const classIds = [...new Set((assignments || []).map(a => a.class_id))];
        const { data: classes } = classIds.length > 0
            ? await supabaseAdmin.from('classes').select('id,name').in('id', classIds)
            : { data: [] };
        const cMap = Object.fromEntries((classes || []).map(c => [c.id, c]));
        const aMap = Object.fromEntries((assignments || []).map(a => [a.id, { ...a, class: cMap[a.class_id] || {} }]));

        res.json(attempts.map(a => ({
            ...a,
            student: uMap[a.user_id] || {},
            assignment: aMap[a.assignment_id] || null,
        })));
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải kết quả.' });
    }
};

// GET /api/exams/teacher/attempts/:id
exports.getAttempt = async (req, res) => {
    try {
        const { data: attempt, error } = await examDb.from('quiz_attempts').select('*').eq('id', req.params.id).single();
        if (error || !attempt) return res.status(404).json({ error: 'Không tìm thấy bài làm.' });
        const exam = await getOwnedExam(attempt.quiz_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với bài làm này.' });

        const { data: questions } = await examDb.from('quiz_questions')
            .select('id,question,options,correct_answer,correct_answer_data,question_type,explanation,order_index')
            .eq('quiz_id', attempt.quiz_id).order('order_index');
        const { data: student } = await supabaseAdmin.from('users').select('id,full_name,email').eq('id', attempt.user_id).single();

        res.json({ ...attempt, exam_title: exam.title, questions: questions || [], student: student || {} });
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải bài làm.' });
    }
};

// PUT /api/exams/teacher/attempts/:id/grade  (UC45 — chấm điểm thủ công)
exports.gradeAttempt = async (req, res) => {
    const { manual_score, feedback } = req.body;
    try {
        const { data: attempt } = await examDb.from('quiz_attempts').select('quiz_id,total_questions').eq('id', req.params.id).single();
        if (!attempt) return res.status(404).json({ error: 'Không tìm thấy bài làm.' });
        const exam = await getOwnedExam(attempt.quiz_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với bài làm này.' });

        if (manual_score === undefined || manual_score === null || manual_score < 0 || manual_score > attempt.total_questions)
            return res.status(400).json({ error: `Điểm phải từ 0 đến ${attempt.total_questions}.` });

        const { data, error } = await examDb.from('quiz_attempts')
            .update({
                manual_score, feedback: feedback || null,
                status: 'graded', graded_by: req.user.id, graded_at: new Date().toISOString(),
            })
            .eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Không thể lưu kết quả chấm điểm.' });
    }
};

// POST /api/exams/teacher/attempts/:id/ai-grade  (UC45 — gợi ý chấm điểm bằng AI cho câu tự luận)
exports.aiGradeAttempt = async (req, res) => {
    try {
        const { data: attempt } = await examDb.from('quiz_attempts')
            .select('quiz_id,answers,score,total_questions').eq('id', req.params.id).single();
        if (!attempt) return res.status(404).json({ error: 'Không tìm thấy bài làm.' });
        const exam = await getOwnedExam(attempt.quiz_id, req.user.id);
        if (!exam) return res.status(403).json({ error: 'Không có quyền với bài làm này.' });

        const { data: questions } = await examDb.from('quiz_questions')
            .select('id,question,correct_answer,explanation,question_type').eq('quiz_id', attempt.quiz_id);

        const shortAnswerQs = (questions || []).filter(q => q.question_type === 'short_answer');
        if (shortAnswerQs.length === 0)
            return res.status(400).json({ error: 'Đề thi không có câu hỏi tự luận để AI hỗ trợ chấm.' });

        const items = shortAnswerQs.map(q => ({
            question: q.question,
            expected: q.correct_answer || q.explanation || '(không có đáp án mẫu)',
            student_answer: attempt.answers?.[q.id] ?? '',
        }));

        const prompt = `Bạn là giáo viên tiếng Nhật. Hãy chấm điểm các câu trả lời tự luận sau, mỗi câu cho 0 hoặc 1 điểm (đúng hoặc gần đúng = 1, sai = 0), kèm nhận xét ngắn gọn bằng tiếng Việt.
Dữ liệu (JSON): ${JSON.stringify(items)}
Trả về ĐÚNG một JSON array, mỗi phần tử có dạng { "score": 0 hoặc 1, "comment": "..." }, theo đúng thứ tự, không kèm giải thích hay markdown.`;

        const result = await chatCompletion([{ role: 'user', content: prompt }], { max_tokens: 800, temperature: 0.3 });
        const raw = result.choices?.[0]?.message?.content?.trim() || '[]';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(cleaned);

        const aiTotal = suggestions.reduce((s, x) => s + (Number(x.score) || 0), 0);
        const suggestedScore = Math.min((attempt.score || 0) + aiTotal, attempt.total_questions);

        res.json({ suggestions, suggested_score: suggestedScore, questions: shortAnswerQs });
    } catch (err) {
        console.error('AI grade error:', err);
        res.status(502).json({ error: 'Không thể nhận gợi ý chấm điểm từ AI.' });
    }
};

// ─────────────────────── Student: Take Assigned Exam (UC27) ─────────────────

// GET /api/exams/student
exports.listAssignedExams = async (req, res) => {
    try {
        const { data: enrollments } = await supabaseAdmin.from('class_enrollments')
            .select('class_id').eq('student_id', req.user.id).eq('status', 'active');
        const classIds = [...new Set((enrollments || []).map(e => e.class_id))];
        if (classIds.length === 0) return res.json([]);

        const { data: assignments, error } = await classDb.from('exam_assignments')
            .select('*').in('class_id', classIds).order('created_at', { ascending: false });
        if (error) throw error;
        if (!assignments || assignments.length === 0) return res.json([]);

        const examIds = [...new Set(assignments.map(a => a.exam_id))];
        const classIds2 = [...new Set(assignments.map(a => a.class_id))];
        const assignmentIds = assignments.map(a => a.id);

        const [{ data: exams }, { data: classes }, { data: attempts }] = await Promise.all([
            examDb.from('quizzes').select('id,title,title_ja,description,time_limit').in('id', examIds),
            supabaseAdmin.from('classes').select('id,name').in('id', classIds2),
            examDb.from('quiz_attempts')
                .select('id,assignment_id,score,total_questions,manual_score,status,attempt_number,completed_at')
                .eq('user_id', req.user.id).in('assignment_id', assignmentIds),
        ]);

        const eMap = Object.fromEntries((exams || []).map(e => [e.id, e]));
        const cMap = Object.fromEntries((classes || []).map(c => [c.id, c]));
        const attemptsByAssign = {};
        (attempts || []).forEach(a => { (attemptsByAssign[a.assignment_id] ||= []).push(a); });

        const now = new Date();
        res.json(assignments.map(a => {
            const myAttempts = (attemptsByAssign[a.id] || []).sort((x, y) => y.attempt_number - x.attempt_number);
            const start = a.start_time ? new Date(a.start_time) : null;
            const end   = a.end_time ? new Date(a.end_time) : null;
            let windowStatus = 'open';
            if (start && now < start) windowStatus = 'upcoming';
            else if (end && now > end) windowStatus = 'closed';

            return {
                ...a,
                exam: eMap[a.exam_id] || {},
                class: cMap[a.class_id] || {},
                attempts_used: myAttempts.length,
                attempts_remaining: Math.max(0, (a.max_attempts || 1) - myAttempts.length),
                window_status: windowStatus,
                latest_attempt: myAttempts[0] || null,
            };
        }));
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải danh sách đề thi được giao.' });
    }
};

// Verify the student is actively enrolled in the assignment's class, return the assignment
async function getEnrolledAssignment(assignmentId, studentId) {
    const { data: assignment } = await classDb.from('exam_assignments').select('*').eq('id', assignmentId).single();
    if (!assignment) return { error: 'Không tìm thấy đề thi được giao.', code: 404 };

    const { data: enrollment } = await supabaseAdmin.from('class_enrollments').select('id')
        .eq('class_id', assignment.class_id).eq('student_id', studentId).eq('status', 'active').single();
    if (!enrollment) return { error: 'Bạn không thuộc lớp học được giao đề thi này.', code: 403 };

    return { assignment };
}

// GET /api/exams/student/:assignmentId
exports.getAssignedExam = async (req, res) => {
    try {
        const { assignment, error, code } = await getEnrolledAssignment(req.params.assignmentId, req.user.id);
        if (error) return res.status(code).json({ error });

        const now = new Date();
        if (assignment.start_time && now < new Date(assignment.start_time))
            return res.status(403).json({ error: 'Đề thi chưa đến thời gian bắt đầu.' });
        if (assignment.end_time && now > new Date(assignment.end_time))
            return res.status(403).json({ error: 'Đề thi đã hết thời gian làm bài.' });

        const { count } = await examDb.from('quiz_attempts').select('id', { count: 'exact', head: true })
            .eq('assignment_id', assignment.id).eq('user_id', req.user.id);
        if ((count || 0) >= (assignment.max_attempts || 1))
            return res.status(403).json({ error: 'Bạn đã hết số lần làm bài cho phép.' });

        const { data: exam } = await examDb.from('quizzes')
            .select('id,title,title_ja,description,time_limit,mode').eq('id', assignment.exam_id).single();
        if (!exam) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

        // Không gửi đáp án đúng cho học sinh
        const { data: questions } = await examDb.from('quiz_questions')
            .select('id,question,options,question_type,order_index')
            .eq('quiz_id', assignment.exam_id).order('order_index');

        res.json({
            ...exam,
            assignment_id: assignment.id,
            max_attempts: assignment.max_attempts,
            attempts_used: count || 0,
            end_time: assignment.end_time,
            questions: questions || [],
        });
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải đề thi.' });
    }
};

// POST /api/exams/student/:assignmentId/attempt
exports.submitExamAttempt = async (req, res) => {
    const { answers, violation_count, proctor_events, snapshots } = req.body;
    try {
        const { assignment, error, code } = await getEnrolledAssignment(req.params.assignmentId, req.user.id);
        if (error) return res.status(code).json({ error });

        const now = new Date();
        if (assignment.end_time && now > new Date(assignment.end_time))
            return res.status(403).json({ error: 'Đề thi đã hết thời gian làm bài.' });

        const { count } = await examDb.from('quiz_attempts').select('id', { count: 'exact', head: true })
            .eq('assignment_id', assignment.id).eq('user_id', req.user.id);
        if ((count || 0) >= (assignment.max_attempts || 1))
            return res.status(403).json({ error: 'Bạn đã hết số lần làm bài cho phép.' });

        // Đề thi ở chế độ giám sát?
        const { data: exam } = await examDb.from('quizzes').select('mode').eq('id', assignment.exam_id).single();
        const isProctored = exam?.mode === 'proctored';

        const { data: questions } = await examDb.from('quiz_questions')
            .select('id,question_type,options,correct_answer,correct_answer_data')
            .eq('quiz_id', assignment.exam_id);
        if (!questions || questions.length === 0) return res.status(404).json({ error: 'Không tìm thấy đề thi.' });

        let score = 0;
        let hasShortAnswer = false;
        questions.forEach(q => {
            if (q.question_type === 'short_answer') hasShortAnswer = true;
            if (isCorrect(q, answers?.[q.id])) score++;
        });

        const { data: attempt, error: insErr } = await examDb.from('quiz_attempts').insert({
            quiz_id: assignment.exam_id, user_id: req.user.id,
            score, total_questions: questions.length, answers: answers || {},
            assignment_id: assignment.id, attempt_number: (count || 0) + 1,
            status: hasShortAnswer ? 'pending_review' : 'graded',
            mode: exam?.mode || 'normal',
            violation_count: isProctored ? (Number(violation_count) || 0) : 0,
            proctor_events:  isProctored && Array.isArray(proctor_events) ? proctor_events : null,
            snapshots:       isProctored && Array.isArray(snapshots) ? snapshots : null,
        }).select().single();
        if (insErr) throw insErr;

        res.json({ score, total: questions.length, attempt_id: attempt.id, status: attempt.status });
    } catch (err) {
        console.error('Submit exam attempt error:', err);
        res.status(500).json({ error: 'Không thể lưu kết quả.' });
    }
};

// GET /api/exams/student/:assignmentId/results
exports.myExamResults = async (req, res) => {
    try {
        const { error, code } = await getEnrolledAssignment(req.params.assignmentId, req.user.id);
        if (error) return res.status(code).json({ error });

        const { data, error: qErr } = await examDb.from('quiz_attempts').select('*')
            .eq('assignment_id', req.params.assignmentId).eq('user_id', req.user.id)
            .order('attempt_number', { ascending: false });
        if (qErr) throw qErr;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: 'Không thể tải kết quả.' });
    }
};
