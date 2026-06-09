import { useCallback, useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import FuriganaText from '../../components/ui/FuriganaText';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

const TOPICS = [
  'Chào hỏi', 'Gia đình', 'Đồ ăn & thức uống', 'Thời gian & ngày tháng',
  'Màu sắc', 'Cơ thể', 'Động vật', 'Trường học', 'Địa điểm',
  'Thời tiết & thiên nhiên', 'Giao thông', 'Hành động', 'Tính từ mô tả',
];

const TOPIC_ICONS = {
  'Chào hỏi': 'waving_hand',
  'Gia đình': 'family_restroom',
  'Đồ ăn & thức uống': 'restaurant',
  'Thời gian & ngày tháng': 'calendar_month',
  'Màu sắc': 'palette',
  'Cơ thể': 'accessibility',
  'Động vật': 'pets',
  'Trường học': 'school',
  'Địa điểm': 'location_on',
  'Thời tiết & thiên nhiên': 'partly_cloudy_day',
  'Giao thông': 'directions_car',
  'Hành động': 'directions_run',
  'Tính từ mô tả': 'star',
};

const TYPE_COLORS = {
  'DANH TỪ': 'bg-blue-100 text-blue-700',
  '名詞':    'bg-blue-100 text-blue-700',
  'ĐỘNG TỪ': 'bg-green-100 text-green-700',
  '動詞':    'bg-green-100 text-green-700',
  'TÍNH TỪ': 'bg-amber-100 text-amber-700',
  '形容詞':  'bg-amber-100 text-amber-700',
  'PHÓ TỪ':  'bg-purple-100 text-purple-700',
  '副詞':    'bg-purple-100 text-purple-700',
};

function VocabSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="glass-card rounded-2xl p-5 min-h-[120px] animate-pulse flex flex-col justify-center items-center gap-2">
          <div className="h-8 w-16 bg-surface-low rounded" />
          <div className="h-4 w-12 bg-surface-low rounded" />
        </div>
      ))}
    </div>
  );
}

