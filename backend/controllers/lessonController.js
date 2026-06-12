'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/lessons/:id
exports.getOne = async (req, res) => {
  try {
    const { data: lesson, error } = await supabaseAdmin
      .from('lessons').select('*').eq('id', req.params.id).single();
    if (error || !lesson) return res.status(404).json({ error: 'Không tìm thấy bài học.' });

    const [{ data: vocab }, { data: kanji }, { data: quiz }] = await Promise.all([
      supabaseAdmin.from('vocabulary')
        .select('id,kanji,reading,meaning_vi,meaning_ja,type,example_sentence')
        .eq('lesson_id', req.params.id).order('created_at'),
      supabaseAdmin.from('kanji')
        .select('id,character,reading_on,reading_kun,meaning_vi,stroke_count,level,han_viet')
        .eq('lesson_id', req.params.id).order('created_at'),
      supabaseAdmin.from('quizzes')
        .select('id,title,time_limit,type')
        .eq('lesson_id', req.params.id)
        .limit(1)
        .maybeSingle(),
    ]);

    res.json({ ...lesson, vocabulary: vocab || [], kanji: kanji || [], quiz: quiz || null });
  } catch (err) {
    console.error('Get lesson error:', err);
    res.status(500).json({ error: 'Không thể tải bài học.' });
  }
};
