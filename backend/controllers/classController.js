'use strict';

const { supabaseAdmin } = require('../config/supabase');

// ── Teacher: manage own classes ───────────────────────────────────────────────

exports.listMyClasses = async (req, res) => {
  try {
    const { data: classes, error } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!classes || classes.length === 0) return res.json([]);

    const classIds = classes.map(c => c.id);
    const { data: enrollments } = await supabaseAdmin
      .from('class_enrollments')
      .select('class_id, status')
      .in('class_id', classIds);

    const counts = {};
    (enrollments || []).forEach(e => {
      if (!counts[e.class_id]) counts[e.class_id] = { total: 0, active: 0 };
      counts[e.class_id].total++;
      if (e.status === 'active') counts[e.class_id].active++;
    });

    res.json(classes.map(c => ({ ...c, student_count: counts[c.id]?.active || 0 })));
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh sách lớp.' });
  }
};

exports.createClass = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên lớp là bắt buộc.' });
  try {
    const { data, error } = await supabaseAdmin.from('classes')
      .insert({ name, description, teacher_id: req.user.id })
      .select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể tạo lớp.' });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('classes').select('teacher_id').eq('id', req.params.id).single();
    if (!existing || existing.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const allowed = ['name','description','is_active'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('classes').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật lớp.' });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('classes').select('teacher_id').eq('id', req.params.id).single();
    if (!existing || existing.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    await supabaseAdmin.from('classes').delete().eq('id', req.params.id);
    res.json({ message: 'Đã xóa lớp.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể xóa lớp.' });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const { data: cls } = await supabaseAdmin.from('classes').select('teacher_id').eq('id', req.params.id).single();
    if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });

    const { data: enrollments, error } = await supabaseAdmin
      .from('class_enrollments')
      .select('id, student_id, status, enrolled_at')
      .eq('class_id', req.params.id)
      .order('enrolled_at', { ascending: false });
    if (error) throw error;

    const studentIds = (enrollments || []).map(e => e.student_id);
    if (studentIds.length === 0) return res.json([]);

    const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email, avatar_url').in('id', studentIds);
    const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    res.json((enrollments || []).map(e => ({ ...e, student: uMap[e.student_id] || { email: e.student_id } })));
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh sách học viên.' });
  }
};

exports.updateEnrollmentStatus = async (req, res) => {
  const { status } = req.body;
  if (!['active','inactive'].includes(status)) return res.status(400).json({ error: 'status phải là active hoặc inactive.' });
  try {
    const { data: enrollment } = await supabaseAdmin.from('class_enrollments').select('class_id').eq('id', req.params.enrollmentId).single();
    if (!enrollment) return res.status(404).json({ error: 'Không tìm thấy.' });
    const { data: cls } = await supabaseAdmin.from('classes').select('teacher_id').eq('id', enrollment.class_id).single();
    if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'Không có quyền.' });
    const { data, error } = await supabaseAdmin.from('class_enrollments').update({ status }).eq('id', req.params.enrollmentId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

// ── Student: join / view classes ──────────────────────────────────────────────

exports.joinClass = async (req, res) => {
  const { enrollment_key } = req.body;
  if (!enrollment_key) return res.status(400).json({ error: 'Vui lòng nhập mã lớp.' });
  try {
    const { data: cls, error: clsErr } = await supabaseAdmin
      .from('classes')
      .select('id, name, teacher_id, is_active')
      .eq('enrollment_key', enrollment_key.trim().toUpperCase())
      .single();
    if (clsErr || !cls) return res.status(404).json({ error: 'Mã lớp không hợp lệ.' });
    if (!cls.is_active) return res.status(400).json({ error: 'Lớp này hiện không hoạt động.' });

    const { data: existing } = await supabaseAdmin.from('class_enrollments')
      .select('id, status').eq('class_id', cls.id).eq('student_id', req.user.id).single();
    if (existing) {
      if (existing.status === 'active') return res.status(400).json({ error: 'Bạn đã tham gia lớp này rồi.' });
      await supabaseAdmin.from('class_enrollments').update({ status: 'active' }).eq('id', existing.id);
      return res.json({ message: `Đã tham gia lại lớp "${cls.name}".` });
    }

    await supabaseAdmin.from('class_enrollments').insert({ class_id: cls.id, student_id: req.user.id });
    res.status(201).json({ message: `Đã tham gia lớp "${cls.name}".` });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tham gia lớp.' });
  }
};

exports.listMyEnrollments = async (req, res) => {
  try {
    const { data: enrollments, error } = await supabaseAdmin
      .from('class_enrollments')
      .select('id, class_id, status, enrolled_at')
      .eq('student_id', req.user.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false });
    if (error) throw error;

    const classIds = (enrollments || []).map(e => e.class_id);
    if (classIds.length === 0) return res.json([]);

    const { data: classes } = await supabaseAdmin.from('classes').select('id, name, description, teacher_id, is_active').in('id', classIds);
    const teacherIds = [...new Set((classes || []).map(c => c.teacher_id))];
    const { data: teachers } = await supabaseAdmin.from('users').select('id, full_name').in('id', teacherIds);
    const tMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));
    const cMap = Object.fromEntries((classes || []).map(c => ({ ...c, teacher: tMap[c.teacher_id] })).map(c => [c.id, c]));

    res.json((enrollments || []).map(e => ({ ...e, class: cMap[e.class_id] })));
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải lớp học.' });
  }
};

