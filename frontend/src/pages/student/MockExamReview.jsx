import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import AudioPlayer from '../../components/mockexam/AudioPlayer';
import { sectionDisplay, MONDAI_INSTRUCTION_VI } from '../../lib/mockExamConstants';
import { getMockReview } from '../../lib/mockExamApi';

export default function MockExamReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [furigana, setFurigana] = useState(false);
  const [openTranscript, setOpenTranscript] = useState({});

  useEffect(() => {
    getMockReview(attemptId).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <StudentLayout title="Xem lại"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (!data) return <StudentLayout title="Xem lại"><Alert type="error">{error}</Alert></StudentLayout>;

  // Danh sách phẳng toàn bộ câu hỏi (đúng thứ tự hiển thị) cho đánh số + nav grid
  const allQuestions = data.sections.flatMap(s => s.groups.flatMap(g => g.questions));
  const numById = {};
  allQuestions.forEach((q, i) => { numById[q.id] = i + 1; });
  const correctCount = allQuestions.filter(q => q.is_correct).length;

  return (
    <StudentLayout title="Xem lại bài làm">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-5">
      <div className="space-y-5 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(`/mock-exams/attempt/${attemptId}/result`)} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Kết quả
          </button>
          <button onClick={() => setFurigana(f => !f)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-outline text-on-muted'}`}>あ</button>
        </div>

        {data.sections.map(section => (
          <div key={section.id} className="space-y-3">
            <h2 className="font-display font-bold text-charcoal border-b border-outline/30 pb-1">{sectionDisplay(section)}</h2>
            {section.groups.map(group => (
              <div key={group.id} className="space-y-3">
                {group.instruction_text && (
                  <div>
                    <p className="text-xs font-semibold text-on-muted">問題{group.mondai_number} · {group.instruction_text}</p>
                    {MONDAI_INSTRUCTION_VI[group.mondai_type] && (
                      <p className="text-xs text-on-muted italic mt-0.5">{MONDAI_INSTRUCTION_VI[group.mondai_type]}</p>
                    )}
                  </div>
                )}
                {group.passage_text && (
                  <div className="bg-surface-low border border-outline/30 rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    <FuriganaText text={group.passage_text} enabled={furigana} block />
                  </div>
                )}
                {group.audio_url && <AudioPlayer src={group.audio_url} label={`問題${group.mondai_number} — Audio`} />}
                {group.audio_transcript && (
                  <div className="text-xs">
                    <button onClick={() => setOpenTranscript(o => ({ ...o, [group.id]: !o[group.id] }))} className="text-tsubaki-red font-semibold">
                      {openTranscript[group.id] ? 'Ẩn transcript' : 'Xem transcript'}
                    </button>
                    {openTranscript[group.id] && <p className="mt-1 bg-blue-50 border border-blue-200 rounded-lg p-2 whitespace-pre-wrap text-blue-900">{group.audio_transcript}</p>}
                  </div>
                )}
                {group.questions.map(q => {
                  const num = numById[q.id];
                  return (
                    <div key={q.id} id={`q-${q.id}`} className={`border rounded-xl p-4 scroll-mt-20 ${q.is_correct ? 'border-green-200 bg-green-50/40' : 'border-error/30 bg-error-bg/20'}`}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`w-6 h-6 shrink-0 rounded-full text-white text-xs font-bold flex items-center justify-center ${q.is_correct ? 'bg-green-500' : 'bg-error'}`}>{q.is_correct ? '✓' : '✕'}</span>
                        <div className="flex-1 text-sm font-medium text-charcoal">
                          <span className="text-on-muted mr-1">{num}.</span>
                          {q.question_text ? <FuriganaText text={q.question_text} enabled={furigana} /> : <span className="text-on-muted italic">Câu nghe</span>}
                        </div>
                      </div>
                      {q.audio_url && <div className="mb-2"><AudioPlayer src={q.audio_url} label={`Câu ${num}`} /></div>}
                      <div className="space-y-1.5">
                        {q.options.map((opt, idx) => {
                          const isCorrect = idx === q.correct_index;
                          const isPicked = idx === q.selected_index;
                          return (
                            <div key={idx} className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${
                              isCorrect ? 'border-green-400 bg-green-100/60' : isPicked ? 'border-error/50 bg-error-bg/40' : 'border-outline/40'}`}>
                              <span className={`w-5 h-5 shrink-0 rounded-full text-[11px] font-bold flex items-center justify-center border ${isCorrect ? 'bg-green-500 border-green-500 text-white' : isPicked ? 'bg-error border-error text-white' : 'border-outline text-on-muted'}`}>{idx + 1}</span>
                              <FuriganaText text={opt} enabled={furigana} />
                              {isCorrect && <span className="ml-auto text-xs text-green-700 font-semibold">Đáp án đúng</span>}
                              {isPicked && !isCorrect && <span className="ml-auto text-xs text-error font-semibold">Bạn chọn</span>}
                            </div>
                          );
                        })}
                      </div>
                      {q.selected_index == null && <p className="text-xs text-on-muted mt-1.5 italic">Bạn chưa trả lời câu này.</p>}
                      {q.explanation && <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-900"><b>Giải thích:</b> {q.explanation}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Nav grid: bấm nhanh đến câu — xanh = đúng, đỏ = sai/chưa trả lời */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 bg-white border border-outline/40 rounded-xl p-3">
          <p className="text-xs font-semibold text-on-muted mb-2">Đúng {correctCount}/{allQuestions.length}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {allQuestions.map((q, i) => (
              <button key={q.id}
                onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                title={q.is_correct ? 'Đúng' : 'Sai / chưa trả lời'}
                className={`aspect-square rounded text-xs font-bold flex items-center justify-center text-white hover:opacity-80 transition-opacity ${q.is_correct ? 'bg-green-500' : 'bg-error'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-on-muted">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block" />Đúng</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-error inline-block" />Sai</span>
          </div>
        </div>
      </aside>
      </div>
    </StudentLayout>
  );
}
