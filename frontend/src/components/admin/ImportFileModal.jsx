import { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import api from '../../lib/api';

// Modal "Nhập file" cho trình soạn Mục (vocab / kanji / grammar), dùng chung
// admin + teacher qua apiBase. Flow: chọn file (.json/.csv/.xlsx/.xls/.docx)
// → POST {apiBase}/lessons/{lessonId}/{slug}/import-file (preview, chưa ghi DB)
// → bảng preview cho sửa tay / xóa dòng (dòng AI sửa được đánh dấu)
// → Xác nhận → POST {apiBase}/{slug}/import với lesson_id trên từng dòng.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const TYPE_CONFIG = {
  vocab: {
    slug: 'vocabulary',
    label: 'từ vựng',
    columns: [
      { key: 'kanji',            label: 'Kanji' },
      { key: 'reading',          label: 'Reading',  required: true },
      { key: 'meaning_vi',       label: 'Nghĩa VI', required: true },
      { key: 'level',            label: 'Level',    select: LEVELS },
      { key: 'example_sentence', label: 'Ví dụ' },
    ],
    hint: 'Cột hỗ trợ: kanji, reading (cách đọc), meaning_vi (nghĩa), meaning_ja, level, type (loại từ), topic, example_sentence (ví dụ). Chấp nhận tên cột tiếng Việt/Anh.',
  },
  kanji: {
    slug: 'kanji',
    label: 'kanji',
    columns: [
      { key: 'character',   label: 'Kanji',    required: true },
      { key: 'reading_on',  label: 'On-yomi' },
      { key: 'reading_kun', label: 'Kun-yomi' },
      { key: 'meaning_vi',  label: 'Nghĩa VI', required: true },
      { key: 'han_viet',    label: 'Hán Việt' },
      { key: 'level',       label: 'Level',    select: LEVELS },
    ],
    hint: 'Cột hỗ trợ: character (chữ hán), reading_on (âm on), reading_kun (âm kun), meaning_vi (nghĩa), stroke_count (số nét), han_viet, level. Nhiều cách đọc cách nhau bằng dấu phẩy.',
  },
  grammar: {
    slug: 'grammar-points',
    label: 'ngữ pháp',
    columns: [
      { key: 'title',       label: 'Cấu trúc', required: true },
      { key: 'meaning_vi',  label: 'Ý nghĩa',  required: true },
      { key: 'explanation', label: 'Giải thích' },
      { key: 'level',       label: 'Level',    select: LEVELS },
    ],
    hint: 'Cột hỗ trợ: title (cấu trúc/mẫu câu), title_ja, meaning_vi (ý nghĩa), explanation (giải thích), example_sentence (ví dụ), level.',
  },
};

// Kanji: AI có thể trả reading_on/kun dạng mảng — hiển thị và gửi dạng chuỗi
// "a, b" (backend importKanji tự tách lại thành mảng).
const flattenArrays = (item) =>
  Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));