exports.leaveClass = async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin.from('class_enrollments')
      .select('id').eq('class_id', req.params.id).eq('student_id', req.user.id).single();
    if (!existing) return res.status(404).json({ error: 'Bạn chưa tham gia lớp này.' });
    await supabaseAdmin.from('class_enrollments').update({ status: 'inactive' }).eq('id', existing.id);
    res.json({ message: 'Đã rời khỏi lớp.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể rời lớp.' });
  }
};

// ── Admin: view all classes ────────────────────────────────────────────────────

exports.adminListClasses = async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  try {
    let q = supabaseAdmin.from('classes').select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data: classes, error, count } = await q;
    if (error) throw error;

    const teacherIds = [...new Set((classes || []).map(c => c.teacher_id))];
    const { data: teachers } = teacherIds.length > 0
      ? await supabaseAdmin.from('users').select('id,full_name,email').in('id', teacherIds)
      : { data: [] };
    const tMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));

    const classIds = (classes || []).map(c => c.id);
    const { data: enrollments } = classIds.length > 0
      ? await supabaseAdmin.from('class_enrollments').select('class_id, status').in('class_id', classIds)
      : { data: [] };
    const eCounts = {};
    (enrollments || []).forEach(e => {
      if (!eCounts[e.class_id]) eCounts[e.class_id] = 0;
      if (e.status === 'active') eCounts[e.class_id]++;
    });

    res.json({
      data: (classes || []).map(c => ({ ...c, teacher: tMap[c.teacher_id] || {}, student_count: eCounts[c.id] || 0 })),
      total: count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải danh sách lớp.' });
  }
};

exports.adminGetClassDetail = async (req, res) => {
  try {
    const { data: cls, error } = await supabaseAdmin.from('classes').select('*').eq('id', req.params.id).single();
    if (error || !cls) return res.status(404).json({ error: 'Không tìm thấy lớp.' });

    const { data: teacher } = await supabaseAdmin.from('users').select('id,full_name,email').eq('id', cls.teacher_id).single();
    const { data: enrollments } = await supabaseAdmin
      .from('class_enrollments').select('id,student_id,status,enrolled_at').eq('class_id', cls.id).order('enrolled_at', { ascending: false });

    const studentIds = (enrollments || []).map(e => e.student_id);
    const { data: students } = studentIds.length > 0
      ? await supabaseAdmin.from('users').select('id,full_name,email,avatar_url').in('id', studentIds)
      : { data: [] };
    const sMap = Object.fromEntries((students || []).map(s => [s.id, s]));

    res.json({
      ...cls,
      teacher: teacher || {},
      enrollments: (enrollments || []).map(e => ({ ...e, student: sMap[e.student_id] || {} })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Không thể tải chi tiết lớp.' });
  }
};
