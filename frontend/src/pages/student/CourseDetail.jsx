import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

export default function CourseDetail() {
  const { id } = useParams();
  const { t }  = useLang();
  const [course, setCourse]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get(`/courses/${id}`)
      .then(r => setCourse(r.data))
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

  if (error || !course) return (
    <StudentLayout title="Lỗi">
      <Alert type="error">{error || 'Không tìm thấy khóa học.'}</Alert>
    </StudentLayout>
  );

  return (
    <StudentLayout title={course.title}>
      <div className="mb-6">
        <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-4">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách khoá học
        </Link>
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-56 md:h-72 object-cover rounded-2xl mb-6" />
        )}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            {course.level && <span className="text-xs px-2 py-0.5 rounded-full bg-tsubaki-red/10 text-tsubaki-red font-bold mb-2 inline-block">{course.level}</span>}
            <h1 className="font-display text-3xl font-bold mb-3">{course.title}</h1>
            <p className="text-on-muted leading-relaxed">{course.description}</p>
          </div>
        </div>
      </div>

      {/* Lessons list */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-outline/30">
          <h2 className="font-display font-bold text-lg">
            Danh sách bài học <span className="text-on-muted text-sm font-normal">({course.lessons?.length || 0} {t('courses.lessons')})</span>
          </h2>
        </div>
        {course.lessons?.length === 0 ? (
          <div className="text-center py-12 text-on-muted">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">article</span>
            Chưa có bài học nào
          </div>
        ) : (
          <div className="divide-y divide-outline/20">
            {course.lessons?.map((lesson, i) => (
              <Link key={lesson.id} to={`/lessons/${lesson.id}`}
                className="flex items-center gap-4 p-4 hover:bg-surface-low transition-colors group">
                <div className="w-8 h-8 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm group-hover:text-tsubaki-red transition-colors">{lesson.title}</p>
                  {lesson.title_ja && <p className="text-xs text-on-muted mt-0.5">{lesson.title_ja}</p>}
                </div>
                <span className="material-symbols-outlined text-on-muted text-xl group-hover:text-tsubaki-red transition-colors">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
