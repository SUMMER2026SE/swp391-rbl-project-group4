'use strict';

const { supabaseAdmin } = require('../config/supabase');

const contentDb = supabaseAdmin.schema('content_module');

function validRating(v) {
  const r = Number(v);
  return Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
}

// GET /api/courses/:id/reviews  (public) — kèm thông tin người đánh giá.
exports.getReviews = async (req, res) => {
  const courseId = req.params.id;
  const { page = 1, limit = 10 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    const { data, error, count } = await contentDb.from('course_reviews')
      .select('id,course_id,student_id,rating,comment,created_at,updated_at', { count: 'exact' })
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (error) throw error;

    const reviews = data || [];
    const ids = [...new Set(reviews.map(r => r.student_id))];
    const uMap = {};
    if (ids.length) {
      const { data: us } = await supabaseAdmin.from('users').select('id,full_name,avatar_url').in('id', ids);
      (us || []).forEach(u => { uMap[u.id] = u; });
    }

    const enriched = reviews.map(r => ({
      ...r,
      user: {
        id: r.student_id,
        display_name: uMap[r.student_id]?.full_name || 'Học viên',
        avatar_url: uMap[r.student_id]?.avatar_url || null,
      },
    }));
    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Không thể tải đánh giá.' });
  }
};

// POST /api/courses/:id/reviews  [requireAuth] — học viên đã enroll mới được đánh giá.
exports.createReview = async (req, res) => {
  const courseId = req.params.id;
  const studentId = req.user.id;
  const rating = validRating(req.body.rating);
  if (rating === null) return res.status(400).json({ error: 'Đánh giá phải là số sao từ 1 đến 5.' });
  try {
    const { data: enr } = await contentDb.from('course_enrollments')
      .select('id').eq('course_id', courseId).eq('student_id', studentId).maybeSingle();
    if (!enr) return res.status(403).json({ error: 'Bạn cần đăng ký khóa học trước khi đánh giá.' });

    // Đã có review → cập nhật; chưa có → tạo mới (UNIQUE course_id+student_id).
    const { data, error } = await contentDb.from('course_reviews')
      .upsert(
        { course_id: courseId, student_id: studentId, rating, comment: req.body.comment || null, updated_at: new Date().toISOString() },
        { onConflict: 'course_id,student_id' })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Không thể gửi đánh giá.' });
  }
};

// PUT /api/courses/:id/reviews/:reviewId  [requireAuth] — chỉ sửa review của chính mình.
exports.updateReview = async (req, res) => {
  const { reviewId } = req.params;
  const studentId = req.user.id;
  try {
    const { data: row } = await contentDb.from('course_reviews')
      .select('student_id').eq('id', reviewId).maybeSingle();
    if (!row) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
    if (row.student_id !== studentId) return res.status(403).json({ error: 'Không có quyền sửa đánh giá này.' });

    const updates = { updated_at: new Date().toISOString() };
    if (req.body.rating !== undefined) {
      const rating = validRating(req.body.rating);
      if (rating === null) return res.status(400).json({ error: 'Đánh giá phải là số sao từ 1 đến 5.' });
      updates.rating = rating;
    }
    if (req.body.comment !== undefined) updates.comment = req.body.comment || null;

    const { data, error } = await contentDb.from('course_reviews')
      .update(updates).eq('id', reviewId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ error: 'Không thể cập nhật đánh giá.' });
  }
};

// DELETE /api/courses/:id/reviews/:reviewId  [requireAuth] — chỉ xóa review của chính mình.
exports.deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  const studentId = req.user.id;
  try {
    const { data: row } = await contentDb.from('course_reviews')
      .select('student_id').eq('id', reviewId).maybeSingle();
    if (!row) return res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
    if (row.student_id !== studentId) return res.status(403).json({ error: 'Không có quyền xóa đánh giá này.' });

    const { error } = await contentDb.from('course_reviews').delete().eq('id', reviewId);
    if (error) throw error;
    res.json({ message: 'Đã xóa đánh giá.' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Không thể xóa đánh giá.' });
  }
};
