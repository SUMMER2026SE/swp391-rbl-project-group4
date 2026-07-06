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

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    allowTaint: true,
  });

  const A4_W = 210, A4_H = 297; // mm
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 10;
  const imgW = A4_W - margin * 2;
  const imgH = (canvas.height / canvas.width) * imgW;
  const pageH = A4_H - margin * 2;

  let y = 0;
  while (y < imgH) {
    if (y > 0) pdf.addPage();
    const srcY  = (y / imgH) * canvas.height;
    const srcH  = Math.min((pageH / imgH) * canvas.height, canvas.height - srcY);
    const sliceH = (srcH / canvas.height) * imgH;

    // cắt từng trang từ canvas
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width  = canvas.width;
    pageCanvas.height = srcH;
    pageCanvas.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgW, sliceH);
    y += pageH;
  }

  pdf.save(filename);
}