export default function Vocabulary() {
  const { t } = useLang();
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [topic, setTopic]     = useState('');
  const [page, setPage]       = useState(1);
  const [selected, setSelected] = useState(null);
  const [furigana, setFurigana] = useState(false);
  const LIMIT = 20;

  const fetchVocab = useCallback(async (p = 1, l = '', s = '', tp = '') => {
    setLoading(true);
    setSelected(null);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (s)  params.set('search', s);
      if (l)  params.set('level', l);
      if (tp) params.set('topic', tp);
      const r = await api.get(`/vocabulary?${params}`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVocab(page, level, search, topic); }, [page, level, topic]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchVocab(1, level, search, topic);
  };

  const handleLevelChange = (l) => {
    setLevel(l);
    setPage(1);
  };

  const handleTopicChange = (tp) => {
    setTopic(tp);
    setPage(1);
  };

  return (
    <StudentLayout title={t('vocab.title')}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('vocab.title')}</h1>
          {total > 0 && !loading && (
            <p className="text-sm text-on-muted mt-0.5">{total.toLocaleString()} từ vựng</p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setFurigana(v => !v)}
            title={furigana ? 'Ẩn furigana' : 'Hiển thị furigana'}
            className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-all select-none ${furigana ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-outline/60 text-on-muted hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'}`}>
            <span className="font-bold" style={{ fontFamily: 'serif', fontSize: '13px' }}>あ</span>
            ふりがな
          </button>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('vocab.search')}
              className="px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-48 transition-colors"
            />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl hover:opacity-90 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-lg">search</span>
            </button>
          </form>
        </div>
      </div>

      {/* Level filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => handleLevelChange('')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${!level ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}
        >
          {t('vocab.all_levels')}
        </button>
        {LEVELS.map(l => (
          <button key={l} onClick={() => handleLevelChange(l)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${level === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Topic filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => handleTopicChange('')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!topic ? 'bg-charcoal text-white' : 'bg-white border border-outline text-on-muted hover:border-charcoal'}`}
        >
          Tất cả chủ đề
        </button>
        {TOPICS.map(tp => (
          <button
            key={tp}
            onClick={() => handleTopicChange(tp)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${topic === tp ? 'bg-charcoal text-white' : 'bg-white border border-outline text-on-muted hover:border-charcoal'}`}
          >
            <span className="material-symbols-outlined text-[14px]">{TOPIC_ICONS[tp]}</span>
            {tp}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <VocabSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 mb-4">translate</span>
          <h3 className="font-display font-bold text-lg text-charcoal mb-1">
            {search || level || topic ? 'Không tìm thấy từ vựng' : 'Chưa có từ vựng nào'}
          </h3>
          <p className="text-sm text-on-muted max-w-xs">
            {search
              ? `Không có kết quả cho "${search}". Thử từ khóa khác.`
              : topic
              ? `Chưa có từ vựng trong chủ đề "${topic}".`
              : level
              ? `Chưa có từ vựng cấp độ ${level}.`
              : 'Nội dung từ vựng đang được biên soạn, hãy quay lại sau.'}
          </p>
          {(search || level || topic) && (
            <button
              onClick={() => { setSearch(''); setLevel(''); setTopic(''); setPage(1); fetchVocab(1, '', '', ''); }}
              className="mt-4 text-sm text-tsubaki-red font-semibold hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(v => (
              <div
                key={v.id}
                onClick={() => setSelected(v)}
                className="glass-card rounded-2xl p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all min-h-[120px] flex flex-col justify-center items-center text-center select-none"
              >
                <FuriganaText text={v.kanji || v.reading} enabled={furigana} textClassName="text-3xl font-bold text-tsubaki-red mb-1" />
                {v.kanji && <p className="text-sm text-on-muted">{v.reading}</p>}
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {v.type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${TYPE_COLORS[v.type] || 'bg-surface-low text-on-muted'}`}>
                      {v.type}
                    </span>
                  )}
                  {v.topic && !topic && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                      {v.topic}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors"
              >
                ← Trước
              </button>
              <span className="px-4 py-2 text-sm text-on-muted">
                {page} / {Math.ceil(total / LIMIT)}
              </span>
              <button
                disabled={page * LIMIT >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40 hover:border-tsubaki-red transition-colors"
              >
                Tiếp →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Vocab detail popup ──────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-tsubaki-red to-sumire-purple" />

            {/* Close */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-on-muted hover:bg-surface-low hover:text-charcoal transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Main reading / kanji */}
            <div className="px-8 pt-8 pb-6 text-center">
              <div className="flex justify-center mb-2">
                <FuriganaText text={selected.kanji || selected.reading} enabled={furigana} textClassName="text-6xl font-bold text-tsubaki-red leading-none" />
              </div>
              {selected.kanji && (
                <p className="text-lg text-on-muted mt-1">{selected.reading}</p>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {selected.level && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${LEVEL_COLORS[selected.level] || 'bg-surface-low text-on-muted'}`}>
                    {selected.level}
                  </span>
                )}
                {selected.type && (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${TYPE_COLORS[selected.type] || 'bg-surface-low text-on-muted'}`}>
                    {selected.type}
                  </span>
                )}
                {selected.topic && (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    <span className="material-symbols-outlined text-[12px]">{TOPIC_ICONS[selected.topic] || 'label'}</span>
                    {selected.topic}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-8 border-t border-outline/30" />

            {/* Details */}
            <div className="px-8 py-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Nghĩa tiếng Việt</p>
                <p className="text-lg font-bold text-charcoal">{selected.meaning_vi}</p>
              </div>
              {selected.meaning_ja && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Giải thích tiếng Nhật</p>
                  <FuriganaText text={selected.meaning_ja} enabled={furigana} textClassName="text-sm text-charcoal" block />
                </div>
              )}
              {selected.example_sentence && (
                <div>
                  <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-1">Câu ví dụ</p>
                  <div className="text-sm text-charcoal italic bg-surface-low rounded-xl px-4 py-3">
                    「<FuriganaText text={selected.example_sentence} enabled={furigana} textClassName="text-sm text-charcoal italic" />」
                  </div>
                </div>
              )}
            </div>

            {/* Navigation between cards */}
            <div className="px-8 pb-6 flex gap-2">
              <button
                onClick={() => { const idx = items.findIndex(v => v.id === selected.id); if (idx > 0) setSelected(items[idx - 1]); }}
                disabled={items.findIndex(v => v.id === selected.id) === 0}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
              </button>
              <button
                onClick={() => { const idx = items.findIndex(v => v.id === selected.id); if (idx < items.length - 1) setSelected(items[idx + 1]); }}
                disabled={items.findIndex(v => v.id === selected.id) === items.length - 1}
                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
              >
                Tiếp <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
