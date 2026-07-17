import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import QuestionCard from '../../components/admin/mock/QuestionCard';
import { mondaiJa, mondaiVi, mondaiInstruction, SECTION_LABEL, blueprintCount, PASSAGE_MONDAI_TYPES } from '../../lib/mockExamConstants';
import {
  adminGetExam, adminPublishExam, adminUpdateExam, adminUpdateSection,
  adminUpdateGroup,
  adminCreateQuestions, adminUpdateQuestion, adminDeleteQuestion,
  adminAiGenerate, adminAiRegenerateOne, adminImportFromBank, adminListBankForImport, adminUploadMedia,
} from '../../lib/mockExamApi';

const blankQuestion = () => ({ question_text: '', options: ['', '', '', ''], correct_index: 0, explanation: '', translation_vi: '' });

export default function AdminMockExamEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exam, setExam]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [warning, setWarning] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);

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
  const hasPassage = PASSAGE_MONDAI_TYPES.has(selectedGroup?.mondai_type);

  const run = async (fn, okMsg) => {
    setError(''); setNotice('');
    try { await fn(); if (okMsg) setNotice(okMsg); load(); }
    catch (e) { setError(e.data?.details ? `${e.message} — ${e.data.details.join(' · ')}` : e.message); }
  };

  // ── Registry câu hỏi đang sửa dở (QuestionCard tự đăng ký qua onRegister) ──
  const cardsRef = useRef(new Map());
  const [dirtyCount, setDirtyCount] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const registerCard = (key) => (api) => {
    if (api) cardsRef.current.set(key, api); else cardsRef.current.delete(key);
    const n = [...cardsRef.current.values()].filter(a => a.dirty).length;
    setDirtyCount(prev => (prev === n ? prev : n));
  };

  // Lưu mọi thứ đang sửa dở: passage + các câu dirty hợp lệ. Trả về số câu không lưu được
  // (câu mới chưa bấm Lưu hoặc câu thiếu nội dung lựa chọn).
  const flushDrafts = async () => {
    if (groupDraftDirty) await saveGroupMetaCore({ passage_text: groupDraft.passage_text });
    let invalid = 0;
    for (const api of cardsRef.current.values()) {
      if (!api.dirty) continue;
      if (api.id && api.valid) { await adminUpdateQuestion(api.id, api.question); api.markSaved(); }
      else invalid++;
    }
    return invalid;
  };

  const handleSaveDraft = async () => {
    setError(''); setNotice(''); setWarning(''); setSavingDraft(true);
    try {
      const invalid = await flushDrafts();
      setNotice('Đã lưu bản nháp.');
      if (invalid) setWarning(`Còn ${invalid} câu chưa lưu được (câu mới chưa bấm Lưu hoặc thiếu nội dung lựa chọn).`);
    } catch (e) { setError(e.message); }
    finally { setSavingDraft(false); }
  };

  // Chuyển mondai: tự lưu các câu dirty hợp lệ; nếu còn câu không lưu được → hỏi trước khi chuyển
  const selectGroup = async (gid) => {
    if (gid === selectedGroupId) return;
    try {
      const invalid = await flushDrafts();
      if (invalid) { setConfirm({ type: 'switch-group', id: gid, count: invalid }); return; }
    } catch (e) { setError(e.message); return; }
    setSelectedGroupId(gid);
  };

  const handlePublish = async () => {
    setError(''); setNotice(''); setWarning('');
    try {
      // Flush mọi thứ đang sửa dở (passage + câu hỏi) trước khi xuất bản
      if (!published) await flushDrafts();
      const r = await adminPublishExam(id, !published);
      setNotice(published ? 'Đã gỡ xuất bản.' : 'Đã xuất bản đề thi.');
      // Publish trả warnings[] (lệch số câu chuẩn); unpublish trả warning (số lượt đã làm)
      if (r?.warnings?.length) setWarning(`Đã xuất bản, nhưng số câu lệch chuẩn JLPT: ${r.warnings.join(' · ')}`);
      else if (r?.warning) setWarning(r.warning);
      load();
    } catch (e) {
      setError(e.data?.details ? `${e.message} — ${e.data.details.join(' · ')}` : e.message);
    }
  };

  // ── Group meta (passage/ảnh) — autosave onBlur, không có nút Lưu riêng ──
  const [groupDraft, setGroupDraft] = useState(null);
  const [groupSaveState, setGroupSaveState] = useState(''); // '' | 'saving' | 'saved'
  useEffect(() => {
    if (selectedGroup) {
      setGroupDraft({
        passage_text: selectedGroup.passage_text || '',
        image_url: selectedGroup.image_url || '',
      });
      setGroupSaveState('');
    }
  }, [selectedGroupId, exam]);

  // Chỉ passage có thể dirty (ảnh lưu ngay sau upload)
  const groupDraftDirty = !!(selectedGroup && groupDraft
    && groupDraft.passage_text !== (selectedGroup.passage_text || ''));

  // Cảnh báo khi đóng tab/reload còn thay đổi chưa lưu
  const anyDirty = dirtyCount > 0 || groupDraftDirty;
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [anyDirty]);

  // Lưu 1 phần group + cập nhật exam state tại chỗ (không load() lại để tránh nháy trang)
  const saveGroupMetaCore = async (patch) => {
    await adminUpdateGroup(selectedGroupId, patch);
    setExam(x => ({
      ...x,
      sections: x.sections.map(s => ({
        ...s,
        groups: s.groups.map(g => (g.id === selectedGroupId ? { ...g, ...patch } : g)),
      })),
    }));
  };
  const saveGroupMeta = async (patch) => {
    setGroupSaveState('saving'); setError('');
    try {
      await saveGroupMetaCore(patch);
      setGroupSaveState('saved');
    } catch (e) { setGroupSaveState(''); setError(e.message); }
  };

  const uploadGroupImage = async (file) => {
    if (!file) return;
    setGroupSaveState('saving'); setError('');
    try {
      const { url } = await adminUploadMedia('image', file);
      setGroupDraft(d => ({ ...d, image_url: url }));
      await saveGroupMeta({ image_url: url });
    } catch (e) { setGroupSaveState(''); setError(e.message); }
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
            <span className={`inline-flex px-2 py-0.5 rounded-md font-bold text-xs ${published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {published ? 'Đã xuất bản' : 'Bản nháp'}
            </span>
            {!published && (
              <Button variant="secondary" loading={savingDraft} onClick={handleSaveDraft}>
                <span className="material-symbols-outlined text-lg">save</span>
                Lưu bản nháp{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
              </Button>
            )}
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

        {published && <Alert type="warning">Đề đang xuất bản là <b>bất biến</b>. Gỡ xuất bản để sửa nội dung (chỉ giải thích/bản dịch/transcript được sửa khi đang xuất bản).</Alert>}
        {error &&   <Alert type="error" onClose={() => setError('')}>{error}</Alert>}
        {warning && <Alert type="warning" onClose={() => setWarning('')}>{warning}</Alert>}
        {notice &&  <Alert type="success" onClose={() => setNotice('')}>{notice}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
          {/* ── Cây phần thi / mondai ── */}
          <div className="space-y-3">
            {(exam.sections || []).map(section => (
              <div key={section.id} className="border border-outline/40 rounded-xl overflow-hidden">
                <div className="bg-surface-low px-3 py-2.5">
                  <span className="text-xs font-bold text-charcoal truncate block">{section.title || SECTION_LABEL[section.section_type]}</span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-on-muted">
                    <span className="material-symbols-outlined text-[13px]">timer</span>
                    <input type="number" min="1" value={section.time_limit_minutes} disabled={published}
                      onChange={e => setExam(x => ({ ...x, sections: x.sections.map(s => s.id === section.id ? { ...s, time_limit_minutes: +e.target.value } : s) }))}
                      onBlur={e => run(() => adminUpdateSection(section.id, { time_limit_minutes: +e.target.value }))}
                      className="w-12 bg-transparent border-b border-outline/50 text-center outline-none disabled:opacity-100" /> phút
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {section.groups.map(g => {
                    const std = blueprintCount(exam.level, section.position, g.mondai_type);
                    const off = std != null ? g.questions.length !== std : g.questions.length === 0;
                    return (
                    <button key={g.id} onClick={() => selectGroup(g.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${selectedGroupId === g.id ? 'bg-tsubaki-red/10 border border-tsubaki-red/40' : 'hover:bg-surface-low'}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-charcoal">問題{g.mondai_number} · {mondaiJa(g.mondai_type)}</span>
                        <span title={std != null ? `Chuẩn JLPT: ${std} câu` : undefined}
                          className={`shrink-0 text-[10px] px-1.5 rounded ${off ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {g.questions.length}{std != null ? `/${std}` : ''} câu
                        </span>
                      </div>
                      <span className="text-on-muted">{mondaiVi(g.mondai_type)}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-bold text-charcoal">問題{selectedGroup.mondai_number} · {mondaiJa(selectedGroup.mondai_type)}</h2>
                      <p className="text-sm text-on-muted">{mondaiVi(selectedGroup.mondai_type)} · Cột điểm: {selectedGroup.score_category}</p>
                    </div>
                    {groupSaveState === 'saving' && <span className="shrink-0 text-xs text-on-muted flex items-center gap-1"><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>Đang lưu…</span>}
                    {groupSaveState === 'saved' && <span className="shrink-0 text-xs text-green-600 flex items-center gap-1"><span className="material-symbols-outlined text-sm">check</span>Đã lưu</span>}
                  </div>
                  {/* Câu chỉ dẫn chuẩn JLPT — hằng số theo cấp độ + loại mondai, không sửa được */}
                  <div className="bg-surface-low border border-outline/30 rounded-lg px-3 py-2 text-sm">
                    <p className="text-charcoal">{mondaiInstruction(exam.level, selectedGroup.mondai_type).ja}</p>
                    <p className="text-xs text-on-muted italic mt-0.5">{mondaiInstruction(exam.level, selectedGroup.mondai_type).vi}</p>
                  </div>
                  {/* Passage/ảnh dùng chung chỉ có ở mondai đọc hiểu; ảnh câu nghe (発話表現) nằm ở từng câu */}
                  {groupDraft && hasPassage && (<>
                    <textarea value={groupDraft.passage_text} disabled={published}
                      onChange={e => setGroupDraft(d => ({ ...d, passage_text: e.target.value }))}
                      onBlur={() => { if (groupDraftDirty) saveGroupMeta({ passage_text: groupDraft.passage_text }); }}
                      placeholder="Đoạn văn đọc hiểu — dùng chung cho các câu trong mondai (tự lưu khi rời ô)"
                      className="w-full px-3 py-2 border border-outline rounded-lg text-sm resize-y min-h-[60px] outline-none focus:border-tsubaki-red" />

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {/* Ảnh — lưu ngay sau khi upload */}
                      <label className="cursor-pointer text-tsubaki-red font-semibold hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">image</span>
                        {groupDraft.image_url ? 'Đổi ảnh' : 'Tải ảnh minh họa (情報検索…)'}
                        <input type="file" accept="image/*" className="hidden" disabled={published}
                          onChange={e => uploadGroupImage(e.target.files[0])} />
                      </label>
                      {groupDraft.image_url && <img src={groupDraft.image_url} className="h-10 rounded border border-outline/40" alt="" />}
                    </div>
                  </>)}
                </div>

                {/* Câu hỏi */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-charcoal">
                    Câu hỏi ({selectedGroup.questions.length})
                    {(() => {
                      const std = blueprintCount(exam.level, selectedGroup._section?.position, selectedGroup.mondai_type);
                      if (std == null) return null;
                      const off = selectedGroup.questions.length !== std;
                      return <span className={`ml-2 text-xs font-semibold ${off ? 'text-amber-600' : 'text-green-600'}`}>chuẩn JLPT: {std} câu</span>;
                    })()}
                  </h3>
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
                      onRegister={registerCard(q.id)}
                      onSave={(val) => run(() => adminUpdateQuestion(q.id, val), 'Đã lưu câu hỏi.')}
                      onDelete={() => setConfirm({ type: 'question', id: q.id })} />
                  ))}
                  {!published && (
                    <NewQuestionInline key={selectedGroupId} groupId={selectedGroupId} listening={isListening} onAdded={load} setError={setError}
                      onRegister={registerCard('new')} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI drawer */}
      {showAi && selectedGroup && (
        <AiGenerateModal group={selectedGroup} onClose={() => setShowAi(false)} onAdded={load} />
      )}

      {/* Import bank */}
      {showImport && selectedGroup && (
        <ImportBankModal group={selectedGroup} level={exam.level} onClose={() => setShowImport(false)} onImported={load} />
      )}

      <ConfirmDialog open={!!confirm} onCancel={() => setConfirm(null)}
        title={confirm?.type === 'switch-group' ? 'Có câu chưa lưu được' : 'Xóa câu hỏi?'}
        message={confirm?.type === 'switch-group'
          ? `Có ${confirm.count} câu chưa lưu được (câu mới chưa bấm Lưu hoặc thiếu nội dung lựa chọn). Chuyển mondai sẽ mất thay đổi của các câu đó.`
          : 'Thao tác này không thể hoàn tác.'}
        confirmLabel={confirm?.type === 'switch-group' ? 'Vẫn chuyển' : 'Xóa'}
        onConfirm={() => {
          const c = confirm; setConfirm(null);
          if (c.type === 'switch-group') setSelectedGroupId(c.id);
          else run(() => adminDeleteQuestion(c.id));
        }} />
    </AdminLayout>
  );
}

