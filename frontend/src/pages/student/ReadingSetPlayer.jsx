import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import api from '../../lib/api';

const LEVEL_COLOR = {
  N5: 'bg-sky-100 text-sky-700 border-sky-200',
  N4: 'bg-green-100 text-green-700 border-green-200',
  N3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  N2: 'bg-orange-100 text-orange-700 border-orange-200',
  N1: 'bg-red-100 text-red-700 border-red-200',
};

function optionLabel(idx) { return String.fromCharCode(65 + idx); }

export default function ReadingSetPlayer() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [rs, setRs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Answer state: { [passageIdx-questionIdx]: selectedOptionIdx | optionIdx[] | string }
  const [answers, setAnswers] = useState({});
  // Submitted state
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore]         = useState(null); // { correct, total }

  // Font size
  const [fontSize, setFontSize] = useState(16);
  // Furigana toggle (stub — could call /api/ai/furigana later)
  const [showFurigana, setShowFurigana] = useState(false);

  useEffect(() => {
    api.get(`/reading-sets/${id}`)
      .then(r => setRs(r.data.readingSet))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const answerKey = (pi, qi) => `${pi}-${qi}`;

  const setAnswer = (pi, qi, qType, val) => {
    if (submitted) return;
    const key = answerKey(pi, qi);
    if (qType === 'multiple_choice') {
      setAnswers(a => {
        const prev = Array.isArray(a[key]) ? a[key] : [];
        return { ...a, [key]: prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val] };
      });
    } else {
      setAnswers(a => ({ ...a, [key]: val }));
    }
  };

  const handleSubmit = () => {
    let correct = 0, total = 0;
    for (const [pi, p] of (rs?.passages || []).entries()) {
      for (const [qi, q] of (p.questions || []).entries()) {
        if (!['single_choice','multiple_choice','true_false'].includes(q.question_type)) continue;
        total++;
        const key = answerKey(pi, qi);
        const ans = answers[key];
        const correctOpts = (q.options || []).map((o, i) => ({ ...o, idx: i })).filter(o => o.is_correct).map(o => o.idx);
        if (q.question_type === 'multiple_choice') {
          const selected = Array.isArray(ans) ? ans.sort() : [];
          if (JSON.stringify(selected.sort()) === JSON.stringify(correctOpts.sort())) correct++;
        } else {
          if (ans === correctOpts[0]) correct++;
        }
      }
    }
    setScore({ correct, total });
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return (
    <StudentLayout title="Bài đọc">
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-tsubaki-red border-t-transparent rounded-full animate-spin" />
      </div>
    </StudentLayout>
  );

  if (error) return (
    <StudentLayout title="Bài đọc">
      <div className="max-w-2xl mx-auto text-center py-24">
        <span className="material-symbols-outlined text-5xl text-red-300 block mb-3">error</span>
        <p className="text-red-600 font-medium mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2 bg-tsubaki-red text-white rounded-xl">Quay lại</button>
      </div>
    </StudentLayout>
  );

  if (!rs) return null;

  const totalQ = (rs.passages || []).reduce((s, p) => s + (p.questions || []).filter(q => ['single_choice','multiple_choice','true_false'].includes(q.question_type)).length, 0);
  const answeredCount = Object.keys(answers).length;

  return (
    <StudentLayout title="Luyện đọc hiểu">
      <div className="max-w-3xl mx-auto">

        {/* Score banner */}
        {submitted && score && (
          <div className={`rounded-2xl p-6 mb-6 text-center ${score.correct / score.total >= 0.8 ? 'bg-emerald-50 border-2 border-emerald-300' : score.correct / score.total >= 0.5 ? 'bg-amber-50 border-2 border-amber-300' : 'bg-red-50 border-2 border-red-300'}`}>
            <div className="text-4xl font-bold font-display mb-1">
              {score.correct}<span className="text-xl text-on-muted font-normal"> / {score.total}</span>
            </div>
            <p className="text-sm text-on-muted mb-1">câu trả lời đúng</p>
            <div className="text-2xl font-bold mt-2">
              {Math.round((score.correct / score.total) * 100)}%
            </div>
            <p className="text-sm mt-3 font-medium">
              {score.correct === score.total ? '🎉 Xuất sắc! Bạn đã trả lời đúng tất cả câu hỏi!' :
               score.correct / score.total >= 0.8 ? '👍 Rất tốt! Tiếp tục luyện tập nhé.' :
               score.correct / score.total >= 0.5 ? '💪 Khá ổn! Hãy xem lại những câu sai.' :
               '📚 Hãy đọc lại đoạn văn và thử lại.'}
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={handleReset}
                className="px-5 py-2 border border-outline rounded-xl text-sm font-medium hover:bg-surface-low">
                Làm lại
              </button>
              <button onClick={() => navigate('/reading')}
                className="px-5 py-2 bg-tsubaki-red text-white rounded-xl text-sm font-semibold hover:opacity-90">
                Bài đọc khác
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {rs.jlpt_level && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${LEVEL_COLOR[rs.jlpt_level] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                {rs.jlpt_level}
              </span>
            )}
            {rs.topic && <span className="px-2.5 py-0.5 rounded-full bg-surface text-xs text-on-muted">{rs.topic}</span>}
            {rs.estimated_time_minutes && (
              <span className="flex items-center gap-1 text-xs text-on-muted">
                <span className="material-symbols-outlined text-xs" style={{fontSize:13}}>schedule</span>
                {rs.estimated_time_minutes} phút
              </span>
            )}
          </div>
          <h1 className="font-display font-bold text-2xl">{rs.title}</h1>
          {rs.short_description && <p className="text-on-muted text-sm mt-1">{rs.short_description}</p>}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-1 border border-outline rounded-lg p-0.5">
            <button onClick={() => setFontSize(f => Math.max(12, f - 1))}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-low text-on-muted text-sm">A−</button>
            <span className="px-2 text-xs text-on-muted tabular-nums">{fontSize}</span>
            <button onClick={() => setFontSize(f => Math.min(22, f + 1))}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-low text-on-muted text-sm">A+</button>
          </div>
          <button
            onClick={() => setShowFurigana(f => !f)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${showFurigana ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-outline text-on-muted hover:bg-surface-low'}`}>
            <span className="material-symbols-outlined text-sm">translate</span>
            Furigana
          </button>
          {!submitted && (
            <div className="ml-auto text-xs text-on-muted">
              {answeredCount}/{totalQ} câu đã trả lời
            </div>
          )}
        </div>

        {/* Instructions */}
        {rs.instructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 mb-6">
            <strong>📋 Hướng dẫn:</strong> {rs.instructions}
          </div>
        )}

        {/* Passages */}
        <div className="space-y-8">
          {(rs.passages || []).map((p, pi) => (
            <div key={p.id || pi} className="glass-card rounded-2xl overflow-hidden">
              {/* Passage header */}
              {(p.title || rs.passages.length > 1) && (
                <div className="px-5 py-3 border-b border-outline/20 bg-surface/30">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-tsubaki-red text-white text-xs font-bold">
                      {pi + 1}
                    </span>
                    {p.title || `Đoạn văn ${pi + 1}`}
                  </h2>
                </div>
              )}

              {/* Passage text */}
              <div className="px-5 py-5 border-b border-outline/20">
                <div
                  className="leading-loose whitespace-pre-wrap"
                  style={{ fontSize, fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
                >
                  {p.content}
                </div>
              </div>

              {/* Questions for this passage */}
              {(p.questions || []).length > 0 && (
                <div className="px-5 py-5 space-y-6">
                  <h3 className="text-sm font-bold text-on-muted uppercase tracking-wide">Câu hỏi</h3>
                  {p.questions.map((q, qi) => {
                    const key = answerKey(pi, qi);
                    const ans = answers[key];
                    const correctIdxs = (q.options || []).map((o, i) => o.is_correct ? i : -1).filter(i => i >= 0);
                    const isChoice = ['single_choice','multiple_choice','true_false'].includes(q.question_type);

                    const getOptionStyle = (oi) => {
                      if (!submitted || !isChoice) {
                        const selected = q.question_type === 'multiple_choice' ? Array.isArray(ans) && ans.includes(oi) : ans === oi;
                        return selected
                          ? 'border-tsubaki-red bg-tsubaki-red/5 text-charcoal'
                          : 'border-outline/40 hover:border-tsubaki-red/40 hover:bg-surface-low/50';
                      }
                      const isCorrect = correctIdxs.includes(oi);
                      const selected  = q.question_type === 'multiple_choice' ? Array.isArray(ans) && ans.includes(oi) : ans === oi;
                      if (isCorrect)  return 'border-emerald-400 bg-emerald-50 text-emerald-800';
                      if (selected)   return 'border-red-300 bg-red-50 text-red-700';
                      return 'border-outline/20 text-on-muted/60';
                    };

                    return (
                      <div key={q.id || qi}>
                        <p className="font-medium text-sm mb-3">
                          <span className="text-tsubaki-red font-bold mr-1.5">問{qi + 1}</span>
                          {q.question_text}
                        </p>

                        {isChoice && (
                          <div className="space-y-2">
                            {(q.options || []).filter(o => o.option_text).map((o, oi) => {
                              const selected = q.question_type === 'multiple_choice'
                                ? Array.isArray(ans) && ans.includes(oi)
                                : ans === oi;
                              return (
                                <button
                                  key={oi}
                                  onClick={() => setAnswer(pi, qi, q.question_type, oi)}
                                  disabled={submitted}
                                  className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${getOptionStyle(oi)} ${!submitted ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                  {/* Indicator */}
                                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-all ${selected && !submitted ? 'border-tsubaki-red bg-tsubaki-red text-white' : submitted && correctIdxs.includes(oi) ? 'border-emerald-500 bg-emerald-500 text-white' : submitted && selected ? 'border-red-400 bg-red-100 text-red-700' : 'border-outline/50 text-on-muted'}`}>
                                    {submitted && correctIdxs.includes(oi) ? '✓' : submitted && selected ? '✗' : optionLabel(oi)}
                                  </span>
                                  <span className="text-sm">{o.option_text}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.question_type === 'fill_blank' && (
                          <input
                            disabled={submitted}
                            placeholder="Nhập đáp án..."
                            value={typeof ans === 'string' ? ans : ''}
                            onChange={e => setAnswer(pi, qi, 'fill_blank', e.target.value)}
                            className="w-full px-4 py-2.5 border border-outline rounded-xl text-sm focus:outline-none focus:border-tsubaki-red disabled:bg-surface-low disabled:cursor-not-allowed"
                          />
                        )}

                        {q.question_type === 'short_answer' && (
                          <textarea
                            disabled={submitted}
                            placeholder="Nhập câu trả lời..."
                            value={typeof ans === 'string' ? ans : ''}
                            onChange={e => setAnswer(pi, qi, 'short_answer', e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2.5 border border-outline rounded-xl text-sm focus:outline-none focus:border-tsubaki-red resize-none disabled:bg-surface-low disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Explanation (shown after submit) */}
                        {submitted && q.explanation && (
                          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                            <strong>💡 Giải thích:</strong> {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit bar */}
        {!submitted && totalQ > 0 && (
          <div className="sticky bottom-6 mt-8">
            <div className="flex items-center justify-between bg-white border border-outline/30 shadow-xl shadow-charcoal/10 rounded-2xl px-5 py-4">
              <div className="text-sm">
                <span className="font-bold text-tsubaki-red tabular-nums">{answeredCount}</span>
                <span className="text-on-muted">/{totalQ} câu đã trả lời</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={answeredCount === 0}
                className="px-6 py-2.5 bg-tsubaki-red text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
                Nộp bài
              </button>
            </div>
          </div>
        )}

        <div className="h-24" />
      </div>
    </StudentLayout>
  );
}
