import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import api from '../../lib/api';

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

  return (
    <StudentLayout title={lesson.title}>
      <div className="max-w-3xl mx-auto">
        <Link to={`/courses/${lesson.course_id}`} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-6 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại khoá học
        </Link>

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
          {lesson.content ? (
            <div className="prose prose-sm max-w-none text-on-surface leading-relaxed"
              dangerouslySetInnerHTML={{ __html: lesson.content }} />
          ) : (
            <p className="text-on-muted italic">Nội dung bài học đang được cập nhật...</p>
          )}
        </div>

        {/* Vocabulary */}
        {lesson.vocabulary?.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-tsubaki-red">translate</span>
                Từ vựng trong bài ({lesson.vocabulary.length})
              </h2>
            </div>
            <div className="divide-y divide-outline/20">
              {lesson.vocabulary.map(v => (
                <div key={v.id} className="flex items-center gap-4 p-4">
                  <div className="text-2xl font-bold text-tsubaki-red w-16 shrink-0 text-center">
                    <FuriganaText text={v.kanji || v.reading} enabled={furigana} textClassName="text-2xl font-bold text-tsubaki-red" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{v.reading}</p>
                    <p className="text-xs text-on-muted">{v.meaning_vi}</p>
                  </div>
                  {v.type && <span className="text-xs px-2 py-0.5 rounded-full bg-surface-low text-on-muted">{v.type}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
