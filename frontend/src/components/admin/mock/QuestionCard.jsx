import { useState } from 'react';
import Button from '../../ui/Button';
import { adminUploadMedia, adminGenerateQuestionAudio } from '../../../lib/mockExamApi';

// Card soạn/sửa 1 câu hỏi trắc nghiệm (3–4 lựa chọn). Dùng cho câu đã lưu (editable inline).
// value: { id?, question_text, options[], correct_index, explanation, audio_url, image_url, audio_transcript }
export default function QuestionCard({ index, value, onSave, onDelete, listening, saving, disabled }) {
  const [q, setQ] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tts, setTts] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const update = (patch) => { setQ(prev => ({ ...prev, ...patch })); setDirty(true); };
  const setOption = (i, val) => {
    const options = [...q.options]; options[i] = val;
    update({ options });
  };
  const setCount = (n) => {
    let options = [...q.options];
    while (options.length < n) options.push('');
    options = options.slice(0, n);
    update({ options, correct_index: Math.min(q.correct_index, n - 1) });
  };
  const uploadAudio = async (file) => {
    if (!file) return;
    setUploading(true); setMediaError('');
    try { const { url } = await adminUploadMedia('audio', file); update({ audio_url: url }); }
    catch (e) { setMediaError(e.message); }
    finally { setUploading(false); }
  };
  // TTS đọc transcript ĐÃ LƯU trong DB → cần lưu câu trước khi tạo audio
  const generateAudio = async () => {
    setTts(true); setMediaError('');
    try {
      const r = await adminGenerateQuestionAudio(q.id);
      setQ(prev => ({ ...prev, audio_url: r.audio_url }));
    } catch (e) { setMediaError(e.message); }
    finally { setTts(false); }
  };

  const canSave = q.options.every(o => o.trim()) && q.options.length >= 3;

  return (
    <div className="border border-outline/40 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-on-muted">Câu {index + 1}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCount(3)} disabled={disabled}
            className={`text-xs px-2 py-0.5 rounded ${q.options.length === 3 ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted'}`}>3 lựa chọn</button>
          <button onClick={() => setCount(4)} disabled={disabled}
            className={`text-xs px-2 py-0.5 rounded ${q.options.length === 4 ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted'}`}>4 lựa chọn</button>
        </div>
      </div>

      <textarea
        value={q.question_text || ''} disabled={disabled}
        onChange={e => update({ question_text: e.target.value })}
        placeholder={listening ? 'Nội dung câu hỏi (có thể để trống với 即時応答)' : 'Nội dung câu hỏi (tiếng Nhật)'}
        className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[52px] outline-none focus:border-tsubaki-red"
      />

      {listening && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {q.audio_url
              ? <audio src={q.audio_url} controls className="h-8 max-w-[60%]" />
              : <span className="text-on-muted">Chưa có audio cho câu (bắt buộc để xuất bản)</span>}
            <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline">
              {uploading ? 'Đang tải…' : (q.audio_url ? 'Đổi audio' : 'Tải audio câu')}
              <input type="file" accept="audio/*" className="hidden" disabled={disabled}
                onChange={e => uploadAudio(e.target.files[0])} />
            </label>
          </div>
          <textarea
            value={q.audio_transcript || ''} disabled={disabled}
            onChange={e => update({ audio_transcript: e.target.value })}
            placeholder="Transcript (hiện khi học viên xem lại) — mỗi lượt thoại một dòng, có nhãn 男：/女："
            className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[48px] outline-none focus:border-tsubaki-red"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" loading={tts}
              disabled={disabled || !q.id || dirty || !q.audio_transcript?.trim()}
              onClick={generateAudio}>
              <span className="material-symbols-outlined text-base">record_voice_over</span>
              Tạo audio từ transcript (TTS)
            </Button>
            <span className="text-[11px] text-on-muted">
              {!q.id || dirty
                ? 'Lưu câu trước rồi mới tạo audio (TTS đọc transcript đã lưu).'
                : 'Giọng máy đọc theo nhãn 男：(nam) / 女：(nữ) — có thể upload file thu âm riêng để thay thế.'}
            </span>
          </div>
          {mediaError && <p className="text-xs text-error">{mediaError}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        {q.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => update({ correct_index: i })} disabled={disabled}
              title="Đánh dấu đáp án đúng"
              className={`w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border-2 ${
                q.correct_index === i ? 'bg-green-500 border-green-500 text-white' : 'border-outline text-on-muted'}`}>
              {i + 1}
            </button>
            <input value={opt} disabled={disabled}
              onChange={e => setOption(i, e.target.value)}
              placeholder={`Lựa chọn ${i + 1}`}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:border-tsubaki-red ${q.correct_index === i ? 'border-green-400 bg-green-50' : 'border-outline'}`} />
          </div>
        ))}
      </div>

      <textarea
        value={q.explanation || ''} disabled={disabled}
        onChange={e => update({ explanation: e.target.value })}
        placeholder="Giải thích (hiện khi học viên xem lại bài)"
        className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[44px] outline-none focus:border-tsubaki-red"
      />

      <textarea
        value={q.translation_vi || ''} disabled={disabled}
        onChange={e => update({ translation_vi: e.target.value })}
        placeholder="Bản dịch tiếng Việt (không bắt buộc — hiện khi học viên xem lại bài)"
        className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[44px] outline-none focus:border-tsubaki-red"
      />

      <div className="flex items-center justify-end gap-2">
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={() => onDelete(q)} disabled={disabled}>
            <span className="material-symbols-outlined text-lg">delete</span>
          </Button>
        )}
        {onSave && (
          <Button size="sm" onClick={() => { onSave(q); setDirty(false); }} loading={saving} disabled={disabled || !canSave || !dirty}>
            {dirty ? 'Lưu' : 'Đã lưu'}
          </Button>
        )}
      </div>
    </div>
  );
}
