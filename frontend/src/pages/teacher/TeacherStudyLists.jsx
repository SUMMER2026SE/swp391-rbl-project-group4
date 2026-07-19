import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TeacherLayout from '../../components/layout/TeacherLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';
import { TOPICS } from '../../lib/studyListTopics';
import {
  PostPreviewCard, VocabPreviewEditor, ItemPickerContent,
  ITEM_UNIT, LEVELS, LEVEL_BG, LEVEL_BADGE,
} from '../../components/shared/StudyListPostEditor';

const TYPES = [
  ['vocabulary', 'translate', 'Từ vựng'],
  ['kanji', 'font_download', 'Kanji'],
  ['grammar', 'spellcheck', 'Ngữ pháp'],
];

export default function TeacherStudyLists() {
  const confirm = useConfirm();
  const [type, setType]       = useState('vocabulary');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  // Modal — chỉ dùng cho tạo mới
  const [modal, setModal]     = useState(false);
  const [editTab, setEditTab] = useState('info');
  const [form, setForm]       = useState({ title: '', description: '', level: '', topic: '' });
  const [editId, setEditId]   = useState(null);
  const [editPost, setEditPost] = useState(null);
  const [previewBase, setPreviewBase]   = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewIdx, setPreviewIdx]     = useState(0);
  const [saving, setSaving] = useState(false);

  // Accordion — dùng cho chỉnh sửa
  const [expandedId, setExpandedId]         = useState(null);
  const [accTab, setAccTab]                 = useState('info');
  const [accForm, setAccForm]               = useState({ title: '', description: '', level: '', topic: '' });
  const [accPost, setAccPost]               = useState(null);
  const [accPreviewBase, setAccPreviewBase] = useState(null);
  const [accPreviewItems, setAccPreviewItems] = useState([]);
  const [accPreviewIdx, setAccPreviewIdx]   = useState(0);
  const [accSaving, setAccSaving]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/study-lists?type=${type}&mine=true&limit=100`);
      setItems(r.data.data || []);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  /* ── Tạo mới (modal) ── */
  const openCreate = () => {
    setExpandedId(null);
    setForm({ title: '', description: '', level: '', topic: '' });
    setEditId(null); setEditPost(null); setPreviewBase(null); setPreviewItems([]); setPreviewIdx(0);
    setEditTab('info');
    setModal(true);
  };

  const handlePreviewItemSaved = (itemId, patch) => {
    setPreviewItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));
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
      const r = await api.post('/study-lists', { list_type: type, title: form.title, description: form.description, level: form.level || null, topic: form.topic || null });
      setEditId(r.data.id);
      setEditPost(r.data);
      setPreviewBase(r.data);
      setEditTab('items');
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  /* ── Chỉnh sửa (accordion) ── */
  const toggleAccordion = async (post) => {
    if (expandedId === post.id) { setExpandedId(null); return; }
    setModal(false);
    setExpandedId(post.id);
    setAccForm({ title: post.title, description: post.description || '', level: post.level || '', topic: post.topic || '' });
    setAccPost(post);
    setAccPreviewBase(post);
    setAccTab('info');
    setAccPreviewIdx(0);
    if (type === 'vocabulary') {
      try {
        const r = await api.get(`/study-lists/${post.id}`);
        setAccPreviewItems(r.data.items || []);
      } catch { setAccPreviewItems([]); }
    } else {
      setAccPreviewItems([]);
    }
  };

  const handleAccPreviewItemSaved = (itemId, patch) => {
    setAccPreviewItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));
  };

  const handleAccSave = async () => {
    if (!accForm.title.trim()) return setAlert({ type: 'error', msg: 'Tiêu đề là bắt buộc.' });
    if (type === 'vocabulary') {
      if (!accForm.topic) return setAlert({ type: 'error', msg: 'Vui lòng chọn chủ đề.' });
    } else if (!accForm.level) {
      return setAlert({ type: 'error', msg: 'Vui lòng chọn cấp độ.' });
    }
    setAccSaving(true);
    try {
      await api.put(`/study-lists/${accPost.id}`, { title: accForm.title, description: accForm.description, level: accForm.level || null, topic: accForm.topic || null });
      setExpandedId(null);
      await load();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setAccSaving(false); }
  };

  /* ── Xoá ── */
  const handleDelete = async (post) => {
    if (!await confirm(`Xóa bài đăng "${post.title}"?`)) return;
    try { await api.delete(`/study-lists/${post.id}`); load(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  return (
    <TeacherLayout title="Bài đăng danh sách">
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Bài đăng danh sách</h1>
        <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
          {TYPES.map(([key, icon, label]) => (
            <button key={key} onClick={() => { setType(key); setExpandedId(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 transition-colors ${type === key ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
              <span className="material-symbols-outlined text-lg">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> Tạo bài đăng</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <span className="material-symbols-outlined animate-spin text-tsubaki-red text-5xl">progress_activity</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-on-muted text-center">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-25">library_books</span>
          <p className="text-lg font-semibold text-charcoal mb-1">Bạn chưa tạo bài đăng nào cho mục này</p>
          <p className="text-sm">Bấm "Tạo bài đăng" để bắt đầu</p>
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
                    <p className="font-semibold text-charcoal text-sm truncate flex items-center gap-1.5">
                      {post.title}
                      {post.is_locked && (
                        <span title={post.lock_note ? `Quản trị viên yêu cầu sửa: ${post.lock_note}` : 'Quản trị viên đã khóa bài đăng này'} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-error text-[10px] font-bold shrink-0">
                          <span className="material-symbols-outlined text-[12px]">lock</span>CẦN SỬA
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[post.level]}`}>{post.level}</span>}
                      {post.topic && <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{post.topic}</span>}
                      <span className="text-xs text-on-muted">{post.item_count} {ITEM_UNIT[type]}</span>
                      <span className="flex items-center gap-0.5 text-xs text-on-muted">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>{post.view_count}
                      </span>
                    </div>
                    {post.is_locked && post.lock_note && (
                      <p className="text-xs text-error truncate mt-1">Lý do: {post.lock_note}</p>
                    )}
                  </div>

                  {/* Actions — stopPropagation để không toggle accordion */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Link to={`/study-lists/${type}/${post.id}`} title="Xem trang"
                      className="p-1.5 rounded-lg text-on-muted hover:text-tsubaki-red hover:bg-tsubaki-red/10 transition-colors">
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </Link>
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
                        <button key={tab} onClick={() => setAccTab(tab)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${accTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Thông tin */}
                    {accTab === 'info' && (
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="flex-1 space-y-4 min-w-0">
                          <Input label="Tiêu đề *" value={accForm.title} onChange={e => setAccForm({ ...accForm, title: e.target.value })}
                            placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
                          <div className="flex flex-col gap-4">
                            <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
                              <label className="block text-sm font-medium text-on-muted mb-1">Cấp độ{type === 'vocabulary' ? '' : ' *'}</label>
                              <select value={accForm.level} onChange={e => setAccForm({ ...accForm, level: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                                <option value="">-- Chọn cấp độ --</option>
                                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                              </select>
                              {type === 'vocabulary' && (
                                <p className="text-xs text-on-muted mt-1">Không bắt buộc — 1 chủ đề thường có từ ở nhiều cấp độ, cấp độ sẽ lọc bên trong khi xem từng từ.</p>
                              )}
                            </div>
                            <div className={type === 'vocabulary' ? 'order-1' : 'order-2'}>
                              <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                              <select value={accForm.topic} onChange={e => setAccForm({ ...accForm, topic: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                                <option value="">-- Không chọn --</option>
                                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                          </div>
                          <Input label="Mô tả" value={accForm.description} onChange={e => setAccForm({ ...accForm, description: e.target.value })} />
                        </div>
                        <div className="shrink-0 sm:w-80 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
                          <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">
                            {type === 'vocabulary' && accPreviewItems.length > 0 ? 'Xem trước — sửa trực tiếp từng từ' : 'Xem trước'}
                          </p>
                          {type === 'vocabulary' && accPreviewItems.length > 0 ? (
                            <VocabPreviewEditor items={accPreviewItems} idx={accPreviewIdx} setIdx={setAccPreviewIdx} onItemSaved={handleAccPreviewItemSaved} />
                          ) : (
                            <div className="flex justify-center">
                              <PostPreviewCard type={type} form={accForm} base={accPreviewBase} />
                            </div>
                          )}
                          {!(type === 'vocabulary' && accPreviewItems.length > 0) && (
                            <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab: Quản lý mục */}
                    {accTab === 'items' && accPost && (
                      <ItemPickerContent post={accPost} listType={type} onChanged={load} />
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-outline/20">
                      {accTab === 'info' ? (
                        <>
                          <Button variant="secondary" onClick={() => setExpandedId(null)}>Huỷ</Button>
                          <Button loading={accSaving} onClick={handleAccSave}>Lưu</Button>
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

      {/* ── Modal tạo mới ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Tạo bài đăng" size="xl"
        footer={
          editTab === 'items'
            ? <Button variant="secondary" onClick={() => setModal(false)}>Đóng</Button>
            : <><Button variant="secondary" onClick={() => setModal(false)}>Huỷ</Button><Button loading={saving} onClick={handleSave}>Tạo</Button></>
        }>

        {editId && (
          <div className="flex border-b border-outline/40 mb-5">
            {[['info', 'Thông tin'], ['items', 'Quản lý mục']].map(([tab, label]) => (
              <button key={tab} onClick={() => setEditTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editTab === tab ? 'border-tsubaki-red text-tsubaki-red' : 'border-transparent text-on-muted hover:text-charcoal'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {editTab === 'info' && (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-4 min-w-0">
              <Input label="Tiêu đề *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder='vd "Kanji thường gặp trong đề JLPT N4"' />
              <div className="flex flex-col gap-4">
                <div className={type === 'vocabulary' ? 'order-2' : 'order-1'}>
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
                <div className={type === 'vocabulary' ? 'order-1' : 'order-2'}>
                  <label className="block text-sm font-medium text-on-muted mb-1">Chủ đề{type === 'vocabulary' ? ' *' : ''}</label>
                  <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                    <option value="">-- Không chọn --</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Mô tả" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="shrink-0 sm:w-80 sm:pl-6 sm:border-l border-outline/30 flex flex-col">
              <p className="text-xs font-semibold text-on-muted uppercase tracking-wide mb-4">Xem trước</p>
              <div className="flex justify-center">
                <PostPreviewCard type={type} form={form} base={previewBase} />
              </div>
              <p className="text-xs text-on-muted/60 text-center mt-3">Cập nhật theo thời gian thực</p>
            </div>
          </div>
        )}

        {editTab === 'items' && editPost && (
          <ItemPickerContent post={editPost} listType={type} onChanged={load} />
        )}
      </Modal>
    </TeacherLayout>
  );
}
