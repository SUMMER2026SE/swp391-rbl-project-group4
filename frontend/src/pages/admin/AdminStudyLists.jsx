import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import ImportFileModal from '../../components/admin/ImportFileModal';
import api from '../../lib/api';
import { TOPICS, TOPIC_ICONS } from '../../lib/studyListTopics';

const TYPE_TO_IMPORT = { vocabulary: 'vocab', kanji: 'kanji', grammar: 'grammar' };
const TYPE_ICON  = { vocabulary: 'translate', kanji: 'font_download', grammar: 'spellcheck' };
const ITEM_UNIT  = { vocabulary: 'từ vựng', kanji: 'kanji', grammar: 'mẫu ngữ pháp' };
const LEVEL_BG   = {
  N5: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  N4: 'bg-gradient-to-br from-sky-400 to-sky-600',
  N3: 'bg-gradient-to-br from-violet-400 to-violet-600',
  N2: 'bg-gradient-to-br from-orange-400 to-orange-600',
  N1: 'bg-gradient-to-br from-red-400 to-red-600',
};
const LEVEL_BADGE = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function PostPreviewCard({ type, form, base }) {
  const post = {
    title: form.title || '(Chưa có tiêu đề)',
    level: form.level,
    topic: form.topic,
    item_count: base?.item_count ?? 0,
    view_count:  base?.view_count  ?? 0,
    creator_name: base?.creator?.name || base?.creator?.email || '—',
  };
  const headerIcon = post.topic ? (TOPIC_ICONS[post.topic] || TYPE_ICON[type]) : TYPE_ICON[type];
  return (
    <div className="rounded-2xl overflow-hidden glass-card border border-outline/30 w-56 shadow-lg">
      <div className={`h-28 flex items-center justify-center ${LEVEL_BG[post.level] || 'bg-gradient-to-br from-slate-400 to-slate-600'}`}>
        <span className="material-symbols-outlined text-5xl text-white/90">{headerIcon}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-charcoal text-sm line-clamp-2 mb-2 min-h-[2.5rem]">{post.title}</h3>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
          {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
          <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-on-muted">
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-sm">person</span>{post.creator_name}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-sm">visibility</span>{post.view_count}
          </span>
        </div>
      </div>
    </div>
  );
}

const SEARCH_ENDPOINT = { vocabulary: '/vocabulary', kanji: '/kanji', grammar: '/grammar-points' };
const ITEM_LABEL = (type, item) => type === 'kanji' ? item.character : type === 'grammar' ? item.title : (item.kanji || item.reading);
const ITEM_SUB   = (type, item) => type === 'grammar' ? item.meaning_vi : item.meaning_vi;

function ItemPickerContent({ post, listType, onChanged }) {
  const [detail, setDetail]         = useState(null);
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState([]);
  const [alert, setAlert]           = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!post) return;
    const r = await api.get(`/study-lists/${post.id}`);
    setDetail(r.data);
  }, [post]);

  useEffect(() => {
    loadDetail();
    setSearch('');
    setResults([]);
    setAlert('');
  }, [loadDetail]);

  const runSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    const r = await api.get(`${SEARCH_ENDPOINT[listType]}?search=${encodeURIComponent(search)}&limit=10`);
    setResults(r.data.data || []);
  };

  const addItem = async (item_id) => {
    try {
      await api.post(`/study-lists/${post.id}/items`, { item_id });
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const removeItem = async (item_id) => {
    try {
      await api.delete(`/study-lists/${post.id}/items/${item_id}`);
      await loadDetail();
      onChanged();
    } catch (e) { setAlert(e.message); }
  };

  const currentIds = new Set((detail?.items || []).map(i => i.id));

  return (
    <>
      <div className="space-y-4">
        {alert && <Alert type="error" onClose={() => setAlert('')}>{alert}</Alert>}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined text-base">upload_file</span>
            Nhập file / JSON
          </Button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm để thêm vào danh sách..."
            className="flex-1 px-4 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
          <Button type="submit" size="sm">Tìm</Button>
        </form>

        {results.length > 0 && (
          <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-40 overflow-y-auto">
            {results.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                {currentIds.has(item.id) ? (
                  <span className="text-xs text-on-muted">Đã thêm</span>
                ) : (
                  <button onClick={() => addItem(item.id)} className="text-tsubaki-red text-xs font-semibold hover:underline">+ Thêm</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-on-muted mb-2">Đang có {detail?.items?.length || 0} mục:</p>
          {!detail?.items?.length ? (
            <p className="text-sm text-on-muted">Chưa có mục nào — tìm và thêm ở trên.</p>
          ) : (
            <div className="border border-outline rounded-xl divide-y divide-outline/40 max-h-56 overflow-y-auto">
              {detail.items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span><strong>{ITEM_LABEL(listType, item)}</strong> — {ITEM_SUB(listType, item)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-on-muted hover:text-error">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ImportFileModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type={TYPE_TO_IMPORT[listType]}
        studyListId={post?.id}
        onImported={async () => {
          await loadDetail();
          onChanged();
          setImportOpen(false);
        }}
      />
    </>
  );
}

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export default function AdminStudyLists() {
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [expandedId, setExpandedId] = useState(null);
  const [editTab, setEditTab]       = useState('info');
  const [form, setForm]             = useState({ title: '', description: '', level: '', topic: '' });
  const [editId, setEditId]         = useState(null);
  const [editPost, setEditPost]     = useState(null);
  const [previewBase, setPreviewBase] = useState(null);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/study-lists?type=${type}&limit=100`);
      setItems(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const toggleAccordion = (post) => {
    if (expandedId === post.id) { setExpandedId(null); return; }
    setExpandedId(post.id);
    setForm({ title: post.title, description: post.description || '', level: post.level || '', topic: post.topic || '' });
    setEditId(post.id);
    setEditPost(post);
    setPreviewBase(post);
    setEditTab('info');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!form.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!form.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    setSaving(true);
    try {
      await api.put(`/study-lists/${editId}`, { title: form.title, description: form.description, level: form.level || null, topic: form.topic || null });
      setExpandedId(null);
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (post) => {
    const teacherName = post.creator?.name || post.creator?.email || 'giáo viên';
    if (!confirm(`Xóa bài đăng "${post.title}" của ${teacherName}?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <AdminLayout title="Bài đăng của giáo viên">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng của giáo viên</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => { setType(key); setExpandedId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-on-muted mb-4">Tổng: <strong>{total}</strong> bài đăng</p>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">library_books</span>
          <p className="text-on-muted">Chưa có bài đăng nào.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-outline/40">
          {items.map(post => {
            const isOpen = expandedId === post.id;
            return (
              <div key={post.id}>
                {/* ── Accordion header ── */}
                <div
                  onClick={() => toggleAccordion(post)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer select-none transition-colors ${isOpen ? 'bg-tsubaki-red/5' : 'hover:bg-surface-low/50'}`}
                >
                  {/* Level color bar */}
                  <div className={`w-1 h-11 rounded-full shrink-0 ${LEVEL_BG[post.level] || 'bg-gradient-to-b from-slate-300 to-slate-400'}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-charcoal text-sm truncate">{post.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
                      {post.topic && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{post.topic}</span>}
                      <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
                      <span className="flex items-center gap-0.5 text-xs text-on-muted">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>{post.view_count}
                      </span>
                      <span className="flex items-center gap-0.5 text-xs text-on-muted">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {post.creator?.name || post.creator?.email || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Actions — stopPropagation to not toggle accordion */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(post)} title="Xóa"
                      className="p-1.5 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>

                  {/* Chevron */}
                  <span className={`material-symbols-outlined text-on-muted shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>

                {/* ── Accordion body ── */}
                {isOpen && (
                  <div className="border-t border-outline/40 bg-surface-low/20 px-6 py-5">
                    {/* Tabs */}
                    <div className="flex border-b border-outline/40 mb-5">
                      {[['info', 'Thông tin'], ['items', 'Quản lý mục']].map(([tab, label]) => (
                        <button key={tab} onClick={() => setEditTab(tab)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Thông tin */}
                    {editTab === 'info' && (
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 space-y-4 min-w-0">
                          <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                          <div>
                            <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                            <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                              <option value="">-- Chọn cấp độ --</option>
                              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            {type === 'vocabulary' && (
                              <p className="text-xs text-on-muted mt-1">Không bắt buộc — 1 chủ đề thường có từ ở nhiều cấp độ, cấp độ sẽ lọc bên trong khi xem từng từ.</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                            <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                              <option value="">-- Không chọn --</option>
                              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <Input label="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="shrink-0 sm:w-72 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
                          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">Xem trước</p>
                          <div className="flex justify-center">
                            <PostPreviewCard type={type} form={form} base={previewBase} />
                          </div>
                          <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
                        </div>
                      </div>
                    )}

                    {/* Tab: Quản lý mục */}
                    {editTab === 'items' && editPost && (
                      <ItemPickerContent post={editPost} listType={type} onChanged={load} />
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline/20">
                      {editTab === 'info' ? (
                        <>
                          <Button variant="secondary" onClick={() => setExpandedId(null)}>Huỷ</Button>
                          <Button loading={saving} onClick={handleSave}>Lưu</Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={() => setExpandedId(null)}>Đóng</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
