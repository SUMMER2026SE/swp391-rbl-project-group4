import { useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import api from '../../lib/api';

function JoinModal({ open, onClose, onJoined }) {
  const [key, setKey]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleJoin = async () => {
    if (!key.trim()) return setError('Vui lòng nhập mã lớp.');
    setLoading(true); setError('');
    try {
      const r = await api.post('/classes/join', { enrollment_key: key });
      onJoined(r.data.message); setKey(''); onClose();
    } catch(e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tham gia lớp học"
      footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button><Button loading={loading} onClick={handleJoin}>Tham gia</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-on-muted">Nhập mã tham gia do giáo viên cung cấp để vào lớp học.</p>
        <div>
          <input
            value={key}
            onChange={e => setKey(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Mã lớp (VD: A1B2C3D4)"
            maxLength={8}
            className="w-full text-center text-2xl tracking-[0.4em] font-mono font-bold px-4 py-4 border-2 border-outline rounded-2xl outline-none focus:border-tsubaki-red uppercase transition-colors"
          />
          {error && <p className="text-sm text-red-500 mt-2 text-center">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
/* ─── Leave Confirm Modal ─────────────────────────────────────────────────── */
function LeaveModal({ open, onClose, cls, onLeft }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleLeave = async () => {
    setLoading(true); setError('');
    try {
      await api.delete(`/classes/my/${cls.class_id}`);
      onLeft(`Đã rời khỏi lớp "${cls.class?.name}".`);
      onClose();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
      <Modal open={open} onClose={onClose} title="Rời khỏi lớp học"
             footer={<><Button variant="secondary" onClick={onClose}>Huỷ</Button>
               <Button loading={loading} onClick={handleLeave}
                       className="bg-red-500 hover:bg-red-600 text-white">Rời lớp</Button></>}>
        <div className="text-center py-2">
          <span className="material-symbols-outlined text-5xl text-red-400 block mb-3">logout</span>
          <p className="text-base font-semibold mb-1">Bạn muốn rời khỏi lớp này?</p>
          <p className="text-sm text-on-muted">
            Lớp: <strong>{cls?.class?.name || '—'}</strong>
          </p>
          <p className="text-sm text-on-muted mt-1">Bạn có thể tham gia lại bằng mã lớp.</p>
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      </Modal>
  );
}

function ClassCard({ enrollment, onLeave }) {
  const cls = enrollment.class || {};
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-tsubaki-red/10 rounded-xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-tsubaki-red text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>groups</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base truncate">{cls.name}</h3>
          {cls.description && <p className="text-sm text-on-muted line-clamp-2 mt-0.5">{cls.description}</p>}
        </div>
        <button onClick={() => onLeave(enrollment)} title="Rời khỏi lớp"
          className="shrink-0 p-2 rounded-lg text-on-muted hover:text-red-500 hover:bg-red-50 transition-colors">
          <span className="material-symbols-outlined text-lg">logout</span>
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-on-muted">
        <span className="material-symbols-outlined text-sm">school</span>
        <span>{cls.teacher?.full_name || 'Giáo viên'}</span>
        <span className="ml-auto text-[11px] text-on-muted/60">
          {enrollment.enrolled_at ? `Tham gia ${new Date(enrollment.enrolled_at).toLocaleDateString('vi')}` : ''}
        </span>
      </div>
    </div>
  );
}

export default function Classes() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [alert, setAlert]             = useState({ type:'', msg:'' });
  const [joinModal, setJoinModal]     = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/classes/my'); setEnrollments(r.data || []); }
    catch(e) { setAlert({ type:'error', msg:'Không thể tải lớp học.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleJoined = (msg) => { setAlert({ type:'success', msg }); load(); };
  const handleLeft   = (msg) => { setAlert({ type:'success', msg }); load(); };

  return (
    <StudentLayout title="Lớp học">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Lớp học của tôi</h1>
        <Button onClick={() => setJoinModal(true)}>
          <span className="material-symbols-outlined text-lg">add</span> Tham gia lớp
        </Button>
      </div>

      {alert.msg && <Alert type={alert.type} onClose={() => setAlert({type:'',msg:''})} className="mb-4">{alert.msg}</Alert>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({length:2}).map((_,i) => <div key={i} className="glass-card rounded-2xl h-32 animate-pulse bg-surface-low"/>)}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-on-muted/20 block mb-3">groups</span>
          <h2 className="font-bold text-lg mb-1">Bạn chưa tham gia lớp học nào</h2>
          <p className="text-on-muted text-sm mb-4">Nhập mã lớp do giáo viên cung cấp để tham gia.</p>
          <Button onClick={() => setJoinModal(true)}>Tham gia lớp ngay</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrollments.map(e => <ClassCard key={e.id} enrollment={e} onLeave={setLeaveTarget} />)}
        </div>
      )}

      <JoinModal open={joinModal} onClose={() => setJoinModal(false)} onJoined={handleJoined} />
      <LeaveModal open={!!leaveTarget} cls={leaveTarget} onClose={() => setLeaveTarget(null)} onLeft={handleLeft} />
    </StudentLayout>
  );
}
