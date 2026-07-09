import { useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const VOCAB_SAMPLE = JSON.stringify([
  { kanji: '食べる', reading: 'たべる', meaning_vi: 'ăn', level: 'N5', type: 'ĐỘNG TỪ', example_sentence: '毎日ご飯を食べます。' },
  { kanji: '水', reading: 'みず', meaning_vi: 'nước', meaning_ja: '液体の一種', level: 'N5', type: 'DANH TỪ' },
], null, 2);

const VOCAB_PROMPT =
`Tạo danh sách từ vựng tiếng Nhật dạng JSON để nhập vào hệ thống.
Chỉ trả về MỘT MẢNG JSON, không thêm giải thích hay markdown.

Cấu trúc mỗi từ:
{
  "kanji": "chữ hán (bỏ trống nếu không có)",
  "reading": "hiragana/katakana — BẮT BUỘC",
  "meaning_vi": "nghĩa tiếng Việt — BẮT BUỘC",
  "meaning_ja": "giải thích tiếng Nhật (tuỳ chọn)",
  "level": "N5 | N4 | N3 | N2 | N1",
  "type": "DANH TỪ | ĐỘNG TỪ | TÍNH TỪ | PHÓ TỪ | LIÊN TỪ",
  "example_sentence": "câu ví dụ tiếng Nhật"
}

Yêu cầu: Tạo 20 từ vựng N5 về chủ đề "gia đình".`;

const KANJI_SAMPLE = JSON.stringify([
  { character: '山', reading_on: 'サン', reading_kun: 'やま', meaning_vi: 'núi', han_viet: 'Sơn', stroke_count: 3, level: 'N5' },
  { character: '川', reading_on: 'セン', reading_kun: 'かわ', meaning_vi: 'sông', han_viet: 'Xuyên', stroke_count: 3, level: 'N5' },
], null, 2);

const KANJI_PROMPT =
`Tạo danh sách kanji tiếng Nhật dạng JSON để nhập vào hệ thống.
Chỉ trả về MỘT MẢNG JSON, không thêm giải thích hay markdown.

Cấu trúc mỗi kanji:
{
  "character": "chữ kanji — BẮT BUỘC",
  "reading_on": "âm On, phân cách bằng dấu phẩy (ví dụ: サン, ザン)",
  "reading_kun": "âm Kun, phân cách bằng dấu phẩy (ví dụ: やま)",
  "meaning_vi": "nghĩa tiếng Việt — BẮT BUỘC",
  "han_viet": "cách đọc Hán Việt (ví dụ: Sơn)",
  "stroke_count": số nét nguyên,
  "level": "N5 | N4 | N3 | N2 | N1"
}

Yêu cầu: Tạo 20 kanji N5 thông dụng.`;

const GRAMMAR_SAMPLE = JSON.stringify([
  { title: '〜は〜です', meaning_vi: '... là ...', explanation: 'Cấu trúc khẳng định cơ bản, dùng để định nghĩa hoặc nhận dạng.', example_sentence: '私は学生です。', level: 'N5' },
  { title: '〜ません', meaning_vi: 'không ... (phủ định lịch sự)', explanation: 'Phủ định lịch sự của động từ dạng ます.', level: 'N5' },
], null, 2);

const GRAMMAR_PROMPT =
`Tạo danh sách mẫu ngữ pháp tiếng Nhật dạng JSON để nhập vào hệ thống.
Chỉ trả về MỘT MẢNG JSON, không thêm giải thích hay markdown.

Cấu trúc mỗi mẫu:
{
  "title": "mẫu câu — BẮT BUỘC (ví dụ: 〜は〜です)",
  "meaning_vi": "ý nghĩa tiếng Việt — BẮT BUỘC",
  "explanation": "giải thích chi tiết cách dùng",
  "example_sentence": "câu ví dụ tiếng Nhật",
  "level": "N5 | N4 | N3 | N2 | N1"
}

Yêu cầu: Tạo 10 mẫu ngữ pháp N5 cơ bản.`;

const GUIDE_SAMPLE_ROWS = {
  vocab: [
    { kanji: '食べる', reading: 'たべる', meaning_vi: 'ăn', level: 'N5', example_sentence: '毎日ご飯を食べます。' },
    { kanji: '水', reading: 'みず', meaning_vi: 'nước', level: 'N5', example_sentence: '水を飲む。' },
  ],
  kanji: [
    { character: '山', reading_on: 'サン', reading_kun: 'やま', meaning_vi: 'núi', han_viet: 'Sơn', level: 'N5' },
    { character: '川', reading_on: 'セン', reading_kun: 'かわ', meaning_vi: 'sông', han_viet: 'Xuyên', level: 'N5' },
  ],
  grammar: [
    { title: '〜は〜です', meaning_vi: '... là ...', explanation: 'Khẳng định danh tính hoặc trạng thái.', level: 'N5' },
    { title: '〜てから', meaning_vi: 'sau khi...', explanation: 'Hành động trước hoàn thành rồi mới làm sau.', level: 'N5' },
  ],
};

const TYPE_CONFIG = {
  vocab: {
    slug: 'vocabulary',
    bankSlug: 'my-vocab',
    label: 'từ vựng',
    columns: [
      { key: 'kanji',            label: 'Kanji' },
      { key: 'reading',          label: 'Reading',  required: true },
      { key: 'meaning_vi',       label: 'Nghĩa VI', required: true },
      { key: 'level',            label: 'Level',    select: LEVELS },
      { key: 'example_sentence', label: 'Ví dụ' },
    ],
    sampleJson: VOCAB_SAMPLE,
    aiPrompt:   VOCAB_PROMPT,
  },
  kanji: {
    slug: 'kanji',
    bankSlug: 'my-kanji',
    label: 'kanji',
    columns: [
      { key: 'character',   label: 'Kanji',    required: true },
      { key: 'reading_on',  label: 'On-yomi' },
      { key: 'reading_kun', label: 'Kun-yomi' },
      { key: 'meaning_vi',  label: 'Nghĩa VI', required: true },
      { key: 'han_viet',    label: 'Hán Việt' },
      { key: 'level',       label: 'Level',    select: LEVELS },
    ],
    sampleJson: KANJI_SAMPLE,
    aiPrompt:   KANJI_PROMPT,
  },
  grammar: {
    slug: 'grammar-points',
    bankSlug: null,
    label: 'ngữ pháp',
    columns: [
      { key: 'title',       label: 'Cấu trúc', required: true },
      { key: 'meaning_vi',  label: 'Ý nghĩa',  required: true },
      { key: 'explanation', label: 'Giải thích' },
      { key: 'level',       label: 'Level',    select: LEVELS },
    ],
    sampleJson: GRAMMAR_SAMPLE,
    aiPrompt:   GRAMMAR_PROMPT,
  },
};

const flattenArrays = (item) =>
  Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));

