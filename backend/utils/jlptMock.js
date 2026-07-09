'use strict';

// ─── JLPT Mock Test: hằng số cấu trúc đề + quy tắc điểm + hàm chấm ───────────
// Nguồn cấu trúc: jlpt.jp (format hiện hành sau điều chỉnh 12/2020 N4-N5 và
// 12/2022 phần Nghe N1). Số câu mỗi mondai là 目安 (tham khảo) — chỉ dùng làm
// mặc định khi tạo khung đề; chấm điểm luôn theo số câu thực tế của đề.

// ── Cột chấm điểm theo cấp (khác với phần THI) ───────────────────────────────
// N1–N3: 3 cột language / reading / listening, mỗi cột 0–60, điểm liệt 19.
// N4–N5: 2 cột language_reading (0–120, liệt 38) / listening (0–60, liệt 19).
// `cats` = các score_category của group được gom vào cột đó.
const SCORE_COLUMNS = {
  N1: [
    { key: 'language',  max: 60, min: 19, cats: ['language'] },
    { key: 'reading',   max: 60, min: 19, cats: ['reading'] },
    { key: 'listening', max: 60, min: 19, cats: ['listening'] },
  ],
  N4: [
    { key: 'language_reading', max: 120, min: 38, cats: ['language', 'reading', 'language_reading'] },
    { key: 'listening',        max: 60,  min: 19, cats: ['listening'] },
  ],
};
SCORE_COLUMNS.N2 = SCORE_COLUMNS.N1;
SCORE_COLUMNS.N3 = SCORE_COLUMNS.N1;
SCORE_COLUMNS.N5 = SCORE_COLUMNS.N4;

// Điểm đậu tổng (/180) theo cấp
const PASS_TOTAL = { N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 };

