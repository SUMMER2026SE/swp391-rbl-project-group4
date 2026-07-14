import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import WorksheetPreview from './WorksheetPreview';
import { downloadWorksheetPDF } from '../../lib/kanjiWorksheet';

// Panel cài đặt + xem trước + tải PDF bộ luyện viết kanji — dùng chung cho bài
// đăng (Study List) và mục kanji trong bài học của khóa học.
// `list`: [{ char, reading_on, reading_kun, meaning_vi, han_viet }] — caller tự
// map field gốc `character` → `char` trước khi truyền vào.
// Parent mount/unmount có điều kiện ({open && <KanjiPdfPanel/>}) để danh sách
// tự reset mỗi lần mở.
export default function KanjiPdfPanel({ list, filename, onClose, className = '' }) {
  const panelRef = useRef(null);
  const [pdfList, setPdfList]         = useState(list);
  const [boxSize, setBoxSize]         = useState(68);
  const [guideCount, setGuideCount]   = useState(3);
  const [downloading, setDownloading] = useState(false);

  // Panel thường nằm ngoài khung nhìn lúc bấm nút mở → cuộn tới cho student thấy ngay.
  // scroll-mt-20 chừa chỗ cho header sticky h-16 của layout, tránh che tiêu đề panel.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div ref={panelRef} className={`glass-card rounded-2xl p-6 space-y-5 scroll-mt-20 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Bộ luyện viết PDF</h2>
        <button onClick={onClose} className="text-on-muted hover:text-charcoal">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Danh sách kanji — X để xóa khỏi PDF */}
      <div className="flex flex-wrap gap-1.5">
        {pdfList.map((k, i) => (
          <div key={i} className="relative group">
            <div className="w-10 h-10 rounded-lg border border-outline bg-surface text-xl flex items-center justify-center">
              {k.char}
            </div>
            <button
              onClick={() => setPdfList(l => l.filter((_, j) => j !== i))}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
              ×
            </button>
          </div>
        ))}
      </div>

      {pdfList.length === 0 ? (
        <p className="text-sm text-on-muted text-center py-4">Không còn kanji nào — thêm lại bằng cách nhấn "Tạo PDF luyện viết".</p>
      ) : (
        <>
          {/* Cài đặt */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">Cỡ ô
              <select value={boxSize} onChange={e => setBoxSize(Number(e.target.value))}
                className="px-2 py-1 border border-outline rounded-lg text-sm">
                <option value={56}>Nhỏ</option>
                <option value={68}>Vừa</option>
                <option value={84}>Lớn</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">Ô chữ mờ
              <select value={guideCount} onChange={e => setGuideCount(Number(e.target.value))}
                className="px-2 py-1 border border-outline rounded-lg text-sm">
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={0}>Không</option>
              </select>
            </label>
            <div className="ml-auto">
              <Button
                loading={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await downloadWorksheetPDF('ws-print', filename);
                  } finally { setDownloading(false); }
                }}>
                <span className="material-symbols-outlined text-lg">download</span> Tải PDF
              </Button>
            </div>
          </div>

          {/* Preview */}
          <WorksheetPreview list={pdfList} boxSize={boxSize} guideCount={guideCount} />
        </>
      )}
    </div>
  );
}
