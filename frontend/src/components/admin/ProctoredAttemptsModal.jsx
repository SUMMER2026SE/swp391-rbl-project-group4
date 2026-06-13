import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '../../lib/api';

const VIOLATION_VI = {
  fullscreen_exit: 'Thoát toàn màn hình',
  tab_hidden:      'Rời tab/cửa sổ',
  no_face:         'Không thấy mặt',
  multiple_faces:  'Nhiều người',
  camera_lost:     'Mất webcam',
};

// Modal xem bài làm chế độ giám sát: điểm, log vi phạm, ảnh webcam.
export default function ProctoredAttemptsModal({ open, onClose, quizId }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [zoomImg, setZoomImg]   = useState(null);

  useEffect(() => {
    if (!open || !quizId) return;
    setLoading(true);
    api.get(`/admin/quizzes/${quizId}/attempts`)
      .then(r => setAttempts(r.data || []))
      .catch(() => setAttempts([]))
      .finally(() => setLoading(false));
  }, [open, quizId]);

  return (
    <Modal open={open} onClose={onClose} title="Bài làm — chế độ giám sát" size="xl"
      footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}>
      {loading ? (
        <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-2xl text-tsubaki-red">progress_activity</span></div>
      ) : attempts.length === 0 ? (
        <div className="text-center py-10 text-on-muted">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">policy</span>
          Chưa có học sinh nào làm bài thi này.
        </div>
      ) : (
        <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
          {attempts.map(a => (
            <div key={a.id} className="border border-outline/30 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-semibold text-sm">{a.student?.full_name || a.student?.email}</p>
                  <p className="text-xs text-on-muted">{new Date(a.completed_at).toLocaleString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{a.score}/{a.total_questions}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${a.violation_count > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <span className="material-symbols-outlined text-[14px]">{a.violation_count > 0 ? 'warning' : 'check_circle'}</span>
                    {a.violation_count > 0 ? `${a.violation_count} vi phạm` : 'Không vi phạm'}
                  </span>
                </div>
              </div>

              {Array.isArray(a.proctor_events) && a.proctor_events.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.proctor_events.map((ev, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                      {VIOLATION_VI[ev.type] || ev.type} · {new Date(ev.at).toLocaleTimeString('vi-VN')}
                    </span>
                  ))}
                </div>
              )}

              {Array.isArray(a.snapshot_urls) && a.snapshot_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {a.snapshot_urls.map((url, i) => (
                    <img key={i} src={url} alt="snapshot" onClick={() => setZoomImg(url)}
                      className="w-20 h-16 rounded-lg object-cover border border-outline/30 cursor-pointer hover:ring-2 hover:ring-tsubaki-red" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {zoomImg && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6" onClick={() => setZoomImg(null)}>
          <img src={zoomImg} alt="zoom" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </Modal>
  );
}