// ── Form thêm 1 câu hỏi mới ──
function NewQuestionInline({ groupId, listening, onAdded, setError, onRegister }) {
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
    <QuestionCard index={-1} value={draft} listening={listening} saving={saving} onRegister={onRegister}
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
// Bỏ các field nội bộ (_picked, _editing…) trước khi gửi lên server.
const cleanDraft = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith('_')));
// Chuỗi tóm tắt 1 câu (câu hỏi/transcript → đáp án đúng) cho prompt chống trùng.
const draftSummary = (d) =>
  `${d.question_text || (d.audio_transcript ? String(d.audio_transcript).slice(0, 80) : '')} → ${d.options?.[d.correct_index] || ''}`;

function AiGenerateModal({ group, onClose, onAdded }) {
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState(null);   // [{...q, _picked, _editing, _regenOpen, _regenNote, _regenLoading}]
  const [passage, setPassage] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const listening = group.score_category === 'listening';

  const patchDraft = (i, patch) => setDrafts(ds => ds.map((x, j) => j === i ? { ...x, ...patch } : x));

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const r = await adminAiGenerate(group.id, count, topic, instruction);
      setDrafts(r.questions.map(q => ({ ...q, _picked: true })));
      setPassage(r.passage_text || null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const regenOne = async (i) => {
    patchDraft(i, { _regenLoading: true }); setError('');
    try {
      const r = await adminAiRegenerateOne(group.id, {
        instruction:       drafts[i]._regenNote || '',
        current_question:  cleanDraft(drafts[i]),
        sibling_questions: drafts.filter((_, j) => j !== i).map(draftSummary),
      });
      setDrafts(ds => ds.map((x, j) => j === i ? { ...r.question, _picked: true } : x));
    } catch (e) {
      setError(e.message);
      patchDraft(i, { _regenLoading: false });
    }
  };

  const addPicked = async () => {
    const picked = drafts.filter(d => d._picked).map(cleanDraft);
    if (!picked.length) { setError('Chọn ít nhất 1 câu.'); return; }
    if (drafts.some(d => d._editing)) { setError('Có câu đang sửa dở — bấm "Áp dụng" hoặc "Hủy" trước khi thêm vào đề.'); return; }
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
          <Alert type="info">AI sinh câu theo đúng dạng <b>{mondaiJa(group.mondai_type)}</b> ({mondaiVi(group.mondai_type)}). Câu đã có trong đề được đưa vào prompt để tránh trùng lặp. Với đọc hiểu dài và phần nghe, nên kiểm tra kỹ hoặc soạn tay.</Alert>
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
          {passage && !group.passage_text && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-blue-800 mb-1">Đoạn văn AI sinh (sẽ gắn vào mondai):</p>
              <p className="text-blue-900 whitespace-pre-wrap">{passage}</p>
            </div>
          )}
          {drafts.map((d, i) => (
            <div key={i} className={`border rounded-xl p-3 ${d._picked ? 'border-sumire-purple/40 bg-sumire-purple/5' : 'border-outline/40 opacity-60'}`}>
              {d._editing ? (
                <DraftEditForm draft={d} listening={listening}
                  onApply={(q) => patchDraft(i, { ...q, _editing: false })}
                  onCancel={() => patchDraft(i, { _editing: false })} />
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={d._picked} className="mt-1 cursor-pointer"
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
                    <div className="flex flex-col gap-1 shrink-0">
                      <button type="button" title="Sửa câu này"
                        onClick={() => patchDraft(i, { _editing: true, _regenOpen: false })}
                        className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-charcoal">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button type="button" title="Sinh lại câu này"
                        onClick={() => patchDraft(i, { _regenOpen: !d._regenOpen })}
                        className="p-1 rounded-lg text-on-muted hover:bg-surface hover:text-sumire-purple">
                        <span className="material-symbols-outlined text-lg">autorenew</span>
                      </button>
                    </div>
                  </div>
                  {d._regenOpen && (
                    <div className="mt-2 pl-6 flex items-center gap-2">
                      <input value={d._regenNote || ''} onChange={e => patchDraft(i, { _regenNote: e.target.value })}
                        placeholder="Yêu cầu khi sinh lại (tùy chọn) — vd: câu này sai kiến thức, đổi từ vựng khác…"
                        className="flex-1 px-3 py-1.5 border border-outline rounded-lg text-xs outline-none focus:border-sumire-purple" />
                      <Button variant="purple" size="sm" loading={d._regenLoading} onClick={() => regenOne(i)}>Sinh lại</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Form sửa inline 1 câu nháp AI (trong modal, chưa ghi DB) ──
function DraftEditForm({ draft, listening, onApply, onCancel }) {
  const [q, setQ] = useState(() => ({
    ...cleanDraft(draft),
    options: [...(draft.options || [])],
    option_translations: Array.isArray(draft.option_translations) ? [...draft.option_translations] : null,
  }));
  const setField = (k, v) => setQ(p => ({ ...p, [k]: v }));
  const setOpt = (k, v) => setQ(p => { const o = [...p.options]; o[k] = v; return { ...p, options: o }; });
  const setOptTrans = (k, v) => setQ(p => {
    const t = Array.isArray(p.option_translations) ? [...p.option_translations] : p.options.map(() => '');
    t[k] = v; return { ...p, option_translations: t };
  });
  // Tên nhóm radio riêng cho mỗi form (nhiều card có thể mở sửa cùng lúc)
  const [radioName] = useState(() => `draft-correct-${Math.random().toString(36).slice(2)}`);
  const valid = q.options.length >= 3 && q.options.every(o => String(o).trim())
    && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length;

  return (
    <div className="space-y-2 text-sm">
      <textarea value={q.question_text || ''} onChange={e => setField('question_text', e.target.value)} rows={2}
        placeholder="Câu hỏi (để trống với dạng nghe không in đề chữ)"
        className="w-full px-3 py-2 border border-outline rounded-lg text-sm outline-none focus:border-sumire-purple resize-y" />
      <input value={q.translation_vi || ''} onChange={e => setField('translation_vi', e.target.value)}
        placeholder="Bản dịch tiếng Việt của câu hỏi"
        className="w-full px-3 py-1.5 border border-outline rounded-lg text-xs outline-none focus:border-sumire-purple" />
      {listening && (
        <textarea value={q.audio_transcript || ''} onChange={e => setField('audio_transcript', e.target.value)} rows={3}
          placeholder="Transcript audio (script tiếng Nhật)"
          className="w-full px-3 py-2 border border-outline rounded-lg text-xs outline-none focus:border-sumire-purple resize-y" />
      )}
      <div className="space-y-1.5">
        {q.options.map((o, k) => (
          <div key={k} className="flex items-center gap-2">
            <input type="radio" name={radioName} checked={q.correct_index === k}
              onChange={() => setField('correct_index', k)} title="Đáp án đúng" />
            <div className="flex-1 space-y-0.5">
              <input value={o} onChange={e => setOpt(k, e.target.value)} placeholder={`Lựa chọn ${k + 1}`}
                className={`w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:border-sumire-purple ${q.correct_index === k ? 'border-green-400 bg-green-50/50' : 'border-outline'}`} />
              <input value={q.option_translations?.[k] || ''} onChange={e => setOptTrans(k, e.target.value)}
                placeholder="Dịch tiếng Việt (tùy chọn)"
                className="w-full px-3 py-1 border border-outline/60 rounded-lg text-[11px] italic outline-none focus:border-sumire-purple" />
            </div>
          </div>
        ))}
      </div>
      <textarea value={q.explanation || ''} onChange={e => setField('explanation', e.target.value)} rows={2}
        placeholder="Giải thích đáp án (tiếng Việt)"
        className="w-full px-3 py-2 border border-outline rounded-lg text-xs outline-none focus:border-sumire-purple resize-y" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Hủy</Button>
        <Button size="sm" disabled={!valid} onClick={() => onApply({
          ...q,
          question_text: q.question_text?.trim() || null,
          options: q.options.map(s => s.trim()),
        })}>Áp dụng</Button>
      </div>
    </div>
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
