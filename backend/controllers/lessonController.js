'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Bảng quiz nằm ở exam_module; tiến độ (lesson_progress) + units nằm ở content_module
const examDb = supabaseAdmin.schema('exam_module');
const contentDb = supabaseAdmin.schema('content_module');

// Danh sách Mục toàn khóa, sắp theo (unit.sort_order, lesson.order_index) → để điều hướng tiếp/trước.
async function buildCourseItemOrder(courseId) {
  const [{ data: units }, { data: items }] = await Promise.all([
    contentDb.from('units').select('id,sort_order').eq('course_id', courseId),
    supabaseAdmin.from('lessons').select('id,unit_id,order_index').eq('course_id', courseId),
  ]);
  const unitOrder = Object.fromEntries((units || []).map(u => [u.id, u.sort_order ?? 0]));
  return (items || []).slice().sort((a, b) => {
    const ua = unitOrder[a.unit_id] ?? 0, ub = unitOrder[b.unit_id] ?? 0;
    if (ua !== ub) return ua - ub;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });
}

// GET /api/lessons/:id  — học một Mục
exports.getOne = async (req, res) => {
  const id = req.params.id;
  try {
    const { data: lesson, error } = await supabaseAdmin
      .from('lessons').select('*').eq('id', id).single();
    if (error || !lesson) return res.status(404).json({ error: 'Không tìm thấy mục học.' });

    // Từ vựng & kanji của Mục lấy qua bảng nối (nhiều–nhiều)
    const [{ data: vocabLinks }, { data: kanjiLinks }] = await Promise.all([
      contentDb.from('lesson_vocabulary').select('vocabulary_id').eq('lesson_id', id),
      contentDb.from('lesson_kanji').select('kanji_id').eq('lesson_id', id),
    ]);
    const vocabIds = (vocabLinks || []).map(l => l.vocabulary_id);
    const kanjiIds = (kanjiLinks || []).map(l => l.kanji_id);

    const [{ data: vocab }, { data: kanji }, { data: quiz }, order, { data: progress }] = await Promise.all([
      vocabIds.length
        ? supabaseAdmin.from('vocabulary')
            .select('id,kanji,reading,meaning_vi,meaning_ja,type,example_sentence')
            .in('id', vocabIds).order('created_at')
        : Promise.resolve({ data: [] }),
      kanjiIds.length
        ? supabaseAdmin.from('kanji')
            .select('id,character,reading_on,reading_kun,meaning_vi,stroke_count,level,han_viet')
            .in('id', kanjiIds).order('created_at')
        : Promise.resolve({ data: [] }),
      examDb.from('quizzes')
        .select('id,title,time_limit,type')
        .eq('lesson_id', id)
        .limit(1)
        .maybeSingle(),
      buildCourseItemOrder(lesson.course_id),
      contentDb.from('lesson_progress')
        .select('status').eq('lesson_id', id).eq('student_id', req.user.id).maybeSingle(),
    ]);

    const idx = order.findIndex(i => i.id === id);
    const prev = idx > 0 ? order[idx - 1] : null;
    const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
    const nav = {
      prevId: prev?.id || null,
      nextId: next?.id || null,
      nextIsNewUnit: !!(next && next.unit_id !== lesson.unit_id),
    };

    res.json({
      ...lesson,
      vocabulary: vocab || [],
      kanji: kanji || [],
      quiz: quiz || null,
      nav,
      completed: progress?.status === 'completed',
    });
  } catch (err) {
    console.error('Get lesson error:', err);
    res.status(500).json({ error: 'Không thể tải mục học.' });
  }
};

// POST /api/lessons/:id/complete — đánh dấu Mục đã hoàn thành
exports.complete = async (req, res) => {
  const id = req.params.id;
  const studentId = req.user.id;
  try {
    const { data: existing } = await contentDb.from('lesson_progress')
      .select('id').eq('lesson_id', id).eq('student_id', studentId).maybeSingle();
    if (existing) {
      await contentDb.from('lesson_progress')
        .update({ status: 'completed', progress_pct: 100, completed_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await contentDb.from('lesson_progress').insert({
        student_id: studentId, lesson_id: id,
        status: 'completed', progress_pct: 100, last_position: 0, time_spent_sec: 0,
        completed_at: new Date().toISOString(),
      });
    }
    res.json({ message: 'Đã lưu tiến độ.' });
  } catch (err) {
    console.error('Complete lesson error:', err);
    res.status(500).json({ error: 'Không thể lưu tiến độ.' });
  }
};
