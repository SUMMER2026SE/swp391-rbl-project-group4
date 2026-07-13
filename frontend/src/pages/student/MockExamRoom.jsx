import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import AudioPlayer from '../../components/mockexam/AudioPlayer';
import { sectionDisplay, MONDAI_INSTRUCTION_VI, formatDuration } from '../../lib/mockExamConstants';
import { getMockCurrent, saveMockAnswers, submitMockSection } from '../../lib/mockExamApi';

export default function MockExamRoom() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [section, setSection] = useState(null);
  const [answers, setAnswers] = useState({});        // { question_id: selected_index }
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [breakInfo, setBreakInfo] = useState(null);  // { nextTitle } giữa các phần

  const dirtyRef = useRef({});     // đáp án chưa lưu
  const submittingRef = useRef(false);

  // ── Nạp section hiện tại ──
  const loadCurrent = useCallback(() => {
    setLoading(true);
    getMockCurrent(attemptId)
      .then(r => {
        if (r.finished) { navigate(`/mock-exams/attempt/${attemptId}/result`, { replace: true }); return; }
        setSection(r.section);
        setAnswers(r.saved_answers || {});
        setRemaining(r.remaining_seconds);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [attemptId, navigate]);

  useEffect(loadCurrent, [loadCurrent]);

  // ── Đồng hồ đếm ngược (nguồn: remaining_seconds server) ──
  useEffect(() => {
    if (remaining == null || breakInfo) return;
    if (remaining <= 0) { handleSubmit(true); return; }
    const t = setInterval(() => setRemaining(r => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining, breakInfo]);

  // ── Auto-save đáp án chưa lưu mỗi 10s ──
  useEffect(() => {
    const t = setInterval(flushAnswers, 10000);
    return () => clearInterval(t);
  }, [attemptId]);

  const flushAnswers = async () => {
    const pending = Object.entries(dirtyRef.current);
    if (!pending.length) return;
    const payload = pending.map(([question_id, selected_index]) => ({ question_id, selected_index }));
    dirtyRef.current = {};
    try { await saveMockAnswers(attemptId, payload); } catch { /* sẽ thử lại lần sau */ }
  };

  const pick = (questionId, idx) => {
    setAnswers(a => ({ ...a, [questionId]: idx }));
    dirtyRef.current[questionId] = idx;
  };

  // ── Nộp phần / nộp bài ──
  const handleSubmit = async (auto = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setConfirmSubmit(false); setError('');
    try {
      const payload = Object.entries({ ...answers }).map(([question_id, selected_index]) => ({ question_id, selected_index }));
      dirtyRef.current = {};
      const r = await submitMockSection(attemptId, section.position, payload);
      if (r.finished) {
        navigate(`/mock-exams/attempt/${attemptId}/result`, { replace: true });
        return;
      }
      // sang phần kế — hiện màn nghỉ ngắn
      setBreakInfo({ nextTitle: sectionDisplay(r.section), nextMin: Math.round(r.remaining_seconds / 60) });
      setSection(r.section);
      setAnswers({});
      setRemaining(r.remaining_seconds);
    } catch (e) {
      // Hết giờ phía server → đồng bộ lại
      if (e.status === 403 || e.status === 400) { submittingRef.current = false; loadCurrent(); return; }
      setError(e.message);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div>;
  if (error && !section) return <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3 p-6"><Alert type="error">{error}</Alert><Button variant="secondary" onClick={() => navigate('/mock-exams')}>Về danh sách</Button></div>;
  if (!section) return null;

  const isListening = section.section_type === 'listening';
  const allQuestions = section.groups.flatMap(g => g.questions);
  const answeredCount = allQuestions.filter(q => answers[q.id] != null).length;
  const lowTime = remaining != null && remaining <= 60;

  // Màn nghỉ giữa các phần
  if (breakInfo) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-outline/40 p-8 max-w-md text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-tsubaki-red">check_circle</span>
          <h2 className="font-display text-xl font-bold text-charcoal">Đã nộp phần thi</h2>
          <p className="text-sm text-on-muted">Phần tiếp theo: <b>{breakInfo.nextTitle}</b> — {breakInfo.nextMin} phút. Đồng hồ đã bắt đầu chạy.</p>
          <Button className="w-full" onClick={() => setBreakInfo(null)}>Vào phần tiếp theo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-outline/30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-on-muted">Phần thi</p>
            <p className="font-bold text-charcoal truncate">{sectionDisplay(section)}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold tabular-nums ${lowTime ? 'bg-error-bg text-error animate-pulse' : 'bg-surface-low text-charcoal'}`}>
              <span className="material-symbols-outlined text-lg">timer</span>{formatDuration(remaining)}
            </div>
            <Button size="sm" onClick={() => setConfirmSubmit(true)} loading={submitting}>Nộp phần</Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-5">
        {/* Câu hỏi */}
        <div className="space-y-6">
          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
          {section.groups.map(group => {
            const hasPassage = !!group.passage_text || !!group.image_url;
            return (
              <div key={group.id} className="scroll-mt-20" id={`group-${group.id}`}>
                {group.instruction_text && (
                  <div className="bg-charcoal/5 rounded-lg px-3 py-2 text-sm mb-3">
                    <span className="font-semibold text-charcoal">問題{group.mondai_number} · </span>
                    <span className="text-on-muted">{group.instruction_text}</span>
                    {MONDAI_INSTRUCTION_VI[group.mondai_type] && (
                      <p className="text-xs text-on-muted italic mt-1">{MONDAI_INSTRUCTION_VI[group.mondai_type]}</p>
                    )}
                  </div>
                )}
                {group.audio_url && <div className="mb-3"><AudioPlayer src={group.audio_url} label={`問題${group.mondai_number} — Audio`} /></div>}

                <div className={hasPassage ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
                  {hasPassage && (
                    <div className="md:sticky md:top-20 md:self-start bg-white border border-outline/40 rounded-xl p-4 max-h-[70vh] overflow-y-auto">
                      {group.image_url && <img src={group.image_url} className="w-full rounded-lg mb-3" alt="" />}
                      {group.passage_text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{group.passage_text}</p>}
                    </div>
                  )}
                  <div className="space-y-4">
                    {group.questions.map((q, qi) => {
                      const num = allQuestions.findIndex(x => x.id === q.id) + 1;
                      return (
                        <div key={q.id} id={`q-${q.id}`} className="bg-white border border-outline/40 rounded-xl p-4 scroll-mt-20">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="w-6 h-6 shrink-0 rounded-full bg-tsubaki-red text-white text-xs font-bold flex items-center justify-center">{num}</span>
                            <div className="flex-1 text-sm font-medium text-charcoal">
                              {q.question_text ? <span className="whitespace-pre-wrap">{q.question_text}</span> : <span className="text-on-muted italic">Nghe audio và chọn đáp án</span>}
                            </div>
                          </div>
                          {q.audio_url && <div className="mb-3"><AudioPlayer src={q.audio_url} label={`Câu ${num}`} /></div>}
                          <div className="space-y-2">
                            {q.options.map((opt, idx) => (
                              <button key={idx} onClick={() => pick(q.id, idx)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm flex items-center gap-2.5 transition-colors ${answers[q.id] === idx ? 'border-tsubaki-red bg-tsubaki-red/5 text-charcoal' : 'border-outline hover:border-tsubaki-red/40'}`}>
                                <span className={`w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border ${answers[q.id] === idx ? 'bg-tsubaki-red border-tsubaki-red text-white' : 'border-outline text-on-muted'}`}>{idx + 1}</span>
                                <span>{opt}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-2">
            <Button className="w-full" onClick={() => setConfirmSubmit(true)} loading={submitting}>Nộp phần này ➜</Button>
          </div>
        </div>

        {/* Nav grid */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 bg-white border border-outline/40 rounded-xl p-3">
            <p className="text-xs font-semibold text-on-muted mb-2">Đã làm {answeredCount}/{allQuestions.length}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {allQuestions.map((q, i) => (
                <button key={q.id} onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className={`aspect-square rounded text-xs font-bold flex items-center justify-center ${answers[q.id] != null ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-outline/40'}`}>{i + 1}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Nộp phần thi này?"
        footer={<>
          <Button variant="secondary" onClick={() => setConfirmSubmit(false)}>Tiếp tục làm</Button>
          <Button onClick={() => handleSubmit(false)} loading={submitting}>Nộp phần</Button>
        </>}>
        <p className="text-sm text-on-surface-variant">
          Bạn đã làm <b>{answeredCount}/{allQuestions.length}</b> câu. Sau khi nộp <b>không thể quay lại</b> phần này. {isListening ? 'Đây là phần cuối — nộp xong sẽ chấm điểm.' : 'Đồng hồ phần tiếp theo sẽ chạy ngay.'}
        </p>
      </Modal>
    </div>
  );
}
