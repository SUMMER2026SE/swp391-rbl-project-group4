import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Alert from '../../components/ui/Alert';
import LessonInfoPanel from '../../components/shared/LessonInfoPanel';
import api from '../../lib/api';
import parseSubtitles from '../../lib/parseSubtitles';

// Chuyển link YouTube thường sang dạng nhúng để xem trước.
function toEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

// Trần upload mỗi file của Supabase gói free — phải khớp giới hạn multer + bucket lesson-videos ở backend.
const MAX_VIDEO_MB = 50;

// ── Helpers thời gian cho editor bản chép ──────────────────────────────────────
// Hiển thị mm:ss.d cho dễ đọc với video dài; nhập chấp nhận "giây", "m:ss" hoặc "h:mm:ss".
function fmtTime(sec) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
function parseTime(str) {
  const t = String(str ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  let m = t.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return null;
}

// ── Đọc file phụ đề ───────────────────────────────────────────────────────────
// Phụ đề tiếng Nhật hay được lưu Shift-JIS: thử UTF-8 nghiêm ngặt trước, byte không
// hợp lệ UTF-8 thì gần như chắc là Shift-JIS. Trả về { text, usedShiftJis } vì đây là
// suy đoán — người soạn cần tự xác nhận chữ hiển thị đúng.
const MAX_SUBTITLE_MB = 2;
async function decodeSubtitleFile(file) {
  const buf = await file.arrayBuffer();
  let text;
  let usedShiftJis = false;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('shift_jis').decode(buf);
    usedShiftJis = true;
  }
  return { text: text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'), usedShiftJis };
}

const LANGS = [
  { value: 'ja', label: '日 Nhật' },
  { value: 'vi', label: 'VI Việt' },
  { value: 'en', label: 'EN Anh' },
];

export default function AdminLessonVideo() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]       = useState(null);
  const [contentUrl, setContentUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [sourceMode, setSourceMode] = useState('link'); // 'link' | 'upload'
  const [uploading, setUploading]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [alert, setAlert]         = useState({ type: '', msg: '' });
  // Bản chép đồng bộ: rows giữ start/end dạng chuỗi khi soạn ("m:ss.d" hoặc giây),
  // convert sang số khi lưu. parts: [{ lang, text }] — 1-3 ngôn ngữ mỗi dòng.
  const [rows, setRows] = useState([]);
  const previewVideoRef = useRef(null);

  // needsReview: cờ tạm từ kết quả AI (dòng AI không chắc chắn) — chỉ sống trong state
  // rows của phiên soạn, buildSegments không đưa vào payload lưu.
  const segsToRows = (segs) => (segs || []).map(s => ({
    start: fmtTime(s.start), end: fmtTime(s.end),
    needsReview: !!s.needsReview,
    parts: (s.parts || []).map(p => ({ lang: p.lang || 'ja', text: p.text || '' })),
  }));

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`${apiBase}/lessons/${lessonId}`);
        setLesson(r.data);
        setContentUrl(r.data.content_url || '');
        setTranscript(r.data.transcript || '');
        setRows(segsToRows(r.data.transcript_segments));
      } catch (e) {
        setAlert({ type: 'error', msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lessonId]);

  // rows → transcript_segments; trả về { segments } hoặc { error } nếu có ô thời gian sai.
  const buildSegments = () => {
    const segments = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const parts = (row.parts || []).filter(p => p.text.trim());
      if (!parts.length) continue; // dòng trống — bỏ qua, không chặn lưu
      const start = parseTime(row.start);
      const end = parseTime(row.end);
      if (start == null || end == null) return { error: `Dòng #${i + 1}: thời gian không hợp lệ (nhập giây hoặc m:ss).` };
      if (end < start) return { error: `Dòng #${i + 1}: thời gian kết thúc nhỏ hơn bắt đầu.` };
      segments.push({
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        parts: parts.map(p => ({ lang: p.lang, text: p.text.trim() })),
      });
    }
    segments.sort((a, b) => a.start - b.start);
    return { segments };
  };

  const handleSave = async () => {
    const { segments, error } = buildSegments();
    if (error) { setAlert({ type: 'error', msg: error }); return; }
    setSaving(true);
    try {
      await api.put(`${apiBase}/lessons/${lessonId}`, {
        content_url: contentUrl.trim() || null,
        transcript: transcript.trim() || null,
        transcript_segments: segments.length ? segments : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng file sau khi lỗi
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setAlert({ type: 'error', msg: 'Chỉ chấp nhận file video MP4 hoặc WebM.' });
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setAlert({ type: 'error', msg: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa ${MAX_VIDEO_MB}MB.` });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      const r = await api.post(`${apiBase}/lessons/upload-video`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContentUrl(r.data.url);
      setAlert({ type: 'success', msg: 'Đã tải video lên. Nhấn "Lưu nội dung" để lưu vào bài học.' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.error || err.message });
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  const embed = toEmbed(contentUrl);

  return (
    <Layout title="Soạn video">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">{alert.msg}</Alert>
      )}

      <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-2">
            <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại Course Builder
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-sumire-purple/10 text-sumire-purple px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">play_circle</span> Video
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">{loading ? 'Đang tải...' : lesson?.title || 'Mục video'}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <span className="material-symbols-outlined text-base">check_circle</span> Đã lưu
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Đang lưu...' : 'Lưu nội dung'}
          </button>
        </div>
      </section>

      <LessonInfoPanel lesson={lesson} apiBase={apiBase} onSaved={u => setLesson(l => ({ ...l, ...u }))} />

      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nguồn video *</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSourceMode('link')}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${sourceMode === 'link' ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red'}`}
            >
              Dán link YouTube/URL
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${sourceMode === 'upload' ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red'}`}
            >
              Tải file video lên
            </button>
          </div>

          {sourceMode === 'link' ? (
            <>
              <input
                type="url"
                value={contentUrl}
                onChange={e => setContentUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
              <p className="text-xs text-on-muted mt-1">Hỗ trợ link YouTube hoặc URL video trực tiếp (.mp4).</p>
            </>
          ) : (
            <>
              <label className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed border-outline rounded-xl text-sm text-on-muted transition-colors ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:border-tsubaki-red hover:text-tsubaki-red'}`}>
                <span className="material-symbols-outlined text-base">{uploading ? 'hourglass_empty' : 'upload_file'}</span>
                {uploading ? 'Đang tải video lên...' : 'Chọn file video (MP4/WebM)'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-on-muted mt-1">Định dạng MP4 hoặc WebM, tối đa {MAX_VIDEO_MB}MB. Sau khi tải lên, URL sẽ được điền tự động.</p>
            </>
          )}
        </div>

        {/* Preview */}
        {contentUrl && (
          <div className="rounded-xl overflow-hidden border border-outline/20 bg-black/5 aspect-video">
            {embed ? (
              <iframe src={embed} title="preview" className="w-full h-full" allowFullScreen />
            ) : (
              <video ref={previewVideoRef} src={contentUrl} controls className="w-full h-full" />
            )}
          </div>
        )}

        {/* ── Bản chép đồng bộ thời gian ─────────────────────────────── */}
        <TranscriptSegmentsEditor
          rows={rows}
          setRows={setRows}
          isYouTube={!!embed}
          hasVideo={!!contentUrl}
          previewVideoRef={previewVideoRef}
          apiBase={apiBase}
          lessonId={lessonId}
          onAlert={setAlert}
          onAiResult={(segs, flatText) => {
            setRows(segsToRows(segs));
            if (flatText) setTranscript(flatText);
          }}
        />

        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Transcript dự phòng (không đồng bộ, tuỳ chọn)</label>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={8}
            placeholder="Lời thoại hoặc ghi chú nội dung video — hiển thị tĩnh khi chưa có bản chép đồng bộ ở trên..."
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
          />
        </div>
      </div>
    </Layout>
  );
}

// ── Editor bản chép đồng bộ: 3 chế độ nhập đổ chung vào cùng bảng rows ─────────
// "manual": bảng dòng start/end + 1-3 part ngôn ngữ. "paste": dán SRT/VTT rồi parse.
// "ai": gọi backend Whisper + dịch (chỉ cho video đã upload, không hỗ trợ YouTube).
function TranscriptSegmentsEditor({ rows, setRows, isYouTube, hasVideo, previewVideoRef, apiBase, lessonId, onAlert, onAiResult }) {
  const [inputMode, setInputMode] = useState('manual'); // 'manual' | 'paste' | 'ai'
  const [pasteText, setPasteText] = useState('');
  const [pasteLang, setPasteLang] = useState('ja');
  const [pasteFileName, setPasteFileName] = useState('');
  const [transcribing, setTranscribing] = useState(false);

  const updateRow = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const updatePart = (i, j, patch) => setRows(rs => rs.map((r, idx) =>
    idx === i ? { ...r, parts: r.parts.map((p, pj) => pj === j ? { ...p, ...patch } : p) } : r
  ));
  const addPart = (i) => setRows(rs => rs.map((r, idx) => {
    if (idx !== i || r.parts.length >= 3) return r;
    const used = r.parts.map(p => p.lang);
    const nextLang = LANGS.map(l => l.value).find(l => !used.includes(l)) || 'vi';
    return { ...r, parts: [...r.parts, { lang: nextLang, text: '' }] };
  }));
  const removePart = (i, j) => setRows(rs => rs.map((r, idx) =>
    idx === i ? { ...r, parts: r.parts.filter((_, pj) => pj !== j) } : r
  ));
  const addRow = () => setRows(rs => {
    const lastEnd = rs.length ? rs[rs.length - 1].end : '0:00.0';
    return [...rs, { start: lastEnd, end: '', parts: [{ lang: 'ja', text: '' }] }];
  });
  const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i));
  const moveRow = (i, dir) => setRows(rs => {
    const j = i + dir;
    if (j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // Lấy thời gian đang phát của video preview (chỉ có với video upload — YouTube preview là iframe tĩnh)
  const grabTime = (i, field) => {
    const t = previewVideoRef.current?.currentTime;
    if (t == null) return;
    updateRow(i, { [field]: fmtTime(t) });
  };
  const canGrabTime = hasVideo && !isYouTube;

  const handleSubtitleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file vừa chọn
    if (!file) return;
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      onAlert({ type: 'error', msg: 'Chỉ nhận file phụ đề .srt hoặc .vtt.' });
      return;
    }
    if (file.size > MAX_SUBTITLE_MB * 1024 * 1024) {
      onAlert({ type: 'error', msg: `File quá lớn, tối đa ${MAX_SUBTITLE_MB}MB.` });
      return;
    }
    try {
      const { text, usedShiftJis } = await decodeSubtitleFile(file);
      setPasteText(text);
      setPasteFileName(file.name);
      if (usedShiftJis) {
        onAlert({ type: 'success', msg: 'Đã đọc file với bảng mã Shift-JIS. Kiểm tra lại tiếng Nhật có hiển thị đúng không trước khi phân tích.' });
      }
    } catch {
      onAlert({ type: 'error', msg: 'Không đọc được nội dung file — bảng mã không được hỗ trợ. Hãy lưu lại file dưới dạng UTF-8 rồi thử lại.' });
    }
  };

  const handleParse = () => {
    const cues = parseSubtitles(pasteText);
    if (!cues.length) {
      onAlert({ type: 'error', msg: 'Không nhận diện được nội dung SRT/VTT. Kiểm tra lại định dạng.' });
      return;
    }
    if (rows.length && !window.confirm(`Thay thế ${rows.length} dòng hiện có bằng ${cues.length} dòng vừa phân tích?`)) return;
    setRows(cues.map(c => ({
      start: fmtTime(c.start), end: fmtTime(c.end),
      parts: [{ lang: pasteLang, text: c.text }],
    })));
    setPasteText('');
    setPasteFileName('');
    setInputMode('manual');
    onAlert({ type: 'success', msg: `Đã phân tích ${cues.length} dòng. Kiểm tra lại rồi nhấn "Lưu nội dung".` });
  };

  const handleTranscribe = async () => {
    if (transcribing) return;
    if (rows.length && !window.confirm(`Kết quả AI sẽ thay thế ${rows.length} dòng hiện có. Tiếp tục?`)) return;
    setTranscribing(true);
    try {
      const r = await api.post(`${apiBase}/lessons/${lessonId}/transcribe-video`);
      onAiResult(r.data.segments || [], r.data.transcript || '');
      setInputMode('manual');
      onAlert({ type: 'success', msg: `AI đã chép ${r.data.count ?? (r.data.segments || []).length} dòng. Đây là bản nháp — hãy kiểm tra và sửa lại trước khi lưu.` });
    } catch (e) {
      onAlert({ type: 'error', msg: e.response?.data?.error || e.message });
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-on-muted mb-1">Bản chép đồng bộ thời gian (tuỳ chọn)</label>
      <p className="text-xs text-on-muted mb-3">
        Học sinh xem video sẽ thấy danh sách lời thoại đồng bộ: dòng đang nói tự sáng, bấm dòng để tua lại.
        Mỗi dòng có thể gồm 1-3 ngôn ngữ (Nhật/Việt/Anh) theo đúng thứ tự được nói trong video.
      </p>

      <div className="flex gap-2 mb-3">
        {[['manual', 'edit', 'Nhập tay'], ['paste', 'content_paste', 'Dán SRT/VTT'], ['ai', 'auto_awesome', 'Tự động (AI)']].map(([mode, icon, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setInputMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${inputMode === mode ? 'bg-sumire-purple text-white border-sumire-purple' : 'border-outline text-on-muted hover:border-sumire-purple'}`}
          >
            <span className="material-symbols-outlined text-sm">{icon}</span> {label}
          </button>
        ))}
      </div>

      {inputMode === 'paste' && (
        <div className="mb-4 p-4 rounded-xl border border-outline/40 bg-surface-low/50 space-y-3">
          <div>
            <label className="flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed border-outline rounded-xl text-sm text-on-muted cursor-pointer hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
              <span className="material-symbols-outlined text-base">upload_file</span>
              Chọn file phụ đề (.srt/.vtt)
              <input
                type="file"
                accept=".srt,.vtt,text/vtt"
                onChange={handleSubtitleFile}
                className="hidden"
              />
            </label>
            {pasteFileName && (
              <p className="text-xs text-on-muted mt-1">Đã chọn: {pasteFileName}</p>
            )}
          </div>
          <p className="text-xs text-on-muted">hoặc dán trực tiếp nội dung bên dưới</p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={6}
            placeholder={'Dán nội dung file phụ đề SRT hoặc VTT...\n\n1\n00:00:05,000 --> 00:00:08,500\n今日から勉強する'}
            className="w-full px-3 py-2.5 border border-outline rounded-xl text-xs font-mono outline-none focus:border-tsubaki-red transition-colors resize-none"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-on-muted flex items-center gap-2">
              Ngôn ngữ của phụ đề:
              <select value={pasteLang} onChange={e => setPasteLang(e.target.value)} className="px-2 py-1.5 border border-outline rounded-lg text-xs outline-none">
                {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="px-4 py-1.5 bg-tsubaki-red text-white rounded-xl text-xs font-medium hover:shadow-md transition-all disabled:opacity-50"
            >
              Phân tích
            </button>
          </div>
        </div>
      )}

      {inputMode === 'ai' && (
        <div className="mb-4 p-4 rounded-xl border border-outline/40 bg-surface-low/50 space-y-3">
          {!hasVideo ? (
            <p className="text-xs text-on-muted">Cần có video trước khi dùng chép lời tự động.</p>
          ) : (
            <>
              <p className="text-xs text-on-muted">
                AI sẽ nghe video, tách lời thoại theo thời gian và dịch bổ sung sang các ngôn ngữ còn lại.
                Kết quả là <strong>bản nháp</strong> — hãy kiểm tra và sửa lại trước khi lưu.
                {isYouTube && (
                  <> Với video YouTube: chỉ dùng được video <strong>công khai</strong> (không riêng tư/giới hạn
                  độ tuổi) và chỉ nên dùng với video bạn có quyền sử dụng cho mục đích giảng dạy.</>
                )}
              </p>
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={transcribing}
                className="flex items-center gap-2 px-4 py-2 bg-sumire-purple text-white rounded-xl text-xs font-medium hover:shadow-md transition-all disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-sm ${transcribing ? 'animate-spin' : ''}`}>
                  {transcribing ? 'progress_activity' : 'auto_awesome'}
                </span>
                {transcribing ? 'Đang chép lời... có thể mất vài phút, đừng đóng trang' : 'Tự động chép lời (AI)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Bảng dòng — dùng chung cho cả 3 chế độ */}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="p-3 rounded-xl border border-outline/40 bg-white space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-muted">#{i + 1}</span>
              {row.needsReview && (
                <span
                  title="AI không chắc chắn về đoạn này — nghe lại video để xác nhận nội dung"
                  className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                >
                  <span className="material-symbols-outlined text-xs">warning</span> Cần kiểm tra
                </span>
              )}
              {['start', 'end'].map(field => (
                <span key={field} className="flex items-center gap-1">
                  <input
                    value={row[field]}
                    onChange={e => updateRow(i, { [field]: e.target.value })}
                    placeholder={field === 'start' ? 'Bắt đầu (m:ss)' : 'Kết thúc (m:ss)'}
                    className={`w-24 px-2 py-1.5 border rounded-lg text-xs outline-none focus:border-tsubaki-red transition-colors ${row[field] && parseTime(row[field]) == null ? 'border-red-400' : 'border-outline'}`}
                  />
                  {canGrabTime && (
                    <button
                      type="button"
                      onClick={() => grabTime(i, field)}
                      title="Lấy thời gian đang phát của video xem trước"
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-surface-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">schedule</span>
                    </button>
                  )}
                </span>
              ))}
              <span className="flex-1" />
              <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0} title="Chuyển lên" className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-low disabled:opacity-30 transition-colors">
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
              </button>
              <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} title="Chuyển xuống" className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-low disabled:opacity-30 transition-colors">
                <span className="material-symbols-outlined text-sm">arrow_downward</span>
              </button>
              <button type="button" onClick={() => removeRow(i)} title="Xóa dòng" className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
            {row.parts.map((part, j) => (
              <div key={j} className="flex items-center gap-2">
                <select
                  value={part.lang}
                  onChange={e => updatePart(i, j, { lang: e.target.value })}
                  className="px-2 py-1.5 border border-outline rounded-lg text-xs outline-none shrink-0"
                >
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <input
                  value={part.text}
                  onChange={e => updatePart(i, j, { text: e.target.value })}
                  placeholder={part.lang === 'ja' ? '今日から勉強する' : part.lang === 'vi' ? 'Hôm nay bắt đầu học' : 'Starting to study today'}
                  className="flex-1 px-3 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red transition-colors"
                />
                {row.parts.length > 1 && (
                  <button type="button" onClick={() => removePart(i, j)} title="Xóa phần này" className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            ))}
            {row.parts.length < 3 && (
              <button type="button" onClick={() => addPart(i)} className="flex items-center gap-1 text-[11px] text-on-muted hover:text-sumire-purple transition-colors">
                <span className="material-symbols-outlined text-sm">add</span> Thêm ngôn ngữ
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-outline text-xs text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span> Thêm dòng
        </button>
      </div>
    </div>
  );
}
