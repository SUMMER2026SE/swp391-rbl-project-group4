// Tạo PDF bộ luyện viết kanji — logic client-side thuần túy (html2canvas + jsPDF),
// dùng chung cho trang Luyện viết Kanji và trang Bài học.
export const SERIF = "'Noto Sans JP','Yu Mincho','Hiragino Mincho Pro',serif";

export async function downloadWorksheetPDF(elementId, filename = 'kanji-luyen-viet.pdf') {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const el = document.getElementById(elementId);
  if (!el) return;

  // đợi font CJK load xong trước khi chụp
  await document.fonts.ready;

  const scale = 2;

  // đo ranh giới từng card kanji (CSS px, tương đối so với `el`) trước khi chụp,
  // để lúc cắt trang không cắt ngang giữa 1 card
  const elTop = el.getBoundingClientRect().top;
  const cardBoundsCss = Array.from(el.querySelectorAll('[data-worksheet-entry]')).map((c) => {
    const r = c.getBoundingClientRect();
    return { top: r.top - elTop, bottom: r.bottom - elTop };
  });

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    allowTaint: true,
  });

  // quy đổi ranh giới card sang tọa độ pixel của canvas
  const cardBounds = cardBoundsCss.map(({ top, bottom }) => ({ top: top * scale, bottom: bottom * scale }));

  const A4_W = 210, A4_H = 297; // mm
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 10;
  const imgW = A4_W - margin * 2;
  const pageH = A4_H - margin * 2;
  const pxPerMm = canvas.width / imgW;
  const pageHpx = pageH * pxPerMm;

  let y = 0;
  while (y < canvas.height - 0.5) {
    if (y > 0) pdf.addPage();

    // điểm cắt mặc định theo chiều cao 1 trang
    let cut = Math.min(y + pageHpx, canvas.height);
    // nếu điểm cắt rơi vào giữa 1 card, rút ngắn trang lại để card đó nguyên vẹn sang trang sau
    for (const cb of cardBounds) {
      if (cb.top > y + 0.5 && cb.top < cut && cb.bottom > cut) {
        cut = Math.min(cut, cb.top);
      }
    }
    if (cut <= y) cut = Math.min(y + pageHpx, canvas.height); // fallback: tránh vòng lặp vô hạn (card cao hơn 1 trang)
    cut = Math.min(Math.round(cut), canvas.height);

    const srcH = cut - y;
    const sliceH = srcH / pxPerMm;

    // cắt từng trang từ canvas
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width  = canvas.width;
    pageCanvas.height = srcH;
    pageCanvas.getContext('2d').drawImage(canvas, 0, y, canvas.width, srcH, 0, 0, canvas.width, srcH);

    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgW, sliceH);
    y = cut;
  }

  pdf.save(filename);
}