// lessonId / studyListId là tuỳ chọn.
// Không có cả hai → bank mode (nhập vào ngân hàng cá nhân).
// previewUrl / importUrl: ghi đè endpoint tùy ý (dùng cho admin bank import)
export default function ImportFileModal({ open, onClose, type, lessonId, studyListId, apiBase = '', previewUrl: previewUrlProp, importUrl: importUrlProp, onImported }) {
  const cfg           = TYPE_CONFIG[type];
  const bankMode      = !lessonId && !studyListId && !!cfg.bankSlug;
  const studyListMode = !!studyListId;
  const fileRef  = useRef(null);

  // Upload/parse state
  const [parsing, setParsing]     = useState(false);
  const [items, setItems]         = useState(null);
  const [source, setSource]       = useState('direct');
  const [warnings, setWarnings]   = useState([]);
  const [summary, setSummary]     = useState('');
  const [error, setError]         = useState('');
  const [importing, setImporting] = useState(false);

  // Template panel
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateTab, setTemplateTab]   = useState('guide');
  const [copied, setCopied]             = useState('');

  // Input mode toggle
  const [inputMode, setInputMode] = useState('file');  // 'file' | 'paste'
  const [pasteText, setPasteText] = useState('');

  const reset = () => {
    setItems(null); setSource('direct'); setWarnings([]); setSummary('');
    setError(''); setParsing(false); setImporting(false);
    setPasteText('');
    if (fileRef.current) fileRef.current.value = '';
  };
  const handleClose = () => { reset(); onClose(); };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // ── Core parse/upload ──────────────────────────────────────────────────────
  const processFile = async (file) => {
    setError(''); setItems(null); setParsing(true);
    const previewUrl = previewUrlProp || (studyListMode
      ? `/study-lists/${studyListId}/${cfg.slug}/import-file`
      : bankMode
        ? `${apiBase}/${cfg.bankSlug}/import-file`
        : `${apiBase}/lessons/${lessonId}/${cfg.slug}/import-file`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(previewUrl, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setItems((r.data.items || []).map(flattenArrays));
      setSource(r.data.source || 'direct');
      setWarnings(r.data.warnings || []);
      setSummary(r.data.summary || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
  };

  const handlePasteSubmit = () => {
    let parsed;
    try { parsed = JSON.parse(pasteText); } catch (e) {
      setError('JSON không hợp lệ: ' + e.message); return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError('Dữ liệu phải là một mảng JSON không rỗng (bắt đầu bằng [).'); return;
    }
    const blob = new Blob([pasteText], { type: 'application/json' });
    processFile(new File([blob], 'import.json', { type: 'application/json' }));
  };

  // ── Preview confirm ────────────────────────────────────────────────────────
  const updateCell = (rowIdx, key, value) =>
    setItems(list => list.map((it, i) => (i === rowIdx ? { ...it, [key]: value } : it)));
  const removeRow = (rowIdx) =>
    setItems(list => list.filter((_, i) => i !== rowIdx));

  const invalidCount = (items || []).filter(it =>
    cfg.columns.some(col => col.required && !String(it[col.key] || '').trim())
  ).length;

  const handleImport = async () => {
    setImporting(true); setError('');
    const importUrl = importUrlProp || (studyListMode
      ? `/study-lists/${studyListId}/import`
      : bankMode
        ? `${apiBase}/${cfg.bankSlug}/import`
        : `${apiBase}/${cfg.slug}/import`);
    try {
      const payload = items.map(({ _notes, _changed, ...rest }) =>
        bankMode || studyListMode ? rest : { ...rest, lesson_id: lessonId }
      );
      const r = await api.post(importUrl, payload);
      onImported?.(r.data.message || `Đã nhập ${items.length} ${cfg.label}.`);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        studyListMode ? `Nhập ${cfg.label} vào bài đăng` :
        bankMode      ? `Nhập ${cfg.label} vào thư viện` :
                        `Nhập ${cfg.label} từ file`
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Đóng</Button>
          {items && (
            <Button variant="secondary" onClick={reset}>
              <span className="material-symbols-outlined text-base">restart_alt</span>
              Nhập lại
            </Button>
          )}
          {items && (
            <Button loading={importing} disabled={items.length === 0 || invalidCount > 0 || importing} onClick={handleImport}>
              <span className="material-symbols-outlined text-base">upload</span>
              Nhập {items.length} {cfg.label}{' '}
              {studyListMode ? 'vào danh sách' : bankMode ? 'vào thư viện' : 'vào bài'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">

        {/* ── Template / hướng dẫn ────────────────────────────────────────── */}
        <div className="rounded-xl border border-outline overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTemplate(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-low hover:bg-surface text-sm font-medium transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-tsubaki-red">description</span>
              Xem mẫu &amp; prompt AI — định dạng .xlsx / .xls / .csv / .docx / .json
            </span>
            <span className="material-symbols-outlined text-lg text-on-muted">
              {showTemplate ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {showTemplate && (
            <div className="border-t border-outline">
              {/* Tab bar */}
              <div className="flex border-b border-outline bg-white">
                {[
                  { key: 'guide',  icon: 'menu_book',   label: 'Hướng dẫn' },
                  { key: 'json',   icon: 'data_object', label: 'Mẫu JSON' },
                  { key: 'prompt', icon: 'smart_toy',   label: 'Prompt AI' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setTemplateTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                      templateTab === tab.key
                        ? 'border-tsubaki-red text-tsubaki-red'
                        : 'border-transparent text-on-muted hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-white p-3">
                {templateTab === 'guide' && (
                  <div className="space-y-4 text-xs">
                    {/* Các bước */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: 'table', step: '1', title: 'Tạo bảng', desc: 'Excel: dòng đầu là tên cột, các dòng sau là dữ liệu.\nWord: chèn bảng (Insert → Table), hàng đầu là tên cột.' },
                        { icon: 'tune', step: '2', title: 'Điền dữ liệu', desc: 'Điền từng dòng theo các cột bên dưới. Cột có dấu * là bắt buộc, còn lại có thể bỏ trống.' },
                        { icon: 'upload_file', step: '3', title: 'Tải lên', desc: 'Lưu file (.xlsx, .xls, .docx, .csv) rồi kéo thả hoặc chọn file bên dưới.' },
                      ].map(s => (
                        <div key={s.step} className="flex gap-2.5 p-2.5 bg-surface-low rounded-xl">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-tsubaki-red text-white flex items-center justify-center text-xs font-bold">{s.step}</div>
                          <div>
                            <p className="font-semibold text-on-surface mb-0.5">{s.title}</p>
                            <p className="text-on-muted whitespace-pre-line leading-relaxed">{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Danh sách cột */}
                    <div>
                      <p className="font-semibold text-on-surface mb-1.5">Các cột cho <span className="text-tsubaki-red">{cfg.label}</span>:</p>
                      <div className="rounded-xl border border-outline overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-surface-low">
                            <tr>
                              <th className="text-left px-3 py-1.5 font-semibold text-on-muted">Tên cột</th>
                              <th className="text-left px-3 py-1.5 font-semibold text-on-muted">Bắt buộc?</th>
                              <th className="text-left px-3 py-1.5 font-semibold text-on-muted">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cfg.columns.map((col, i) => (
                              <tr key={col.key} className={`border-t border-outline/40 ${i % 2 === 1 ? 'bg-surface-low/30' : ''}`}>
                                <td className="px-3 py-1.5 font-mono font-semibold text-tsubaki-red">{col.key}</td>
                                <td className="px-3 py-1.5">
                                  {col.required
                                    ? <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold"><span className="material-symbols-outlined text-sm">check_circle</span> Có</span>
                                    : <span className="text-on-muted">Không</span>}
                                </td>
                                <td className="px-3 py-1.5 text-on-muted">
                                  {col.select ? `Chọn một trong: ${col.select.join(', ')}` : col.key === 'type' ? 'DANH TỪ / ĐỘNG TỪ / TÍNH TỪ / PHÓ TỪ / LIÊN TỪ' : col.key === 'reading_on' || col.key === 'reading_kun' ? 'Nhiều âm cách nhau bằng dấu phẩy' : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Ví dụ trực quan */}
                    <div>
                      <p className="font-semibold text-on-surface mb-1.5">Ví dụ trông như thế này trong Excel / Word:</p>
                      <div className="rounded-xl border border-outline overflow-x-auto">
                        <table className="text-xs">
                          <thead className="bg-amber-50">
                            <tr>
                              {cfg.columns.map(col => (
                                <th key={col.key} className="px-3 py-1.5 text-left font-semibold border-b border-outline whitespace-nowrap">
                                  {col.key}{col.required ? ' *' : ''}
                                </th>
                              ))}
                              <th className="px-3 py-1.5 text-left font-semibold border-b border-outline text-on-muted/60 whitespace-nowrap">stt (bỏ qua)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {GUIDE_SAMPLE_ROWS[type]?.map((row, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-surface-low/30' : ''}>
                                {cfg.columns.map(col => (
                                  <td key={col.key} className="px-3 py-1.5 border-t border-outline/40 whitespace-nowrap">{row[col.key] ?? ''}</td>
                                ))}
                                <td className="px-3 py-1.5 border-t border-outline/40 text-on-muted/60">{i + 1}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Ghi chú nhanh */}
                    <div className="flex flex-col gap-1 text-on-muted">
                      {[
                        'Thứ tự cột không quan trọng — hệ thống nhận diện theo tên.',
                        'Cột thừa (như STT, ghi chú...) sẽ bị bỏ qua, không gây lỗi.',
                        'Tên cột linh hoạt: "Nghĩa Tiếng Việt", "nghia viet", "meaning" đều được nhận.',
                        'File lộn xộn hoặc thiếu cột → AI sẽ tự động trích xuất (có thể mất 10–30 giây).',
                        'Tối đa 500 dòng và 5 MB mỗi lần nhập.',
                      ].map((note, i) => (
                        <p key={i} className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-sm text-tsubaki-red mt-px flex-shrink-0">info</span>
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {templateTab === 'json' && (
                  <div>
                    <p className="text-xs text-on-muted mb-2">
                      Sao chép mẫu bên dưới, điền dữ liệu, lưu thành file <code className="bg-surface-low px-1 rounded">.json</code> rồi tải lên —
                      hoặc dán thẳng vào ô "Dán JSON" bên dưới.
                    </p>
                    <div className="relative">
                      <button
                        onClick={() => copyToClipboard(cfg.sampleJson, 'json')}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/80 hover:bg-white border border-outline rounded-lg text-xs font-medium transition-colors z-10"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {copied === 'json' ? 'check' : 'content_copy'}
                        </span>
                        {copied === 'json' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                      <pre className="text-xs bg-gray-950 text-emerald-300 p-3 pr-24 rounded-xl overflow-x-auto leading-relaxed max-h-52 overflow-y-auto">
                        {cfg.sampleJson}
                      </pre>
                    </div>
                  </div>
                )}

                {templateTab === 'prompt' && (
                  <div>
                    <p className="text-xs text-on-muted mb-2">
                      Sao chép prompt bên dưới, dán vào <strong>ChatGPT</strong> hoặc <strong>Claude</strong>,
                      tuỳ chỉnh yêu cầu (số lượng, cấp độ, chủ đề), rồi dán kết quả JSON vào ô "Dán JSON".
                    </p>
                    <div className="relative">
                      <button
                        onClick={() => copyToClipboard(cfg.aiPrompt, 'prompt')}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/80 hover:bg-white border border-outline rounded-lg text-xs font-medium transition-colors z-10"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {copied === 'prompt' ? 'check' : 'content_copy'}
                        </span>
                        {copied === 'prompt' ? 'Đã sao chép' : 'Sao chép'}
                      </button>
                      <pre className="text-xs bg-gray-950 text-sky-300 p-3 pr-24 rounded-xl overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                        {cfg.aiPrompt}
                      </pre>
                    </div>
                    <p className="text-xs text-on-muted/70 mt-2 italic">
                      Gợi ý: thay "20 từ vựng N5 về chủ đề gia đình" thành chủ đề và số lượng bạn muốn.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Input area (khi chưa có preview) ───────────────────────────── */}
        {!items && (
          <div className="space-y-3">
            {/* Toggle file / paste */}
            <div className="flex gap-1 p-1 bg-surface-low rounded-xl w-fit">
              {[
                { key: 'file',  icon: 'upload_file', label: 'Tải file' },
                { key: 'paste', icon: 'content_paste', label: 'Dán JSON' },
              ].map(m => (
                <button
                  key={m.key}
                  onClick={() => { setInputMode(m.key); setError(''); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    inputMode === m.key
                      ? 'bg-white text-tsubaki-red shadow-sm'
                      : 'text-on-muted hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* File picker */}
            {inputMode === 'file' && (
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
                    <span className="text-xs text-on-muted/60 mt-1">.xlsx / .xls / .csv / .docx / .json</span>
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

            {/* JSON paste */}
            {inputMode === 'paste' && (
              <div className="space-y-2">
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Dán JSON từ AI vào đây...\nVí dụ:\n[\n  {"reading":"たべる","meaning_vi":"ăn",...}\n]`}
                  rows={8}
                  className="w-full px-3 py-2.5 border border-outline rounded-xl text-xs font-mono resize-none outline-none focus:border-tsubaki-red bg-gray-950 text-emerald-300 placeholder:text-gray-600"
                  disabled={parsing}
                />
                <div className="flex justify-end">
                  <Button onClick={handlePasteSubmit} loading={parsing} disabled={!pasteText.trim() || parsing}>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Xử lý JSON
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert type="error" onClose={() => setError('')}>
            <pre className="text-xs whitespace-pre-wrap font-sans">{error}</pre>
          </Alert>
        )}

        {/* ── Preview table ────────────────────────────────────────────────── */}
        {items && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
              source === 'ai'    ? 'bg-violet-50 border border-violet-200 text-violet-700' :
              source === 'mixed' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                   'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              <span className="material-symbols-outlined text-lg">
                {source === 'ai' ? 'auto_fix_high' : source === 'mixed' ? 'layers' : 'check_circle'}
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
