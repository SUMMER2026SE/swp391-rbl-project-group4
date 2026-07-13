import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import Button from '../ui/Button';
import { SCORE_COLUMN_LABEL, formatDuration } from '../../lib/mockExamConstants';

/**
 * Phiếu báo điểm thi thử (mô phỏng 成績通知書 của JLPT) — hiện với mọi kết quả,
 * kèm nút tải PNG. Chỉ mang tính tham khảo, không phải chứng nhận chính thức.
 */
export default function MockExamCertificate({ result, userName }) {
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!result) return null;
  const { level, exam_title, scores, score_columns, total_score, passed, pass_total, duration_seconds, submitted_at, attempt_id } = result;

  const dateStr = submitted_at
    ? new Date(submitted_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const handleDownload = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `phieu-diem-jlpt-${level}-${(attempt_id || '').slice(0, 8)}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        {/* Vùng chụp PNG */}
        <div ref={certRef} className="bg-white p-2 min-w-[560px]">
          <div className="border-4 border-double border-charcoal/70 p-1">
            <div className="border border-charcoal/40 px-8 py-7 relative">
              {/* Con dấu 合格/不合格 */}
              <div className={`absolute top-6 right-6 w-20 h-20 rounded-full border-4 flex items-center justify-center -rotate-12 ${passed ? 'border-red-600 text-red-600' : 'border-slate-400 text-slate-400'}`}>
                <span className="font-bold text-xl tracking-widest" style={{ fontFamily: 'serif' }}>{passed ? '合格' : '不合格'}</span>
              </div>

              {/* Tiêu đề */}
              <div className="text-center mb-6">
                <p className="text-[11px] tracking-[0.3em] text-on-muted uppercase mb-1">Kizuna Nihongo — Sorakara</p>
                <h2 className="text-xl font-bold text-charcoal" style={{ fontFamily: 'serif' }}>日本語能力試験　模擬試験　成績通知書</h2>
                <p className="text-sm text-on-muted mt-1">PHIẾU BÁO ĐIỂM THI THỬ JLPT</p>
              </div>

              {/* Thông tin thí sinh */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-5">
                <p><span className="text-on-muted">Họ tên / 氏名:</span> <b className="text-charcoal">{userName || 'Học viên'}</b></p>
                <p><span className="text-on-muted">Cấp độ / レベル:</span> <b className="text-charcoal">{level}</b></p>
                <p className="col-span-2"><span className="text-on-muted">Đề thi / 試験名:</span> <b className="text-charcoal">{exam_title}</b></p>
                <p><span className="text-on-muted">Ngày thi / 受験日:</span> <b className="text-charcoal">{dateStr}</b></p>
                <p><span className="text-on-muted">Thời gian làm bài:</span> <b className="text-charcoal">{formatDuration(duration_seconds)}</b></p>
              </div>

              {/* Bảng điểm */}
              <table className="w-full text-sm border-collapse mb-5">
                <thead>
                  <tr className="bg-surface-low">
                    <th className="border border-charcoal/30 px-3 py-2 text-left font-semibold text-charcoal">Phần điểm / 得点区分</th>
                    <th className="border border-charcoal/30 px-3 py-2 text-right font-semibold text-charcoal w-28">Điểm / 得点</th>
                  </tr>
                </thead>
                <tbody>
                  {(score_columns || []).map(col => {
                    const s = scores?.[col.key];
                    const label = SCORE_COLUMN_LABEL[col.key];
                    if (!s) return null;
                    return (
                      <tr key={col.key}>
                        <td className="border border-charcoal/30 px-3 py-2 text-charcoal">{label?.vi} <span className="text-on-muted text-xs">({label?.ja})</span></td>
                        <td className={`border border-charcoal/30 px-3 py-2 text-right font-bold ${s.passed ? 'text-charcoal' : 'text-error'}`}>{s.score} / {s.max}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-surface-low">
                    <td className="border border-charcoal/30 px-3 py-2 font-bold text-charcoal">Tổng điểm / 総合得点 <span className="text-on-muted text-xs font-normal">(điểm đậu: {pass_total})</span></td>
                    <td className="border border-charcoal/30 px-3 py-2 text-right font-bold text-lg text-charcoal">{total_score} / 180</td>
                  </tr>
                </tbody>
              </table>

              {/* Kết quả */}
              <p className="text-center text-sm mb-5">
                Kết quả / 判定:{' '}
                <b className={passed ? 'text-green-700' : 'text-error'}>
                  {passed ? 'ĐẬU（合格）' : 'CHƯA ĐẠT（不合格）'}
                </b>
              </p>

              <div className="flex items-end justify-between text-[11px] text-on-muted">
                <p>Mã bài thi: {(attempt_id || '').slice(0, 8).toUpperCase()}</p>
                <p className="italic">※ Phiếu điểm thi thử (điểm ước lượng) — không có giá trị chứng nhận chính thức.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={handleDownload} loading={downloading}>
          <span className="material-symbols-outlined text-lg">download</span> Tải ảnh (PNG)
        </Button>
      </div>
    </div>
  );
}
