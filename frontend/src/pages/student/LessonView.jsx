import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';
import { renderMarkdown, renderReadingText } from '../../lib/renderPreview';

function getLessonHtml(lesson) {
  if (!lesson.content) return '';
  if (lesson.lesson_type === 'grammar') {
    return `<p class="mb-3">${renderMarkdown(lesson.content)}</p>`;
  }
  if (lesson.lesson_type === 'reading') {
    try {
      const parsed = JSON.parse(lesson.content);
      return `<p class="mb-4">${renderReadingText(parsed.text || '')}</p>`;
    } catch {
      return `<p class="mb-4">${renderReadingText(lesson.content)}</p>`;
    }
  }
  return lesson.content;
}

function getReadingImage(lesson) {
  if (lesson.lesson_type !== 'reading' || !lesson.content) return null;
  try {
    const parsed = JSON.parse(lesson.content);
    return parsed.imageUrl || null;
  } catch {
    return null;
  }
}

const QUIZ_TYPE_LABEL = {
  single_choice:   'Trắc nghiệm',
  multiple_choice: 'Nhiều đáp án',
  matching:        'Ghép cặp',
  fill_blank:      'Điền vào chỗ trống',
  short_answer:    'Trả lời ngắn',
};

export default function LessonView() {
  const { id }  = useParams();
  const [lesson, setLesson]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [furigana, setFurigana] = useState(false);

  useEffect(() => {
    api.get(`/lessons/${id}`)
      .then(r => setLesson(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <StudentLayout title="...">
      <div className="flex justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    </StudentLayout>
  );

  if (error || !lesson) return (
    <StudentLayout title="Lỗi">
      <Alert type="error">{error || 'Không tìm thấy bài học.'}</Alert>
    </StudentLayout>
  );

  const readingImage = getReadingImage(lesson);

  return (
    <StudentLayout title={lesson.title}>
      <div className="max-w-3xl mx-auto">
        <Link to={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-6 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại khoá học
        </Link>

        {/* ── Main content card ───────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-8 mb-6">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h1 className="font-display text-3xl font-bold">{lesson.title}</h1>
            <button
              type="button"
              onClick={() => setFurigana(v => !v)}
              title={furigana ? 'Ẩn furigana' : 'Hiển thị furigana'}
              className={`shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-all select-none ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
              <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
              ふりがな
            </button>
          </div>
          {lesson.title_ja && (
            <div className="mb-6">
              <FuriganaText text={lesson.title_ja} enabled={furigana} textClassName="text-on-muted" block />
            </div>
          )}

          {/* Reading image */}
          {readingImage && (
            <img src={readingImage} alt="" className="w-full rounded-xl mb-5 object-cover max-h-72" />
          )}

          {/* Lesson content */}
          {lesson.content ? (
            <div className="prose prose-sm max-w-none text-on-surface leading-relaxed"
              dangerouslySetInnerHTML={{ __html: getLessonHtml(lesson) }} />
          ) : (
            <p className="text-on-muted italic">Nội dung bài học đang được cập nhật...</p>
          )}
        </div>

        {/* ── Vocabulary ─────────────────────────────────────────────── */}
        {lesson.vocabulary?.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-tsubaki-red">translate</span>
                Từ vựng trong bài ({lesson.vocabulary.length})
              </h2>
            </div>
            <div className="divide-y divide-outline/20">
              {lesson.vocabulary.map(v => (
                <div key={v.id} className="flex items-start gap-4 p-4">
                  <div className="text-2xl font-bold text-tsubaki-red w-16 shrink-0 text-center pt-1">
                    <FuriganaText text={v.kanji || v.reading} enabled={furigana} textClassName="text-2xl font-bold text-tsubaki-red" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{v.reading}</p>
                    <p className="text-xs text-on-muted">{v.meaning_vi}</p>
                    {v.meaning_ja && <p className="text-xs text-on-muted/70">{v.meaning_ja}</p>}
                    {v.example_sentence && (
                      <p className="text-xs text-on-muted italic mt-1.5 border-l-2 border-tsubaki-red/30 pl-2">
                        {v.example_sentence}
                      </p>
                    )}
                  </div>
                  {v.type && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted shrink-0">{v.type}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Kanji ──────────────────────────────────────────────────── */}
        {lesson.kanji?.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-sumire-purple">draw</span>
                Kanji trong bài ({lesson.kanji.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {lesson.kanji.map(k => (
                <div key={k.id} className="bg-white rounded-xl border border-outline-variant/50 p-4 flex gap-4 items-start hover:border-sumire-purple/40 transition-colors">
                  {/* Character */}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-5xl font-bold text-on-surface leading-none" style={{ fontFamily: 'serif' }}>
                      {k.character}
                    </span>
                    {k.stroke_count && (
                      <span className="text-[10px] text-on-muted mt-1">{k.stroke_count} nét</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {k.level && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-bold mb-1.5">
                        {k.level}
                      </span>
                    )}
                    <p className="font-bold text-sm text-tsubaki-red mb-1.5">{k.meaning_vi}</p>
                    {k.han_viet && (
                      <p className="text-xs text-on-muted mb-2 italic">{k.han_viet}</p>
                    )}
                    {/* Readings */}
                    <div className="flex flex-wrap gap-1">
                      {k.reading_on?.map(r => (
                        <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-tsubaki-red/10 text-tsubaki-red font-mono">{r}</span>
                      ))}
                      {k.reading_kun?.map(r => (
                        <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-muted font-mono">{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quiz ───────────────────────────────────────────────────── */}
        {lesson.quiz && (
          <div className="glass-card rounded-2xl p-6 mb-6 border border-sumire-purple/20">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-sumire-purple">quiz</span>
              Bài kiểm tra
            </h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-on-surface">{lesson.quiz.title}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {lesson.quiz.type && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-medium">
                      {QUIZ_TYPE_LABEL[lesson.quiz.type] || lesson.quiz.type}
                    </span>
                  )}
                  {lesson.quiz.time_limit && (
                    <span className="flex items-center gap-1 text-xs text-on-muted">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {lesson.quiz.time_limit} phút
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/quizzes/${lesson.quiz.id}`}
                className="inline-flex items-center gap-2 bg-sumire-purple text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-md shadow-sumire-purple/20 shrink-0"
              >
                Làm bài
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
