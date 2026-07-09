import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import AudioPlayer from '../../components/mockexam/AudioPlayer';
import { SECTION_LABEL, mondaiJa } from '../../lib/mockExamConstants';
import { getMockReview } from '../../lib/mockExamApi';

export default function MockExamReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [furigana, setFurigana] = useState(false);
  const [openTranscript, setOpenTranscript] = useState({});
  const [filter, setFilter] = useState('all');   // all | wrong

  useEffect(() => {
    getMockReview(attemptId).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <StudentLayout title="Xem lại"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></StudentLayout>;
  if (!data) return <StudentLayout title="Xem lại"><Alert type="error">{error}</Alert></StudentLayout>;

  let counter = 0;

  return (
    <StudentLayout title="Xem lại bài làm">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => navigate(`/mock-exams/attempt/${attemptId}/result`)} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Kết quả
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilter(f => f === 'all' ? 'wrong' : 'all')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold ${filter === 'wrong' ? 'bg-error-bg text-error border-error/30' : 'border-outline text-on-muted'}`}>
              {filter === 'wrong' ? 'Chỉ câu sai' : 'Tất cả câu'}
            </button>
            <button onClick={() => setFurigana(f => !f)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'border-outline text-on-muted'}`}>あ</button>
          </div>
        </div>

        {data.sections.map(section => (
          <div key={section.id} className="space-y-3">
            <h2 className="font-display font-bold text-charcoal border-b border-outline/30 pb-1">{section.title || SECTION_LABEL[section.section_type]}</h2>
            {section.groups.map(group => (
              <div key={group.id} className="space-y-3">
                {group.instruction_text && <p className="text-xs font-semibold text-on-muted">問題{group.mondai_number} · {group.instruction_text}</p>}
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
                  counter += 1;
                  const num = counter;
                  if (filter === 'wrong' && q.is_correct) return null;
                  return (
                    <div key={q.id} className={`border rounded-xl p-4 ${q.is_correct ? 'border-green-200 bg-green-50/40' : 'border-error/30 bg-error-bg/20'}`}>
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
    </StudentLayout>
  );
}
