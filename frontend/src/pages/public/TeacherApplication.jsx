import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { submitTeacherApplication, getMyTeacherApplication } from '../../lib/api';

const DOC_TYPES = [
  { value: 'cv',          label: 'CV' },
  { value: 'degree',      label: 'Bằng cấp' },
  { value: 'certificate', label: 'Chứng chỉ' },
  { value: 'other',       label: 'Khác' },
];

const ACCEPT = '.pdf,.doc,.docx,image/*';
const MAX_FILES = 6;

export default function TeacherApplication() {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [checking, setChecking] = useState(true);
  const [pendingApp, setPendingApp] = useState(null); // existing pending application
  const [form, setForm] = useState({
    highest_qualification: '', specialization: '', years_experience: '', education: '', bio: '', phone: '',
  });
  const [docs, setDocs]         = useState([]);   // [{ file, type }]
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState(null); // { status, granted, ai_summary }

  useEffect(() => {
    getMyTeacherApplication()
      .then(({ application }) => {
        if (application?.status === 'approved') { navigate('/teacher', { replace: true }); return; }
        if (application?.status === 'pending') setPendingApp(application);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    setDocs(prev => {
      const merged = [...prev];
      for (const file of incoming) {
        if (merged.length >= MAX_FILES) break;
        merged.push({ file, type: 'degree' });
      }
      return merged;
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const setDocType = (i, type) => setDocs(prev => prev.map((d, idx) => idx === i ? { ...d, type } : d));
  const removeDoc  = (i) => setDocs(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!docs.length) return setError('Vui lòng tải lên ít nhất một tài liệu (CV, bằng cấp hoặc chứng chỉ).');
    if (!form.highest_qualification.trim()) return setError('Vui lòng nhập bằng cấp cao nhất.');

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('doc_types', JSON.stringify(docs.map(d => d.type)));
      docs.forEach(d => fd.append('documents', d.file));

      const res = await submitTeacherApplication(fd);
      setResult(res);
      if (res.granted) {
        // Refresh the JWT so the new teacher role is reflected client-side, then go in.
        await supabase.auth.refreshSession();
        setTimeout(() => navigate('/teacher', { replace: true }), 1800);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link to="/" className="font-display text-2xl font-bold text-tsubaki-red block mb-1">Kizuna Nihongo</Link>
        </div>
        {children}
      </div>
    </div>
  );

  if (checking) {
    return <Shell><div className="glass-card rounded-2xl p-10 flex justify-center">
      <span className="material-symbols-outlined animate-spin text-3xl text-tsubaki-red">progress_activity</span>
    </div></Shell>;
  }

  // Submitting → AI reviewing
  if (submitting) {
    return <Shell><div className="glass-card rounded-2xl p-10 text-center">
      <span className="material-symbols-outlined animate-spin text-4xl text-sumire-purple mb-3 block">auto_awesome</span>
      <h2 className="font-display text-lg font-bold mb-1">AI đang xem xét hồ sơ…</h2>
      <p className="text-sm text-on-muted">Đang đọc tài liệu và đánh giá thông tin của bạn. Vui lòng chờ trong giây lát.</p>
    </div></Shell>;
  }

  // Result after submit
  if (result) {
    const ok = result.granted;
    return <Shell><div className="glass-card rounded-2xl p-8 text-center">
      <span className={`material-symbols-outlined text-5xl mb-3 block ${ok ? 'text-green-600' : 'text-amber-500'}`}>
        {ok ? 'verified' : 'hourglass_top'}
      </span>
      <h2 className="font-display text-xl font-bold mb-2">
        {ok ? 'Chúc mừng! Bạn đã trở thành giáo viên' : 'Đơn đã được gửi để duyệt'}
      </h2>
      <p className="text-sm text-on-muted mb-4">
        {ok
          ? 'Hồ sơ của bạn đã được duyệt tự động. Đang chuyển tới trang giáo viên…'
          : 'Hồ sơ của bạn đã được chuyển tới quản trị viên để xem xét. Chúng tôi sẽ thông báo kết quả sớm.'}
      </p>
      {result.ai_summary && !ok && (
        <div className="text-left text-sm bg-surface-low rounded-xl p-3 mb-4">
          <p className="font-semibold text-on-muted mb-1">Nhận xét sơ bộ:</p>
          <p className="text-charcoal">{result.ai_summary}</p>
        </div>
      )}
      {!ok && <Link to="/dashboard"><Button className="w-full">Tiếp tục với vai trò học viên</Button></Link>}
    </div></Shell>;
  }

  // Already has a pending application
  if (pendingApp) {
    return <Shell><div className="glass-card rounded-2xl p-8 text-center">
      <span className="material-symbols-outlined text-5xl text-amber-500 mb-3 block">hourglass_top</span>
      <h2 className="font-display text-xl font-bold mb-2">Đơn của bạn đang chờ duyệt</h2>
      <p className="text-sm text-on-muted mb-4">Quản trị viên đang xem xét hồ sơ giáo viên của bạn.</p>
      {pendingApp.ai_summary && (
        <div className="text-left text-sm bg-surface-low rounded-xl p-3 mb-4">
          <p className="font-semibold text-on-muted mb-1">Nhận xét sơ bộ:</p>
          <p className="text-charcoal">{pendingApp.ai_summary}</p>
        </div>
      )}
      <Link to="/dashboard"><Button variant="secondary" className="w-full">Về trang học viên</Button></Link>
    </div></Shell>;
  }

  // Application form
  return <Shell>
    <div className="glass-card rounded-2xl p-8 space-y-5">
      <div className="text-center">
        <span className="material-symbols-outlined text-tsubaki-red text-4xl mb-2 block">co_present</span>
        <h1 className="font-display text-2xl font-bold">Hồ sơ đăng ký giáo viên</h1>
        <p className="text-sm text-on-muted mt-1">Cung cấp thông tin và tài liệu để chứng minh năng lực giảng dạy.</p>
      </div>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Bằng cấp cao nhất *" value={form.highest_qualification}
          onChange={e => setForm({ ...form, highest_qualification: e.target.value })}
          placeholder="Cử nhân Ngôn ngữ Nhật, JLPT N1..." required />
        <Input label="Chuyên môn giảng dạy" value={form.specialization}
          onChange={e => setForm({ ...form, specialization: e.target.value })}
          placeholder="Luyện thi JLPT N5-N2, giao tiếp..." />
        <Input label="Số năm kinh nghiệm" type="number" min="0" value={form.years_experience}
          onChange={e => setForm({ ...form, years_experience: e.target.value })} placeholder="3" />
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Học vấn / Quá trình đào tạo</label>
          <textarea value={form.education} onChange={e => setForm({ ...form, education: e.target.value })}
            rows={2} placeholder="Trường, ngành, năm tốt nghiệp..."
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y transition-colors" />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Giới thiệu bản thân</label>
          <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
            rows={3} placeholder="Kinh nghiệm giảng dạy, thành tích, phương pháp..."
            className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-y transition-colors" />
        </div>
        <Input label="Số điện thoại" value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09..." />

        {/* Documents */}
        <div>
          <label className="block text-sm font-medium text-on-muted mb-2">
            Tài liệu chứng minh * <span className="font-normal">(CV, bằng cấp, chứng chỉ — PDF, ảnh hoặc DOCX)</span>
          </label>
          <div className="space-y-2">
            {docs.map((d, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl border border-outline/60 bg-surface-low/40">
                <span className="material-symbols-outlined text-on-muted text-lg shrink-0">description</span>
                <span className="text-sm truncate flex-1" title={d.file.name}>{d.file.name}</span>
                <select value={d.type} onChange={e => setDocType(i, e.target.value)}
                  className="text-xs px-2 py-1 bg-white border border-outline rounded-lg outline-none">
                  {DOC_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button type="button" onClick={() => removeDoc(i)}
                  className="text-on-muted hover:text-tsubaki-red shrink-0">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            ))}
          </div>
          {docs.length < MAX_FILES && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="mt-2 w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-outline rounded-xl py-3 text-sm font-semibold text-on-muted hover:border-tsubaki-red hover:bg-surface-low transition-colors">
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Thêm tài liệu ({docs.length}/{MAX_FILES})
            </button>
          )}
          <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
            onChange={e => addFiles(e.target.files)} />
        </div>

        <Button type="submit" loading={submitting} className="w-full">Gửi hồ sơ xét duyệt</Button>
      </form>

      <p className="text-center text-xs text-on-muted">
        Muốn dùng như học viên? <Link to="/dashboard" className="text-tsubaki-red font-semibold hover:underline">Bỏ qua</Link>
      </p>
    </div>
  </Shell>;
}
