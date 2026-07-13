// Hằng số hiển thị cho thi thử JLPT — mirror của backend/utils/jlptMock.js.
// Giữ ở FE để render nhãn mondai/section mà không cần gọi API.

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

export const PASS_TOTAL = { N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 };

// Nhãn cột chấm điểm
export const SCORE_COLUMN_LABEL = {
  language:          { vi: 'Kiến thức ngôn ngữ', ja: '言語知識' },
  reading:           { vi: 'Đọc hiểu',           ja: '読解' },
  listening:         { vi: 'Nghe hiểu',          ja: '聴解' },
  language_reading:  { vi: 'Ngôn ngữ・Đọc hiểu', ja: '言語知識・読解' },
};

// Nhãn phần thi
export const SECTION_LABEL = {
  vocab:            'Từ vựng・Chữ Hán',
  grammar_reading:  'Ngữ pháp・Đọc hiểu',
  language_reading: 'Ngôn ngữ・Đọc hiểu',
  listening:        'Nghe hiểu',
};

// Nhãn từng loại mondai (大問)
export const MONDAI_LABEL = {
  kanji_reading:        { ja: '漢字読み',   vi: 'Đọc kanji' },
  orthography:          { ja: '表記',       vi: 'Cách viết' },
  word_formation:       { ja: '語形成',     vi: 'Cấu tạo từ' },
  context:              { ja: '文脈規定',   vi: 'Điền từ theo ngữ cảnh' },
  paraphrase:           { ja: '言い換え類義', vi: 'Từ đồng nghĩa' },
  usage:                { ja: '用法',       vi: 'Cách dùng từ' },
  grammar_form:         { ja: '文の文法１', vi: 'Chọn dạng ngữ pháp' },
  sentence_assembly:    { ja: '文の文法２', vi: 'Sắp xếp câu (★)' },
  text_grammar:         { ja: '文章の文法', vi: 'Ngữ pháp đoạn văn' },
  reading_short:        { ja: '内容理解（短文）', vi: 'Đọc hiểu đoạn ngắn' },
  reading_mid:          { ja: '内容理解（中文）', vi: 'Đọc hiểu đoạn vừa' },
  reading_long:         { ja: '内容理解（長文）', vi: 'Đọc hiểu đoạn dài' },
  integrated_reading:   { ja: '統合理解',   vi: 'Đọc so sánh' },
  thematic_reading:     { ja: '主張理解',   vi: 'Hiểu chủ trương' },
  info_retrieval:       { ja: '情報検索',   vi: 'Tìm kiếm thông tin' },
  task_comprehension:   { ja: '課題理解',   vi: 'Nghe hiểu nhiệm vụ' },
  point_comprehension:  { ja: 'ポイント理解', vi: 'Nghe hiểu điểm chính' },
  summary_comprehension:{ ja: '概要理解',   vi: 'Nghe hiểu khái quát' },
  utterance_expression: { ja: '発話表現',   vi: 'Phát ngôn theo tranh' },
  quick_response:       { ja: '即時応答',   vi: 'Đáp lại tức thì' },
  integrated_listening: { ja: '統合理解（聴解）', vi: 'Nghe tổng hợp' },
};

// Tên phần thi hiển thị: "tiêu đề tiếng Nhật · tên tiếng Việt"
export const sectionDisplay = (section) => {
  const vi = SECTION_LABEL[section.section_type] || '';
  if (!section.title) return vi;
  return vi ? `${section.title} · ${vi}` : section.title;
};

// Bản dịch tiếng Việt của câu chỉ dẫn chuẩn từng loại mondai
// (mirror MONDAI_TYPES[type].instruction ở backend/utils/jlptMock.js)
export const MONDAI_INSTRUCTION_VI = {
  kanji_reading:        'Chọn cách đọc đúng nhất cho từ được gạch dưới, từ 1・2・3・4.',
  orthography:          'Từ được gạch dưới viết bằng kanji (hoặc cách viết đúng) như thế nào? Chọn đáp án đúng nhất từ 1・2・3・4.',
  word_formation:       'Chọn phương án thích hợp nhất để điền vào chỗ trống（　　）, từ 1・2・3・4.',
  context:              'Chọn từ thích hợp nhất để điền vào chỗ trống（　　）, từ 1・2・3・4.',
  paraphrase:           'Chọn từ/cụm từ có nghĩa gần nhất với từ được gạch dưới, từ 1・2・3・4.',
  usage:                'Chọn câu dùng đúng nhất từ đã cho, từ 1・2・3・4.',
  grammar_form:         'Chọn cấu trúc ngữ pháp thích hợp nhất để điền vào chỗ trống（　　）, từ 1・2・3・4.',
  sentence_assembly:    'Chọn phương án phù hợp nhất cho vị trí ＿★＿ khi sắp xếp câu, từ 1・2・3・4.',
  text_grammar:         'Đọc đoạn văn, dựa vào nội dung toàn bài chọn phương án thích hợp nhất cho chỗ trống（　　）, từ 1・2・3・4.',
  reading_short:        'Đọc đoạn văn và trả lời câu hỏi. Chọn đáp án đúng nhất từ 1・2・3・4.',
  reading_mid:          'Đọc đoạn văn và trả lời câu hỏi. Chọn đáp án đúng nhất từ 1・2・3・4.',
  reading_long:         'Đọc đoạn văn và trả lời câu hỏi. Chọn đáp án đúng nhất từ 1・2・3・4.',
  integrated_reading:   'Đọc hai văn bản A và B rồi trả lời câu hỏi. Chọn đáp án đúng nhất từ 1・2・3・4.',
  thematic_reading:     'Đọc bài văn và trả lời câu hỏi. Chọn đáp án đúng nhất từ 1・2・3・4.',
  info_retrieval:       'Xem trang thông tin và trả lời câu hỏi bên dưới. Chọn đáp án đúng nhất từ 1・2・3・4.',
  task_comprehension:   'Nghe câu hỏi trước, sau đó nghe hội thoại và chọn đáp án đúng nhất từ 1–4 in trên đề.',
  point_comprehension:  'Nghe câu hỏi trước, đọc các lựa chọn in trên đề, sau đó nghe nội dung và chọn đáp án đúng nhất từ 1–4.',
  summary_comprehension:'Trên đề không in gì. Dạng bài này hỏi nội dung tổng thể của bài nói; không có câu hỏi trước khi nghe.',
  utterance_expression: 'Vừa nhìn tranh vừa nghe câu hỏi. Người có mũi tên (→) sẽ nói gì? Chọn đáp án đúng nhất từ 1–3.',
  quick_response:       'Nghe câu nói và chọn câu đáp lại phù hợp nhất từ 1–3.',
  integrated_listening: 'Nghe bài nói dài và trả lời câu hỏi. Chọn đáp án đúng nhất từ 1–4.',
};

// Danh sách mondai_type để chọn khi soạn đề (nhóm theo kỹ năng)
export const MONDAI_TYPE_OPTIONS = Object.entries(MONDAI_LABEL).map(([value, l]) => ({
  value, label: `${l.ja} — ${l.vi}`,
}));

export const mondaiJa = (type) => MONDAI_LABEL[type]?.ja || type;
export const mondaiVi = (type) => MONDAI_LABEL[type]?.vi || type;

// Định dạng mm:ss / hh:mm:ss
export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
