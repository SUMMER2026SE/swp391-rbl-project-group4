'use strict';

const { supabaseAdmin } = require('../config/supabase');

// ── Stats ────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [usersRes, coursesRes, vocabRes, quizzesRes] = await Promise.allSettled([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('vocabulary').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('quizzes').select('id', { count: 'exact', head: true }),
    ]);
    const authUsers    = usersRes.status === 'fulfilled' ? (usersRes.value.data?.users || []) : [];
    const teacherCount = authUsers.filter(u => u.user_metadata?.role === 'teacher').length;
    res.json({
      total_users:    usersRes.status    === 'fulfilled' ? (usersRes.value.data?.total || authUsers.length) : 0,
      teacher_count:  teacherCount,
      total_courses:  coursesRes.status  === 'fulfilled' ? (coursesRes.value.count    || 0) : 0,
      total_vocab:    vocabRes.status    === 'fulfilled' ? (vocabRes.value.count       || 0) : 0,
      total_quizzes:  quizzesRes.status  === 'fulfilled' ? (quizzesRes.value.count    || 0) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

// ── Users ────────────────────────────────────────────────────────────────────
exports.listUsers = async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let query = supabaseAdmin.from('users')
      .select('id,full_name,email,phone,avatar_url,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with role from auth.users metadata
    const roleMap = {};
    if (data && data.length > 0) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const ids = new Set(data.map(u => u.id));
      (authData?.users || []).forEach(u => {
        if (ids.has(u.id)) roleMap[u.id] = u.user_metadata?.role || 'student';
      });
    }

    const enriched = (data || []).map(u => ({ ...u, role: roleMap[u.id] || 'student' }));
    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách.' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải dữ liệu.' });
  }
};

exports.updateUser = async (req, res) => {
  const { full_name, phone, role } = req.body;
  try {
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone     !== undefined) updates.phone     = phone;
    await supabaseAdmin.from('users').update(updates).eq('id', req.params.id);
    if (role !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { user_metadata: { role } });
    }
    res.json({ message: 'Đã cập nhật.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    res.json({ message: 'Đã xóa người dùng.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa.' });
  }
};

exports.resetUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
    if (error) throw error;
    res.json({ message: 'Đã đặt lại mật khẩu thành công.' });
  } catch (err) {
    console.error('Reset user password error:', err);
    res.status(500).json({ error: 'Không thể đặt lại mật khẩu.' });
  }
};

// ── Recent Activity ──────────────────────────────────────────────────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id,full_name,email,created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;

    const activity = (data || []).map(u => {
      const name = u.full_name || u.email || 'Người dùng';
      const words = name.trim().split(' ');
      const initials = words.length >= 2
        ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase();
      return { id: u.id, name, initials, action: 'Đã đăng ký tài khoản', time: u.created_at };
    });
    res.json(activity);
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ error: 'Không thể tải hoạt động.' });
  }
};

