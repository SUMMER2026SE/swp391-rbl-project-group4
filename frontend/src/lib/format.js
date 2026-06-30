// Định dạng tiền VNĐ: 299000 → "299.000 ₫"
export function formatVnd(amount) {
  const n = Number(amount) || 0;
  return `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
}

// Định dạng số lượt gọn: 1200 → "1,2k", 12000 → "12k", 950 → "950"
export function formatCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${(k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)).replace('.', ',')}k`;
}
