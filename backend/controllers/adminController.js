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
  const { level, skill, topic, difficulty, status, question_type, passage_id, search, page = 1, limit = 15 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let query = supabaseAdmin.from('question_bank')
      .select('*, reading_passages(id, title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (level)         query = query.eq('level', level);
    if (skill)         query = query.eq('skill', skill);
    if (topic)         query = query.ilike('topic', `%${topic}%`);
    if (difficulty)    query = query.eq('difficulty', difficulty);
    if (status)        query = query.eq('status', status);
    if (question_type) query = query.eq('question_type', question_type);
    if (passage_id)    query = query.eq('passage_id', passage_id);
    if (search)        query = query.ilike('question_text', `%${search}%`);

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
  const { question_text, options, correct_answer, explanation, level, skill, topic, difficulty, status, is_ai_generated, question_type, passage_id } = req.body;
  if (!question_text) return res.status(400).json({ error: 'Nội dung câu hỏi là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('question_bank')
      .insert({ question_text, options: options ?? [], correct_answer, explanation, level, skill, topic, difficulty: difficulty || 'medium', status: status || 'pending', is_ai_generated: !!is_ai_generated, question_type: question_type || 'single_choice', passage_id: passage_id || null, created_by: req.user?.id })
      .select('*, reading_passages(id, title)').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestionBank = async (req, res) => {
  const allowed = ['question_text','options','correct_answer','explanation','level','skill','topic','difficulty','status','is_ai_generated','question_type','passage_id'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if ('passage_id' in updates && !updates.passage_id) updates.passage_id = null;
  try {
    const { data, error } = await supabaseAdmin.from('question_bank').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật.' }); }
};

exports.deleteQuestionBank = async (req, res) => {
  try {
    await supabaseAdmin.from('question_bank').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa.' }); }
};

// ── Reading Passages ──────────────────────────────────────────────────────────
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
  const { title, content, level, topic, source } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Nội dung bài đọc là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .insert({ title, content, level, topic, source, created_by: req.user?.id })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, question_count: 0 });
  } catch (err) { res.status(500).json({ error: 'Không thể tạo bài đọc.' }); }
};

exports.updatePassage = async (req, res) => {
  const allowed = ['title', 'content', 'level', 'topic', 'source'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabaseAdmin.from('reading_passages')
      .update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể cập nhật bài đọc.' }); }
};

exports.deletePassage = async (req, res) => {
  try {
    // unlink questions before deleting
    await supabaseAdmin.from('question_bank').update({ passage_id: null }).eq('passage_id', req.params.id);
    await supabaseAdmin.from('reading_passages').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa bài đọc.' });
  } catch (err) { res.status(500).json({ error: 'Không thể xóa bài đọc.' }); }
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

// ── Quiz Questions CRUD ──────────────────────────────────────────────────────
exports.createQuestion = async (req, res) => {
  const { quiz_id, question, options, correct_answer, explanation, order_index } = req.body;
  if (!quiz_id || !question || !correct_answer) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('quiz_questions')
      .insert({ quiz_id, question, options, correct_answer, explanation, order_index: order_index || 0 })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: 'Không thể tạo câu hỏi.' }); }
};

exports.updateQuestion = async (req, res) => {
  const allowed = ['question','options','correct_answer','explanation','order_index'];
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
