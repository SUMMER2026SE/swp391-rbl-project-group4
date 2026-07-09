import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'vocabulary', label: 'Từ vựng' },
  { value: 'kanji',      label: 'Kanji' },
  { value: 'grammar',    label: 'Ngữ pháp' },
];
const LEVELS = ['', 'N5', 'N4', 'N3', 'N2', 'N1'];
const DIFFICULTIES = [
  { value: '', label: 'Tất cả' },
  { value: 'easy',   label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard',   label: 'Khó' },
];

const EMPTY_OPTION = { option_text: '', is_correct: false };
const EMPTY_FORM = {
  question_text: '',
  category: 'vocabulary',
  level: 'N5',
  difficulty: 'easy',
  explanation: '',
  tags: '',
  is_active: true,
  options: [
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ],
};

// ── Question form ─────────────────────────────────────────────────────────────

function QuestionForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setOpt = (i, k, v) => setForm(p => {
    const opts = [...p.options];
    if (k === 'is_correct') {
      opts.forEach((o, oi) => { opts[oi] = { ...o, is_correct: oi === i }; });
    } else {
      opts[i] = { ...opts[i], [k]: v };
    }
    return { ...p, options: opts };
  });

  const valid = form.question_text.trim() &&
    form.options.every(o => o.option_text.trim()) &&
    form.options.some(o => o.is_correct);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-1">Nội dung câu hỏi <span className="text-red-500">*</span></label>
        <textarea rows={3} value={form.question_text} onChange={e => set('question_text', e.target.value)}
          placeholder="Nhập câu hỏi..."
          className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm focus:outline-none focus:border-tsubaki-red resize-none bg-transparent" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">Danh mục</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none focus:border-tsubaki-red">
            <option value="vocabulary">Từ vựng</option>
            <option value="kanji">Kanji</option>
            <option value="grammar">Ngữ pháp</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Cấp độ</label>
          <select value={form.level} onChange={e => set('level', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none focus:border-tsubaki-red">
            {['N5','N4','N3','N2','N1'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Độ khó</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none focus:border-tsubaki-red">
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Các đáp án <span className="text-red-500">*</span></label>
        <div className="space-y-2">
          {form.options.map((opt, i) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-colors ${opt.is_correct ? 'border-emerald-400 bg-emerald-50/30' : 'border-outline/30'}`}>
              <button type="button" onClick={() => setOpt(i, 'is_correct', true)}
                className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${opt.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-outline/40 hover:border-emerald-400'}`}>
                {opt.is_correct && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-xs font-bold text-on-muted w-5">{String.fromCharCode(65 + i)}</span>
              <input value={opt.option_text} onChange={e => setOpt(i, 'option_text', e.target.value)}
                placeholder={`Đáp án ${String.fromCharCode(65 + i)}...`}
                className="flex-1 text-sm bg-transparent focus:outline-none" />
              {opt.is_correct && <span className="text-xs text-emerald-600 font-bold">Đúng</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-on-muted mt-1">Nhấn nút tròn để đánh dấu đáp án đúng.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Giải thích (tùy chọn)</label>
        <textarea rows={2} value={form.explanation} onChange={e => set('explanation', e.target.value)}
          placeholder="Giải thích tại sao đáp án đúng..."
          className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm focus:outline-none focus:border-tsubaki-red resize-none bg-transparent" />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Tags (phân cách bởi dấu phẩy)</label>
        <input value={form.tags} onChange={e => set('tags', e.target.value)}
          placeholder="N5_vocab, greetings, daily..."
          className="w-full px-3 py-2 rounded-xl border border-outline/40 text-sm focus:outline-none focus:border-tsubaki-red bg-transparent" />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="is_active_chk" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
          className="rounded" />
        <label htmlFor="is_active_chk" className="text-sm">Kích hoạt câu hỏi này</label>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-outline/40 text-sm font-semibold hover:bg-surface-low transition-colors">
          Hủy
        </button>
        <button type="submit" disabled={!valid || saving}
          className="flex-1 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors disabled:opacity-50">
          {saving ? 'Đang lưu...' : 'Lưu câu hỏi'}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPlacementQuestions() {
  const [stats, setStats]       = useState(null);
  const [questions, setQuestions] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);

  const [filters, setFilters] = useState({ category: '', level: '', difficulty: '', search: '' });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [modal, setModal] = useState(null);   // null | 'create' | { ...editQuestion }
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    api.get('/admin/placement/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(filters.search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filters.search]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/placement/questions', {
        params: { ...filters, search: debouncedSearch, page },
      });
      setQuestions(data.questions || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, [filters.category, filters.level, filters.difficulty, debouncedSearch, page]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const handleCreate = async (form) => {
    setSaving(true); setError('');
    try {
      await api.post('/admin/placement/questions', form);
      setModal(null);
      loadQuestions();
      api.get('/admin/placement/stats').then(r => setStats(r.data)).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.error || 'Không thể tạo câu hỏi.');
    }
    setSaving(false);
  };

  const handleEdit = async (form) => {
    setSaving(true); setError('');
    try {
      await api.put(`/admin/placement/questions/${modal.id}`, form);
      setModal(null);
      loadQuestions();
    } catch (e) {
      setError(e.response?.data?.error || 'Không thể cập nhật câu hỏi.');
    }
    setSaving(false);
  };

  const handleToggle = async (q) => {
    try {
      await api.patch(`/admin/placement/questions/${q.id}/toggle`, { is_active: !q.is_active });
      setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await api.delete(`/admin/placement/questions/${confirmDel}`);
      setConfirmDel(null);
      loadQuestions();
      api.get('/admin/placement/stats').then(r => setStats(r.data)).catch(() => {});
    } catch {}
  };

  const openEdit = async (id) => {
    try {
      const { data } = await api.get(`/admin/placement/questions/${id}`);
      const initForm = {
        ...data,
        tags: (data.tags || []).join(', '),
        options: [...(data.placement_test_question_options || [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(o => ({ option_text: o.option_text, is_correct: o.is_correct })),
      };
      setModal(initForm);
    } catch {}
  };

  const totalPages = Math.ceil(total / 20);

  const catColor = (cat) =>
    cat === 'vocabulary' ? 'bg-blue-100 text-blue-700' :
    cat === 'kanji'      ? 'bg-purple-100 text-purple-700' :
                           'bg-emerald-100 text-emerald-700';
  const catLabel = (cat) =>
    cat === 'vocabulary' ? 'Từ vựng' : cat === 'kanji' ? 'Kanji' : 'Ngữ pháp';
  const diffLabel = (d) => d === 'hard' ? 'Khó' : d === 'medium' ? 'TB' : 'Dễ';
  const diffColor = (d) => d === 'hard' ? 'text-red-500' : d === 'medium' ? 'text-amber-500' : 'text-emerald-500';

  return (
    <AdminLayout title="Ngân hàng — Kiểm tra năng lực">
      {/* Stats */}
      {stats && (
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {[
              { label: 'Tổng câu hỏi', value: stats.total,    icon: 'quiz',         color: 'text-charcoal' },
              { label: 'Đang hoạt động', value: stats.active, icon: 'check_circle', color: 'text-emerald-600' },
              { label: 'Lượt thi', value: stats.attempts,     icon: 'assignment',   color: 'text-on-muted' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
                <span className={`material-symbols-outlined text-2xl ${s.color}`}>{s.icon}</span>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-xs text-on-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Level breakdown */}
          {stats.levelStats?.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-outline/20 flex items-center gap-2">
                <span className="font-bold text-sm text-charcoal">Câu hỏi theo cấp độ JLPT</span>
                <span className="text-xs text-on-muted">(tối thiểu {stats.config?.minPerCategory} câu/kỹ năng để có thể thi)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-on-muted uppercase tracking-wide border-b border-outline/20">
                      <th className="text-left px-4 py-2.5 font-semibold">Cấp độ</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Từ vựng</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Kanji</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Ngữ pháp</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Tổng</th>
                      <th className="text-center px-4 py-2.5 font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.levelStats.map(row => (
                      <tr key={row.level} className="border-b border-outline/10 hover:bg-surface-low/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-charcoal">{row.level}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.vocabulary >= (stats.config?.minPerCategory || 10) ? 'text-emerald-600' : 'text-red-500'}`}>{row.vocabulary}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.kanji >= (stats.config?.minPerCategory || 10) ? 'text-emerald-600' : 'text-red-500'}`}>{row.kanji}</td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.grammar >= (stats.config?.minPerCategory || 10) ? 'text-emerald-600' : 'text-red-500'}`}>{row.grammar}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-on-muted font-medium">{row.total}</td>
                        <td className="px-4 py-3 text-center">
                          {row.canStart ? (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${row.needsFallback ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {row.needsFallback ? '⚠ Fallback' : '✓ Sẵn sàng'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">
                              ✗ Chưa đủ
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
          placeholder="Tìm câu hỏi..."
          className="px-3 py-2 rounded-xl border border-outline/40 text-sm focus:outline-none focus:border-tsubaki-red bg-transparent min-w-0 flex-1 max-w-xs"
        />

        <select value={filters.category} onChange={e => { setFilters(p => ({ ...p, category: e.target.value })); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none">
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select value={filters.level} onChange={e => { setFilters(p => ({ ...p, level: e.target.value })); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none">
          {LEVELS.map(l => <option key={l} value={l}>{l || 'Tất cả cấp'}</option>)}
        </select>

        <select value={filters.difficulty} onChange={e => { setFilters(p => ({ ...p, difficulty: e.target.value })); setPage(1); }}
          className="px-3 py-2 rounded-xl border border-outline/40 text-sm bg-transparent focus:outline-none">
          {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>

        <button onClick={() => { setModal('create'); setError(''); }}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-tsubaki-red text-white text-sm font-bold hover:bg-tsubaki-red/90 transition-colors">
          <span className="material-symbols-outlined text-base">add</span>
          Thêm câu hỏi
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline/20 text-on-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Câu hỏi</th>
                <th className="text-left px-4 py-3 font-semibold w-28">Danh mục</th>
                <th className="text-left px-4 py-3 font-semibold w-16">Cấp</th>
                <th className="text-left px-4 py-3 font-semibold w-20">Độ khó</th>
                <th className="text-center px-4 py-3 font-semibold w-24">Trạng thái</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-on-muted">Đang tải...</td></tr>
              ) : questions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-on-muted">Chưa có câu hỏi nào.</td></tr>
              ) : questions.map(q => (
                <tr key={q.id} className="border-b border-outline/10 hover:bg-surface-low/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 font-medium">{q.question_text}</p>
                    {q.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {q.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-low text-on-muted">{t}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${catColor(q.category)}`}>
                      {catLabel(q.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-on-muted">{q.level}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${diffColor(q.difficulty)}`}>{diffLabel(q.difficulty)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(q)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                        q.is_active
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-surface-low text-on-muted hover:bg-outline/20'
                      }`}>
                      {q.is_active ? 'Hoạt động' : 'Ẩn'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(q.id)}
                        className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button onClick={() => setConfirmDel(q.id)}
                        className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline/20 text-sm">
            <span className="text-on-muted">Tổng {total} câu hỏi</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 rounded-lg border border-outline/30 disabled:opacity-40 hover:bg-surface-low transition-colors">
                ←
              </button>
              <span className="px-3 py-1 text-on-muted tabular-nums">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1 rounded-lg border border-outline/30 disabled:opacity-40 hover:bg-surface-low transition-colors">
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-charcoal rounded-2xl shadow-2xl w-full max-w-lg my-8 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{modal === 'create' ? 'Thêm câu hỏi mới' : 'Sửa câu hỏi'}</h3>
              <button onClick={() => setModal(null)} className="text-on-muted hover:text-charcoal">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>}
            <QuestionForm
              initial={modal === 'create' ? undefined : modal}
              onSave={modal === 'create' ? handleCreate : handleEdit}
              onCancel={() => setModal(null)}
              saving={saving}
            />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-charcoal rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Xác nhận xóa</h3>
            <p className="text-sm text-on-muted">Bạn có chắc muốn xóa vĩnh viễn câu hỏi này không? Hành động không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline/40 text-sm font-semibold hover:bg-surface-low transition-colors">
                Hủy
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
