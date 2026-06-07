import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'Business'];
const LEVEL_COLORS = { N5: 'bg-green-100 text-green-700', N4: 'bg-blue-100 text-blue-700', N3: 'bg-yellow-100 text-yellow-700', N2: 'bg-orange-100 text-orange-700', N1: 'bg-red-100 text-red-700', Business: 'bg-purple-100 text-purple-700' };

export default function Courses() {
  const { t } = useLang();
  const [courses, setCourses] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 9;

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/courses?${params}`);
      setCourses(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, [page, level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCourses();
  };

  return (
    <StudentLayout title={t('courses.title')}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">{t('courses.title')}</h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('courses.search')}
            className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-48" />
          <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl">
            <span className="material-symbols-outlined text-lg">search</span>
          </button>
        </form>
      </div>

      {/* Level filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => { setLevel(''); setPage(1); }}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
          {t('courses.all_levels')}
        </button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => { setLevel(l); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 text-on-muted">
          <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">menu_book</span>
          Chưa có khóa học nào
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map(course => (
            <Link key={course.id} to={`/courses/${course.id}`}
              className="glass-card rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all group">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-tsubaki-red/10 to-sumire-purple/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-tsubaki-red/30">menu_book</span>
                </div>
              )}
              <div className="p-5">
                {course.level && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold mb-2 inline-block ${LEVEL_COLORS[course.level] || 'bg-surface-low text-on-muted'}`}>
                    {course.level}
                  </span>
                )}
                <h3 className="font-display font-bold text-base mb-1 group-hover:text-tsubaki-red transition-colors">{course.title}</h3>
                <p className="text-sm text-on-muted line-clamp-2">{course.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-8">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors">
            ← Trước
          </button>
          <span className="px-4 py-2 text-sm text-on-muted">{page} / {Math.ceil(total / LIMIT)}</span>
          <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors">
            Tiếp →
          </button>
        </div>
      )}
    </StudentLayout>
  );
}