// ── Loại mondai (大問) ────────────────────────────────────────────────────────
// category: cột chấm mặc định; options_count: số lựa chọn chuẩn;
// ai_hint: mô tả dạng bài đưa vào prompt AI sinh câu.
const MONDAI_TYPES = {
  kanji_reading: {
    ja: '漢字読み', vi: 'Đọc kanji', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばの読み方として最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ viết bằng kanji được đánh dấu (đặt trong 「」hoặc gạch dưới bằng ＿＿), hỏi cách đọc hiragana đúng. 4 lựa chọn là các cách đọc hiragana, distractor là âm đọc gần giống (trường âm, âm đục, âm ngắt).',
  },
  orthography: {
    ja: '表記', vi: 'Cách viết (chữ Hán/Katakana)', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばを漢字（または正しい表記）で書くとき、最もよいものを１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ viết bằng hiragana được đánh dấu, hỏi cách viết đúng bằng kanji (hoặc katakana). Distractor là kanji có hình dạng gần giống hoặc đồng âm khác nghĩa.',
  },
  word_formation: {
    ja: '語形成', vi: 'Cấu tạo từ', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つ選びなさい。',
    ai_hint: 'Câu có chỗ trống, điền tiền tố/hậu tố hoặc thành tố ghép đúng để tạo từ phái sinh (vd 「再～」「～性」「～的」). Chỉ có ở N2.',
  },
  context: {
    ja: '文脈規定', vi: 'Điền từ theo ngữ cảnh', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu có chỗ trống（　　）, chọn từ vựng đúng nhất theo ngữ cảnh. 4 lựa chọn cùng từ loại, distractor là từ cùng trường nghĩa nhưng sai sắc thái/collocation.',
  },
  paraphrase: {
    ja: '言い換え類義', vi: 'Từ đồng nghĩa', category: 'language', options_count: 4,
    instruction: '＿＿＿のことばに意味が最も近いものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu chứa 1 từ/cụm được đánh dấu, chọn từ/cụm có nghĩa gần nhất. Distractor là từ liên quan nhưng nghĩa khác.',
  },
  usage: {
    ja: '用法', vi: 'Cách dùng từ', category: 'language', options_count: 4,
    instruction: 'つぎのことばの使い方として最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'question_text là 1 từ cho trước, 4 lựa chọn là 4 câu hoàn chỉnh dùng từ đó — chỉ 1 câu dùng đúng nghĩa/ngữ cảnh, 3 câu dùng sai một cách tự nhiên.',
  },
  grammar_form: {
    ja: '文の文法１（文法形式の判断）', vi: 'Chọn dạng ngữ pháp', category: 'language', options_count: 4,
    instruction: '（　　）に入れるのに最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu có chỗ trống（　　）, chọn cấu trúc ngữ pháp đúng. Distractor là mẫu ngữ pháp cùng cấp trông tương tự nhưng sai nghĩa/cách nối.',
  },
  sentence_assembly: {
    ja: '文の文法２（文の組み立て）', vi: 'Sắp xếp câu (câu ★)', category: 'language', options_count: 4,
    instruction: 'つぎの文の　＿★＿　に入る最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Câu bị khuyết 4 chỗ liên tiếp ＿＿＿　＿★＿　＿＿＿　＿＿＿, 4 lựa chọn là 4 mảnh câu; hỏi mảnh nào nằm ở vị trí ★ khi sắp đúng thứ tự. explanation phải ghi rõ thứ tự đúng của cả 4 mảnh.',
  },
  text_grammar: {
    ja: '文章の文法', vi: 'Ngữ pháp đoạn văn', category: 'language', options_count: 4,
    instruction: 'つぎの文章を読んで、文章全体の内容を考えて、（　　）に入る最もよいものを、１・２・３・４から一つえらびなさい。',
    ai_hint: 'Cho 1 đoạn văn ngắn (passage_text của group) có các chỗ trống đánh số, mỗi câu hỏi tương ứng 1 chỗ trống — chọn từ nối/ngữ pháp đúng theo mạch văn.',
  },
  reading_short: {
    ja: '内容理解（短文）', vi: 'Đọc hiểu đoạn ngắn', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn ngắn (~80–200 chữ tùy cấp, để ở passage_text) kèm 1 câu hỏi nội dung.',
  },
  reading_mid: {
    ja: '内容理解（中文）', vi: 'Đọc hiểu đoạn vừa', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn vừa (~250–500 chữ tùy cấp) kèm 2–3 câu hỏi về nội dung, lý do, ý người viết.',
  },
  reading_long: {
    ja: '内容理解（長文）', vi: 'Đọc hiểu đoạn dài', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Đoạn văn dài (~550–1000 chữ tùy cấp) kèm 3–4 câu hỏi.',
  },
  integrated_reading: {
    ja: '統合理解', vi: 'Đọc so sánh nhiều văn bản', category: 'reading', options_count: 4,
    instruction: 'つぎのＡとＢの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Hai văn bản A và B về cùng chủ đề (đặt cả hai trong passage_text, đánh dấu Ａ/Ｂ), câu hỏi yêu cầu so sánh/tổng hợp quan điểm.',
  },
  thematic_reading: {
    ja: '主張理解（長文）', vi: 'Hiểu chủ trương (xã luận)', category: 'reading', options_count: 4,
    instruction: 'つぎの文章を読んで、質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Bài xã luận/bình luận dài (~900–1000 chữ), câu hỏi về chủ trương, ý kiến của tác giả.',
  },
  info_retrieval: {
    ja: '情報検索', vi: 'Tìm kiếm thông tin', category: 'reading', options_count: 4,
    instruction: 'つぎのページを見て、下の質問に答えなさい。答えは、１・２・３・４から最もよいものを一つえらびなさい。',
    ai_hint: 'Văn bản thông tin dạng thông báo/quảng cáo/thời khóa biểu (passage_text hoặc image_url), câu hỏi yêu cầu tra cứu thông tin thỏa điều kiện.',
  },
  task_comprehension: {
    ja: '課題理解', vi: 'Nghe hiểu nhiệm vụ', category: 'listening', options_count: 4, needs_audio: true,
    instruction: 'まず質問を聞いてください。それから話を聞いて、問題用紙の１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Hội thoại ngắn (viết script vào audio_transcript), hỏi người nghe tiếp theo phải làm gì. 4 lựa chọn in trên giấy (chữ hoặc mô tả tranh).',
  },
  point_comprehension: {
    ja: 'ポイント理解', vi: 'Nghe hiểu điểm chính', category: 'listening', options_count: 4, needs_audio: true,
    instruction: 'まず質問を聞いてください。そのあと、問題用紙のせんたくしを読んでください。それから話を聞いて、１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Hội thoại/độc thoại, câu hỏi nêu trước điểm cần chú ý (lý do, thời gian...). 4 lựa chọn in trên giấy.',
  },
  summary_comprehension: {
    ja: '概要理解', vi: 'Nghe hiểu khái quát', category: 'listening', options_count: 4, needs_audio: true,
    instruction: '問題用紙に何もいんさつされていません。この問題は、ぜんたいとしてどんなないようかを聞く問題です。話の前に質問はありません。',
    ai_hint: 'Độc thoại/hội thoại, hỏi đại ý toàn bài; câu hỏi và lựa chọn chỉ đọc trong audio (không in trên giấy) — question_text để trống, options vẫn nhập để chấm.',
    no_question_text: true,
  },
  utterance_expression: {
    ja: '発話表現', vi: 'Chọn phát ngôn theo tranh', category: 'listening', options_count: 3, needs_audio: true, needs_image: true,
    instruction: 'えを見ながら質問を聞いてください。やじるし（→）の人は何と言いますか。１から３の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Tình huống có tranh (image_url), người được đánh dấu → phải nói gì. 3 lựa chọn là 3 câu nói ngắn. Chỉ có ở N3–N5.',
  },
  quick_response: {
    ja: '即時応答', vi: 'Đáp lại tức thì', category: 'listening', options_count: 3, needs_audio: true,
    instruction: 'ぶんを聞いて、１から３の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Một câu nói ngắn + 3 câu đáp lại (tất cả chỉ nghe, không in trên giấy) — question_text để trống; ghi câu mở lời + 3 lựa chọn vào script; options nhập text để chấm và review.',
    no_question_text: true,
  },
  integrated_listening: {
    ja: '統合理解（聴解）', vi: 'Nghe tổng hợp', category: 'listening', options_count: 4, needs_audio: true,
    instruction: '長めの話を聞いて、質問に答えてください。１から４の中から、最もよいものを一つえらんでください。',
    ai_hint: 'Bài nghe dài (nhiều người nói/so sánh thông tin), 1 audio dùng chung cho 1–2 câu hỏi con. Chỉ có ở N1–N2.',
  },
};

