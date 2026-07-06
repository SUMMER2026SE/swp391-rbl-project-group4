import { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../lib/api';

const LEVELS = ['N5','N4','N3','N2','N1'];
const LEVEL_COLOR = { N5:'#059669', N4:'#0284c7', N3:'#7c3aed', N2:'#d97706', N1:'#ae2826' };
const LEVEL_BG    = { N5:'#d1fae5', N4:'#dbeafe', N3:'#ede9fe', N2:'#fef3c7', N1:'#fde8e8' };
const ICONS = ['headphones','restaurant','signpost','person','calendar_today','sports_esports',
  'family_restroom','school','wb_sunny','directions_bus','local_hospital','shopping_bag'];

const stripFurigana = t => t.replace(/\{([^|]+)\|[^}]+\}/g, '$1');

const EMPTY_DLG  = { title:'', title_vi:'', level:'N5', topic:'', thumbnail_icon:'headphones' };
const EMPTY_LINE = { speaker:'A', text_jp:'', text_plain:'', text_vi:'' };

function DialogueForm({ init = EMPTY_DLG, onSave, onCancel, saving }) {
  const [f, setF] = useState(init);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-semibold text-on-muted">Tiêu đề (JP) *</label>
          <input value={f.title} onChange={set('title')} placeholder="自己紹介"
            className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"
            style={{ fontFamily:"'Noto Sans JP',sans-serif" }} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-xs font-semibold text-on-muted">Tiêu đề (VI)</label>
          <input value={f.title_vi} onChange={set('title_vi')} placeholder="Tự giới thiệu"
            className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
        </div>
        <div>
          <label className="text-xs font-semibold text-on-muted">Cấp độ *</label>
          <select value={f.level} onChange={set('level')}
            className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red bg-white">
            {LEVELS.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-on-muted">Chủ đề</label>
          <input value={f.topic} onChange={set('topic')} placeholder="日常会話"
            className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-on-muted">Icon (Material Symbols)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ICONS.map(icon => (
              <button key={icon} type="button" onClick={() => setF(p => ({ ...p, thumbnail_icon: icon }))}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all
                  ${f.thumbnail_icon === icon ? 'border-tsubaki-red bg-tsubaki-red/10' : 'border-outline hover:border-tsubaki-red/40'}`}>
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(f)} disabled={!f.title || !f.level || saving}
          className="px-4 py-2 bg-tsubaki-red text-white text-sm font-semibold rounded-xl disabled:opacity-40">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-outline text-sm rounded-xl hover:bg-surface-low">
          Hủy
        </button>
      </div>
    </div>
  );
}

function LineRow({ line, onEdit, onDelete }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-outline/30 last:border-0 group">
      <span className="w-6 h-6 rounded-full bg-surface-low flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {line.speaker?.slice(0,1)}
      </span>
      <div className="flex-1 min-w-0 text-sm">
        <p style={{ fontFamily:"'Noto Sans JP',sans-serif" }} className="text-sm">{line.text_jp}</p>
        <p className="text-xs text-on-muted">{line.text_vi}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(line)} className="w-7 h-7 rounded-lg bg-surface-low hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
        <button onClick={() => onDelete(line.id)} className="w-7 h-7 rounded-lg bg-surface-low hover:bg-red-50 hover:text-tsubaki-red flex items-center justify-center">
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    </div>
  );
}

function LineForm({ init = EMPTY_LINE, onSave, onCancel, saving }) {
  const [f, setF] = useState(init);
  const set = k => e => {
    const val = e.target.value;
    setF(p => {
      const next = { ...p, [k]: val };
      if (k === 'text_jp') next.text_plain = stripFurigana(val);
      return next;
    });
  };
  return (
    <div className="mt-3 p-3 rounded-xl border border-outline bg-white space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-on-muted">Người nói</label>
          <input value={f.speaker} onChange={set('speaker')} placeholder="A / B / 田中"
            className="w-full mt-0.5 px-2 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-on-muted">Tiếng Nhật (dùng &#123;漢字|ふりがな&#125;)</label>
          <textarea value={f.text_jp} onChange={set('text_jp')} rows={2}
            placeholder="はじめまして。{田中|たなか}です。"
            className="w-full mt-0.5 px-2 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red resize-none"
            style={{ fontFamily:"'Noto Sans JP',sans-serif" }} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-on-muted">Plain text (tự điền từ JP)</label>
          <input value={f.text_plain} onChange={set('text_plain')}
            className="w-full mt-0.5 px-2 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red"
            style={{ fontFamily:"'Noto Sans JP',sans-serif" }} />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-semibold text-on-muted">Tiếng Việt</label>
          <input value={f.text_vi} onChange={set('text_vi')} placeholder="Xin chào. Tôi là Tanaka."
            className="w-full mt-0.5 px-2 py-1.5 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={!f.text_jp || !f.text_plain || saving}
          className="px-3 py-1.5 bg-tsubaki-red text-white text-xs font-semibold rounded-lg disabled:opacity-40">
          {saving ? '...' : 'Lưu câu'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 border border-outline text-xs rounded-lg hover:bg-surface-low">Hủy</button>
      </div>
    </div>
  );
}

function DialogueCard({ dlg, onUpdated, onDeleted }) {
  const [expanded, setExpanded]   = useState(false);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [addingLine, setAddingLine]   = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [lines, setLines] = useState(dlg.dialogue_lines || []);

  const saveDialogue = async (f) => {
    setSaving(true);
    try {
      const r = await api.put(`/admin/listening/dialogues/${dlg.id}`, f);
      onUpdated(r.data); setEditing(false);
    } catch { alert('Lỗi cập nhật.'); } finally { setSaving(false); }
  };

  const deleteDlg = async () => {
    if (!confirm('Xóa hội thoại này và toàn bộ câu thoại?')) return;
    await api.delete(`/admin/listening/dialogues/${dlg.id}`);
    onDeleted(dlg.id);
  };

  const addLine = async (f) => {
    setSaving(true);
    try {
      const r = await api.post(`/admin/listening/dialogues/${dlg.id}/lines`, f);
      setLines(prev => [...prev, r.data]); setAddingLine(false);
    } catch { alert('Lỗi thêm câu.'); } finally { setSaving(false); }
  };

  const updateLine = async (f) => {
    setSaving(true);
    try {
      const r = await api.put(`/admin/listening/lines/${editingLine.id}`, f);
      setLines(prev => prev.map(l => l.id === r.data.id ? r.data : l));
      setEditingLine(null);
    } catch { alert('Lỗi cập nhật câu.'); } finally { setSaving(false); }
  };

  const deleteLine = async (id) => {
    if (!confirm('Xóa câu này?')) return;
    await api.delete(`/admin/listening/lines/${id}`);
    setLines(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {editing ? (
        <div className="p-4">
          <DialogueForm init={dlg} onSave={saveDialogue} onCancel={() => setEditing(false)} saving={saving} />
        </div>
      ) : (
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: LEVEL_BG[dlg.level] }}>
            <span className="material-symbols-outlined text-xl" style={{ color: LEVEL_COLOR[dlg.level] }}>
              {dlg.thumbnail_icon || 'headphones'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold" style={{ fontFamily:"'Noto Sans JP',sans-serif" }}>{dlg.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: LEVEL_BG[dlg.level], color: LEVEL_COLOR[dlg.level] }}>{dlg.level}</span>
              {dlg.title_vi && <span className="text-xs text-on-muted">{dlg.title_vi}</span>}
              <span className="text-xs text-on-muted">{lines.length} câu</span>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setExpanded(v => !v)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-outline hover:bg-surface-low flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">{expanded ? 'expand_less' : 'list'}</span>
              Câu thoại
            </button>
            <button onClick={() => setEditing(true)}
              className="w-8 h-8 rounded-xl bg-surface-low hover:bg-sky-50 hover:text-sky-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">edit</span>
            </button>
            <button onClick={deleteDlg}
              className="w-8 h-8 rounded-xl bg-surface-low hover:bg-red-50 hover:text-tsubaki-red flex items-center justify-center">
              <span className="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-outline/30 px-4 pb-4">
          <div className="mt-3 space-y-0">
            {lines.map(line => editingLine?.id === line.id
              ? <LineForm key={line.id} init={editingLine} onSave={updateLine}
                  onCancel={() => setEditingLine(null)} saving={saving} />
              : <LineRow key={line.id} line={line}
                  onEdit={l => setEditingLine(l)} onDelete={deleteLine} />
            )}
          </div>
          {addingLine
            ? <LineForm onSave={addLine} onCancel={() => setAddingLine(false)} saving={saving} />
            : <button onClick={() => setAddingLine(true)}
                className="mt-3 flex items-center gap-1.5 text-sm text-tsubaki-red hover:underline">
                <span className="material-symbols-outlined text-base">add_circle</span> Thêm câu thoại
              </button>
          }
        </div>
      )}
    </div>
  );
}

export default function AdminListening() {
  const [dialogues, setDialogues] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [levelFilter, setLevelFilter] = useState('');

  useEffect(() => {
    api.get('/admin/listening/dialogues').then(r => setDialogues(r.data)).finally(() => setLoading(false));
  }, []);

  const createDialogue = async (f) => {
    setSaving(true);
    try {
      const r = await api.post('/admin/listening/dialogues', f);
      setDialogues(prev => [r.data, ...prev]); setCreating(false);
    } catch { alert('Lỗi tạo hội thoại.'); } finally { setSaving(false); }
  };

  const filtered = levelFilter ? dialogues.filter(d => d.level === levelFilter) : dialogues;

  return (
    <AdminLayout title="Hội thoại luyện nghe">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">Hội thoại luyện nghe</h1>
            <p className="text-sm text-on-muted">{dialogues.length} hội thoại · UC20-22</p>
          </div>
          <button onClick={() => setCreating(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-tsubaki-red text-white text-sm font-semibold rounded-xl">
            <span className="material-symbols-outlined text-base">{creating ? 'close' : 'add'}</span>
            {creating ? 'Hủy' : 'Thêm hội thoại'}
          </button>
        </div>

        {creating && (
          <div className="mb-4">
            <DialogueForm onSave={createDialogue} onCancel={() => setCreating(false)} saving={saving} />
          </div>
        )}

        {/* Level filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setLevelFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${!levelFilter ? 'bg-charcoal text-white border-charcoal' : 'border-outline text-on-muted'}`}>
            Tất cả
          </button>
          {LEVELS.map(lv => (
            <button key={lv} onClick={() => setLevelFilter(lv)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border transition-all ${levelFilter === lv ? 'text-white border-transparent' : 'border-outline text-on-muted'}`}
              style={levelFilter === lv ? { background: LEVEL_COLOR[lv] } : {}}>
              {lv}
            </button>
          ))}
        </div>

        {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="glass-card h-20 rounded-2xl animate-pulse"/>)}</div>}

        <div className="space-y-3">
          {filtered.map(dlg => (
            <DialogueCard key={dlg.id} dlg={dlg}
              onUpdated={updated => setDialogues(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))}
              onDeleted={id => setDialogues(prev => prev.filter(d => d.id !== id))} />
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-on-muted">
            <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">headphones</span>
            Chưa có hội thoại{levelFilter ? ` ${levelFilter}` : ''}.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
