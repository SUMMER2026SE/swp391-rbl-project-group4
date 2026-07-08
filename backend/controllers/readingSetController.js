'use strict';

const svc = require('../services/readingSetService');

// ── Admin: list ───────────────────────────────────────────────────────────────

async function adminList(req, res) {
  try {
    const { page, limit, status, jlpt_level, topic, source_type, search } = req.query;
    const result = await svc.listReadingSets({
      page:        parseInt(page || '1', 10),
      limit:       Math.min(50, parseInt(limit || '20', 10)),
      status:      status || undefined,
      jlpt_level:  jlpt_level || undefined,
      topic:       topic || undefined,
      source_type: source_type || undefined,
      search:      search?.trim() || undefined,
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: get one (full nested) ──────────────────────────────────────────────

async function adminGetOne(req, res) {
  try {
    const rs = await svc.getReadingSet(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Không tìm thấy.' });
    res.json({ readingSet: rs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: create ─────────────────────────────────────────────────────────────

async function create(req, res) {
  try {
    const id = await svc.saveReadingSet(null, req.body, req.user.id);
    const rs = await svc.getReadingSet(id);
    res.status(201).json({ readingSet: rs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: update (full replace) ──────────────────────────────────────────────

async function update(req, res) {
  try {
    await svc.saveReadingSet(req.params.id, req.body, req.user.id);
    const rs = await svc.getReadingSet(req.params.id);
    res.json({ readingSet: rs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: delete ─────────────────────────────────────────────────────────────

async function remove(req, res) {
  try {
    await svc.deleteReadingSet(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: publish ────────────────────────────────────────────────────────────

async function publish(req, res) {
  try {
    await svc.publishReadingSet(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    const status = err.httpStatus || 500;
    res.status(status).json({ error: err.message, errors: err.errors });
  }
}

// ── Admin: unpublish ──────────────────────────────────────────────────────────

async function unpublish(req, res) {
  try {
    await svc.unpublishReadingSet(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: duplicate ──────────────────────────────────────────────────────────

async function duplicate(req, res) {
  try {
    const newId = await svc.duplicateReadingSet(req.params.id, req.user.id);
    const rs = await svc.getReadingSet(newId);
    res.json({ readingSet: rs });
  } catch (err) {
    const status = err.httpStatus || 500;
    res.status(status).json({ error: err.message });
  }
}

// ── Admin: validate ───────────────────────────────────────────────────────────

async function validate(req, res) {
  try {
    const rs = req.body; // full reading set JSON from client
    const errors = svc.validateReadingSet(rs);
    res.json({ valid: errors.length === 0, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: AI generate ────────────────────────────────────────────────────────

async function aiGenerate(req, res) {
  try {
    const { jlpt_level, topic, passage_count, questions_per_passage, question_types, custom_instructions } = req.body;
    if (!jlpt_level) return res.status(400).json({ error: 'jlpt_level là bắt buộc.' });

    const draft = await svc.aiGenerateReadingSet({
      jlpt_level,
      topic,
      passage_count:         Math.min(3, Math.max(1, parseInt(passage_count || '1', 10))),
      questions_per_passage: Math.min(10, Math.max(1, parseInt(questions_per_passage || '5', 10))),
      question_types:        question_types || ['single_choice'],
      custom_instructions:   custom_instructions || '',
    });
    res.json({ draft });
  } catch (err) {
    const status = err.httpStatus || 500;
    res.status(status).json({ error: err.message, raw: err.raw });
  }
}

// ── Admin: draft snapshot ─────────────────────────────────────────────────────

async function saveDraft(req, res) {
  try {
    await svc.saveDraftSnapshot(req.params.id, req.body.snapshot, req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getDraft(req, res) {
  try {
    const draft = await svc.getLatestDraft(req.params.id);
    res.json({ draft });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Admin: export ─────────────────────────────────────────────────────────────

async function exportSet(req, res) {
  try {
    const data = await svc.exportReadingSet(req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="reading-set-${req.params.id.slice(0, 8)}.json"`);
    res.json(data);
  } catch (err) {
    const status = err.httpStatus || 500;
    res.status(status).json({ error: err.message });
  }
}

// ── Admin: import ─────────────────────────────────────────────────────────────

async function importSet(req, res) {
  try {
    const normalized = svc.normalizeImport(req.body);
    const id = await svc.saveReadingSet(null, normalized, req.user.id);
    const rs = await svc.getReadingSet(id);
    res.status(201).json({ readingSet: rs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Student: list published ───────────────────────────────────────────────────

async function studentList(req, res) {
  try {
    const { page, jlpt_level, topic, search } = req.query;
    const result = await svc.listReadingSets({
      page:       parseInt(page || '1', 10),
      limit:      12,
      status:     'published',
      jlpt_level: jlpt_level || undefined,
      topic:      topic || undefined,
      search:     search?.trim() || undefined,
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Student: get one published ────────────────────────────────────────────────

async function studentGetOne(req, res) {
  try {
    const rs = await svc.getReadingSet(req.params.id);
    if (!rs) return res.status(404).json({ error: 'Không tìm thấy.' });
    if (rs.status !== 'published') return res.status(403).json({ error: 'Bài đọc chưa được công bố.' });
    res.json({ readingSet: rs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = {
  adminList, adminGetOne, create, update, remove,
  publish, unpublish, duplicate, validate,
  aiGenerate, saveDraft, getDraft, exportSet, importSet,
  studentList, studentGetOne,
};
