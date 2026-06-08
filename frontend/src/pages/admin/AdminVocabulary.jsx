import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { useLang } from '../../contexts/LangContext';
import api from '../../lib/api';

const EMPTY  = { kanji: '', reading: '', meaning_vi: '', meaning_ja: '', level: '', type: '', example_sentence: '' };
const LEVELS = ['N5','N4','N3','N2','N1'];
const TYPES  = ['DANH TỪ','ĐỘNG TỪ','TÍNH TỪ','PHÓ TỪ','LIÊN TỪ'];

const SAMPLE_JSON = `[
  {
    "kanji": "食べる",
    "reading": "たべる",
    "meaning_vi": "ăn",
    "meaning_ja": "食物を口に入れる",
    "level": "N5",
    "type": "ĐỘNG TỪ",
    "example_sentence": "毎日ご飯を食べます。"
  },
  {
    "reading": "ありがとう",
    "meaning_vi": "cảm ơn",
    "level": "N5"
  }
]`;

export default function AdminVocabulary() {
  const { t } = useLang();
  const fileRef = useRef(null);

  const [data, setData]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert]     = useState({ type: '', msg: '' });
  const [search, setSearch]   = useState('');
  const [level, setLevel]     = useState('');
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [importModal, setImportModal]   = useState(false);
  const [importTab, setImportTab]       = useState('file');
  const [importData, setImportData]     = useState(null);
  const [importErr, setImportErr]       = useState('');
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showSample, setShowSample]     = useState(false);
  const [pasteText, setPasteText]       = useState('');
  const [aiChecking, setAiChecking]     = useState(false);
  const [aiResult, setAiResult]         = useState(null);
  const [aiSummary, setAiSummary]       = useState('');
  const [rawInput, setRawInput]         = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (level)  params.set('level', level);
      const r = await api.get(`/vocabulary?${params}`);
      setData(r.data.data || []); setTotal(r.data.total || 0);
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [page, level]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit   = (row) => {
    setForm({ kanji: row.kanji||'', reading: row.reading||'', meaning_vi: row.meaning_vi||'',
      meaning_ja: row.meaning_ja||'', level: row.level||'', type: row.type||'', example_sentence: row.example_sentence||'' });
    setEditId(row.id); setModal(true);
  };

  const handleSave = async () => {
    if (!form.reading || !form.meaning_vi) return setAlert({ type: 'error', msg: 'Reading và nghĩa là bắt buộc.' });
    setSaving(true);
    try {
      if (editId) await api.put(`/admin/vocabulary/${editId}`, form);
      else        await api.post('/admin/vocabulary', form);
      setAlert({ type: 'success', msg: 'Đã lưu.' }); setModal(false); fetch();
    } catch (e) { setAlert({ type: 'error', msg: e.message }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(t('admin.confirm_delete'))) return;
    try { await api.delete(`/admin/vocabulary/${row.id}`); setAlert({ type: 'success', msg: 'Đã xóa.' }); fetch(); }
    catch (e) { setAlert({ type: 'error', msg: e.message }); }
  };

  const openImport = () => {
    setImportData(null); setImportErr(''); setImportResult(null);
    setShowSample(false); setImportTab('file'); setPasteText('');
    setAiResult(null); setAiSummary(''); setRawInput('');
    setImportModal(true);
  };

  const switchTab = (tab) => {
    setImportTab(tab); setImportData(null); setImportErr('');
    setAiResult(null); setAiSummary(''); setRawInput('');
    if (tab === 'file' && fileRef.current) fileRef.current.value = '';
    if (tab === 'paste') setPasteText('');
  };

  const handleAiCheck = async () => {
    if (!importData) return;
    setAiChecking(true); setAiResult(null); setAiSummary(''); setImportErr('');
    try {
      const r = await api.post('/ai/check-json', { type: 'vocab', items: importData });
      setAiResult(r.data.items);
      setAiSummary(r.data.summary);
    } catch (e) {
      setImportErr('AI kiểm tra thất bại: ' + (e.response?.data?.error || e.message));
    } finally { setAiChecking(false); }
  };

  const applyAiResult = () => {
    const cleaned = aiResult.map(({ _notes, _changed, ...rest }) => rest);
    setImportData(cleaned);
    setAiResult(null);
    setAiSummary('');
  };

  const parseJSON = (raw, source) => {
    setRawInput(raw);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('Phải là mảng JSON (bắt đầu bằng "[").');
      if (parsed.length === 0)   throw new Error('Mảng JSON không được rỗng.');
      setImportErr(''); setImportData(parsed);
    } catch (err) { setImportErr(`Lỗi định dạng JSON: ${err.message}`); setImportData(null); }
  };

  const handleAiFixAndCheck = async () => {
    if (!rawInput) return;
    setAiChecking(true); setImportErr(''); setAiResult(null); setAiSummary('');
    try {
      const r = await api.post('/ai/check-json', { type: 'vocab', rawText: rawInput });
      setAiResult(r.data.items);
      setAiSummary(r.data.summary);
    } catch (e) {
      setImportErr('AI sửa thất bại: ' + (e.response?.data?.error || e.message));
    } finally { setAiChecking(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportErr(''); setImportData(null); setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => parseJSON(ev.target.result, 'file');
    reader.readAsText(file, 'UTF-8');
  };

  const handleParsePaste = () => parseJSON(pasteText, 'nội dung');

  const handleImport = async () => {
    if (!importData) return;
    setImporting(true); setImportErr('');
    try {
      const r = await api.post('/admin/vocabulary/import', importData);
      setImportResult(r.data);
      setImportData(null);
      if (fileRef.current) fileRef.current.value = '';
      fetch();
    } catch (e) { setImportErr(e.message); }
    finally { setImporting(false); }
  };

  const COLS = [
    { key: 'kanji',      label: 'Kanji',  render: v => <span className="text-lg font-bold text-tsubaki-red">{v || '—'}</span> },
    { key: 'reading',    label: 'Reading' },
    { key: 'meaning_vi', label: 'Nghĩa' },
    { key: 'level',      label: 'Level' },
    { key: 'type',       label: 'Loại' },
  ];

  return (
    <AdminLayout title={t('admin.vocabulary')}>
      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-4">{alert.msg}</Alert>}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h1 className="font-display text-2xl font-bold">{t('admin.vocabulary')} <span className="text-on-muted text-lg font-normal">({total})</span></h1>
        <div className="flex gap-2 flex-wrap">
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="px-3 py-2 border border-outline rounded-xl text-sm outline-none">
            <option value="">Tất cả level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetch(); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red w-36" />
            <button type="submit" className="p-2 bg-tsubaki-red text-white rounded-xl"><span className="material-symbols-outlined text-lg">search</span></button>
          </form>
          <Button variant="secondary" onClick={openImport}>
            <span className="material-symbols-outlined text-lg">upload_file</span> Nhập JSON
          </Button>
          <Button onClick={openCreate}><span className="material-symbols-outlined text-lg">add</span> {t('admin.create')}</Button>
        </div>
      </div>

      <DataTable columns={COLS} data={data} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      {total > LIMIT && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">← Trước</button>
          <span className="px-4 py-2 text-sm text-on-muted">{page}/{Math.ceil(total/LIMIT)}</span>
          <button disabled={page*LIMIT>=total} onClick={() => setPage(p=>p+1)} className="px-4 py-2 rounded-xl border border-outline text-sm disabled:opacity-40">Tiếp →</button>
        </div>
      )}

      {/* ── Edit / Create modal ─────────────────────────────────────────────── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('admin.edit') : t('admin.create') + ' từ vựng'}
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>{t('admin.cancel')}</Button><Button loading={saving} onClick={handleSave}>{t('admin.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kanji" value={form.kanji} onChange={e => setForm({...form, kanji: e.target.value})} placeholder="漢字" />
            <Input label="Reading *" value={form.reading} onChange={e => setForm({...form, reading: e.target.value})} placeholder="かなよみ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nghĩa (VI) *" value={form.meaning_vi} onChange={e => setForm({...form, meaning_vi: e.target.value})} />
            <Input label="Nghĩa (JA)" value={form.meaning_ja} onChange={e => setForm({...form, meaning_ja: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Level</label>
              <select value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-muted mb-1">Loại từ</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red">
                <option value="">--</option>
                {TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
              </select>
            </div>
          </div>
          <Input label="Ví dụ" value={form.example_sentence} onChange={e => setForm({...form, example_sentence: e.target.value})} placeholder="Câu ví dụ..." />
        </div>
      </Modal>

      {/* ── Import JSON modal ───────────────────────────────────────────────── */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Nhập từ vựng từ JSON"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportModal(false)}>Đóng</Button>
            {importTab === 'paste' && !importData && !importResult && !aiResult && (
              <Button variant="secondary" onClick={handleParsePaste} disabled={!pasteText.trim()}>
                <span className="material-symbols-outlined text-lg">data_object</span>
                Phân tích JSON
              </Button>
            )}
            {importErr && rawInput && !importData && !importResult && !aiResult && (
              <Button variant="secondary" loading={aiChecking} onClick={handleAiFixAndCheck}
                className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                <span className="material-symbols-outlined text-lg">build</span>
                {aiChecking ? 'AI đang sửa...' : 'Sửa JSON bằng AI'}
              </Button>
            )}
            {importData && !importResult && !aiResult && (
              <Button variant="secondary" loading={aiChecking} onClick={handleAiCheck}
                className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">
                <span className="material-symbols-outlined text-lg">auto_fix_high</span>
                {aiChecking ? 'AI đang kiểm tra...' : 'Kiểm tra bằng AI'}
              </Button>
            )}
            {aiResult && !importResult && (
              <>
                <Button variant="secondary" onClick={() => { setAiResult(null); setAiSummary(''); }}>Bỏ qua</Button>
                <Button onClick={applyAiResult}
                  className="bg-violet-600 hover:bg-violet-700 text-white">
                  <span className="material-symbols-outlined text-lg">check</span>
                  Áp dụng sửa chữa
                </Button>
              </>
            )}
            {importData && !importResult && !aiResult && (
              <Button loading={importing} onClick={handleImport}>
                <span className="material-symbols-outlined text-lg">upload</span>
                Nhập {importData.length} từ vựng
              </Button>
            )}
          </>
        }>
        <div className="space-y-4">

          {/* Tab switcher */}
          {!importResult && (
            <div className="flex rounded-xl border border-outline overflow-hidden text-sm font-medium">
              {[['file','upload_file','Tải file JSON'],['paste','content_paste','Dán nội dung JSON']].map(([tab, icon, label]) => (
                <button key={tab} type="button" onClick={() => switchTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors
                    ${importTab === tab ? 'bg-tsubaki-red text-white' : 'bg-surface-low text-on-muted hover:bg-surface'}`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Collapsible instructions */}
          <div className="rounded-xl border border-outline overflow-hidden">
            <button type="button" onClick={() => setShowSample(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-low hover:bg-surface text-sm font-medium transition-colors">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-tsubaki-red">description</span>
                Hướng dẫn định dạng JSON
              </span>
              <span className="material-symbols-outlined text-lg text-on-muted">
                {showSample ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {showSample && (
              <div className="px-4 pb-4 pt-2 space-y-3 bg-white">
                <p className="text-xs text-on-muted">
                  Phải là <strong>mảng JSON</strong> (tối đa 500 phần tử). Mỗi phần tử là một object với các trường:
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-low">
                      <th className="text-left px-2 py-1 border border-outline/40 font-semibold">Trường</th>
                      <th className="text-left px-2 py-1 border border-outline/40 font-semibold">Bắt buộc</th>
                      <th className="text-left px-2 py-1 border border-outline/40 font-semibold">Giá trị hợp lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['reading',          '✅ Có',   'Chuỗi hiragana/katakana'],
                      ['meaning_vi',       '✅ Có',   'Nghĩa tiếng Việt'],
                      ['kanji',            '⬜ Không', 'Chữ Hán (có thể bỏ trống)'],
                      ['meaning_ja',       '⬜ Không', 'Giải thích tiếng Nhật'],
                      ['level',            '⬜ Không', 'N5 / N4 / N3 / N2 / N1'],
                      ['type',             '⬜ Không', 'DANH TỪ / ĐỘNG TỪ / TÍNH TỪ / PHÓ TỪ / LIÊN TỪ'],
                      ['example_sentence', '⬜ Không', 'Câu ví dụ tiếng Nhật'],
                      ['lesson_id',        '⬜ Không', 'UUID bài học (nếu có)'],
                    ].map(([f, req, desc]) => (
                      <tr key={f}>
                        <td className="px-2 py-1 border border-outline/40 font-mono text-tsubaki-red">{f}</td>
                        <td className="px-2 py-1 border border-outline/40">{req}</td>
                        <td className="px-2 py-1 border border-outline/40 text-on-muted">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div>
                  <p className="text-xs font-semibold text-on-muted mb-1">Ví dụ:</p>
                  <pre className="text-xs bg-surface-low rounded-lg p-3 overflow-x-auto text-charcoal font-mono leading-relaxed whitespace-pre">{SAMPLE_JSON}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Input: file upload */}
          {importTab === 'file' && !importResult && (
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-outline rounded-xl cursor-pointer hover:border-tsubaki-red hover:bg-tsubaki-red/5 transition-colors">
              <span className="material-symbols-outlined text-3xl text-on-muted mb-1">upload_file</span>
              <span className="text-sm text-on-muted">
                {importData
                  ? <span className="text-tsubaki-red font-semibold">✓ Đã tải — {importData.length} từ vựng</span>
                  : 'Kéo thả hoặc nhấn để chọn file .json'}
              </span>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
            </label>
          )}

          {/* Input: paste textarea */}
          {importTab === 'paste' && !importResult && !importData && (
            <div>
              <label className="block text-sm font-medium text-on-muted mb-2">Dán nội dung JSON vào đây</label>
              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setImportErr(''); }}
                placeholder={'[\n  { "reading": "たべる", "meaning_vi": "ăn", "level": "N5" },\n  ...\n]'}
                className="w-full h-40 px-3 py-2.5 border border-outline rounded-xl text-xs font-mono outline-none focus:border-tsubaki-red resize-y bg-surface-low"
                spellCheck={false}
              />
            </div>
          )}

          {/* Error */}
          {importErr && (
            <Alert type="error">
              <pre className="text-xs whitespace-pre-wrap font-mono">{importErr}</pre>
            </Alert>
          )}

          {/* Preview table — all rows, scrollable */}
          {importData && !importResult && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-on-muted">
                  Xem trước toàn bộ <span className="text-charcoal font-semibold">{importData.length}</span> từ vựng:
                </p>
                <span className="text-xs text-on-muted bg-surface-low px-2 py-0.5 rounded-full">Cuộn để xem thêm</span>
              </div>
              <div className="rounded-xl border border-outline overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-low sticky top-0 z-10">
                      <tr>
                        {['#','Kanji','Reading','Nghĩa VI','Level','Loại'].map(h =>
                          <th key={h} className="text-left px-3 py-2 font-semibold text-on-muted border-b border-outline">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.map((row, i) => (
                        <tr key={i} className={`border-t border-outline/40 ${!row.reading || !row.meaning_vi ? 'bg-red-50' : i % 2 === 1 ? 'bg-surface-low/40' : ''}`}>
                          <td className="px-3 py-1.5 text-on-muted">{i + 1}</td>
                          <td className="px-3 py-1.5 font-bold text-tsubaki-red">{row.kanji || '—'}</td>
                          <td className="px-3 py-1.5">{row.reading || <span className="text-red-500 font-bold" title="Bắt buộc">⚠ thiếu</span>}</td>
                          <td className="px-3 py-1.5">{row.meaning_vi || <span className="text-red-500 font-bold" title="Bắt buộc">⚠ thiếu</span>}</td>
                          <td className="px-3 py-1.5">{row.level || '—'}</td>
                          <td className="px-3 py-1.5">{row.type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* AI loading */}
          {aiChecking && (
            <div className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0"/>
              <div>
                <p className="text-sm font-semibold text-violet-700">AI đang phân tích nội dung...</p>
                <p className="text-xs text-violet-500 mt-0.5">Có thể mất 10–30 giây tùy số lượng từ vựng.</p>
              </div>
            </div>
          )}

          {/* AI result */}
          {aiResult && !importResult && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
                aiResult.some(i => i._changed) ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}>
                <span className="material-symbols-outlined text-lg">
                  {aiResult.some(i => i._changed) ? 'auto_fix_high' : 'check_circle'}
                </span>
                {aiSummary}
              </div>
              <div className="rounded-xl border border-outline overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-low sticky top-0 z-10">
                      <tr>
                        {['#','Kanji','Reading','Nghĩa VI','Level','Loại','Ghi chú AI'].map(h =>
                          <th key={h} className="text-left px-3 py-2 font-semibold text-on-muted border-b border-outline">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {aiResult.map((row, i) => (
                        <tr key={i} className={`border-t border-outline/40 ${row._changed ? 'bg-amber-50' : i % 2 === 1 ? 'bg-surface-low/40' : ''}`}>
                          <td className="px-3 py-1.5 text-on-muted">{i + 1}</td>
                          <td className="px-3 py-1.5 font-bold text-tsubaki-red">{row.kanji || '—'}</td>
                          <td className="px-3 py-1.5">{row.reading}</td>
                          <td className="px-3 py-1.5">{row.meaning_vi}</td>
                          <td className="px-3 py-1.5">{row.level || '—'}</td>
                          <td className="px-3 py-1.5">{row.type || '—'}</td>
                          <td className="px-3 py-1.5 text-violet-600 italic max-w-[180px]">{row._notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {importResult && (
            <Alert type="success">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
                <div>
                  <p className="font-semibold">{importResult.message}</p>
                  <p className="text-sm opacity-80">Danh sách từ vựng đã được cập nhật.</p>
                </div>
              </div>
            </Alert>
          )}
        </div>
      </Modal>
    </AdminLayout>
  );
}
