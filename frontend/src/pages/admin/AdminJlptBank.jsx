import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  JLPT_LEVELS, mondaiJa, mondaiVi, PASSAGE_MONDAI_TYPES, LISTENING_MONDAI_TYPES,
  mondaiOptionsCount, levelMondaiTypes,
} from '../../lib/mockExamConstants';
import {
  adminJlptBankStats, adminJlptBankListQuestions, adminJlptBankCreateQuestions,
  adminJlptBankUpdateQuestion, adminJlptBankDeleteQuestion, adminJlptBankQuestionTts,
  adminJlptBankListGroups, adminJlptBankCreateGroup, adminJlptBankUpdateGroup,
  adminJlptBankDeleteGroup, adminJlptBankAiGenerate, adminUploadMedia,
  adminJlptBankImportTemplate, adminJlptBankImportFile, adminJlptBankImportCommit,
} from '../../lib/mockExamApi';

// Ngân hàng đề JLPT riêng (jlpt_module.jlpt_bank_*) — kho câu theo cấp × dạng mondai,
// là nguồn cho nút "Nhập từ ngân hàng" trong editor đề thi thử.
export default function AdminJlptBank() {
  const [level, setLevel] = useState('N5');
  const [type, setType]   = useState(levelMondaiTypes('N5')[0]);
  const [counts, setCounts] = useState({});
  const [error, setError]   = useState('');
  // Tăng để báo panel + sidebar reload sau khi thêm/xóa câu
  const [refreshKey, setRefreshKey] = useState(0);

  const types = levelMondaiTypes(level);
  const isPassage = PASSAGE_MONDAI_TYPES.has(type);
  const listening = LISTENING_MONDAI_TYPES.has(type);

  const changeLevel = (lv) => { setLevel(lv); setType(levelMondaiTypes(lv)[0]); };
  const onChanged = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    adminJlptBankStats(level).then(r => setCounts(r.counts || {})).catch(e => setError(e.message));
  }, [level, refreshKey]);

  return (
    <AdminLayout title="Ngân hàng JLPT">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">Ngân hàng đề JLPT</h1>
            <p className="text-sm text-on-muted">Kho câu hỏi theo cấp độ × dạng mondai — dùng để nhập vào đề thi thử (sao chép snapshot).</p>
          </div>
          <div className="flex gap-1.5">
            {JLPT_LEVELS.map(lv => (
              <button key={lv} onClick={() => changeLevel(lv)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${level === lv ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:text-charcoal'}`}>
                {lv}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* ── Sidebar: dạng mondai của cấp đang chọn ── */}
          <div className="border border-outline/40 rounded-xl p-2 space-y-1 self-start">
            {types.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${type === t ? 'bg-tsubaki-red/10 border border-tsubaki-red/40' : 'hover:bg-surface-low'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-charcoal">{mondaiJa(t)}</span>
                  <span className={`shrink-0 text-[10px] px-1.5 rounded ${counts[t] ? 'bg-green-100 text-green-700' : 'bg-surface-low text-on-muted'}`}>
                    {counts[t] || 0} câu
                  </span>
                </div>
                <span className="text-on-muted">{mondaiVi(t)}</span>
              </button>
            ))}
          </div>

          {/* ── Panel: câu đơn hoặc nhóm passage ── */}
          {isPassage
            ? <GroupPanel key={`${level}:${type}:${refreshKey}`} level={level} type={type} onChanged={onChanged} />
            : <QuestionPanel key={`${level}:${type}:${refreshKey}`} level={level} type={type} listening={listening} onChanged={onChanged} />}
        </div>
      </div>
    </AdminLayout>
  );
}

// ── Hiển thị 1 câu trong list (dùng chung cho câu đơn + câu trong nhóm) ──
function BankQuestionView({ q, index, listening, onEdit, onDelete, onTts, ttsLoading }) {
  return (
    <div className="border border-outline/40 rounded-xl p-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-surface-low text-on-muted text-xs font-bold flex items-center justify-center">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-charcoal whitespace-pre-wrap">
            {q.question_text || <em className="text-on-muted font-normal">(không có đề chữ — nghe)</em>}
          </p>
          {q.translation_vi && <p className="text-xs text-emerald-700 mt-0.5 whitespace-pre-wrap">🇻🇳 {q.translation_vi}</p>}
          <ul className="mt-1 space-y-0.5">
            {(q.options || []).map((o, k) => (
              <li key={k} className={k === q.correct_index ? 'text-green-700 font-semibold' : 'text-on-muted'}>
                {k + 1}. {o} {k === q.correct_index && '✓'}
                {q.option_translations?.[k] && <span className="block pl-4 text-[11px] italic font-normal text-on-muted">{q.option_translations[k]}</span>}
              </li>
            ))}
          </ul>
          {q.explanation && <p className="text-xs text-on-muted mt-1">💡 {q.explanation}</p>}
          {listening && q.audio_transcript && <p className="text-xs text-blue-700 mt-1 whitespace-pre-wrap">🎧 {q.audio_transcript}</p>}
          {q.image_url && <img src={q.image_url} className="mt-1.5 max-h-24 rounded border border-outline/40" alt="" />}
          {q.audio_url && <audio controls src={q.audio_url} className="mt-1.5 w-full max-w-sm h-9" />}
          <p className="text-[10px] text-on-muted mt-1.5">
            Nguồn: {q.source === 'ai' ? 'AI sinh' : q.source === 'import' ? 'Nhập file' : 'Soạn tay'}
            {q.created_at ? ` · ${new Date(q.created_at).toLocaleDateString('vi-VN')}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {listening && (
            <button type="button" title={q.audio_transcript ? 'Tạo audio từ transcript (TTS)' : 'Cần có transcript trước'}
              disabled={!q.audio_transcript || ttsLoading}
              onClick={onTts}
              className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-sumire-purple disabled:opacity-40">
              <span className={`material-symbols-outlined text-lg ${ttsLoading ? 'animate-spin' : ''}`}>{ttsLoading ? 'progress_activity' : 'record_voice_over'}</span>
            </button>
          )}
          <button type="button" title="Sửa câu" onClick={onEdit}
            className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-charcoal">
            <span className="material-symbols-outlined text-lg">edit</span>
          </button>
          <button type="button" title="Xóa câu" onClick={onDelete}
            className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-tsubaki-red">
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel câu đơn (từ vựng / ngữ pháp / nghe) ──
function QuestionPanel({ level, type, listening, onChanged }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);      // null | { q } (q rỗng = thêm mới)
  const [showAi, setShowAi] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [ttsId, setTtsId] = useState(null);
  const limit = 10;

  const load = (p = page, s = search) => {
    setLoading(true);
    adminJlptBankListQuestions({ level, mondai_type: type, search: s || undefined, page: p, limit })
      .then(r => { setRows(r.data || []); setTotal(r.total || 0); setPage(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(1); }, []);

  const run = async (fn, okMsg) => {
    setError(''); setNotice('');
    try { await fn(); if (okMsg) setNotice(okMsg); load(); onChanged(); }
    catch (e) { setError(e.message); }
  };

  const doTts = async (q) => {
    setTtsId(q.id); setError(''); setNotice('');
    try { await adminJlptBankQuestionTts(q.id); setNotice('Đã tạo audio từ transcript.'); load(); }
    catch (e) { setError(e.message); }
    finally { setTtsId(null); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-charcoal">{mondaiJa(type)} · {mondaiVi(type)} <span className="text-xs text-on-muted font-normal">({total} câu)</span></h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined text-lg">upload_file</span> Nhập file
          </Button>
          <Button variant="purple" size="sm" onClick={() => setShowAi(true)}>
            <span className="material-symbols-outlined text-lg">smart_toy</span> AI sinh
          </Button>
          <Button size="sm" onClick={() => setForm({ q: null })}>
            <span className="material-symbols-outlined text-lg">add</span> Thêm câu
          </Button>
        </div>
      </div>

      {error &&  <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}

      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="Tìm theo nội dung câu hỏi…"
          className="flex-1 px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        <Button variant="secondary" size="sm" onClick={() => load(1)}>Tìm</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-14"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
      ) : rows.length === 0 ? (
        <div className="text-center text-on-muted py-14 border border-dashed border-outline/50 rounded-2xl">
          <span className="material-symbols-outlined text-5xl opacity-30 block mb-2">inventory_2</span>
          Chưa có câu nào trong ngân hàng cho dạng này.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((q, i) => (
            <BankQuestionView key={q.id} q={q} index={(page - 1) * limit + i} listening={listening}
              onEdit={() => setForm({ q })} onDelete={() => setConfirm(q.id)}
              onTts={() => doTts(q)} ttsLoading={ttsId === q.id} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Trước</Button>
          <span className="text-on-muted">Trang {page}/{totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Sau</Button>
        </div>
      )}

      {form && (
        <QuestionFormModal level={level} type={type} listening={listening} initial={form.q}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load(); onChanged(); }} />
      )}
      {showAi && (
        <BankAiModal level={level} type={type} listening={listening} isPassage={false}
          onClose={() => setShowAi(false)}
          onSaved={(n) => { setShowAi(false); setNotice(`Đã thêm ${n} câu vào ngân hàng.`); load(); onChanged(); }} />
      )}
      {showImport && (
        <ImportFileModal level={level} type={type} listening={listening}
          onClose={() => setShowImport(false)}
          onSaved={(n) => { setShowImport(false); setNotice(`Đã nhập ${n} câu từ file vào ngân hàng.`); load(); onChanged(); }} />
      )}
      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        title="Xóa câu khỏi ngân hàng?" message="Câu đã import vào đề không bị ảnh hưởng (đề giữ bản sao). Thao tác này không thể hoàn tác."
        confirmLabel="Xóa" variant="danger"
        onConfirm={() => { const id = confirm; setConfirm(null); run(() => adminJlptBankDeleteQuestion(id), 'Đã xóa câu.'); }} />
    </div>
  );
}

// ── Panel nhóm passage (7 dạng đọc) ──
function GroupPanel({ level, type, onChanged }) {
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [groupForm, setGroupForm] = useState(null);  // null | { g } (g null = tạo mới)
  const [qForm, setQForm] = useState(null);          // null | { groupId, q }
  const [showAi, setShowAi] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);      // { kind: 'group'|'question', id }
  const limit = 5;

  const load = (p = page) => {
    setLoading(true);
    adminJlptBankListGroups({ level, mondai_type: type, page: p, limit })
      .then(r => { setGroups(r.data || []); setTotal(r.total || 0); setPage(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(1); }, []);

  const run = async (fn, okMsg) => {
    setError(''); setNotice('');
    try { await fn(); if (okMsg) setNotice(okMsg); load(); onChanged(); }
    catch (e) { setError(e.message); }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-charcoal">{mondaiJa(type)} · {mondaiVi(type)} <span className="text-xs text-on-muted font-normal">({total} nhóm passage)</span></h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <span className="material-symbols-outlined text-lg">upload_file</span> Nhập file
          </Button>
          <Button variant="purple" size="sm" onClick={() => setShowAi(true)}>
            <span className="material-symbols-outlined text-lg">smart_toy</span> AI sinh nhóm
          </Button>
          <Button size="sm" onClick={() => setGroupForm({ g: null })}>
            <span className="material-symbols-outlined text-lg">add</span> Thêm nhóm passage
          </Button>
        </div>
      </div>

      {error &&  <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}

      {loading ? (
        <div className="flex justify-center py-14"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div>
      ) : groups.length === 0 ? (
        <div className="text-center text-on-muted py-14 border border-dashed border-outline/50 rounded-2xl">
          <span className="material-symbols-outlined text-5xl opacity-30 block mb-2">auto_stories</span>
          Chưa có nhóm passage nào cho dạng này.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <div key={g.id} className="border border-outline/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-charcoal text-sm">{g.title || <em className="font-normal text-on-muted">(nhóm không tên)</em>}</p>
                  <p className="text-[11px] text-on-muted">{(g.jlpt_bank_questions || []).length} câu · {new Date(g.created_at).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" title="Sửa nhóm (tiêu đề/passage/ảnh)" onClick={() => setGroupForm({ g })}
                    className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-charcoal">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button type="button" title="Xóa nhóm (kèm câu con)" onClick={() => setConfirm({ kind: 'group', id: g.id })}
                    className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-tsubaki-red">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
              {g.passage_text && (
                <p className="text-sm text-charcoal bg-surface-low border border-outline/30 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-40 overflow-y-auto">{g.passage_text}</p>
              )}
              {g.image_url && <img src={g.image_url} className="max-h-32 rounded border border-outline/40" alt="" />}
              <div className="space-y-2">
                {(g.jlpt_bank_questions || []).map((q, i) => (
                  <BankQuestionView key={q.id} q={q} index={i} listening={false}
                    onEdit={() => setQForm({ groupId: g.id, q })}
                    onDelete={() => setConfirm({ kind: 'question', id: q.id })} />
                ))}
                <button onClick={() => setQForm({ groupId: g.id, q: null })}
                  className="w-full border border-dashed border-outline/60 rounded-xl py-2 text-xs text-tsubaki-red font-semibold hover:bg-tsubaki-red/5 flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-base">add</span> Thêm câu vào nhóm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Trước</Button>
          <span className="text-on-muted">Trang {page}/{totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Sau</Button>
        </div>
      )}

      {groupForm && (
        <GroupFormModal level={level} type={type} initial={groupForm.g}
          onClose={() => setGroupForm(null)}
          onSaved={() => { setGroupForm(null); load(); onChanged(); }} />
      )}
      {qForm && (
        <QuestionFormModal level={level} type={type} listening={false} initial={qForm.q} groupId={qForm.groupId}
          onClose={() => setQForm(null)}
          onSaved={() => { setQForm(null); load(); onChanged(); }} />
      )}
      {showAi && (
        <BankAiModal level={level} type={type} listening={false} isPassage
          onClose={() => setShowAi(false)}
          onSaved={(n) => { setShowAi(false); setNotice(`Đã tạo nhóm passage với ${n} câu.`); load(); onChanged(); }} />
      )}
      {showImport && (
        <ImportFileModal level={level} type={type} listening={false} isPassage
          onClose={() => setShowImport(false)}
          onSaved={(r) => { setShowImport(false); setNotice(`Đã nhập ${r.groups} nhóm (${r.questions} câu) từ file vào ngân hàng.`); load(); onChanged(); }} />
      )}
      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        title={confirm?.kind === 'group' ? 'Xóa nhóm passage?' : 'Xóa câu khỏi ngân hàng?'}
        message={confirm?.kind === 'group'
          ? 'Toàn bộ câu con trong nhóm sẽ bị xóa theo. Câu đã import vào đề không bị ảnh hưởng.'
          : 'Câu đã import vào đề không bị ảnh hưởng (đề giữ bản sao). Thao tác này không thể hoàn tác.'}
        confirmLabel="Xóa" variant="danger"
        onConfirm={() => {
          const c = confirm; setConfirm(null);
          if (c.kind === 'group') run(() => adminJlptBankDeleteGroup(c.id), 'Đã xóa nhóm passage.');
          else run(() => adminJlptBankDeleteQuestion(c.id), 'Đã xóa câu.');
        }} />
    </div>
  );
}

// ── Modal thêm/sửa nhóm passage (chỉ meta: tiêu đề/passage/ảnh) ──
function GroupFormModal({ level, type, initial, onClose, onSaved }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [passage, setPassage] = useState(initial?.passage_text || '');
  const [imageUrl, setImageUrl] = useState(initial?.image_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true); setError('');
    try { const { url } = await adminUploadMedia('image', file); setImageUrl(url); }
    catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body = { title: title.trim() || null, passage_text: passage.trim() || null, image_url: imageUrl || null };
      if (initial?.id) await adminJlptBankUpdateGroup(initial.id, body);
      else await adminJlptBankCreateGroup({ level, mondai_type: type, ...body });
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={initial ? 'Sửa nhóm passage' : `Thêm nhóm passage · ${mondaiJa(type)}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={save} loading={saving}>{initial ? 'Lưu' : 'Tạo nhóm'}</Button>
      </>}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      <div className="space-y-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tiêu đề/ghi chú nhóm (tùy chọn — vd: Bài đọc về môi trường)"
          className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        <textarea value={passage} onChange={e => setPassage(e.target.value)} rows={8}
          placeholder="Đoạn văn đọc hiểu dùng chung cho các câu trong nhóm"
          className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red resize-y" />
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-base">{uploading ? 'progress_activity' : 'image'}</span>
            {imageUrl ? 'Đổi ảnh' : 'Tải ảnh minh họa (情報検索…)'}
            <input type="file" accept="image/*" className="hidden" onChange={e => uploadImage(e.target.files[0])} />
          </label>
          {imageUrl && <img src={imageUrl} className="h-10 rounded border border-outline/40" alt="" />}
        </div>
      </div>
    </Modal>
  );
}

// ── Modal thêm/sửa 1 câu trong bank ──
function QuestionFormModal({ level, type, listening, initial, groupId, onClose, onSaved }) {
  const optCount = initial?.options?.length || mondaiOptionsCount(type);
  const [q, setQ] = useState(() => initial ? {
    question_text:       initial.question_text || '',
    translation_vi:      initial.translation_vi || '',
    options:             [...(initial.options || [])],
    correct_index:       initial.correct_index ?? 0,
    option_translations: Array.isArray(initial.option_translations) ? [...initial.option_translations] : null,
    explanation:         initial.explanation || '',
    audio_transcript:    initial.audio_transcript || '',
    audio_url:           initial.audio_url || '',
    image_url:           initial.image_url || '',
  } : {
    question_text: '', translation_vi: '', options: Array(optCount).fill(''),
    correct_index: 0, option_translations: null, explanation: '',
    audio_transcript: '', audio_url: '', image_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');

  const setField = (k, v) => setQ(p => ({ ...p, [k]: v }));
  const setOpt = (k, v) => setQ(p => { const o = [...p.options]; o[k] = v; return { ...p, options: o }; });
  const setOptTrans = (k, v) => setQ(p => {
    const t = Array.isArray(p.option_translations) ? [...p.option_translations] : p.options.map(() => '');
    t[k] = v; return { ...p, option_translations: t };
  });

  const upload = async (kind, file) => {
    if (!file) return;
    setUploading(kind); setError('');
    try { const { url } = await adminUploadMedia(kind, file); setField(kind === 'audio' ? 'audio_url' : 'image_url', url); }
    catch (e) { setError(e.message); }
    finally { setUploading(''); }
  };

  const valid = q.options.every(o => String(o).trim())
    && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length;

  const save = async () => {
    setSaving(true); setError('');
    const payload = {
      question_text:       q.question_text.trim() || null,
      translation_vi:      q.translation_vi.trim() || null,
      options:             q.options.map(s => s.trim()),
      correct_index:       q.correct_index,
      option_translations: q.option_translations,
      explanation:         q.explanation.trim() || null,
      audio_transcript:    q.audio_transcript.trim() || null,
      audio_url:           q.audio_url || null,
      image_url:           q.image_url || null,
    };
    try {
      if (initial?.id) await adminJlptBankUpdateQuestion(initial.id, payload);
      else await adminJlptBankCreateQuestions({ level, mondai_type: type, group_id: groupId || undefined, questions: [payload] });
      onSaved();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={initial ? 'Sửa câu hỏi' : `Thêm câu · ${mondaiJa(type)} (${level})`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={save} loading={saving} disabled={!valid}>{initial ? 'Lưu' : 'Thêm vào ngân hàng'}</Button>
      </>}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      <div className="space-y-2.5 text-sm">
        <textarea value={q.question_text} onChange={e => setField('question_text', e.target.value)} rows={2}
          placeholder={listening ? 'Câu hỏi in trên đề (để trống với dạng nghe không in đề chữ)' : 'Nội dung câu hỏi'}
          className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red resize-y" />
        <input value={q.translation_vi} onChange={e => setField('translation_vi', e.target.value)}
          placeholder="Bản dịch tiếng Việt của câu hỏi (tùy chọn)"
          className="w-full px-3 py-1.5 border border-outline rounded-lg text-xs outline-none focus:border-tsubaki-red" />

        {listening && (<>
          <textarea value={q.audio_transcript} onChange={e => setField('audio_transcript', e.target.value)} rows={3}
            placeholder={'Transcript audio (script tiếng Nhật, nhãn 男：/女： mỗi lượt thoại một dòng)'}
            className="w-full px-3 py-2 border border-outline rounded-lg text-xs outline-none focus:border-tsubaki-red resize-y" />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-base">{uploading === 'audio' ? 'progress_activity' : 'music_note'}</span>
              {q.audio_url ? 'Đổi file audio' : 'Tải file audio (mp3…)'}
              <input type="file" accept="audio/*" className="hidden" onChange={e => upload('audio', e.target.files[0])} />
            </label>
            {q.audio_url && <audio controls src={q.audio_url} className="h-8" />}
            {!initial && <span className="text-on-muted">(Lưu câu xong có thể tạo audio bằng TTS từ transcript.)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-base">{uploading === 'image' ? 'progress_activity' : 'image'}</span>
              {q.image_url ? 'Đổi ảnh' : 'Tải ảnh minh họa (発話表現…)'}
              <input type="file" accept="image/*" className="hidden" onChange={e => upload('image', e.target.files[0])} />
            </label>
            {q.image_url && <img src={q.image_url} className="h-10 rounded border border-outline/40" alt="" />}
          </div>
        </>)}

        <div className="space-y-1.5">
          {q.options.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name="bank-q-correct" checked={q.correct_index === k}
                onChange={() => setField('correct_index', k)} title="Đáp án đúng" />
              <div className="flex-1 space-y-0.5">
                <input value={o} onChange={e => setOpt(k, e.target.value)} placeholder={`Lựa chọn ${k + 1}`}
                  className={`w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:border-tsubaki-red ${q.correct_index === k ? 'border-green-400 bg-green-50/50' : 'border-outline'}`} />
                <input value={q.option_translations?.[k] || ''} onChange={e => setOptTrans(k, e.target.value)}
                  placeholder="Dịch tiếng Việt (tùy chọn)"
                  className="w-full px-3 py-1 border border-outline/60 rounded-lg text-[11px] italic outline-none focus:border-tsubaki-red" />
              </div>
            </div>
          ))}
        </div>
        <textarea value={q.explanation} onChange={e => setField('explanation', e.target.value)} rows={2}
          placeholder="Giải thích đáp án (tiếng Việt, tùy chọn)"
          className="w-full px-3 py-2 border border-outline rounded-lg text-xs outline-none focus:border-tsubaki-red resize-y" />
      </div>
    </Modal>
  );
}

// ── Modal nhập từ file Excel/CSV vào bank ─────────────────────────────────────
// Câu đơn/nghe: preview.valid (mỗi dòng 1 câu). Dạng passage: preview.groups
// (mỗi nhóm = đoạn văn + câu con, file .xlsx 2 sheet) — tick chọn theo NHÓM.
function ImportFileModal({ level, type, listening, isPassage, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);  // { valid | groups, errors, warnings, source }
  const [picked, setPicked] = useState([]);      // bool[] song song với items
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Danh sách hiển thị/tick: câu (valid) hoặc nhóm passage có câu con
  const items = !preview ? []
    : isPassage ? (preview.groups || []).filter(g => g.questions.length > 0)
    : (preview.valid || []);

  const downloadTemplate = async () => {
    setError('');
    try {
      const blob = await adminJlptBankImportTemplate(level, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jlpt-bank-${level}-${type}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError('Không thể tải file mẫu.'); }
  };

  const parseFile = async () => {
    if (!file) return;
    setParsing(true); setError('');
    try {
      const r = await adminJlptBankImportFile(level, type, file);
      setPreview(r);
      const list = isPassage ? (r.groups || []).filter(g => g.questions.length > 0) : (r.valid || []);
      setPicked(list.map(() => true));
    } catch (e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const pickedCount = picked.filter(Boolean).length;

  const commit = async () => {
    const chosen = items.filter((_, i) => picked[i]);
    if (!chosen.length) { setError(`Chọn ít nhất 1 ${isPassage ? 'nhóm' : 'câu'} để nhập.`); return; }
    setSaving(true); setError('');
    try {
      if (isPassage) {
        const groups = chosen.map(g => ({ title: g.title, passage_text: g.passage_text, questions: g.questions.map(q => q.question) }));
        const r = await adminJlptBankImportCommit({ level, mondai_type: type, groups });
        onSaved({ groups: r.saved_groups ?? groups.length, questions: r.saved ?? 0 });
      } else {
        const questions = chosen.map(v => v.question);
        const r = await adminJlptBankImportCommit({ level, mondai_type: type, questions });
        onSaved(r.saved ?? questions.length);
      }
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`Nhập câu từ file · ${mondaiJa(type)} (${level})`}
      footer={preview ? <>
        <Button variant="secondary" onClick={() => { setPreview(null); setPicked([]); }}>Chọn file khác</Button>
        <Button onClick={commit} loading={saving} disabled={!pickedCount}>Nhập {pickedCount} {isPassage ? 'nhóm' : 'câu'} vào ngân hàng</Button>
      </> : <>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={parseFile} loading={parsing} disabled={!file}>Đọc file</Button>
      </>}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {!preview ? (
        <div className="space-y-4">
          <Alert type="info">
            {isPassage ? <>
              Nhập nhóm đọc hiểu dạng <b>{mondaiJa(type)}</b> ({mondaiVi(type)}) cấp {level} từ file <b>.xlsx có 2 sheet</b>:
              sheet "Đoạn văn" (mỗi dòng 1 đoạn, có số đoạn) và sheet "Câu hỏi" (mỗi câu ghi số đoạn nó thuộc về).
              Tải file mẫu bên dưới để có đúng cấu trúc — hệ thống kiểm tra và cho xem trước, chưa ghi vào ngân hàng.
            </> : <>
              Nhập câu dạng <b>{mondaiJa(type)}</b> ({mondaiVi(type)}) cấp {level} từ file .xlsx/.csv.
              Tải file mẫu bên dưới, điền mỗi câu một dòng rồi upload — hệ thống sẽ kiểm tra và cho xem trước, chưa ghi vào ngân hàng.
              {listening && <> Với dạng nghe, điền <b>script bài nghe</b> vào cột audio_transcript (nhãn 男：/女： mỗi lượt thoại);
              file audio tạo sau bằng nút TTS hoặc upload ở từng câu.</>}
            </>}
          </Alert>
          <button type="button" onClick={downloadTemplate}
            className="text-tsubaki-red font-semibold text-sm hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">download</span> Tải file mẫu (.xlsx)
          </button>
          <label className="block border border-dashed border-outline/60 rounded-2xl p-6 text-center cursor-pointer hover:bg-surface-low">
            <span className="material-symbols-outlined text-4xl text-on-muted block mb-1">upload_file</span>
            <span className="text-sm font-semibold text-charcoal">{file ? file.name : isPassage ? 'Chọn file .xlsx / .xls' : 'Chọn file .xlsx / .xls / .csv'}</span>
            <input type="file" accept={isPassage ? '.xlsx,.xls' : '.xlsx,.xls,.csv'} className="hidden"
              onChange={e => setFile(e.target.files[0] || null)} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {(preview.warnings || []).map((w, i) => <Alert key={i} type="warning">{w}</Alert>)}
          {preview.errors?.length > 0 && (
            <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm space-y-1">
              <p className="font-semibold text-red-700">{preview.errors.length} dòng lỗi — sẽ bị bỏ qua:</p>
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">Dòng {e.row}: {e.message}</p>
              ))}
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-on-muted text-center py-6">Không có {isPassage ? 'nhóm' : 'dòng'} hợp lệ nào trong file.</p>
          ) : isPassage ? (
            <div className="space-y-2">
              <p className="text-xs text-on-muted">{items.length} nhóm hợp lệ — bỏ tick nhóm không muốn nhập:</p>
              {items.map((g, i) => (
                <label key={i} className={`block border rounded-xl p-3 cursor-pointer ${picked[i] ? 'border-sumire-purple/40 bg-sumire-purple/5' : 'border-outline/40 opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={!!picked[i]} className="mt-1"
                      onChange={e => setPicked(p => p.map((x, j) => j === i ? e.target.checked : x))} />
                    <div className="flex-1 text-sm space-y-2 min-w-0">
                      <p className="font-bold text-charcoal">
                        <span className="text-[10px] text-on-muted font-normal mr-1.5">Đoạn {g.passage_no}</span>
                        {g.title || <em className="font-normal text-on-muted">(nhóm không tên)</em>}
                        <span className="text-xs text-on-muted font-normal"> · {g.questions.length} câu</span>
                      </p>
                      <p className="text-xs text-charcoal bg-surface-low border border-outline/30 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap max-h-32 overflow-y-auto">{g.passage_text}</p>
                      <ul className="space-y-1">
                        {g.questions.map((v, k) => (
                          <li key={k} className="text-xs">
                            <span className="font-semibold text-charcoal whitespace-pre-wrap">{k + 1}. {v.question.question_text}</span>
                            <span className="text-green-700"> — Đáp án: {v.question.options[v.question.correct_index]}</span>
                            {v.question.translation_vi && <span className="block pl-4 italic text-emerald-700">🇻🇳 {v.question.translation_vi}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-on-muted">{items.length} câu hợp lệ — bỏ tick câu không muốn nhập:</p>
              {items.map((v, i) => (
                <label key={i} className={`block border rounded-xl p-3 cursor-pointer ${picked[i] ? 'border-sumire-purple/40 bg-sumire-purple/5' : 'border-outline/40 opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={!!picked[i]} className="mt-1"
                      onChange={e => setPicked(p => p.map((x, j) => j === i ? e.target.checked : x))} />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-charcoal whitespace-pre-wrap">
                        <span className="text-[10px] text-on-muted font-normal mr-1.5">Dòng {v.row}</span>
                        {v.question.question_text || <span className="italic font-normal text-on-muted">(câu hỏi chỉ đọc trong bài nghe)</span>}
                      </p>
                      {v.question.audio_transcript && <p className="text-xs text-blue-700 mt-1 whitespace-pre-wrap">🎧 {v.question.audio_transcript}</p>}
                      {v.question.translation_vi && <p className="text-xs text-emerald-700 mt-0.5">🇻🇳 {v.question.translation_vi}</p>}
                      <ul className="mt-1 space-y-0.5">
                        {v.question.options.map((o, k) => (
                          <li key={k} className={k === v.question.correct_index ? 'text-green-700 font-semibold' : 'text-on-muted'}>
                            {k + 1}. {o} {k === v.question.correct_index && '✓'}
                            {v.question.option_translations?.[k] && <span className="block pl-4 text-[11px] italic font-normal text-on-muted">{v.question.option_translations[k]}</span>}
                          </li>
                        ))}
                      </ul>
                      {v.question.explanation && <p className="text-xs text-on-muted mt-1">💡 {v.question.explanation}</p>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Modal AI sinh nháp vào bank ──
function BankAiModal({ level, type, listening, isPassage, onClose, onSaved }) {
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [passage, setPassage] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const patchDraft = (i, patch) => setDrafts(ds => ds.map((x, j) => j === i ? { ...x, ...patch } : x));

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const r = await adminJlptBankAiGenerate({ level, mondai_type: type, count, topic, instruction });
      setDrafts(r.questions.map(q => ({ ...q, _picked: true })));
      setPassage(r.passage_text || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const savePicked = async () => {
    const picked = drafts.filter(d => d._picked)
      .map(d => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith('_'))));
    if (!picked.length) { setError('Chọn ít nhất 1 câu.'); return; }
    setSaving(true); setError('');
    try {
      if (isPassage) {
        await adminJlptBankCreateGroup({ level, mondai_type: type, passage_text: passage || null, source: 'ai', questions: picked });
      } else {
        await adminJlptBankCreateQuestions({ level, mondai_type: type, source: 'ai', questions: picked });
      }
      onSaved(picked.length);
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`AI sinh câu vào ngân hàng · ${mondaiJa(type)} (${level})`}
      footer={drafts ? <>
        <Button variant="secondary" onClick={() => setDrafts(null)}>Sinh lại</Button>
        <Button onClick={savePicked} loading={saving}>Lưu {drafts.filter(d => d._picked).length} câu vào ngân hàng</Button>
      </> : <>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button variant="purple" onClick={generate} loading={loading}>Sinh câu hỏi</Button>
      </>}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {!drafts ? (
        <div className="space-y-4">
          <Alert type="info">
            AI sinh câu dạng <b>{mondaiJa(type)}</b> ({mondaiVi(type)}) cấp {level}. Câu đã có trong ngân hàng (cùng cấp + dạng) được đưa vào prompt để tránh trùng lặp.
            {isPassage && ' AI sẽ sinh cả đoạn văn — các câu được lưu thành 1 nhóm passage mới.'}
          </Alert>
          <div className="flex items-center gap-3">
            <label className="text-sm text-on-muted">Số câu:</label>
            <input type="number" min="1" max="15" value={count} onChange={e => setCount(+e.target.value)}
              className="w-20 px-3 py-2 border border-outline rounded-lg text-sm" />
          </div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Chủ đề (tùy chọn)"
            className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
          <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3}
            placeholder="Yêu cầu thêm cho AI (tùy chọn) — vd: tập trung ngữ pháp về điều kiện, tránh chủ đề ẩm thực…"
            className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red resize-y" />
        </div>
      ) : (
        <div className="space-y-3">
          {passage && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-blue-800 mb-1">Đoạn văn AI sinh (sẽ lưu thành nhóm passage):</p>
              <p className="text-blue-900 whitespace-pre-wrap">{passage}</p>
            </div>
          )}
          {drafts.map((d, i) => (
            <label key={i} className={`block border rounded-xl p-3 cursor-pointer ${d._picked ? 'border-sumire-purple/40 bg-sumire-purple/5' : 'border-outline/40 opacity-60'}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={d._picked} className="mt-1"
                  onChange={e => patchDraft(i, { _picked: e.target.checked })} />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-charcoal">{d.question_text || <em className="text-on-muted">(không có đề chữ — nghe)</em>}</p>
                  {d.translation_vi && <p className="text-xs text-emerald-700 mt-0.5 whitespace-pre-wrap">🇻🇳 {d.translation_vi}</p>}
                  <ul className="mt-1 space-y-0.5">
                    {d.options.map((o, k) => (
                      <li key={k} className={k === d.correct_index ? 'text-green-700 font-semibold' : 'text-on-muted'}>
                        {k + 1}. {o} {k === d.correct_index && '✓'}
                        {d.option_translations?.[k] && <span className="block pl-4 text-[11px] italic font-normal text-on-muted">{d.option_translations[k]}</span>}
                      </li>
                    ))}
                  </ul>
                  {d.explanation && <p className="text-xs text-on-muted mt-1">💡 {d.explanation}</p>}
                  {listening && d.audio_transcript && <p className="text-xs text-blue-700 mt-1 whitespace-pre-wrap">🎧 {d.audio_transcript}</p>}
                </div>
              </div>
            </label>
          ))}
          <p className="text-xs text-on-muted">Sau khi lưu, có thể sửa từng câu / tạo audio TTS ngay trong ngân hàng.</p>
        </div>
      )}
    </Modal>
  );
}
