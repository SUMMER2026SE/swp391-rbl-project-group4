import { useState, useRef, useEffect } from 'react';
import parseSubtitles from '../../lib/parseSubtitles';

// ── Editor bản chép đồng bộ thời gian (dùng chung cho video bài giảng & luyện nghe) ──
// 3 chế độ nhập đổ chung vào cùng bảng rows: "manual" (bảng dòng start/end + 1-3 part
// ngôn ngữ), "paste" (dán/đọc SRT-VTT), "ai" (nguồn cha cung cấp qua onTranscribe).
// Bao trọn cả "soạn từ đầu" lẫn "sửa sau khi AI đã tạo".

export const LANGS = [
  { value: 'ja', label: '日 Nhật' },
  { value: 'vi', label: 'VI Việt' },
  { value: 'en', label: 'EN Anh' },
];

// Hiển thị mm:ss.d; nhập chấp nhận "giây", "m:ss" hoặc "h:mm:ss".
export function fmtTime(sec) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
export function parseTime(str) {
  const t = String(str ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  let m = t.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return null;
}

// segments (đã lưu) → rows (đang soạn). needsReview/confidence/note: cờ tạm từ AI, không lưu DB.
export function segsToRows(segs) {
  return (segs || []).map(s => ({
    start: fmtTime(s.start), end: fmtTime(s.end),
    needsReview: !!s.needsReview,
    ...(s.confidence != null ? { confidence: s.confidence } : {}),
    ...(s.note ? { note: s.note } : {}),
    parts: (s.parts && s.parts.length ? s.parts : [{ lang: 'ja', text: s.text || '' }])
      .map(p => ({ lang: p.lang || 'ja', text: p.text || '' })),
  }));
}

// rows → { segments } hoặc { error } nếu có ô thời gian sai.
export function rowsToSegments(rows) {
  const segments = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parts = (row.parts || []).filter(p => p.text.trim());
    if (!parts.length) continue;
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
}

// Phụ đề tiếng Nhật hay lưu Shift-JIS: thử UTF-8 nghiêm ngặt trước, lỗi thì Shift-JIS.
const MAX_SUBTITLE_MB = 2;
async function decodeSubtitleFile(file) {
  const buf = await file.arrayBuffer();
  let text, usedShiftJis = false;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('shift_jis').decode(buf);
    usedShiftJis = true;
  }
  return { text: text.replace(/^﻿/, '').replace(/\r\n/g, '\n'), usedShiftJis };
}

