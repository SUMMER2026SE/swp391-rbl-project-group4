'use strict';

const { supabaseAdmin } = require('../config/supabase');

// GET /api/lessons/:id
exports.getOne = async (req, res) => {
  try {
    const { data: lesson, error } = await supabaseAdmin
      .from('lessons').select('*').eq('id', req.params.id).eq('is_published', true).single();
    if (error || !lesson) return res.status(404).json({ error: 'Không tìm thấy bài học.' });

    const { data: vocab } = await supabaseAdmin
      .from('vocabulary').select('id,kanji,reading,meaning_vi,meaning_ja,type')
      .eq('lesson_id', req.params.id).order('created_at');

    res.json({ ...lesson, vocabulary: vocab || [] });
  } catch (err) {
    console.error('Get lesson error:', err);
    res.status(500).json({ error: 'Không thể tải bài học.' });
  }
};
