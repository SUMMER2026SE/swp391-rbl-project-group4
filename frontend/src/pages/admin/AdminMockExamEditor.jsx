import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import QuestionCard from '../../components/admin/mock/QuestionCard';
import { MONDAI_TYPE_OPTIONS, mondaiJa, mondaiVi, SECTION_LABEL } from '../../lib/mockExamConstants';
import {
  adminGetExam, adminPublishExam, adminUpdateExam,
  adminCreateSection, adminUpdateSection, adminDeleteSection,
  adminCreateGroup, adminUpdateGroup, adminDeleteGroup,
  adminCreateQuestions, adminUpdateQuestion, adminDeleteQuestion,
  adminAiGenerate, adminImportFromBank, adminListBankForImport, adminUploadMedia,
} from '../../lib/mockExamApi';

const blankQuestion = () => ({ question_text: '', options: ['', '', '', ''], correct_index: 0, explanation: '' });

export default function AdminMockExamEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);   // modal thêm mondai cho section nào
  const [addForm, setAddForm] = useState({ sectionId: null, mondai_type: 'kanji_reading' });
  const [showAi, setShowAi]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const published = exam?.is_published;

  const load = useCallback(() => {
    setLoading(true);
    adminGetExam(id)
      .then(data => {
        setExam(data);
        // giữ selection nếu còn tồn tại
        const allGroups = (data.sections || []).flatMap(s => s.groups);
        setSelectedGroupId(prev => (allGroups.some(g => g.id === prev) ? prev : allGroups[0]?.id || null));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(load, [load]);

  const allGroups = (exam?.sections || []).flatMap(s => s.groups.map(g => ({ ...g, _section: s })));
  const selectedGroup = allGroups.find(g => g.id === selectedGroupId) || null;
  const isListening = selectedGroup?.score_category === 'listening';

  const run = async (fn, okMsg) => {
    setError(''); setNotice('');
    try { await fn(); if (okMsg) setNotice(okMsg); load(); }
    catch (e) { setError(e.data?.details ? `${e.message} — ${e.data.details.join(' · ')}` : e.message); }
  };

  const handlePublish = () => run(
    () => adminPublishExam(id, !published),
    published ? 'Đã gỡ xuất bản.' : 'Đã xuất bản đề thi.'
  );

  // ── Group meta (instruction/passage/media) ──
  const [groupDraft, setGroupDraft] = useState(null);
  useEffect(() => {
    if (selectedGroup) setGroupDraft({
      instruction_text: selectedGroup.instruction_text || '',
      passage_text: selectedGroup.passage_text || '',
      image_url: selectedGroup.image_url || '',
      audio_url: selectedGroup.audio_url || '',
      audio_transcript: selectedGroup.audio_transcript || '',
    });
  }, [selectedGroupId, exam]);

  const saveGroupMeta = () => run(
    () => adminUpdateGroup(selectedGroupId, groupDraft),
    'Đã lưu thông tin mondai.'
  );

  const uploadGroupMedia = async (kind, file) => {
    if (!file) return;
    setSaving(true); setError('');
    try {
      const { url } = await adminUploadMedia(kind, file);
      setGroupDraft(d => ({ ...d, [kind === 'audio' ? 'audio_url' : 'image_url']: url }));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <AdminLayout title="Soạn đề"><div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span></div></AdminLayout>;
  if (!exam)   return <AdminLayout title="Soạn đề"><Alert type="error">{error || 'Không tìm thấy đề.'}</Alert></AdminLayout>;

  return (
    <AdminLayout title={`Soạn đề · ${exam.title}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate('/admin/mock-exams')} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
            <span className="material-symbols-outlined text-lg">arrow_back</span> Danh sách đề
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex px-2 py-0.5 rounded-md bg-sumire-purple/10 text-sumire-purple font-bold text-xs">{exam.level}</span>
            <Button variant={published ? 'secondary' : 'primary'} onClick={handlePublish}>
              <span className="material-symbols-outlined text-lg">{published ? 'visibility_off' : 'publish'}</span>
              {published ? 'Gỡ xuất bản' : 'Xuất bản'}
            </Button>
          </div>
        </div>

        <div>
          <input
            value={exam.title} disabled={published}
            onChange={e => setExam(x => ({ ...x, title: e.target.value }))}
            onBlur={e => run(() => adminUpdateExam(id, { title: e.target.value }))}
            className="font-display text-2xl font-bold text-charcoal bg-transparent outline-none border-b-2 border-transparent focus:border-outline w-full disabled:opacity-100" />
        </div>

        {published && <Alert type="warning">Đề đang xuất bản là <b>bất biến</b>. Gỡ xuất bản để sửa nội dung (chỉ giải thích/chỉ dẫn được sửa khi đang xuất bản).</Alert>}
        {error &&  <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          {/* ── Cây phần thi / mondai ── */}
          <div className="space-y-3">
            {(exam.sections || []).map(section => (
              <div key={section.id} className="border border-outline/40 rounded-xl overflow-hidden">
                <div className="bg-surface-low px-3 py-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-charcoal truncate">{section.title || SECTION_LABEL[section.section_type]}</span>
                    {!published && (
                      <button onClick={() => setConfirm({ type: 'section', id: section.id, name: section.title })}
                        className="text-on-muted hover:text-error shrink-0">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-on-muted">
                    <span className="material-symbols-outlined text-[13px]">timer</span>
                    <input type="number" min="1" value={section.time_limit_minutes} disabled={published}
                      onChange={e => setExam(x => ({ ...x, sections: x.sections.map(s => s.id === section.id ? { ...s, time_limit_minutes: +e.target.value } : s) }))}
                      onBlur={e => run(() => adminUpdateSection(section.id, { time_limit_minutes: +e.target.value }))}
                      className="w-12 bg-transparent border-b border-outline/50 text-center outline-none disabled:opacity-100" /> phút
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {section.groups.map(g => (
                    <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${selectedGroupId === g.id ? 'bg-tsubaki-red/10 border border-tsubaki-red/40' : 'hover:bg-surface-low'}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-charcoal">問題{g.mondai_number} · {mondaiJa(g.mondai_type)}</span>
                        <span className={`shrink-0 text-[10px] px-1.5 rounded ${g.questions.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{g.questions.length} câu</span>
                      </div>
                      <span className="text-on-muted">{mondaiVi(g.mondai_type)}</span>
                    </button>
                  ))}
                  {!published && (
                    <button onClick={() => { setAddForm({ sectionId: section.id, mondai_type: 'kanji_reading' }); setShowAdd(true); }}
                      className="w-full text-xs text-tsubaki-red font-semibold py-1.5 hover:bg-tsubaki-red/5 rounded-lg flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">add</span> Thêm mondai
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!published && (
              <Button variant="secondary" size="sm" className="w-full"
                onClick={() => run(() => adminCreateSection(id, { section_type: 'listening', title: 'Phần thi mới', time_limit_minutes: 30 }))}>
                <span className="material-symbols-outlined text-lg">add</span> Thêm phần thi
              </Button>
            )}
          </div>

          {/* ── Panel mondai đang chọn ── */}
          <div>
            {!selectedGroup ? (
              <div className="text-center text-on-muted py-20 border border-dashed border-outline/50 rounded-2xl">
                <span className="material-symbols-outlined text-5xl opacity-30 block mb-2">quiz</span>
                Chọn một mondai bên trái để soạn câu hỏi.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border border-outline/40 rounded-2xl p-5 space-y-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-charcoal">問題{selectedGroup.mondai_number} · {mondaiJa(selectedGroup.mondai_type)}</h2>
                    <p className="text-sm text-on-muted">{mondaiVi(selectedGroup.mondai_type)} · Cột điểm: {selectedGroup.score_category}</p>
                  </div>
                  {groupDraft && (<>
                    <textarea value={groupDraft.instruction_text} disabled={published}
                      onChange={e => setGroupDraft(d => ({ ...d, instruction_text: e.target.value }))}
                      placeholder="Chỉ dẫn chung của mondai (tiếng Nhật)"
                      className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[48px] outline-none focus:border-tsubaki-red" />

                    {/* Passage cho dạng đọc hiểu */}
                    <textarea value={groupDraft.passage_text} disabled={published}
                      onChange={e => setGroupDraft(d => ({ ...d, passage_text: e.target.value }))}
                      placeholder="Đoạn văn đọc hiểu (nếu có) — dùng chung cho các câu trong mondai"
                      className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[60px] outline-none focus:border-tsubaki-red" />

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {/* Ảnh */}
                      <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">image</span>
                        {groupDraft.image_url ? 'Đổi ảnh' : 'Tải ảnh (発話表現/情報検索)'}
                        <input type="file" accept="image/*" className="hidden" disabled={published}
                          onChange={e => uploadGroupMedia('image', e.target.files[0])} />
                      </label>
                      {groupDraft.image_url && <img src={groupDraft.image_url} className="h-10 rounded border border-outline/40" alt="" />}
                      {/* Audio nhóm */}
                      <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">graphic_eq</span>
                        {groupDraft.audio_url ? 'Đổi audio mondai' : 'Tải audio mondai'}
                        <input type="file" accept="audio/*" className="hidden" disabled={published}
                          onChange={e => uploadGroupMedia('audio', e.target.files[0])} />
                      </label>
                      {groupDraft.audio_url && <audio src={groupDraft.audio_url} controls className="h-8 max-w-[40%]" />}
                    </div>

                    {isListening && (
                      <textarea value={groupDraft.audio_transcript} disabled={published}
                        onChange={e => setGroupDraft(d => ({ ...d, audio_transcript: e.target.value }))}
                        placeholder="Transcript (chỉ hiện khi học viên xem lại)"
                        className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[48px] outline-none focus:border-tsubaki-red" />
                    )}

                    <div className="flex items-center justify-end">
                      <Button size="sm" onClick={saveGroupMeta} loading={saving}>Lưu thông tin mondai</Button>
                    </div>
                  </>)}
                </div>

                {/* Câu hỏi */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-charcoal">Câu hỏi ({selectedGroup.questions.length})</h3>
                  {!published && (
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
                        <span className="material-symbols-outlined text-lg">inventory_2</span> Nhập từ ngân hàng
                      </Button>
                      <Button variant="purple" size="sm" onClick={() => setShowAi(true)}>
                        <span className="material-symbols-outlined text-lg">smart_toy</span> AI sinh câu
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedGroup.questions.map((q, i) => (
                    <QuestionCard key={q.id} index={i} value={q} listening={isListening} disabled={published}
                      onSave={(val) => run(() => adminUpdateQuestion(q.id, val), 'Đã lưu câu hỏi.')}
                      onDelete={() => setConfirm({ type: 'question', id: q.id })} />
                  ))}
                  {!published && (
                    <NewQuestionInline groupId={selectedGroupId} listening={isListening} onAdded={load} setError={setError} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal thêm mondai */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Thêm mondai"
        footer={<>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Hủy</Button>
          <Button onClick={() => run(() => adminCreateGroup(addForm.sectionId, { mondai_type: addForm.mondai_type }).then(() => setShowAdd(false)))}>Thêm</Button>
        </>}>
        <label className="block text-sm font-medium text-on-muted mb-1.5">Loại mondai (大問)</label>
        <select value={addForm.mondai_type} onChange={e => setAddForm(f => ({ ...f, mondai_type: e.target.value }))}
          className="w-full px-3 py-2.5 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
          {MONDAI_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Modal>

      {/* AI drawer */}
      {showAi && selectedGroup && (
        <AiGenerateModal group={selectedGroup} onClose={() => setShowAi(false)} onAdded={load} />
      )}

      {/* Import bank */}
      {showImport && selectedGroup && (
        <ImportBankModal group={selectedGroup} level={exam.level} onClose={() => setShowImport(false)} onImported={load} />
      )}

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        title={confirm?.type === 'section' ? 'Xóa phần thi?' : confirm?.type === 'question' ? 'Xóa câu hỏi?' : 'Xóa mondai?'}
        message="Thao tác này không thể hoàn tác."
        confirmLabel="Xóa"
        onConfirm={() => {
          const c = confirm; setConfirm(null);
          const fn = c.type === 'section' ? adminDeleteSection : c.type === 'question' ? adminDeleteQuestion : adminDeleteGroup;
          run(() => fn(c.id));
        }} />
    </AdminLayout>
  );
}

// ── Form thêm 1 câu hỏi mới ──
function NewQuestionInline({ groupId, listening, onAdded, setError }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft]   = useState(null);
  const [saving, setSaving] = useState(false);

  if (!adding) return (
    <button onClick={() => { setDraft(blankQuestion()); setAdding(true); }}
      className="w-full border border-dashed border-outline/60 rounded-xl py-3 text-sm text-tsubaki-red font-semibold hover:bg-tsubaki-red/5 flex items-center justify-center gap-1">
      <span className="material-symbols-outlined text-lg">add</span> Thêm câu hỏi
    </button>
  );

  return (
    <QuestionCard index={-1} value={draft} listening={listening} saving={saving}
      onSave={async (val) => {
        setSaving(true); setError('');
        try { await adminCreateQuestions(groupId, [val]); setAdding(false); onAdded(); }
        catch (e) { setError(e.message); }
        finally { setSaving(false); }
      }}
      onDelete={() => setAdding(false)} />
  );
}

// ── Modal AI sinh nháp ──
function AiGenerateModal({ group, onClose, onAdded }) {
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState(null);   // [{...q, _picked}]
  const [passage, setPassage] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const listening = group.score_category === 'listening';

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const r = await adminAiGenerate(group.id, count, topic);
      setDrafts(r.questions.map(q => ({ ...q, _picked: true })));
      setPassage(r.passage_text || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const addPicked = async () => {
    const picked = drafts.filter(d => d._picked).map(({ _picked, audio_transcript, ...q }) => q);
    if (!picked.length) { setError('Chọn ít nhất 1 câu.'); return; }
    setSaving(true); setError('');
    try {
      // Nếu AI sinh passage cho mondai đọc và group chưa có → gắn vào group
      if (passage && !group.passage_text) await adminUpdateGroup(group.id, { passage_text: passage });
      await adminCreateQuestions(group.id, picked);
      onAdded(); onClose();
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`AI sinh câu · ${mondaiJa(group.mondai_type)}`}
      footer={drafts ? <>
        <Button variant="secondary" onClick={() => setDrafts(null)}>Sinh lại</Button>
        <Button onClick={addPicked} loading={saving}>Thêm {drafts.filter(d => d._picked).length} câu vào đề</Button>
      </> : <>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button variant="purple" onClick={generate} loading={loading}>Sinh câu hỏi</Button>
      </>}>
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
      {!drafts ? (
        <div className="space-y-4">
          <Alert type="info">AI sinh câu theo đúng dạng <b>{mondaiJa(group.mondai_type)}</b> ({mondaiVi(group.mondai_type)}) cấp {group._section ? '' : ''}. Với đọc hiểu dài và phần nghe, nên kiểm tra kỹ hoặc soạn tay.</Alert>
          <div className="flex items-center gap-3">
            <label className="text-sm text-on-muted">Số câu:</label>
            <input type="number" min="1" max="15" value={count} onChange={e => setCount(+e.target.value)}
              className="w-20 px-3 py-2 border border-outline rounded-lg text-sm" />
          </div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Chủ đề (tùy chọn)"
            className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        </div>
      ) : (
        <div className="space-y-3">
          {passage && !group.passage_text && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-blue-800 mb-1">Đoạn văn AI sinh (sẽ gắn vào mondai):</p>
              <p className="text-blue-900 whitespace-pre-wrap">{passage}</p>
            </div>
          )}
          {drafts.map((d, i) => (
            <div key={i} className={`border rounded-xl p-3 ${d._picked ? 'border-sumire-purple/40 bg-sumire-purple/5' : 'border-outline/40 opacity-60'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={d._picked} className="mt-1"
                  onChange={e => setDrafts(ds => ds.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))} />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-charcoal">{d.question_text || <em className="text-on-muted">(không có đề chữ — nghe)</em>}</p>
                  <ul className="mt-1 space-y-0.5">
                    {d.options.map((o, k) => (
                      <li key={k} className={k === d.correct_index ? 'text-green-700 font-semibold' : 'text-on-muted'}>
                        {k + 1}. {o} {k === d.correct_index && '✓'}
                      </li>
                    ))}
                  </ul>
                  {d.explanation && <p className="text-xs text-on-muted mt-1">💡 {d.explanation}</p>}
                  {listening && d.audio_transcript && <p className="text-xs text-blue-700 mt-1">🎧 {d.audio_transcript}</p>}
                </div>
              </label>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Modal import từ ngân hàng câu hỏi ──
function ImportBankModal({ group, level, onClose, onImported }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    adminListBankForImport({ level, question_type: 'single_choice', search: search || undefined, status: 'approved', limit: 50 })
      .then(r => setRows(r.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const doImport = async () => {
    const ids = Object.keys(picked).filter(k => picked[k]);
    if (!ids.length) { setError('Chọn ít nhất 1 câu.'); return; }
    setImporting(true); setError('');
    try {
      const r = await adminImportFromBank(group.id, ids);
      onImported();
      if (r.skipped?.length) setError(`Đã nhập ${r.saved} câu. Bỏ qua ${r.skipped.length} câu không hợp lệ.`);
      else onClose();
    } catch (e) { setError(e.message); }
    finally { setImporting(false); }
  };

  return (
    <Modal open onClose={onClose} size="xl" title="Nhập câu hỏi từ ngân hàng"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        <Button onClick={doImport} loading={importing}>Nhập {Object.values(picked).filter(Boolean).length} câu</Button>
      </>}>
      {error && <Alert type="warning" onClose={() => setError('')}>{error}</Alert>}
      <Alert type="info">Chỉ nhập được câu <b>single_choice</b> (3–4 lựa chọn) khớp định dạng. Câu sẽ được <b>sao chép</b> vào đề (snapshot).</Alert>
      <div className="flex gap-2 my-3">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
          placeholder="Tìm theo nội dung câu hỏi…" className="flex-1 px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-tsubaki-red" />
        <Button variant="secondary" size="sm" onClick={load}>Tìm</Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-tsubaki-red text-3xl">progress_activity</span></div> : (
        <div className="space-y-2 max-h-[45vh] overflow-y-auto">
          {rows.length === 0 && <p className="text-center text-on-muted py-8">Không có câu hỏi phù hợp cấp {level}.</p>}
          {rows.map(q => (
            <label key={q.id} className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer ${picked[q.id] ? 'border-tsubaki-red/40 bg-tsubaki-red/5' : 'border-outline/40'}`}>
              <input type="checkbox" checked={!!picked[q.id]} className="mt-1"
                onChange={e => setPicked(p => ({ ...p, [q.id]: e.target.checked }))} />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-charcoal">{q.question_text}</p>
                <p className="text-xs text-on-muted mt-0.5">{(q.options || []).join(' / ')} · Đáp án: <b>{q.correct_answer}</b></p>
              </div>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