// ── Blueprint khung đề chuẩn từng cấp ────────────────────────────────────────
// Tiện ích tạo group theo blueprint: [mondai_type, question_count, score_category]
const g = (type, count, category) => ({ mondai_type: type, question_count: count, score_category: category });

const BLUEPRINTS = {
  N5: {
    total_questions: 67,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 20,
        groups: [
          g('kanji_reading', 7, 'language_reading'),
          g('orthography', 5, 'language_reading'),
          g('context', 6, 'language_reading'),
          g('paraphrase', 3, 'language_reading'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 40,
        groups: [
          g('grammar_form', 9, 'language_reading'),
          g('sentence_assembly', 4, 'language_reading'),
          g('text_grammar', 4, 'language_reading'),
          g('reading_short', 2, 'language_reading'),
          g('reading_mid', 2, 'language_reading'),
          g('info_retrieval', 1, 'language_reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 30,
        groups: [
          g('task_comprehension', 7, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('utterance_expression', 5, 'listening'),
          g('quick_response', 6, 'listening'),
        ],
      },
    ],
  },
  N4: {
    total_questions: 85,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 25,
        groups: [
          g('kanji_reading', 7, 'language_reading'),
          g('orthography', 5, 'language_reading'),
          g('context', 8, 'language_reading'),
          g('paraphrase', 4, 'language_reading'),
          g('usage', 4, 'language_reading'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 55,
        groups: [
          g('grammar_form', 13, 'language_reading'),
          g('sentence_assembly', 4, 'language_reading'),
          g('text_grammar', 4, 'language_reading'),
          g('reading_short', 3, 'language_reading'),
          g('reading_mid', 3, 'language_reading'),
          g('info_retrieval', 2, 'language_reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 35,
        groups: [
          g('task_comprehension', 8, 'listening'),
          g('point_comprehension', 7, 'listening'),
          g('utterance_expression', 5, 'listening'),
          g('quick_response', 8, 'listening'),
        ],
      },
    ],
  },
  N3: {
    total_questions: 102,
    sections: [
      {
        section_type: 'vocab', title: '言語知識（文字・語彙）', time_limit_minutes: 30,
        groups: [
          g('kanji_reading', 8, 'language'),
          g('orthography', 6, 'language'),
          g('context', 11, 'language'),
          g('paraphrase', 5, 'language'),
          g('usage', 5, 'language'),
        ],
      },
      {
        section_type: 'grammar_reading', title: '言語知識（文法）・読解', time_limit_minutes: 70,
        groups: [
          g('grammar_form', 13, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 4, 'reading'),
          g('reading_mid', 6, 'reading'),
          g('reading_long', 4, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 40,
        groups: [
          g('task_comprehension', 6, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 3, 'listening'),
          g('utterance_expression', 4, 'listening'),
          g('quick_response', 9, 'listening'),
        ],
      },
    ],
  },
  N2: {
    total_questions: 106,
    sections: [
      {
        section_type: 'language_reading', title: '言語知識（文字・語彙・文法）・読解', time_limit_minutes: 105,
        groups: [
          g('kanji_reading', 5, 'language'),
          g('orthography', 5, 'language'),
          g('word_formation', 4, 'language'),
          g('context', 7, 'language'),
          g('paraphrase', 5, 'language'),
          g('usage', 5, 'language'),
          g('grammar_form', 12, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 5, 'reading'),
          g('reading_mid', 9, 'reading'),
          g('integrated_reading', 2, 'reading'),
          g('thematic_reading', 3, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        section_type: 'listening', title: '聴解', time_limit_minutes: 50,
        groups: [
          g('task_comprehension', 5, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 5, 'listening'),
          g('quick_response', 12, 'listening'),
          g('integrated_listening', 4, 'listening'),
        ],
      },
    ],
  },
  N1: {
    total_questions: 101,
    sections: [
      {
        section_type: 'language_reading', title: '言語知識（文字・語彙・文法）・読解', time_limit_minutes: 110,
        groups: [
          g('kanji_reading', 6, 'language'),
          g('context', 7, 'language'),
          g('paraphrase', 6, 'language'),
          g('usage', 6, 'language'),
          g('grammar_form', 10, 'language'),
          g('sentence_assembly', 5, 'language'),
          g('text_grammar', 5, 'language'),
          g('reading_short', 4, 'reading'),
          g('reading_mid', 9, 'reading'),
          g('reading_long', 4, 'reading'),
          g('integrated_reading', 3, 'reading'),
          g('thematic_reading', 4, 'reading'),
          g('info_retrieval', 2, 'reading'),
        ],
      },
      {
        // Format phần Nghe N1 từ 12/2022
        section_type: 'listening', title: '聴解', time_limit_minutes: 55,
        groups: [
          g('task_comprehension', 5, 'listening'),
          g('point_comprehension', 6, 'listening'),
          g('summary_comprehension', 5, 'listening'),
          g('quick_response', 11, 'listening'),
          g('integrated_listening', 3, 'listening'),
        ],
      },
    ],
  },
};

// ── Chấm điểm ────────────────────────────────────────────────────────────────
// questions: [{ id, correct_index, score_category }]
// answersMap: { [question_id]: selected_index }
// Trả về: { scores, total_score, passed, perQuestion }
//   scores = { [colKey]: { score, max, min, correct, total, passed } }
// Điểm cột = round(số đúng / tổng câu cột × max) — điểm ƯỚC LƯỢNG (JLPT thật
// dùng scaled score IRT, không tái tạo được). Đậu = tổng ≥ PASS_TOTAL[level]
// VÀ mọi cột ≥ điểm liệt.
function computeJlptScores(questions, answersMap, level) {
  const columns = SCORE_COLUMNS[level];
  if (!columns) throw new Error(`Cấp độ JLPT không hợp lệ: ${level}`);

  const stats = {};
  for (const col of columns) stats[col.key] = { correct: 0, total: 0 };
  const catToCol = {};
  for (const col of columns) for (const cat of col.cats) catToCol[cat] = col.key;

  const perQuestion = [];
  for (const q of questions) {
    const colKey = catToCol[q.score_category];
    const selected = answersMap[q.id];
    const isCorrect = selected !== undefined && selected !== null && Number(selected) === Number(q.correct_index);
    perQuestion.push({ question_id: q.id, selected_index: selected ?? null, is_correct: isCorrect });
    if (!colKey) continue; // score_category không khớp cấp độ — bỏ qua khỏi điểm
    stats[colKey].total += 1;
    if (isCorrect) stats[colKey].correct += 1;
  }

  const scores = {};
  let totalScore = 0;
  let allColumnsPassed = true;
  for (const col of columns) {
    const { correct, total } = stats[col.key];
    const score = total > 0 ? Math.round((correct / total) * col.max) : 0;
    // Cột không có câu (đề chưa hoàn chỉnh) không tính liệt — validate lúc publish đã chặn
    const colPassed = total > 0 ? score >= col.min : true;
    if (!colPassed) allColumnsPassed = false;
    scores[col.key] = { score, max: col.max, min: col.min, correct, total, passed: colPassed };
    totalScore += score;
  }

  const passed = allColumnsPassed && totalScore >= PASS_TOTAL[level];
  return { scores, total_score: totalScore, passed, perQuestion };
}

module.exports = { SCORE_COLUMNS, PASS_TOTAL, MONDAI_TYPES, BLUEPRINTS, computeJlptScores };
