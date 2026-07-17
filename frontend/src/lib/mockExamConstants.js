// Hằng số hiển thị cho thi thử JLPT — mirror của backend/utils/jlptMock.js.
// Giữ ở FE để render nhãn mondai/section mà không cần gọi API.

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// Class badge tô màu theo cấp (dễ phân biệt trong bảng lịch sử)
export const LEVEL_BADGE_CLASS = {
  N5: 'bg-green-100 text-green-700',
  N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-amber-100 text-amber-700',
  N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-rose-100 text-rose-700',
};

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

// Các dạng mondai có passage/ảnh dùng chung cấp mondai (đọc hiểu) — dạng khác không có.
// Ảnh cấp CÂU chỉ dùng cho mondai nghe (発話表現 mỗi câu 1 tranh).
export const PASSAGE_MONDAI_TYPES = new Set([
  'text_grammar', 'reading_short', 'reading_mid', 'reading_long',
  'integrated_reading', 'thematic_reading', 'info_retrieval',
]);

// Tên phần thi hiển thị: "tiêu đề tiếng Nhật · tên tiếng Việt"
export const sectionDisplay = (section) => {
  const vi = SECTION_LABEL[section.section_type] || '';
  if (!section.title) return vi;
  return vi ? `${section.title} · ${vi}` : section.title;
};

// Câu chỉ dẫn chuẩn tiếng Nhật từng loại mondai — hằng số tĩnh, KHÔNG lưu DB.
// Bản kana (dùng cho N3・N4・N5, mirror MONDAI_TYPES[type].instruction ở backend/utils/jlptMock.js).
export const MONDAI_INSTRUCTION_JA = {
  kanji_reading:        '＿＿＿のことばの読み方として最もよいものを、１・２・３・４から一つえらびなさい。',
  orthography:          '＿＿＿のことばを漢字（または正しい表記）で書くとき、最もよいものを１・２・３・４から一つえらびなさい。',
  word_formation:       '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
  context:              '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
  paraphrase:           '＿＿＿のことばに意味が最も近いものを、１・２・３・４から一つえらびなさい。',
  usage:                'つぎのことばの使い方として最もよいものを、１・２・３・４から一つえらびなさい。',
  grammar_form:         '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
  sentence_assembly:    'つぎの文の　＿★＿　に入る最もよいものを、１・２・３・４から一つえらびなさい。',
  text_grammar:         'つぎの文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを、１・２・３・４から一つえらびなさい。',
  reading_short:        'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  reading_mid:          'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  reading_long:         'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  integrated_reading:   'つぎのＡとＢの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  thematic_reading:     'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  info_retrieval:       'つぎのページを見て、下の質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
  task_comprehension:   'まず質問を聞いてください。それから話を聞いて、問題用紙の１から４の中から、最もよいものを一つえらんでください。',
  point_comprehension:  'まず質問を聞いてください。そのあと、問題用紙のせんたくしを読んでください。それから話を聞いて、１から４の中から、最もよいものを一つえらんでください。',
  summary_comprehension:'問題用紙に何もいんさつされていません。この問題は、ぜんたいとしてどんなないようかを聞く問題です。話の前に質問はありません。',
  utterance_expression: 'えを見ながら質問を聞いてください。やじるし（→）の人は何と言いますか。１から３の中から、最もよいものを一つえらんでください。',
  quick_response:       'ぶんを聞いて、１から３の中から、最もよいものを一つえらんでください。',
  integrated_listening: '長めの話を聞いて、質問に答えてください。１から４の中から、最もよいものを一つえらんでください。',
};

// Bản kanji cho N1・N2 (đề thật cấp cao dùng 言葉/選びなさい/次の…). Chỉ ghi các dạng có ở N1/N2.
const INSTRUCTION_JA_KANJI = {
  kanji_reading:        '＿＿＿の言葉の読み方として最もよいものを、１・２・３・４から一つ選びなさい。',
  orthography:          '＿＿＿の言葉を漢字で書くとき、最もよいものを１・２・３・４から一つ選びなさい。',
  word_formation:       '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
  context:              '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
  paraphrase:           '＿＿＿の言葉に意味が最も近いものを、１・２・３・４から一つ選びなさい。',
  usage:                '次の言葉の使い方として最もよいものを、１・２・３・４から一つ選びなさい。',
  grammar_form:         '次の文の（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
  sentence_assembly:    '次の文の　＿★＿　に入る最もよいものを、１・２・３・４から一つ選びなさい。',
  text_grammar:         '次の文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを、１・２・３・４から一つ選びなさい。',
  reading_short:        '次の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  reading_mid:          '次の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  reading_long:         '次の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  integrated_reading:   '次のＡとＢの文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  thematic_reading:     '次の文章を読んで、後の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  info_retrieval:       '次のページを見て、下の問いに対する答えとして最もよいものを、１・２・３・４から一つ選びなさい。',
  task_comprehension:   'まず質問を聞いてください。それから話を聞いて、問題用紙の１から４の中から、最もよいものを一つ選んでください。',
  point_comprehension:  'まず質問を聞いてください。そのあと、問題用紙の選択肢を読んでください。それから話を聞いて、１から４の中から、最もよいものを一つ選んでください。',
  summary_comprehension:'問題用紙に何も印刷されていません。この問題は、全体としてどんな内容かを聞く問題です。話の前に質問はありません。',
  quick_response:       '文を聞いて、１から３の中から、最もよいものを一つ選んでください。',
  integrated_listening: '長めの話を聞いて、質問に答えてください。１から４の中から、最もよいものを一つ選んでください。',
};