export default function ImportFileModal({ open, onClose, type, lessonId, apiBase, onImported }) {
  const cfg = TYPE_CONFIG[type];
  const fileRef = useRef(null);

  const [parsing, setParsing]     = useState(false);
  const [items, setItems]         = useState(null);   // preview rows (sửa được)
  const [source, setSource]       = useState('direct');
  const [warnings, setWarnings]   = useState([]);
  const [summary, setSummary]     = useState('');
  const [error, setError]         = useState('');
  const [importing, setImporting] = useState(false);
  const [showHint, setShowHint]   = useState(false);

  const reset = () => {
    setItems(null); setSource('direct'); setWarnings([]); setSummary('');
    setError(''); setParsing(false); setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(''); setItems(null); setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(
        `${apiBase}/lessons/${lessonId}/${cfg.slug}/import-file`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setItems((r.data.items || []).map(flattenArrays));
      setSource(r.data.source || 'direct');
      setWarnings(r.data.warnings || []);
      setSummary(r.data.summary || '');
    } catch (err) {
      setError(err.message);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setParsing(false);
    }
  };

  const updateCell = (rowIdx, key, value) =>
    setItems(list => list.map((it, i) => (i === rowIdx ? { ...it, [key]: value } : it)));

  const removeRow = (rowIdx) =>
    setItems(list => list.filter((_, i) => i !== rowIdx));

  const invalidCount = (items || []).filter(it =>
    cfg.columns.some(col => col.required && !String(it[col.key] || '').trim())
  ).length;

  const handleImport = async () => {
    setImporting(true); setError('');
    try {
      const payload = items.map(({ _notes, _changed, ...rest }) => ({ ...rest, lesson_id: lessonId }));
      const r = await api.post(`${apiBase}/${cfg.slug}/import`, payload);
      onImported?.(r.data.message || `Đã nhập ${items.length} ${cfg.label}.`);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Nhập ${cfg.label} từ file`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Đóng</Button>
          {items && (
            <Button variant="secondary" onClick={reset}>
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Chọn file khác
            </Button>
          )}
          {items && (
            <Button loading={importing} disabled={items.length === 0 || invalidCount > 0 || importing} onClick={handleImport}>
              <span className="material-symbols-outlined text-base">upload</span>
              Nhập {items.length} {cfg.label} vào bài
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Hướng dẫn cột */}
        <div className="rounded-xl border border-outline overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHint(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-low hover:bg-surface text-sm font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-tsubaki-red">description</span>
              Định dạng hỗ trợ: .xlsx / .xls / .csv / .docx / .json
            </span>
            <span className="material-symbols-outlined text-lg text-on-muted">
              {showHint ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {showHint && (
            <div className="px-4 py-3 bg-white text-xs text-on-muted space-y-1.5">
              <p>{cfg.hint}</p>
              <p>
                File Excel/CSV cần dòng đầu là tên cột; file Word nên chứa bảng. Nếu nội dung lộn xộn
                (thiếu cột, gộp thông tin), hệ thống sẽ tự nhờ AI trích xuất — các dòng do AI sửa sẽ được
                đánh dấu để bạn kiểm tra lại. Tối đa 500 dòng mỗi lần nhập.
              </p>
            </div>
          )}
        </div>

        {/* Chọn file */}
        {!items && (
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-outline rounded-xl transition-colors
            ${parsing ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:border-tsubaki-red hover:bg-tsubaki-red/5'}`}>
            {parsing ? (
              <>
                <span className="material-symbols-outlined animate-spin text-3xl text-tsubaki-red mb-1">progress_activity</span>
                <span className="text-sm text-on-muted">Đang đọc file... (có thể mất 10–30 giây nếu cần AI)</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-3xl text-on-muted mb-1">upload_file</span>
                <span className="text-sm text-on-muted">Kéo thả hoặc nhấn để chọn file</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.xlsx,.xls,.docx"
              className="hidden"
              onChange={handleFile}
              disabled={parsing}
            />
          </label>
        )}

        {error && (
          <Alert type="error" onClose={() => setError('')}>
            <pre className="text-xs whitespace-pre-wrap font-sans">{error}</pre>
          </Alert>
        )}

        {/* Preview */}
        {items && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
              source === 'ai'
                ? 'bg-violet-50 border border-violet-200 text-violet-700'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              <span className="material-symbols-outlined text-lg">
                {source === 'ai' ? 'auto_fix_high' : 'check_circle'}
              </span>
              {summary}
            </div>

            {warnings.map((w, i) => (
              <Alert key={i} type="warning">{w}</Alert>
            ))}

            {invalidCount > 0 && (
              <Alert type="error">
                {invalidCount} dòng thiếu trường bắt buộc (đánh dấu đỏ) — sửa hoặc xóa dòng trước khi nhập.
              </Alert>
            )}

            <div className="rounded-xl border border-outline overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-surface-low sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold text-on-muted border-b border-outline w-8">#</th>
                      {cfg.columns.map(col => (
                        <th key={col.key} className="text-left px-2 py-2 font-semibold text-on-muted border-b border-outline">
                          {col.label}{col.required && ' *'}
                        </th>
                      ))}
                      {source === 'ai' && (
                        <th className="text-left px-2 py-2 font-semibold text-on-muted border-b border-outline">Ghi chú AI</th>
                      )}
                      <th className="border-b border-outline w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, i) => {
                      const invalid = cfg.columns.some(col => col.required && !String(row[col.key] || '').trim());
                      return (
                        <tr key={i} className={`border-t border-outline/40 ${
                          invalid ? 'bg-red-50' : row._changed ? 'bg-amber-50' : i % 2 === 1 ? 'bg-surface-low/40' : ''
                        }`}>
                          <td className="px-2 py-1 text-on-muted">{i + 1}</td>
                          {cfg.columns.map(col => (
                            <td key={col.key} className="px-1 py-1">
                              {col.select ? (
                                <select
                                  value={row[col.key] || ''}
                                  onChange={e => updateCell(i, col.key, e.target.value)}
                                  className="w-full px-1.5 py-1 border border-outline/40 rounded-lg bg-white outline-none focus:border-tsubaki-red"
                                >
                                  <option value="">—</option>
                                  {col.select.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                              ) : (
                                <input
                                  value={row[col.key] || ''}
                                  onChange={e => updateCell(i, col.key, e.target.value)}
                                  className={`w-full min-w-[90px] px-1.5 py-1 border rounded-lg bg-white outline-none focus:border-tsubaki-red
                                    ${col.required && !String(row[col.key] || '').trim() ? 'border-red-400' : 'border-outline/40'}`}
                                />
                              )}
                            </td>
                          ))}
                          {source === 'ai' && (
                            <td className="px-2 py-1 text-violet-600 italic max-w-[180px]">{row._notes || '—'}</td>
                          )}
                          <td className="px-1 py-1">
                            <button
                              onClick={() => removeRow(i)}
                              title="Xóa dòng"
                              className="p-1 text-on-muted hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