// ── Courses CRUD ─────────────────────────────────────────────────────────────
exports.listCourses = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;
  try {
    let q = supabaseAdmin.from('courses').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);
    if (search) q = q.ilike('title', `%${search}%`);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.createCourse = async (req, res) => {
  const { title, title_ja, description, description_ja, level, thumbnail_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  try {
    const { data, error } = await supabaseAdmin.from('courses')
      .insert({ title, title_ja, description, description_ja, level, thumbnail_url, created_by: req.user.id })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo khóa học.' }); }
};

exports.updateCourse = async (req, res) => {
  const allowed = ['title','title_ja','description','description_ja','level','thumbnail_url','is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin.from('courses').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteCourse = async (req, res) => {
  try {
    await supabaseAdmin.from('courses').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Lessons CRUD ─────────────────────────────────────────────────────────────
exports.listLessons = async (req, res) => {
  const { course_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let q = supabaseAdmin.from('lessons').select('*', { count: 'exact' })
      .order('order_index').range(offset, offset + Number(limit) - 1);
    if (course_id) q = q.eq('course_id', course_id);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { res.status(500).json({ error: 'Lỗi.' }); }
};

exports.createLesson = async (req, res) => {
  const { course_id, title, title_ja, content, order_index } = req.body;
  if (!course_id || !title) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('lessons')
      .insert({ course_id, title, title_ja, content, order_index: order_index || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài học.' }); }
};

exports.updateLesson = async (req, res) => {
  const allowed = ['title','title_ja','content','order_index','is_published','course_id'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  updates.updated_at = new Date().toISOString();
  try {
    const { data, error } = await supabaseAdmin.from('lessons').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteLesson = async (req, res) => {
  try {
    await supabaseAdmin.from('lessons').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Vocabulary Import ─────────────────────────────────────────────────────────
exports.importVocab = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Dữ liệu phải là một mảng JSON không rỗng.' });
  if (rows.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 từ mỗi lần nhập.' });

  const ALLOWED = ['kanji','reading','meaning_vi','meaning_ja','level','type','topic','example_sentence','lesson_id'];
  const LEVELS  = new Set(['N5','N4','N3','N2','N1']);
  const TYPES   = new Set(['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ']);
  const errors  = [];
  const cleaned = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.reading)    errors.push(`Dòng ${n}: thiếu trường "reading".`);
    if (!row.meaning_vi) errors.push(`Dòng ${n}: thiếu trường "meaning_vi".`);
    if (row.level && !LEVELS.has(row.level))
      errors.push(`Dòng ${n}: level "${row.level}" không hợp lệ (N5/N4/N3/N2/N1).`);
    if (row.type && !TYPES.has(row.type))
      errors.push(`Dòng ${n}: type "${row.type}" không hợp lệ.`);
    const item = {};
    ALLOWED.forEach(k => { if (row[k] !== undefined) item[k] = row[k] || null; });
    cleaned.push(item);
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }

  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').insert(cleaned).select('id');
    if (error) throw error;
    res.status(201).json({ imported: data.length, message: `Đã nhập ${data.length} từ vựng thành công.` });
  } catch (err) {
    console.error('Import vocab error:', err);
    res.status(500).json({ error: 'Không thể nhập từ vựng vào cơ sở dữ liệu.' });
  }
};

// ── Vocabulary CRUD ──────────────────────────────────────────────────────────
exports.createVocab = async (req, res) => {
  const { kanji, reading, meaning_vi, meaning_ja, level, lesson_id, type, topic, example_sentence } = req.body;
  if (!reading || !meaning_vi) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary')
      .insert({ kanji, reading, meaning_vi, meaning_ja, level, lesson_id, type, topic, example_sentence })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo.' }); }
};

exports.updateVocab = async (req, res) => {
  const allowed = ['kanji','reading','meaning_vi','meaning_ja','level','lesson_id','type','topic','example_sentence'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('vocabulary').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteVocab = async (req, res) => {
  try {
    await supabaseAdmin.from('vocabulary').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Kanji Import ──────────────────────────────────────────────────────────────
exports.importKanji = async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'Dữ liệu phải là một mảng JSON không rỗng.' });
  if (rows.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 kanji mỗi lần nhập.' });

  const LEVELS = new Set(['N5','N4','N3','N2','N1']);
  const toArr  = (v) => {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const errors  = [];
  const cleaned = [];

  rows.forEach((row, i) => {
    const n = i + 1;
    if (!row.character)  errors.push(`Dòng ${n}: thiếu trường "character".`);
    if (!row.meaning_vi) errors.push(`Dòng ${n}: thiếu trường "meaning_vi".`);
    if (row.level && !LEVELS.has(row.level))
      errors.push(`Dòng ${n}: level "${row.level}" không hợp lệ (N5/N4/N3/N2/N1).`);
    if (row.stroke_count !== undefined && row.stroke_count !== null && row.stroke_count !== '' && isNaN(Number(row.stroke_count)))
      errors.push(`Dòng ${n}: stroke_count phải là số nguyên.`);
    cleaned.push({
      character:    row.character,
      reading_on:   toArr(row.reading_on),
      reading_kun:  toArr(row.reading_kun),
      meaning_vi:   row.meaning_vi,
      stroke_count: row.stroke_count ? Number(row.stroke_count) : null,
      level:        row.level || null,
      han_viet:     row.han_viet || null,
    });
  });

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join('\n• ');
    const suffix  = errors.length > 5 ? `\n... và ${errors.length - 5} lỗi khác.` : '';
    return res.status(400).json({ error: `Có ${errors.length} lỗi:\n• ${preview}${suffix}` });
  }

  try {
    // upsert on character (UNIQUE) so re-importing updates existing rows instead of failing
    const { data, error } = await supabaseAdmin
      .from('kanji')
      .upsert(cleaned, { onConflict: 'character' })
      .select('id');
    if (error) throw error;
    res.status(201).json({ imported: data.length, message: `Đã nhập ${data.length} kanji thành công.` });
  } catch (err) {
    console.error('Import kanji error:', err);
    res.status(500).json({ error: 'Không thể nhập kanji vào cơ sở dữ liệu.' });
  }
};

// ── Kanji CRUD ───────────────────────────────────────────────────────────────
exports.createKanji = async (req, res) => {
  const { character, reading_on, reading_kun, meaning_vi, stroke_count, level, han_viet } = req.body;
  if (!character || !meaning_vi) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('kanji')
      .insert({ character, reading_on, reading_kun, meaning_vi, stroke_count, level, han_viet })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo.' }); }
};

exports.updateKanji = async (req, res) => {
  const allowed = ['character','reading_on','reading_kun','meaning_vi','stroke_count','level','han_viet'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('kanji').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteKanji = async (req, res) => {
  try {
    await supabaseAdmin.from('kanji').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Question Bank ─────────────────────────────────────────────────────────────
exports.listQuestionBank = async (req, res) => {
  const { level, skill, topic, difficulty, status, question_type, passage_id, listening_passage_id, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.from('question_bank')
      .select('*, reading_passages(id, title), listening_passages(id, title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)               query = query.eq('level', level);
    if (skill)               query = query.eq('skill', skill);
    if (topic)               query = query.ilike('topic', `%${topic}%`);
    if (difficulty)          query = query.eq('difficulty', difficulty);
    if (status)              query = query.eq('status', status);
    if (question_type)       query = query.eq('question_type', question_type);
    if (passage_id)          query = query.eq('passage_id', passage_id);
    if (listening_passage_id) query = query.eq('listening_passage_id', listening_passage_id);
    if (search)              query = query.ilike('question_text', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải câu hỏi.' });
  }
};

exports.questionBankStats = async (req, res) => {
  try {
    const [total, pending, byLevel] = await Promise.all([
      supabaseAdmin.from('question_bank').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('question_bank').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('question_bank').select('level').not('level', 'is', null),
    ]);
    const levelCounts = {};
    (byLevel.data || []).forEach(r => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
    const topLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    res.json({ total: total.count || 0, pending: pending.count || 0, topLevel });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải thống kê.' });
  }
};

exports.createQuestionBank = async (req, res) => {
  const { question_text, options, correct_answer, explanation, level, skill, topic, difficulty, status, is_ai_generated, question_type, passage_id, listening_passage_id } = req.body;
  if (!question_text) return res.status(400).json({ error: 'Nội dung câu hỏi là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('question_bank')
      .insert({ question_text, options: options ?? [], correct_answer, explanation, level, skill, topic, difficulty: difficulty || 'medium', status: 'approved', is_ai_generated: !!is_ai_generated, question_type: question_type || 'single_choice', passage_id: passage_id || null, listening_passage_id: listening_passage_id || null, created_by: req.user?.id })
      .select('*, reading_passages(id, title), listening_passages(id, title)').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestionBank = async (req, res) => {
  const allowed = ['question_text','options','correct_answer','explanation','level','skill','topic','difficulty','status','is_ai_generated','question_type','passage_id','listening_passage_id'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('passage_id' in updates && !updates.passage_id) updates.passage_id = null;
  if ('listening_passage_id' in updates && !updates.listening_passage_id) updates.listening_passage_id = null;
  try {
    const { data, error } = await supabaseAdmin.from('question_bank').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.bulkCreateQuestionBank = async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'Danh sách câu hỏi không được rỗng.' });
  try {
    const rows = questions.map(q => ({
      question_text:  q.question_text,
      question_type:  q.question_type || 'single_choice',
      options:        q.options ?? [],
      correct_answer: q.correct_answer ?? null,
      explanation:    q.explanation   || null,
      level:          q.level         || null,
      skill:          q.skill         || null,
      topic:          q.topic         || null,
      difficulty:     q.difficulty    || 'medium',
      status:         'approved',
      is_ai_generated: true,
      passage_id:           q.passage_id           || null,
      listening_passage_id: q.listening_passage_id || null,
      created_by:           req.user?.id,
    }));
    const { data, error } = await supabaseAdmin.from('question_bank').insert(rows).select();
    if (error) throw error;
    res.status(201).json({ saved: data.length, data });
  } catch (err) { res.status(500).json({ error: 'Không thể lưu câu hỏi.' }); }
};

// JLPT level profiles: kanji range, vocabulary tier, grammar scope
const JLPT_PROFILES = {
  N5: {
    kanji: `~80 kanji cơ bản nhất. Ví dụ: 日月火水木金土山川田人口目耳手足力大小上下中前後右左東西南北語文字書読聞話食飲見来行出入白赤青長古新高安早本名年時分間国外方円万`,
    vocab: `~800 từ tần suất cao nhất. Chỉ dùng từ trong danh sách N5. Tránh hoàn toàn kanji/từ N4 trở lên.`,
    grammar: `は/が/を/に/で/と/も/へ/から/まで, ます/です形, ない形, て形 cơ bản, たい, い/な形容詞, から(原因), ので cơ bản, てください, ましょう`,
    distractor_tip: `Dùng từ N5 quen thuộc khác nhóm (đồ vật, địa điểm, thức ăn). Tránh kanji ngoài N5.`,
  },
  N4: {
    kanji: `~300 kanji (N5 + thêm N4). Ví dụ thêm N4: 友家会社国場道教考使始終立持待知思言開閉止買売明暗冷温急曲直広狭重軽強弱速遅近遠族達様`,
    vocab: `~1500 từ. Kết hợp tự nhiên kanji N4+N5. Có thể dùng する-verb cơ bản, compound nouns đơn giản.`,
    grammar: `て形 mở rộng, ている/てある, conditional (ば/たら/と/なら), passive/causative cơ bản, のに, という, など, ために, ように, てみる, てしまう`,
    distractor_tip: `Sai đáp án nên có đọc giống (どうぐ vs どうぞ) hoặc kanji hình dạng gần (待つ vs持つ). Tránh kanji ngoài N4.`,
  },
  N3: {
    kanji: `~650 kanji (N4+N5 + thêm N3). Ví dụ thêm N3: 族達様的全然最初末以上対同連絡確認各自現場担当実際様々`,
    vocab: `~3750 từ. Bao gồm kango (漢語) phổ biến, する-verb trung cấp, cụm từ cố định đơn giản.`,
    grammar: `passive/causative/potential đầy đủ, ようにする/ようになる, わけ, ばかり, だけ/しか～ない, ても, らしい/ようだ/そうだ phân biệt, てもいい/てはいけない, ために/ように phân biệt`,
    distractor_tip: `Sai đáp án tinh vi hơn: từ cùng nhóm nghĩa nhưng sắc thái khác (悲しい vs 寂しい vs 辛い). Cùng bộ thủ kanji.`,
  },
  N2: {
    kanji: `~1000 kanji (N3+N4+N5 + thêm N2). Ví dụ N2: 義務権利施設環境経済政治文化伝統技術情報設備組織運営管理効果影響判断承認補助`,
    vocab: `~6000 từ. Kango phức tạp, 4-mora compounds, formal/written register, thành ngữ phổ biến.`,
    grammar: `ながら, につれ/にともない, として, に対して, にもかかわらず, てからでないと, をもとに, という形で, に基づいて, をはじめ, に加えて, に際して`,
    distractor_tip: `Sai đáp án cùng cấu trúc ngữ pháp nhưng nghĩa khác (につれ vs にともない). Kanji có âm đọc gần giống. Từ Hán-Nhật dễ nhầm.`,
  },
  N1: {
    kanji: `~2000 kanji (tất cả N2 trở xuống + N1). Kanji hiếm, nhiều âm đọc. Ví dụ N1: 威厳哀愁懸念執念辛抱諮問勅令凌辱斡旋蹂躙逡巡忖度齟齬乖離`,
    vocab: `~10000 từ. Văn học, học thuật, ngôn ngữ chuyên ngành, 慣用句 (thành ngữ), 四字熟語 (tứ tự thành ngữ), lối văn trang trọng.`,
    grammar: `文語 elements, だに/すら/さえ phân biệt, てやまない, に即して, をよぎなくされる, ならでは, ないまでも, とあって, に照らして, をもって(手段/期限)`,
    distractor_tip: `Sai đáp án rất tinh vi: âm đọc khác nhau của cùng kanji, nghĩa gần trong văn học, 四字熟語 tương tự, sắc thái văn phong chính thức vs thông thường.`,
  },
};

const DIFFICULTY_GUIDE = {
  easy: {
    label: 'DỄ',
    vocab_rule: 'Chọn từ/kanji TẦN SUẤT CAO NHẤT trong cấp độ — những từ xuất hiện nhiều nhất trong đề JLPT và sách giáo khoa tiêu chuẩn.',
    question_rule: 'Câu hỏi trực tiếp, không bẫy. Cấu trúc ngữ pháp đơn giản nhất của cấp.',
    distractor_rule: 'Sai đáp án RÕ RÀNG khác biệt — khác nhóm từ loại, hoặc nghĩa hoàn toàn khác. Không dùng distractors gây nhầm lẫn tinh vi.',
  },
  medium: {
    label: 'TRUNG BÌNH',
    vocab_rule: 'Mix từ/kanji phổ biến và ít phổ biến hơn trong cấp độ — chuẩn theo đề thi JLPT thực tế.',
    question_rule: 'Câu hỏi kiểm tra hiểu nghĩa trong ngữ cảnh. Cấu trúc ngữ pháp trung bình của cấp.',
    distractor_rule: 'Sai đáp án gây nhầm lẫn TỰ NHIÊN — âm đọc tương tự, bộ thủ giống, hoặc nghĩa gần nhưng không đúng ngữ cảnh.',
  },
  hard: {
    label: 'KHÓ',
    vocab_rule: 'Chọn từ/kanji TẦN SUẤT THẤP, ít gặp nhất trong cấp — xuất hiện trong đề JLPT phần khó nhất.',
    question_rule: 'Kiểm tra sắc thái nghĩa, cách dùng trong văn cảnh phức tạp. Cấu trúc ngữ pháp phức tạp nhất của cấp.',
    distractor_rule: 'Sai đáp án RẤT TINH VI — cùng bộ thủ kanji, đọc gần giống, nghĩa gần tương đương nhưng khác sắc thái sử dụng.',
  },
};

exports.aiGenerateQuestions = async (req, res) => {
  const { chatCompletion } = require('../config/ai');
  const {
    passage_id, listening_passage_id, custom_content,
    question_types = ['single_choice'],
    count = 5, level, difficulty = 'medium', topic, skill,
  } = req.body;

  if (!passage_id && !listening_passage_id && !custom_content)
    return res.status(400).json({ error: 'Cần cung cấp bài đọc, bài nghe, hoặc nội dung tự do.' });
  if (!Array.isArray(question_types) || !question_types.length)
    return res.status(400).json({ error: 'Chọn ít nhất 1 loại câu hỏi.' });

  let contentText = custom_content || '';
  let passageTitle = '';
  let skillHint = '';

  if (passage_id) {
    const { data: passage, error } = await supabaseAdmin
      .from('reading_passages').select('title, content, image_url').eq('id', passage_id).single();
    if (error || !passage) return res.status(404).json({ error: 'Không tìm thấy bài đọc.' });
    passageTitle = passage.title || '';
    contentText  = passage.content || '';
    if (!contentText && passage.image_url)
      contentText = `[Bài đọc dạng hình ảnh: ${passageTitle}]`;
    skillHint = 'Đây là câu hỏi ĐỌC HIỂU (reading). Tạo câu hỏi kiểm tra khả năng đọc hiểu nội dung.';
  }

  if (listening_passage_id) {
    const { data: lp, error } = await supabaseAdmin
      .from('listening_passages').select('title, transcript, description').eq('id', listening_passage_id).single();
    if (error || !lp) return res.status(404).json({ error: 'Không tìm thấy bài nghe.' });
    passageTitle = lp.title || '';
    contentText  = lp.transcript || lp.description || '';
    if (!contentText) contentText = `[Bài nghe: ${passageTitle}]`;
    skillHint = 'Đây là câu hỏi NGHE HIỂU (listening). Tạo câu hỏi kiểm tra khả năng nghe hiểu. Câu hỏi nên tập trung vào ý chính, chi tiết cụ thể, suy luận từ nội dung nghe.';
  }

  if (!contentText.trim())
    return res.status(400).json({ error: 'Nội dung bài đọc/nghe trống.' });

  // Build JLPT + difficulty context block
  const jlpt    = JLPT_PROFILES[level] || null;
  const diff    = DIFFICULTY_GUIDE[difficulty] || DIFFICULTY_GUIDE.medium;
  const typeLabels = {
    single_choice:   'Chọn 1 đáp án (single_choice)',
    multiple_choice: 'Chọn nhiều đáp án (multiple_choice)',
    matching:        'Nối kết quả (matching)',
    ordering:        'Sắp xếp thứ tự (ordering)',
    fill_blank:      'Điền vào chỗ trống (fill_blank)',
    short_answer:    'Trả lời ngắn (short_answer)',
  };

  const jlptBlock = jlpt
    ? `\n═══ YÊU CẦU JLPT ${level} ═══
• Kanji được phép dùng: ${jlpt.kanji}
• Từ vựng: ${jlpt.vocab}
• Ngữ pháp: ${jlpt.grammar}
• Gợi ý distractor: ${jlpt.distractor_tip}
⚠️  TUYỆT ĐỐI KHÔNG dùng kanji hoặc từ vựng ngoài phạm vi JLPT ${level}.`
    : '';

  const diffBlock = `\n═══ ĐỘ KHÓ: ${diff.label} ═══
• Từ vựng/kanji: ${diff.vocab_rule}
• Câu hỏi: ${diff.question_rule}
• Distractors (đáp án sai): ${diff.distractor_rule}`;

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT tiếng Nhật. Bạn am hiểu sâu về kanji, từ vựng và ngữ pháp theo từng cấp độ JLPT N5→N1.

BẮT BUỘC: Chỉ trả về một mảng JSON hợp lệ [], KHÔNG có văn bản nào khác ngoài JSON.
${jlptBlock}${diffBlock}

═══ SCHEMA JSON CHO TỪNG LOẠI ═══

1. single_choice — Chọn 1 đáp án:
{"question_type":"single_choice","question_text":"___に入る言葉を選んでください。\\n彼女は毎朝___を飲みます。","options":["コーヒー","シャワー","ニュース","テレビ"],"correct_answer":"コーヒー","explanation":"「飲む」は液体に使う動詞。正解はコーヒーのみ液体。"}
• options: đúng 4 phần tử; correct_answer: chính xác bằng 1 option; distractors áp dụng quy tắc độ khó

2. multiple_choice — Chọn nhiều đáp án đúng:
{"question_type":"multiple_choice","question_text":"正しい文をすべて選んでください。","options":["A文","B文","C文","D文"],"correct_answer":["A文","C文"],"explanation":"..."}
• correct_answer: mảng ≥2 options đúng

3. matching — Nối từ với nghĩa:
{"question_type":"matching","question_text":"言葉と意味を正しく結んでください。","options":[{"left":"猫","right":"con mèo"},{"left":"犬","right":"con chó"},{"left":"魚","right":"cá"},{"left":"鳥","right":"con chim"}],"correct_answer":null,"explanation":"..."}
• options: ≥3 cặp {left, right}; tất cả left/right phải THUỘC cấp JLPT yêu cầu

4. ordering — Sắp xếp thứ tự:
{"question_type":"ordering","question_text":"正しい順番に並び替えてください。","options":["公園で","私は","遊びます","友達と"],"correct_answer":["私は","友達と","公園で","遊びます"],"explanation":"語順：主語→目的語/相手→場所→動詞。"}
• options: thứ tự NGẪU NHIÊN (học sinh phải tìm thứ tự đúng)
• correct_answer: thứ tự ĐÚNG của câu/đoạn
• options và correct_answer chứa CÙNG các phần tử, chỉ khác thứ tự

5. fill_blank — Điền vào chỗ trống:
{"question_type":"fill_blank","question_text":"彼は毎日図書館で勉強___います。","options":[],"correct_answer":"して","explanation":"「勉強する」のて形「勉強して」+いる で継続を表す。"}
• question_text: dấu ___ đánh dấu chỗ trống; blank phải kiểm tra điểm ngữ pháp/từ vựng của cấp JLPT

6. short_answer — Trả lời ngắn:
{"question_type":"short_answer","question_text":"「ありがとうございます」のくだけた言い方は何ですか？","options":[],"correct_answer":"ありがとう","explanation":"「ありがとう」は友達や親しい間柄で使うカジュアルな表現。"}
• correct_answer: câu trả lời mẫu ngắn gọn, đúng cấp JLPT`;

  const sourceLabel = listening_passage_id ? `bài nghe "${passageTitle}"` : passage_id ? `bài đọc "${passageTitle}"` : '';
  const userMsg = `Tạo ${count} câu hỏi${sourceLabel ? ` dựa trên ${sourceLabel}` : ''}.
■ Trình độ JLPT: ${level || '(không giới hạn)'} → Chỉ dùng kanji/từ vựng trong phạm vi ${level || 'phù hợp'}
■ Độ khó: ${diff.label} → Áp dụng đúng quy tắc đã nêu
■ Loại câu hỏi (phân bổ đều): ${question_types.map(t => typeLabels[t] || t).join(', ')}${topic ? '\n■ Chủ đề: ' + topic : ''}${skill ? '\n■ Kỹ năng kiểm tra: ' + skill : ''}${skillHint ? '\n■ Lưu ý: ' + skillHint : ''}

NỘI DUNG ĐỂ RA ĐỀ:
${contentText.slice(0, 4000)}

Trả về ĐÚNG mảng JSON ${count} phần tử. KHÔNG thêm text nào khác.`;

  try {
    const result = await chatCompletion(
      [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
      { max_tokens: 4096, temperature: 0.45 }
    );

    const raw = result.choices?.[0]?.message?.content || '';

    // Try to extract JSON array, handle markdown fences
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: 'AI không trả về JSON hợp lệ.', raw: raw.slice(0, 500) });

    let questions;
    try { questions = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Không thể parse JSON từ AI.', raw: raw.slice(0, 300) }); }

    if (!Array.isArray(questions))
      return res.status(502).json({ error: 'AI trả về định dạng không mong đợi.' });

    const enriched = questions
      .filter(q => q.question_text && q.question_type)
      .map(q => ({
        ...q,
        level:                level               || null,
        difficulty:           difficulty          || 'medium',
        topic:                topic               || null,
        skill:                skill               || null,
        passage_id:           passage_id          || null,
        listening_passage_id: listening_passage_id || null,
        status:               'approved',
        is_ai_generated:      true,
      }));

    res.json({ questions: enriched, count: enriched.length, usage: result.usage });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

exports.deleteQuestionBank = async (req, res) => {
  try {
    await supabaseAdmin.from('question_bank').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Reading Passages ──────────────────────────────────────────────────────────
exports.uploadPassageImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('passage-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('passage-images').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải ảnh lên.' }); }
};

exports.listPassages = async (req, res) => {
  try {
    const { data: passages, error } = await supabaseAdmin
      .from('reading_passages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // question count per passage
    const { data: links } = await supabaseAdmin
      .from('question_bank')
      .select('passage_id')
      .not('passage_id', 'is', null);
    const countMap = {};
    (links || []).forEach(r => { countMap[r.passage_id] = (countMap[r.passage_id] || 0) + 1; });

    res.json((passages || []).map(p => ({ ...p, question_count: countMap[p.id] || 0 })));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bài đọc.' }); }
};

exports.createPassage = async (req, res) => {
  const { title, content, image_url, level, topic, source } = req.body;
  if (!content?.trim() && !image_url) return res.status(400).json({ error: 'Bài đọc phải có nội dung text hoặc hình ảnh.' });
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .insert({ title, content: content || null, image_url: image_url || null, level, topic, source, created_by: req.user?.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài đọc.' }); }
};

exports.updatePassage = async (req, res) => {
  const allowed = ['title', 'content', 'image_url', 'level', 'topic', 'source'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('image_url' in updates && !updates.image_url) updates.image_url = null;
  if ('content'   in updates && !updates.content)   updates.content   = null;
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài đọc.' }); }
};

exports.deletePassage = async (req, res) => {
  try {
    const { data: p } = await supabaseAdmin.from('reading_passages').select('image_url').eq('id', req.params.id).single();
    await supabaseAdmin.from('question_bank').update({ passage_id: null }).eq('passage_id', req.params.id);
    await supabaseAdmin.from('reading_passages').delete().eq('id', req.params.id);
    // clean up storage file if present
    if (p?.image_url) {
      const filename = p.image_url.split('/').pop();
      await supabaseAdmin.storage.from('passage-images').remove([filename]);
    }
    res.json({ message: 'Đã xóa bài đọc.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài đọc.' }); }
};

// ── Listening Passages ────────────────────────────────────────────────────────
exports.uploadListeningAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const ext = (req.file.originalname.split('.').pop() || 'mp3').toLowerCase();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  try {
    const { error } = await supabaseAdmin.storage
      .from('listening-passages-audio')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabaseAdmin.storage.from('listening-passages-audio').getPublicUrl(filename);
    res.json({ url: publicUrl });
  } catch (err) { res.status(500).json({ error: 'Không thể tải file âm thanh lên.' }); }
};

exports.listListeningPassages = async (req, res) => {
  try {
    const { data: passages, error } = await supabaseAdmin
      .from('listening_passages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: links } = await supabaseAdmin
      .from('question_bank')
      .select('listening_passage_id')
      .not('listening_passage_id', 'is', null);
    const countMap = {};
    (links || []).forEach(r => { countMap[r.listening_passage_id] = (countMap[r.listening_passage_id] || 0) + 1; });

    res.json((passages || []).map(p => ({ ...p, question_count: countMap[p.id] || 0 })));
  } catch (err) { res.status(500).json({ error: 'Không thể tải bài nghe.' }); }
};

exports.createListeningPassage = async (req, res) => {
  const { title, audio_url, transcript, description, level, topic, source, duration_sec } = req.body;
  if (!audio_url) return res.status(400).json({ error: 'Bài nghe phải có file âm thanh.' });
  try {
    const { data, error } = await supabaseAdmin.from('listening_passages')
      .insert({ title, audio_url, transcript: transcript || null, description: description || null, level, topic, source, duration_sec: duration_sec || null, created_by: req.user?.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài nghe.' }); }
};

exports.updateListeningPassage = async (req, res) => {
  const allowed = ['title', 'audio_url', 'transcript', 'description', 'level', 'topic', 'source', 'duration_sec', 'transcript_segments'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('transcript'   in updates && !updates.transcript)   updates.transcript   = null;
  if ('description'  in updates && !updates.description)  updates.description  = null;
  if ('duration_sec' in updates && !updates.duration_sec) updates.duration_sec = null;
  try {
    const { data, error } = await supabaseAdmin.from('listening_passages')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài nghe.' }); }
};

exports.transcribeListeningPassage = async (req, res) => {
  const { whisperTranscribe } = require('../config/ai');
  const { language } = req.body; // optional: 'ja', 'en', etc.
  try {
    const { data: passage, error } = await supabaseAdmin
      .from('listening_passages').select('audio_url, title').eq('id', req.params.id).single();
    if (error || !passage) return res.status(404).json({ error: 'Không tìm thấy bài nghe.' });
    if (!passage.audio_url) return res.status(400).json({ error: 'Bài nghe chưa có file âm thanh.' });

    // Download audio from storage
    const audioRes = await fetch(passage.audio_url);
    if (!audioRes.ok) throw new Error('Không thể tải file âm thanh từ storage.');
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // Detect mime type from URL extension
    const ext = (passage.audio_url.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
    const mimeMap = { mp3:'audio/mpeg', mp4:'audio/mp4', wav:'audio/wav', ogg:'audio/ogg', webm:'audio/webm', m4a:'audio/x-m4a', aac:'audio/aac' };
    const mimeType = mimeMap[ext] || 'audio/mpeg';

    const result = await whisperTranscribe(audioBuffer, `audio.${ext}`, mimeType, language || 'ja');
    console.log('[Whisper] segments count:', result.segments?.length ?? 0);

    const segments = (result.segments || []).filter(s => s.text);
    const transcript = result.text?.trim() || segments.map(s => s.text).join(' ');

    await supabaseAdmin.from('listening_passages').update({
      transcript_segments: segments,
      transcript,
      transcript_language: result.language || language || 'ja',
    }).eq('id', req.params.id);

    res.json({ segments, transcript, language: result.language || language || 'ja', count: segments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteListeningPassage = async (req, res) => {
  try {
    const { data: p } = await supabaseAdmin.from('listening_passages').select('audio_url').eq('id', req.params.id).single();
    await supabaseAdmin.from('question_bank').update({ listening_passage_id: null }).eq('listening_passage_id', req.params.id);
    await supabaseAdmin.from('listening_passages').delete().eq('id', req.params.id);
    if (p?.audio_url) {
      const filename = p.audio_url.split('/').pop();
      await supabaseAdmin.storage.from('listening-passages-audio').remove([filename]);
    }
    res.json({ message: 'Đã xóa bài nghe.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài nghe.' }); }
};

// ── Content Submissions (teacher → system) ────────────────────────────────────
exports.listSubmissions = async (req, res) => {
  const { type, status = 'pending' } = req.query;
  try {
    const fetchType = async (table, kind) => {
      let q = supabaseAdmin.from(table).select('*').order('updated_at', { ascending: false });
      if (status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(r => ({ ...r, _kind: kind }));
    };
    let rows = [];
    if (!type || type === 'vocab') rows = rows.concat(await fetchType('teacher_vocabulary', 'vocab'));
    if (!type || type === 'kanji') rows = rows.concat(await fetchType('teacher_kanji', 'kanji'));

    // Enrich with teacher name
    const teacherIds = [...new Set(rows.map(r => r.teacher_id))];
    const { data: teachers } = await supabaseAdmin.from('users').select('id,full_name,email').in('id', teacherIds);
    const tMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));
    rows = rows.map(r => ({ ...r, teacher: tMap[r.teacher_id] || { email: r.teacher_id } }));

    res.json(rows);
  } catch (err) {
    console.error('List submissions error:', err);
    res.status(500).json({ error: 'Không thể tải yêu cầu.' });
  }
};

exports.reviewVocab = async (req, res) => {
  const { action, note } = req.body; // action: 'approve' | 'reject'
  try {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('teacher_vocabulary').select('*').eq('id', req.params.id).single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (action === 'approve') {
      const { error: insertErr } = await supabaseAdmin.from('vocabulary').insert({
        kanji: row.kanji, reading: row.reading, meaning_vi: row.meaning_vi,
        meaning_ja: row.meaning_ja, level: row.level, type: row.type,
        example_sentence: row.example_sentence,
      });
      if (insertErr) throw insertErr;
      await supabaseAdmin.from('teacher_vocabulary')
        .update({ status: 'approved', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã duyệt và thêm vào hệ thống.' });
    }
    if (action === 'reject') {
      await supabaseAdmin.from('teacher_vocabulary')
        .update({ status: 'rejected', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã từ chối.' });
    }
    res.status(400).json({ error: 'action phải là approve hoặc reject.' });
  } catch (err) {
    console.error('Review vocab error:', err);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu.' });
  }
};

exports.reviewKanji = async (req, res) => {
  const { action, note } = req.body;
  try {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('teacher_kanji').select('*').eq('id', req.params.id).single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Không tìm thấy.' });

    if (action === 'approve') {
      const { error: insertErr } = await supabaseAdmin.from('kanji').upsert({
        character: row.character, reading_on: row.reading_on, reading_kun: row.reading_kun,
        meaning_vi: row.meaning_vi, stroke_count: row.stroke_count, level: row.level,
      }, { onConflict: 'character' });
      if (insertErr) throw insertErr;
      await supabaseAdmin.from('teacher_kanji')
        .update({ status: 'approved', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã duyệt và thêm vào hệ thống.' });
    }
    if (action === 'reject') {
      await supabaseAdmin.from('teacher_kanji')
        .update({ status: 'rejected', admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      return res.json({ message: 'Đã từ chối.' });
    }
    res.status(400).json({ error: 'action phải là approve hoặc reject.' });
  } catch (err) {
    console.error('Review kanji error:', err);
    res.status(500).json({ error: 'Không thể xử lý yêu cầu.' });
  }
};

// ── Quizzes CRUD ─────────────────────────────────────────────────────────────
exports.createQuiz = async (req, res) => {
  const { title, title_ja, description, course_id, lesson_id, type, time_limit } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề không được để trống.' });
  try {
    const { data, error } = await supabaseAdmin.from('quizzes')
      .insert({ title, title_ja, description, course_id, lesson_id, type: type || 'multiple_choice', time_limit })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo quiz.' }); }
};

exports.updateQuiz = async (req, res) => {
  const allowed = ['title','title_ja','description','course_id','lesson_id','type','time_limit','is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('quizzes').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteQuiz = async (req, res) => {
  try {
    await supabaseAdmin.from('quizzes').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// Get all questions for a quiz (admin, ignores is_published)
exports.listQuizQuestions = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quiz_questions')
      .select('id,question,options,correct_answer,correct_answer_data,question_type,bank_question_id,explanation,order_index')
      .eq('quiz_id', req.params.quizId)
      .order('order_index');
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Không thể tải câu hỏi.' }); }
};

// ── Quiz Questions CRUD ──────────────────────────────────────────────────────
exports.createQuestion = async (req, res) => {
  const {
    quiz_id, question, options, correct_answer, correct_answer_data,
    explanation, order_index, question_type, bank_question_id,
  } = req.body;
  if (!quiz_id) return res.status(400).json({ error: 'Thiếu quiz_id.' });
  const typ = question_type || 'single_choice';
  const needsText = !bank_question_id;
  if (needsText && !question) return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
  try {
    const { data, error } = await supabaseAdmin.from('quiz_questions')
      .insert({
        quiz_id,
        question:             question || null,
        options:              options  || null,
        correct_answer:       correct_answer || null,
        correct_answer_data:  correct_answer_data || null,
        explanation:          explanation || null,
        order_index:          order_index ?? 0,
        question_type:        typ,
        bank_question_id:     bank_question_id || null,
      })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestion = async (req, res) => {
  const allowed = [
    'question','options','correct_answer','correct_answer_data',
    'explanation','order_index','question_type','bank_question_id',
  ];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('quiz_questions').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    await supabaseAdmin.from('quiz_questions').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// Import multiple questions from question bank into a quiz
exports.importFromBank = async (req, res) => {
  const { quizId } = req.params;
  const { question_ids } = req.body; // array of question_bank IDs
  if (!Array.isArray(question_ids) || !question_ids.length)
    return res.status(400).json({ error: 'Không có câu hỏi được chọn.' });
  try {
    // Fetch max order_index for this quiz
    const { data: existing } = await supabaseAdmin
      .from('quiz_questions').select('order_index').eq('quiz_id', quizId).order('order_index', { ascending: false }).limit(1);
    let nextIdx = existing && existing.length ? (existing[0].order_index + 1) : 0;

    // Fetch bank rows
    const { data: bankRows, error: fetchErr } = await supabaseAdmin
      .from('question_bank').select('*').in('id', question_ids);
    if (fetchErr) throw fetchErr;

    const rows = bankRows.map((bq, i) => ({
      quiz_id:            quizId,
      bank_question_id:   bq.id,
      question_type:      bq.question_type || 'single_choice',
      question:           bq.question_text,
      options:            bq.options,
      correct_answer:     typeof bq.correct_answer === 'string' ? bq.correct_answer : null,
      correct_answer_data: typeof bq.correct_answer !== 'string' ? bq.correct_answer : null,
      explanation:        bq.explanation || null,
      order_index:        nextIdx + i,
    }));

    const { data, error } = await supabaseAdmin.from('quiz_questions').insert(rows).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể nhập câu hỏi.' }); }
};