// Props:
//  rows, setRows       — state bảng dòng (cha giữ, để lưu chung với thông tin khác)
//  onAlert             — ({type,msg}) hiển thị thông báo
//  onTranscribe        — async () => {segments, transcript, count}|null. Có → hiện chế độ AI.
//  canTranscribe       — bật/tắt nút AI (vd đã có nguồn audio/video chưa)
//  onAiResult          — (segments, transcript) sau khi AI xong (cha đổ vào rows + transcript)
//  isYouTube, previewMediaRef — để cảnh báo YouTube & lấy thời gian đang phát (nếu có player)
export default function TranscriptSegmentsEditor({
  rows, setRows, onAlert, onTranscribe, canTranscribe = false, onAiResult,
  isYouTube = false, previewMediaRef = null, simple = false, defaultMode = 'manual',
}) {
  const [inputMode, setInputMode] = useState(defaultMode); // 'manual' | 'paste' | 'ai'
  const [pasteText, setPasteText] = useState('');
  const [pasteLang, setPasteLang] = useState('ja');
  const [pasteFileName, setPasteFileName] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);     // giây đã trôi khi đang chép lời
  const [qa, setQa] = useState(null);            // { confidence, flagged, dropped } sau khi AI xong
  const abortRef    = useRef(null);
  const canceledRef = useRef(false);
  const timerRef    = useRef(null);

  // Dọn timer/abort khi unmount (tránh setState sau khi rời trang).
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    abortRef.current?.abort();
  }, []);

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

  const grabTime = (i, field) => {
    const t = previewMediaRef?.current?.currentTime;
    if (t == null) return;
    updateRow(i, { [field]: fmtTime(t) });
  };
  const canGrabTime = !!previewMediaRef?.current && !isYouTube;

  const handleSubtitleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
      if (usedShiftJis) onAlert({ type: 'success', msg: 'Đã đọc file với bảng mã Shift-JIS. Kiểm tra lại tiếng Nhật hiển thị đúng không trước khi phân tích.' });
    } catch {
      onAlert({ type: 'error', msg: 'Không đọc được nội dung file — bảng mã không hỗ trợ. Hãy lưu lại dưới dạng UTF-8 rồi thử lại.' });
    }
  };

  const handleParse = () => {
    const cues = parseSubtitles(pasteText);
    if (!cues.length) {
      onAlert({ type: 'error', msg: 'Không nhận diện được nội dung SRT/VTT. Kiểm tra lại định dạng.' });
      return;
    }
    if (rows.length && !window.confirm(`Thay thế ${rows.length} dòng hiện có bằng ${cues.length} dòng vừa phân tích?`)) return;
    setRows(cues.map(c => ({ start: fmtTime(c.start), end: fmtTime(c.end), parts: [{ lang: pasteLang, text: c.text }] })));
    setPasteText(''); setPasteFileName(''); setInputMode('manual');
    onAlert({ type: 'success', msg: `Đã phân tích ${cues.length} dòng. Kiểm tra lại rồi nhấn "Lưu".` });
  };

  const handleTranscribe = async () => {
    if (transcribing || !onTranscribe) return;
    if (rows.length && !window.confirm(`Kết quả AI sẽ thay thế ${rows.length} dòng hiện có. Tiếp tục?`)) return;
    canceledRef.current = false;
    setQa(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    setTranscribing(true);
    try {
      const data = await onTranscribe(controller.signal);
      if (!data) return;
      onAiResult(data.segments || [], data.transcript || '');
      setInputMode('manual');
      if (data.confidence != null)
        setQa({ confidence: data.confidence, flagged: data.flagged || 0, dropped: data.dropped || 0 });
      const pct = data.confidence != null ? ` Độ tự tin ${data.confidence}%.` : '';
      onAlert({ type: 'success', msg: `AI đã chép ${data.count ?? (data.segments || []).length} dòng.${pct} Đây là bản nháp — hãy kiểm tra và sửa lại các dòng được đánh dấu trước khi lưu.` });
    } catch (e) {
      if (canceledRef.current) onAlert({ type: 'info', msg: 'Đã huỷ chép lời tự động.' });
      else onAlert({ type: 'error', msg: e.response?.data?.error || e.data?.error || e.message });
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      abortRef.current = null;
      setTranscribing(false);
    }
  };

  const cancelTranscribe = () => {
    canceledRef.current = true;
    abortRef.current?.abort();
  };

  const modes = [['manual', 'edit', 'Nhập tay']];
  if (!simple) modes.push(['paste', 'content_paste', 'Dán SRT/VTT']);
  if (onTranscribe) modes.push(['ai', 'auto_awesome', 'Tự động (AI)']);

  return (
    <div>
      <label className="block text-sm font-medium text-on-muted mb-1">Bản chép đồng bộ thời gian</label>
      <p className="text-xs text-on-muted mb-3">
        Người học sẽ thấy danh sách lời thoại đồng bộ: dòng đang nói tự sáng, bấm dòng để tua lại.
        Mỗi dòng có thể gồm 1-3 ngôn ngữ (Nhật/Việt/Anh).
      </p>

      <div className="flex gap-2 mb-3">
        {modes.map(([mode, icon, label]) => (
          <button key={mode} type="button" onClick={() => setInputMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${inputMode === mode ? 'bg-sumire-purple text-white border-sumire-purple' : 'border-outline text-on-muted hover:border-sumire-purple'}`}>
            <span className="material-symbols-outlined text-sm">{icon}</span> {label}
          </button>
        ))}
      </div>

      {inputMode === 'paste' && (
        <div className="mb-4 p-4 rounded-xl border border-outline/40 bg-surface-low/50 space-y-3">
          <label className="flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed border-outline rounded-xl text-sm text-on-muted cursor-pointer hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
            <span className="material-symbols-outlined text-base">upload_file</span>
            Chọn file phụ đề (.srt/.vtt)
            <input type="file" accept=".srt,.vtt,text/vtt" onChange={handleSubtitleFile} className="hidden" />
          </label>
          {pasteFileName && <p className="text-xs text-on-muted">Đã chọn: {pasteFileName}</p>}
          <p className="text-xs text-on-muted">hoặc dán trực tiếp nội dung bên dưới</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6}
            placeholder={'Dán nội dung SRT hoặc VTT...\n\n1\n00:00:05,000 --> 00:00:08,500\n今日から勉強する'}
            className="w-full px-3 py-2.5 border border-outline rounded-xl text-xs font-mono outline-none focus:border-tsubaki-red transition-colors resize-none" />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-on-muted flex items-center gap-2">
              Ngôn ngữ của phụ đề:
              <select value={pasteLang} onChange={e => setPasteLang(e.target.value)} className="px-2 py-1.5 border border-outline rounded-lg text-xs outline-none">
                {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={handleParse} disabled={!pasteText.trim()}
              className="px-4 py-1.5 bg-tsubaki-red text-white rounded-xl text-xs font-medium hover:shadow-md transition-all disabled:opacity-50">
              Phân tích
            </button>
          </div>
        </div>
      )}

      {inputMode === 'ai' && onTranscribe && (
        <div className="mb-4 p-4 rounded-xl border border-outline/40 bg-surface-low/50 space-y-3">
          {!canTranscribe ? (
            <p className="text-xs text-on-muted">Cần có nguồn audio/video trước khi dùng chép lời tự động.</p>
          ) : transcribing ? (
            <>
              {/* Thanh loading indeterminate + đồng hồ + nút Huỷ (backend không phát tiến trình thật) */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-sumire-purple flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  Đang chép lời… {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} — có thể mất vài phút, đừng đóng trang
                </span>
                <button type="button" onClick={cancelTranscribe}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span> Huỷ
                </button>
              </div>
              <div className="h-1.5 w-full rounded-full bg-sumire-purple/15 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-sumire-purple animate-loadingbar" />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-on-muted">
                AI sẽ nghe nội dung, tách lời thoại theo thời gian và dịch bổ sung. Kết quả là <strong>bản nháp</strong> — hãy kiểm tra và sửa lại trước khi lưu.
                {isYouTube && <> Với YouTube: chỉ dùng video <strong>công khai</strong> và bạn có quyền sử dụng.</>}
              </p>
              <button type="button" onClick={handleTranscribe}
                className="flex items-center gap-2 px-4 py-2 bg-sumire-purple text-white rounded-xl text-xs font-medium hover:shadow-md transition-all">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Tự động chép lời (AI)
              </button>
            </>
          )}
        </div>
      )}

      {/* Bảng điểm độ tự tin sau khi AI chép lời */}
      {qa && (
        <div className={`mb-3 rounded-xl px-3 py-2 text-xs flex items-center gap-2 flex-wrap ${
          qa.confidence >= 85 ? 'bg-emerald-50 text-emerald-700'
          : qa.confidence >= 70 ? 'bg-amber-50 text-amber-700'
          : 'bg-red-50 text-red-700'}`}>
          <span className="material-symbols-outlined text-sm">verified</span>
          <strong>Độ tự tin tổng thể: {qa.confidence}%</strong>
          {qa.flagged > 0 && <span>· {qa.flagged} dòng cần kiểm tra (đánh dấu bên dưới)</span>}
          {qa.dropped > 0 && <span>· đã bỏ {qa.dropped} đoạn âm thanh nền</span>}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className={`p-3 rounded-xl border space-y-2 ${row.needsReview ? 'border-amber-300 bg-amber-50/40' : 'border-outline/40 bg-white'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container text-on-muted">#{i + 1}</span>
              {row.confidence != null && (
                <span title="Độ tự tin của AI cho dòng này"
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    row.confidence >= 85 ? 'bg-emerald-100 text-emerald-700'
                    : row.confidence >= 70 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'}`}>
                  {row.confidence}%
                </span>
              )}
              {row.needsReview && (
                <span title={row.note || 'AI không chắc chắn về đoạn này — nghe lại để xác nhận'} className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  <span className="material-symbols-outlined text-xs">warning</span> {row.note || 'Cần kiểm tra'}
                </span>
              )}
              {['start', 'end'].map(field => (
                <span key={field} className="flex items-center gap-1">
                  <input value={row[field]} onChange={e => updateRow(i, { [field]: e.target.value })}
                    placeholder={field === 'start' ? 'Bắt đầu (m:ss)' : 'Kết thúc (m:ss)'}
                    className={`w-24 px-2 py-1.5 border rounded-lg text-xs outline-none focus:border-tsubaki-red transition-colors ${row[field] && parseTime(row[field]) == null ? 'border-red-400' : 'border-outline'}`} />
                  {canGrabTime && (
                    <button type="button" onClick={() => grabTime(i, field)} title="Lấy thời gian đang phát"
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-surface-low transition-colors">
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
                <select value={part.lang} onChange={e => updatePart(i, j, { lang: e.target.value })} className="px-2 py-1.5 border border-outline rounded-lg text-xs outline-none shrink-0">
                  {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <input value={part.text} onChange={e => updatePart(i, j, { text: e.target.value })}
                  placeholder={part.lang === 'ja' ? '今日から勉強する' : part.lang === 'vi' ? 'Hôm nay bắt đầu học' : 'Starting to study today'}
                  className="flex-1 px-3 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red transition-colors" />
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
        <button type="button" onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-outline text-xs text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">
          <span className="material-symbols-outlined text-sm">add</span> Thêm dòng
        </button>
      </div>
    </div>
  );
}
