'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { chatCompletion } = require('../config/ai');
const { JLPT_PROFILES } = require('../utils/questionGen');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTempId(id) {
  return !id || id.startsWith('temp-') || id.startsWith('new-');
}

async function deleteRemovedChildren(table, parentField, parentId, keepIds) {
  const { data: existing } = await supabaseAdmin
    .from(table).select('id').eq(parentField, parentId);
  const toDelete = (existing || [])
    .filter(r => !keepIds.includes(r.id))
    .map(r => r.id);
  if (toDelete.length > 0) {
    await supabaseAdmin.from(table).delete().in('id', toDelete);
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

async function listReadingSets({ page = 1, limit = 20, status, jlpt_level, topic, source_type, search } = {}) {
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('reading_sets')
    .select('id,title,code,jlpt_level,difficulty,topic,short_description,status,source_type,tags,estimated_time_minutes,created_at,updated_at,published_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)      query = query.eq('status', status);
  if (jlpt_level)  query = query.eq('jlpt_level', jlpt_level);
  if (topic)       query = query.ilike('topic', `%${topic}%`);
  if (source_type) query = query.eq('source_type', source_type);
  if (search)      query = query.ilike('title', `%${search}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const ids = (data || []).map(r => r.id);
  let pCounts = {}, qCounts = {};

  if (ids.length > 0) {
    const [{ data: ps }, { data: qs }] = await Promise.all([
      supabaseAdmin.from('rs_passages').select('reading_set_id').in('reading_set_id', ids),
      supabaseAdmin.from('rs_questions').select('reading_set_id').in('reading_set_id', ids),
    ]);
    for (const p of ps || []) pCounts[p.reading_set_id] = (pCounts[p.reading_set_id] || 0) + 1;
    for (const q of qs || []) qCounts[q.reading_set_id] = (qCounts[q.reading_set_id] || 0) + 1;
  }

  return {
    sets: (data || []).map(r => ({
      ...r,
      passage_count:  pCounts[r.id] || 0,
      question_count: qCounts[r.id] || 0,
    })),
    total: count || 0,
    page,
    limit,
  };
}

// ── Get one (full nested) ─────────────────────────────────────────────────────

async function getReadingSet(id) {
  const { data: rs, error } = await supabaseAdmin
    .from('reading_sets').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!rs) return null;

  const { data: passages } = await supabaseAdmin
    .from('rs_passages').select('*').eq('reading_set_id', id).order('sort_order');

  const passageIds = (passages || []).map(p => p.id);
  let questions = [], options = [];

  if (passageIds.length > 0) {
    const [{ data: qs }, { data: opts }] = await Promise.all([
      supabaseAdmin.from('rs_questions').select('*').in('passage_id', passageIds).order('sort_order'),
      supabaseAdmin.from('rs_options').select('*').in('question_id',
        passageIds.length ? passageIds : ['_none']).order('sort_order'),
    ]);
    questions = qs || [];
    // Get options for all questions
    const qIds = questions.map(q => q.id);
    if (qIds.length > 0) {
      const { data: allOpts } = await supabaseAdmin
        .from('rs_options').select('*').in('question_id', qIds).order('sort_order');
      options = allOpts || [];
    }
  }

  const optsByQ = {};
  for (const o of options) {
    if (!optsByQ[o.question_id]) optsByQ[o.question_id] = [];
    optsByQ[o.question_id].push(o);
  }
  const qsByPassage = {};
  for (const q of questions) {
    if (!qsByPassage[q.passage_id]) qsByPassage[q.passage_id] = [];
    qsByPassage[q.passage_id].push({ ...q, options: optsByQ[q.id] || [] });
  }

  return {
    ...rs,
    passages: (passages || []).map(p => ({
      ...p,
      questions: qsByPassage[p.id] || [],
    })),
  };
}

// ── Save (create or full-replace update) ─────────────────────────────────────

async function saveReadingSet(id, data, userId) {
  const isCreate = !id;
  const now = new Date().toISOString();

  const rsPayload = {
    title:                  data.title?.trim() || 'Bài đọc mới',
    code:                   data.code || null,
    jlpt_level:             data.jlpt_level || null,
    difficulty:             data.difficulty || 'medium',
    topic:                  data.topic || null,
    short_description:      data.short_description || null,
    instructions:           data.instructions || null,
    estimated_time_minutes: data.estimated_time_minutes || null,
    source_type:            data.source_type || 'manual',
    status:                 data.status || 'draft',
    tags:                   data.tags || [],
    updated_by:             userId,
    updated_at:             now,
  };

  let rsId = id;
  if (isCreate) {
    rsPayload.created_by = userId;
    const { data: created, error } = await supabaseAdmin
      .from('reading_sets').insert(rsPayload).select('id').single();
    if (error) throw new Error(error.message);
    rsId = created.id;
  } else {
    const { error } = await supabaseAdmin
      .from('reading_sets').update(rsPayload).eq('id', rsId);
    if (error) throw new Error(error.message);
  }

  const passages = data.passages || [];
  const keepPassageIds = [];

  for (let pi = 0; pi < passages.length; pi++) {
    const p = passages[pi];
    const pPayload = {
      reading_set_id: rsId,
      title:          p.title || null,
      content:        p.content || '',
      note:           p.note || null,
      sort_order:     pi,
      needs_review:   p.needs_review || false,
      updated_at:     now,
    };

    let passageId;
    if (isTempId(p.id)) {
      const { data: created, error } = await supabaseAdmin
        .from('rs_passages').insert(pPayload).select('id').single();
      if (error) throw new Error(error.message);
      passageId = created.id;
    } else {
      const { error } = await supabaseAdmin
        .from('rs_passages').update(pPayload).eq('id', p.id).eq('reading_set_id', rsId);
      if (error) throw new Error(error.message);
      passageId = p.id;
    }
    keepPassageIds.push(passageId);

    const questions = p.questions || [];
    const keepQIds = [];

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const qPayload = {
        reading_set_id: rsId,
        passage_id:     passageId,
        question_type:  q.question_type || 'single_choice',
        question_text:  q.question_text || '',
        explanation:    q.explanation || null,
        skill_tags:     q.skill_tags || [],
        sort_order:     qi,
        needs_review:   q.needs_review || false,
        updated_at:     now,
      };

      let qId;
      if (isTempId(q.id)) {
        const { data: created, error } = await supabaseAdmin
          .from('rs_questions').insert(qPayload).select('id').single();
        if (error) throw new Error(error.message);
        qId = created.id;
      } else {
        const { error } = await supabaseAdmin
          .from('rs_questions').update(qPayload).eq('id', q.id);
        if (error) throw new Error(error.message);
        qId = q.id;
      }
      keepQIds.push(qId);

      // Options: always delete-then-reinsert (small N, clean approach)
      await supabaseAdmin.from('rs_options').delete().eq('question_id', qId);
      const opts = (q.options || []).filter(o => o.option_text?.trim());
      if (opts.length > 0) {
        const { error: oErr } = await supabaseAdmin.from('rs_options').insert(
          opts.map((o, oi) => ({
            question_id: qId,
            option_text: o.option_text.trim(),
            is_correct:  o.is_correct || false,
            sort_order:  oi,
          }))
        );
        if (oErr) throw new Error(oErr.message);
      }
    }

    // Remove deleted questions
    if (!isTempId(p.id)) {
      await deleteRemovedChildren('rs_questions', 'passage_id', passageId, keepQIds);
    }
  }

  // Remove deleted passages
  if (!isCreate) {
    await deleteRemovedChildren('rs_passages', 'reading_set_id', rsId, keepPassageIds);
  }

  return rsId;
}

// ── Validate ──────────────────────────────────────────────────────────────────

function validateReadingSet(rs) {
  const errors = [];
  if (!rs.title?.trim()) errors.push('Thiếu tiêu đề bài đọc.');
  if (!rs.jlpt_level)    errors.push('Chưa chọn cấp độ JLPT.');
  if (!rs.passages || rs.passages.length === 0) errors.push('Cần ít nhất 1 đoạn văn.');

  for (let pi = 0; pi < (rs.passages || []).length; pi++) {
    const p = rs.passages[pi];
    const pLabel = `Đoạn ${pi + 1}`;
    if (!p.content?.trim() || p.content.trim().length < 10)
      errors.push(`${pLabel}: Nội dung đoạn văn quá ngắn.`);
    if (!p.questions || p.questions.length === 0)
      errors.push(`${pLabel}: Cần ít nhất 1 câu hỏi.`);

    for (let qi = 0; qi < (p.questions || []).length; qi++) {
      const q = p.questions[qi];
      const qLabel = `${pLabel} · Câu ${qi + 1}`;
      if (!q.question_text?.trim())
        errors.push(`${qLabel}: Thiếu nội dung câu hỏi.`);
      if (['single_choice', 'multiple_choice', 'true_false'].includes(q.question_type)) {
        const opts = q.options || [];
        if (opts.length < 2) errors.push(`${qLabel}: Cần ít nhất 2 lựa chọn.`);
        if (!opts.some(o => o.is_correct)) errors.push(`${qLabel}: Chưa đánh dấu đáp án đúng.`);
        if (q.question_type === 'single_choice' && opts.filter(o => o.is_correct).length > 1)
          errors.push(`${qLabel}: Single choice chỉ được 1 đáp án đúng.`);
      }
    }
  }
  return errors;
}

// ── Publish ───────────────────────────────────────────────────────────────────

async function publishReadingSet(id, userId) {
  const rs = await getReadingSet(id);
  if (!rs) throw Object.assign(new Error('Không tìm thấy.'), { httpStatus: 404 });
  const errors = validateReadingSet(rs);
  if (errors.length > 0)
    throw Object.assign(new Error('Validation thất bại.'), { httpStatus: 422, errors });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('reading_sets')
    .update({ status: 'published', published_at: now, updated_by: userId, updated_at: now })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

async function unpublishReadingSet(id, userId) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('reading_sets')
    .update({ status: 'draft', updated_by: userId, updated_at: now })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Duplicate ─────────────────────────────────────────────────────────────────

async function duplicateReadingSet(id, userId) {
  const rs = await getReadingSet(id);
  if (!rs) throw Object.assign(new Error('Không tìm thấy.'), { httpStatus: 404 });
  const { id: _id, created_at: _c, updated_at: _u, published_at: _p, ...rest } = rs;
  const newRs = {
    ...rest,
    title: rs.title + ' (bản sao)',
    code: null,
    status: 'draft',
    passages: rs.passages.map(({ id: _pid, reading_set_id: _rsid, created_at: _pc, updated_at: _pu, ...p }) => ({
      ...p,
      questions: (p.questions || []).map(({ id: _qid, reading_set_id: _qrs, passage_id: _pp, created_at: _qc, updated_at: _qu, ...q }) => ({
        ...q,
        options: (q.options || []).map(({ id: _oid, question_id: _oq, ...o }) => o),
      })),
    })),
  };
  return saveReadingSet(null, newRs, userId);
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteReadingSet(id) {
  const { error } = await supabaseAdmin.from('reading_sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Draft snapshots ───────────────────────────────────────────────────────────

async function saveDraftSnapshot(readingSetId, snapshot, userId) {
  // Keep at most 5 snapshots per set
  const { data: existing } = await supabaseAdmin
    .from('rs_drafts').select('id').eq('reading_set_id', readingSetId)
    .order('created_at', { ascending: false });
  if ((existing || []).length >= 5) {
    const toDelete = existing.slice(4).map(r => r.id);
    if (toDelete.length) await supabaseAdmin.from('rs_drafts').delete().in('id', toDelete);
  }
  const { error } = await supabaseAdmin.from('rs_drafts').insert({
    reading_set_id: readingSetId, snapshot, created_by: userId,
  });
  if (error) throw new Error(error.message);
}

async function getLatestDraft(readingSetId) {
  const { data, error } = await supabaseAdmin
    .from('rs_drafts').select('*').eq('reading_set_id', readingSetId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ── AI Generate full reading set ──────────────────────────────────────────────

async function aiGenerateReadingSet({ jlpt_level, topic, passage_count = 1, questions_per_passage = 5, question_types = ['single_choice'], custom_instructions = '' }) {
  const jlpt = JLPT_PROFILES[jlpt_level] || JLPT_PROFILES['N4'];
  const qtLabels = {
    single_choice:   'Chọn 1 đáp án đúng (4 lựa chọn)',
    multiple_choice: 'Chọn nhiều đáp án đúng',
    fill_blank:      'Điền vào chỗ trống',
    short_answer:    'Trả lời ngắn',
    true_false:      'Đúng/Sai',
  };

  const SYSTEM = `Bạn là chuyên gia biên soạn bài đọc JLPT. Nhiệm vụ: tạo bộ bài đọc hoàn chỉnh theo đúng schema JSON.

JLPT ${jlpt_level} CONSTRAINTS:
• Kanji: ${jlpt.kanji}
• Từ vựng: ${jlpt.vocab}
• Ngữ pháp: ${jlpt.grammar}
• Distractor tip: ${jlpt.distractor_tip}

OUTPUT SCHEMA (JSON object chính xác, không có text ngoài JSON):
{
  "title": "string - tiêu đề bộ bài đọc (tiếng Việt)",
  "short_description": "string - mô tả ngắn (tiếng Việt)",
  "instructions": "string - hướng dẫn làm bài (tiếng Việt)",
  "passages": [
    {
      "title": "string | null",
      "content": "string - đoạn văn tiếng Nhật phù hợp cấp ${jlpt_level}",
      "questions": [
        {
          "question_type": "single_choice",
          "question_text": "string - câu hỏi",
          "explanation": "string - giải thích đáp án bằng tiếng Việt",
          "options": [
            { "option_text": "string", "is_correct": false },
            { "option_text": "string", "is_correct": false },
            { "option_text": "string", "is_correct": false },
            { "option_text": "string", "is_correct": true }
          ]
        }
      ]
    }
  ]
}

RULES:
- single_choice: đúng 4 options, đúng 1 is_correct=true
- fill_blank: question_text chứa ___ là chỗ trống, options=[], explanation chứa đáp án
- short_answer: options=[]
- Giải thích bằng tiếng Việt, câu hỏi bằng tiếng Nhật
- Đoạn văn phải tự nhiên, phù hợp cấp ${jlpt_level}`;

  const userMsg = `Tạo bộ bài đọc JLPT ${jlpt_level}:
■ Chủ đề: ${topic || 'tổng hợp (chọn chủ đề phù hợp với cấp)'}
■ Số đoạn văn: ${passage_count}
■ Số câu hỏi mỗi đoạn: ${questions_per_passage}
■ Dạng câu hỏi: ${question_types.map(t => qtLabels[t] || t).join(', ')}
${custom_instructions ? '■ Yêu cầu thêm: ' + custom_instructions : ''}

Trả về ĐÚNG JSON object theo schema trên, không thêm text nào khác.`;

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    { max_tokens: 6000, temperature: 0.35 }
  );

  const raw = result.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    const e = new Error('AI không trả về JSON hợp lệ.');
    e.httpStatus = 502; e.raw = raw.slice(0, 500);
    throw e;
  }

  let parsed;
  try { parsed = JSON.parse(match[0]); }
  catch {
    const e = new Error('Không thể parse JSON từ AI.');
    e.httpStatus = 502; e.raw = raw.slice(0, 300);
    throw e;
  }

  return {
    ...parsed,
    jlpt_level,
    difficulty: 'medium',
    source_type: 'ai_generated',
    status: 'draft',
  };
}

// ── Export / Import ───────────────────────────────────────────────────────────

async function exportReadingSet(id) {
  const rs = await getReadingSet(id);
  if (!rs) throw Object.assign(new Error('Không tìm thấy.'), { httpStatus: 404 });
  // Strip internal IDs for clean export
  const { created_by, updated_by, created_at, updated_at, published_at, ...meta } = rs;
  return {
    _format: 'kizuna_reading_set_v1',
    exported_at: new Date().toISOString(),
    ...meta,
    id: undefined,
    passages: rs.passages.map(({ id: _pid, reading_set_id: _rsid, created_at: _pc, updated_at: _pu, ...p }) => ({
      ...p,
      questions: (p.questions || []).map(({ id: _qid, reading_set_id: _qrs, passage_id: _pp, created_at: _qc, updated_at: _qu, ...q }) => ({
        ...q,
        options: (q.options || []).map(({ id: _oid, question_id: _oq, ...o }) => o),
      })),
    })),
  };
}

function normalizeImport(json) {
  const { _format, exported_at, id, created_at, updated_at, published_at, ...rs } = json;
  return {
    ...rs,
    status: 'draft',
    source_type: 'imported',
    passages: (rs.passages || []).map((p, pi) => {
      const { id: _pid, reading_set_id: _rsid, created_at: _pc, updated_at: _pu, ...pp } = p;
      return {
        ...pp,
        sort_order: pi,
        questions: (p.questions || []).map((q, qi) => {
          const { id: _qid, reading_set_id: _qrs, passage_id: _pp2, created_at: _qc, updated_at: _qu, ...qq } = q;
          return {
            ...qq,
            sort_order: qi,
            options: (q.options || []).map((o, oi) => {
              const { id: _oid, question_id: _oq, ...oo } = o;
              return { ...oo, sort_order: oi };
            }),
          };
        }),
      };
    }),
  };
}

module.exports = {
  listReadingSets,
  getReadingSet,
  saveReadingSet,
  validateReadingSet,
  publishReadingSet,
  unpublishReadingSet,
  duplicateReadingSet,
  deleteReadingSet,
  saveDraftSnapshot,
  getLatestDraft,
  aiGenerateReadingSet,
  exportReadingSet,
  normalizeImport,
};
