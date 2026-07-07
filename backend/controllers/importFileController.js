'use strict';

// Preview bulk import file (Word/Excel/CSV/JSON) cho trình soạn Mục — chỉ parse
// (+ AI fallback khi dữ liệu lộn xộn), KHÔNG ghi DB. Bước xác nhận dùng lại các
// endpoint import JSON hiện có (/vocabulary/import, /kanji/import,
// /grammar-points/import) với lesson_id trên từng dòng.

const { parseImportFile } = require('../utils/fileImportParser');

const TYPE_LABEL = { vocab: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };

const previewImportFile = (type) => async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn file.' });
  try {
    const { items, source, warnings } = await parseImportFile({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      type,
    });
    const changed = items.filter(i => i._changed).length;
    const summary = source === 'ai'
      ? `AI đã trích xuất ${items.length} ${TYPE_LABEL[type]}` + (changed ? ` (chỉnh sửa/suy ra ${changed} mục).` : '.')
      : `Đã đọc ${items.length} ${TYPE_LABEL[type]} từ file.`;
    res.json({ items, source, warnings, summary });
  } catch (err) {
    if (!err.status) console.error('previewImportFile error:', err);
    res.status(err.status || 500).json({
      error: err.status ? err.message : 'Không thể đọc file. Vui lòng kiểm tra định dạng.',
    });
  }
};

exports.previewVocabFile   = previewImportFile('vocab');
exports.previewKanjiFile   = previewImportFile('kanji');
exports.previewGrammarFile = previewImportFile('grammar');