// Câu chỉ dẫn hiển thị theo cấp độ: N1/N2 dạng kanji, N3–N5 dạng kana.
export const mondaiInstruction = (level, mondaiType) => ({
  ja: ((level === 'N1' || level === 'N2') && INSTRUCTION_JA_KANJI[mondaiType]) || MONDAI_INSTRUCTION_JA[mondaiType] || '',
  vi: MONDAI_INSTRUCTION_VI[mondaiType] || '',
});

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

// Số câu chuẩn (目安) mỗi mondai theo blueprint JLPT — mirror BLUEPRINTS ở
// backend/utils/jlptMock.js. Key = "vị trí phần thi : mondai_type".
// Dùng để hiển thị "n câu / chuẩn m" trong editor (không chặn, chỉ cảnh báo).
export const BLUEPRINT_COUNTS = {
  N5: {
    '1:kanji_reading': 7, '1:orthography': 5, '1:context': 6, '1:paraphrase': 3,
    '2:grammar_form': 9, '2:sentence_assembly': 4, '2:text_grammar': 4, '2:reading_short': 2, '2:reading_mid': 2, '2:info_retrieval': 1,
    '3:task_comprehension': 7, '3:point_comprehension': 6, '3:utterance_expression': 5, '3:quick_response': 6,
  },
  N4: {
    '1:kanji_reading': 7, '1:orthography': 5, '1:context': 8, '1:paraphrase': 4, '1:usage': 4,
    '2:grammar_form': 13, '2:sentence_assembly': 4, '2:text_grammar': 4, '2:reading_short': 3, '2:reading_mid': 3, '2:info_retrieval': 2,
    '3:task_comprehension': 8, '3:point_comprehension': 7, '3:utterance_expression': 5, '3:quick_response': 8,
  },
  N3: {
    '1:kanji_reading': 8, '1:orthography': 6, '1:context': 11, '1:paraphrase': 5, '1:usage': 5,
    '2:grammar_form': 13, '2:sentence_assembly': 5, '2:text_grammar': 5, '2:reading_short': 4, '2:reading_mid': 6, '2:reading_long': 4, '2:info_retrieval': 2,
    '3:task_comprehension': 6, '3:point_comprehension': 6, '3:summary_comprehension': 3, '3:utterance_expression': 4, '3:quick_response': 9,
  },
  N2: {
    '1:kanji_reading': 5, '1:orthography': 5, '1:word_formation': 4, '1:context': 7, '1:paraphrase': 5, '1:usage': 5,
    '1:grammar_form': 12, '1:sentence_assembly': 5, '1:text_grammar': 5,
    '1:reading_short': 5, '1:reading_mid': 9, '1:integrated_reading': 2, '1:thematic_reading': 3, '1:info_retrieval': 2,
    '2:task_comprehension': 5, '2:point_comprehension': 6, '2:summary_comprehension': 5, '2:quick_response': 12, '2:integrated_listening': 4,
  },
  N1: {
    '1:kanji_reading': 6, '1:context': 7, '1:paraphrase': 6, '1:usage': 6,
    '1:grammar_form': 10, '1:sentence_assembly': 5, '1:text_grammar': 5,
    '1:reading_short': 4, '1:reading_mid': 9, '1:reading_long': 4, '1:integrated_reading': 3, '1:thematic_reading': 4, '1:info_retrieval': 2,
    '2:task_comprehension': 5, '2:point_comprehension': 6, '2:summary_comprehension': 5, '2:quick_response': 11, '2:integrated_listening': 3,
  },
};

// Số câu chuẩn cho 1 mondai (theo cấp + vị trí phần thi + loại mondai). null nếu không có.
export const blueprintCount = (level, sectionPosition, mondaiType) =>
  BLUEPRINT_COUNTS[level]?.[`${sectionPosition}:${mondaiType}`] ?? null;

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
