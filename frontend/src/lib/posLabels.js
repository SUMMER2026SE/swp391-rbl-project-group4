// Bảng ánh xạ tag loại từ (part-of-speech) của JMdict sang tiếng Việt

export const POS_LABELS = {
  // Danh từ
  n: 'Danh từ',
  'n-suf': 'Hậu tố danh từ',
  'n-pref': 'Tiền tố danh từ',
  'n-t': 'Danh từ chỉ thời gian',
  pn: 'Đại từ',
  num: 'Số từ',
  ctr: 'Lượng từ',

  // Tính từ
  'adj-i': 'Tính từ đuôi i',
  'adj-na': 'Tính từ đuôi na',
  'adj-no': 'Tính từ + の',
  'adj-pn': 'Tính từ liên thể',
  'adj-t': 'Tính từ đuôi -to/-taru',
  'adj-f': 'Tính từ bổ nghĩa trước danh từ',
  'adj-ix': 'Tính từ đuôi i (いい/よい)',

  // Động từ
  v1: 'Động từ nhóm 2 (Ichidan)',
  'v1-s': 'Động từ nhóm 2 (đặc biệt)',
  v5u: 'Động từ nhóm 1 (Godan)',
  'v5u-s': 'Động từ nhóm 1 (Godan, đặc biệt)',
  v5k: 'Động từ nhóm 1 (Godan)',
  'v5k-s': 'Động từ nhóm 1 (Godan, đặc biệt)',
  v5g: 'Động từ nhóm 1 (Godan)',
  v5s: 'Động từ nhóm 1 (Godan)',
  v5t: 'Động từ nhóm 1 (Godan)',
  v5n: 'Động từ nhóm 1 (Godan)',
  v5b: 'Động từ nhóm 1 (Godan)',
  v5m: 'Động từ nhóm 1 (Godan)',
  v5r: 'Động từ nhóm 1 (Godan)',
  'v5r-i': 'Động từ nhóm 1 (Godan, đặc biệt)',
  v5aru: 'Động từ nhóm 1 (Godan, đặc biệt)',
  v5uru: 'Động từ nhóm 1 (Godan, cổ)',
  vk: 'Động từ bất quy tắc (来る)',
  vs: 'Động từ える/する',
  'vs-i': 'Động từ する (biến thể)',
  'vs-s': 'Động từ する (biến thể đặc biệt)',
  'vs-c': 'Động từ する (cổ)',
  vz: 'Động từ ずる',
  vn: 'Động từ bất quy tắc (ぬ)',
  vr: 'Động từ bất quy tắc (kết thúc bằng る)',
  vi: 'Nội động từ',
  vt: 'Ngoại động từ',

  // Khác
  adv: 'Phó từ',
  'adv-to': 'Phó từ + と',
  aux: 'Trợ động từ',
  'aux-v': 'Trợ động từ',
  'aux-adj': 'Trợ tính từ',
  conj: 'Liên từ',
  cop: 'Hệ từ (copula)',
  int: 'Thán từ',
  prt: 'Trợ từ',
  pref: 'Tiền tố',
  suf: 'Hậu tố',
  exp: 'Cụm từ/thành ngữ',
  unc: 'Chưa phân loại',
};

// Dịch chuỗi pos (có thể nhiều tag cách nhau bởi dấu phẩy) sang tiếng Việt.
// Tag không có trong bảng sẽ giữ nguyên dạng gốc.
export function translatePos(pos) {
  if (!pos) return '';
  return pos
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => POS_LABELS[tag] || tag)
    .join(', ');
}
