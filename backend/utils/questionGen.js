'use strict';

// Shared JLPT question-generation logic, reused by both the admin global
// question bank and each teacher's private question bank.

const { chatCompletion } = require('../config/ai');

// JLPT level profiles: kanji range, vocabulary tier, grammar scope
const JLPT_PROFILES = {
  N5: {
    kanji: `~80 kanji cơ bản nhất. Ví dụ: 日月火水木金土山川田人口目耳手足力大小上下中前後右左東西南北語文字書読聞話食飲見来行出入白赤青長古新高安早本名年時分間国外方円万`,
    vocab: `~800 từ tần suất cao nhất. Chỉ dùng từ trong danh sách N5. Tránh hoàn toàn kanji/từ N4 trở lên.`,
    grammar: `は/が/を/に/で/と/も/へ/から/まで, ます/です形, ない形, て形 cơ bản, たい, い/な形容詞, から(原因), ので cơ bản, てください, ましょう`,
    distractor_tip: `Dùng từ N5 quen thuộc khác nhóm (đồ vật, địa điểm, thức ăn). Tránh kanji ngoài N5.`,
  },
  N4: {
    kanji: `~300 kanji (N5 + thêm N4). Ví dụ thêm N4: 友家会社国場道教考使始終立持待知思言開閉止買売明暗冷温急曲直広狭重軽強弱速遅近遠族達様`,
    vocab: `~1500 từ. Kết hợp tự nhiên kanji N4+N5. Có thể dùng する-verb cơ bản, compound nouns đơn giản.`,
    grammar: `て形 mở rộng, ている/てある, conditional (ば/たら/と/なら), passive/causative cơ bản, のに, という, など, ために, ように, てみる, てしまう`,
    distractor_tip: `Sai đáp án nên có đọc giống (どうぐ vs どうぞ) hoặc kanji hình dạng gần (待つ vs持つ). Tránh kanji ngoài N4.`,
  },
  N3: {
    kanji: `~650 kanji (N4+N5 + thêm N3). Ví dụ thêm N3: 族達様的全然最初末以上対同連絡確認各自現場担当実際様々`,
    vocab: `~3750 từ. Bao gồm kango (漢語) phổ biến, する-verb trung cấp, cụm từ cố định đơn giản.`,
    grammar: `passive/causative/potential đầy đủ, ようにする/ようになる, わけ, ばかり, だけ/しか～ない, ても, らしい/ようだ/そうだ phân biệt, てもいい/てはいけない, ために/ように phân biệt`,
    distractor_tip: `Sai đáp án tinh vi hơn: từ cùng nhóm nghĩa nhưng sắc thái khác (悲しい vs 寂しい vs 辛い). Cùng bộ thủ kanji.`,
  },
  N2: {
    kanji: `~1000 kanji (N3+N4+N5 + thêm N2). Ví dụ N2: 義務権利施設環境経済政治文化伝統技術情報設備組織運営管理効果影響判断承認補助`,
    vocab: `~6000 từ. Kango phức tạp, 4-mora compounds, formal/written register, thành ngữ phổ biến.`,
    grammar: `ながら, につれ/にともない, として, に対して, にもかかわらず, てからでないと, をもとに, という形で, に基づいて, をはじめ, に加えて, に際して`,
    distractor_tip: `Sai đáp án cùng cấu trúc ngữ pháp nhưng nghĩa khác (につれ vs にともない). Kanji có âm đọc gần giống. Từ Hán-Nhật dễ nhầm.`,
  },
  N1: {
    kanji: `~2000 kanji (tất cả N2 trở xuống + N1). Kanji hiếm, nhiều âm đọc. Ví dụ N1: 威厳哀愁懸念執念辛抱諮問勅令凌辱斡旋蹂躙逡巡忖度齟齬乖離`,
    vocab: `~10000 từ. Văn học, học thuật, ngôn ngữ chuyên ngành, 慣用句 (thành ngữ), 四字熟語 (tứ tự thành ngữ), lối văn trang trọng.`,
    grammar: `文語 elements, だに/すら/さえ phân biệt, てやまない, に即して, をよぎなくされる, ならでは, ないまでも, とあって, に照らして, をもって(手段/期限)`,
    distractor_tip: `Sai đáp án rất tinh vi: âm đọc khác nhau của cùng kanji, nghĩa gần trong văn học, 四字熟語 tương tự, sắc thái văn phong chính thức vs thông thường.`,
  },
};

const DIFFICULTY_GUIDE = {
  easy: {
    label: 'DỄ',
    vocab_rule: 'Chọn từ/kanji TẦN SUẤT CAO NHẤT trong cấp độ — những từ xuất hiện nhiều nhất trong đề JLPT và sách giáo khoa tiêu chuẩn.',
    question_rule: 'Câu hỏi trực tiếp, không bẫy. Cấu trúc ngữ pháp đơn giản nhất của cấp.',
    distractor_rule: 'Sai đáp án RÕ RÀNG khác biệt — khác nhóm từ loại, hoặc nghĩa hoàn toàn khác. Không dùng distractors gây nhầm lẫn tinh vi.',
  },
  medium: {
    label: 'TRUNG BÌNH',
    vocab_rule: 'Mix từ/kanji phổ biến và ít phổ biến hơn trong cấp độ — chuẩn theo đề thi JLPT thực tế.',
    question_rule: 'Câu hỏi kiểm tra hiểu nghĩa trong ngữ cảnh. Cấu trúc ngữ pháp trung bình của cấp.',
    distractor_rule: 'Sai đáp án gây nhầm lẫn TỰ NHIÊN — âm đọc tương tự, bộ thủ giống, hoặc nghĩa gần nhưng không đúng ngữ cảnh.',
  },
  hard: {
    label: 'KHÓ',
    vocab_rule: 'Chọn từ/kanji TẦN SUẤT THẤP, ít gặp nhất trong cấp — xuất hiện trong đề JLPT phần khó nhất.',
    question_rule: 'Kiểm tra sắc thái nghĩa, cách dùng trong văn cảnh phức tạp. Cấu trúc ngữ pháp phức tạp nhất của cấp.',
    distractor_rule: 'Sai đáp án RẤT TINH VI — cùng bộ thủ kanji, đọc gần giống, nghĩa gần tương đương nhưng khác sắc thái sử dụng.',
  },
};

/**
 * Generate JLPT questions from already-resolved content text.
 * Throws an Error with `.httpStatus` (and optional `.raw`) on AI/parse failures.
 * @returns {Promise<{ questions: object[], usage: object }>}
 */
async function generateQuestions({
  contentText,
  passageTitle = '',
  question_types = ['single_choice'],
  count = 5,
  level,
  difficulty = 'medium',
  topic,
  skill,
  passage_id = null,
}) {
  const jlpt = JLPT_PROFILES[level] || null;
  const diff = DIFFICULTY_GUIDE[difficulty] || DIFFICULTY_GUIDE.medium;
  const typeLabels = {
    single_choice:   'Chọn 1 đáp án (single_choice)',
    multiple_choice: 'Chọn nhiều đáp án (multiple_choice)',
    matching:        'Nối kết quả (matching)',
    ordering:        'Sắp xếp thứ tự (ordering)',
    fill_blank:      'Điền vào chỗ trống (fill_blank)',
    short_answer:    'Trả lời ngắn (short_answer)',
  };

  const jlptBlock = jlpt
    ? `\n═══ YÊU CẦU JLPT ${level} ═══
• Kanji được phép dùng: ${jlpt.kanji}
• Từ vựng: ${jlpt.vocab}
• Ngữ pháp: ${jlpt.grammar}
• Gợi ý distractor: ${jlpt.distractor_tip}
⚠️  TUYỆT ĐỐI KHÔNG dùng kanji hoặc từ vựng ngoài phạm vi JLPT ${level}.`
    : '';

  const diffBlock = `\n═══ ĐỘ KHÓ: ${diff.label} ═══
• Từ vựng/kanji: ${diff.vocab_rule}
• Câu hỏi: ${diff.question_rule}
• Distractors (đáp án sai): ${diff.distractor_rule}`;

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT tiếng Nhật. Bạn am hiểu sâu về kanji, từ vựng và ngữ pháp theo từng cấp độ JLPT N5→N1.

BẮT BUỘC: Chỉ trả về một mảng JSON hợp lệ [], KHÔNG có văn bản nào khác ngoài JSON.
${jlptBlock}${diffBlock}

═══ SCHEMA JSON CHO TỪNG LOẠI ═══

1. single_choice — Chọn 1 đáp án:
{"question_type":"single_choice","question_text":"___に入る言葉を選んでください。\\n彼女は毎朝___を飲みます。","options":["コーヒー","シャワー","ニュース","テレビ"],"correct_answer":"コーヒー","explanation":"「飲む」は液体に使う動詞。正解はコーヒーのみ液体。"}
• options: đúng 4 phần tử; correct_answer: chính xác bằng 1 option; distractors áp dụng quy tắc độ khó

2. multiple_choice — Chọn nhiều đáp án đúng:
{"question_type":"multiple_choice","question_text":"正しい文をすべて選んでください。","options":["A文","B文","C文","D文"],"correct_answer":["A文","C文"],"explanation":"..."}
• correct_answer: mảng ≥2 options đúng

3. matching — Nối từ với nghĩa:
{"question_type":"matching","question_text":"言葉と意味を正しく結んでください。","options":[{"left":"猫","right":"con mèo"},{"left":"犬","right":"con chó"},{"left":"魚","right":"cá"},{"left":"鳥","right":"con chim"}],"correct_answer":null,"explanation":"..."}
• options: ≥3 cặp {left, right}; tất cả left/right phải THUỘC cấp JLPT yêu cầu

4. ordering — Sắp xếp thứ tự:
{"question_type":"ordering","question_text":"正しい順番に並び替えてください。","options":["公園で","私は","遊びます","友達と"],"correct_answer":["私は","友達と","公園で","遊びます"],"explanation":"語順：主語→目的語/相手→場所→動詞。"}
• options: thứ tự NGẪU NHIÊN (học sinh phải tìm thứ tự đúng)
• correct_answer: thứ tự ĐÚNG của câu/đoạn
• options và correct_answer chứa CÙNG các phần tử, chỉ khác thứ tự

5. fill_blank — Điền vào chỗ trống:
{"question_type":"fill_blank","question_text":"彼は毎日図書館で勉強___います。","options":[],"correct_answer":"して","explanation":"「勉強する」のて形「勉強して」+いる で継続を表す。"}
• question_text: dấu ___ đánh dấu chỗ trống; blank phải kiểm tra điểm ngữ pháp/từ vựng của cấp JLPT

6. short_answer — Trả lời ngắn:
{"question_type":"short_answer","question_text":"「ありがとうございます」のくだけた言い方は何ですか？","options":[],"correct_answer":"ありがとう","explanation":"「ありがとう」は友達や親しい間柄で使うカジュアルな表現。"}
• correct_answer: câu trả lời mẫu ngắn gọn, đúng cấp JLPT`;

  const userMsg = `Tạo ${count} câu hỏi${passageTitle ? ` dựa trên bài đọc "${passageTitle}"` : ''}.
■ Trình độ JLPT: ${level || '(không giới hạn)'} → Chỉ dùng kanji/từ vựng trong phạm vi ${level || 'phù hợp'}
■ Độ khó: ${diff.label} → Áp dụng đúng quy tắc đã nêu
■ Loại câu hỏi (phân bổ đều): ${question_types.map(t => typeLabels[t] || t).join(', ')}${topic ? '\n■ Chủ đề: ' + topic : ''}${skill ? '\n■ Kỹ năng kiểm tra: ' + skill : ''}

NỘI DUNG ĐỂ RA ĐỀ:
${contentText.slice(0, 4000)}

Trả về ĐÚNG mảng JSON ${count} phần tử. KHÔNG thêm text nào khác.`;

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    { max_tokens: 4096, temperature: 0.45 }
  );

  const raw = result.choices?.[0]?.message?.content || '';

  // Try to extract JSON array, handle markdown fences
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    const e = new Error('AI không trả về JSON hợp lệ.');
    e.httpStatus = 502; e.raw = raw.slice(0, 500);
    throw e;
  }

  let questions;
  try { questions = JSON.parse(match[0]); }
  catch {
    const e = new Error('Không thể parse JSON từ AI.');
    e.httpStatus = 502; e.raw = raw.slice(0, 300);
    throw e;
  }

  if (!Array.isArray(questions)) {
    const e = new Error('AI trả về định dạng không mong đợi.');
    e.httpStatus = 502;
    throw e;
  }

  const enriched = questions
    .filter(q => q.question_text && q.question_type)
    .map(q => ({
      ...q,
      level:           level      || null,
      difficulty:      difficulty || 'medium',
      topic:           topic      || null,
      skill:           skill      || null,
      passage_id:      passage_id || null,
      status:          'approved',
      is_ai_generated: true,
    }));

  return { questions: enriched, usage: result.usage };
}

/**
 * Sinh nháp câu hỏi cho MỘT mondai của đề thi thử JLPT (mock test).
 * Chỉ trả nháp để admin duyệt/sửa — KHÔNG ghi DB.
 * Throws Error với `.httpStatus` khi AI/parse lỗi.
 * @returns {Promise<{ questions: object[], skipped: number, passage_text: string|null, usage: object }>}
 */
async function generateMondaiQuestions({ level, mondaiType, count = 5, passageText = '', topic = '' }) {
  // require tại chỗ để tránh vòng require nếu sau này jlptMock cần module này
  const { MONDAI_TYPES } = require('./jlptMock');
  const meta = MONDAI_TYPES[mondaiType];
  if (!meta) { const e = new Error('Loại mondai không hợp lệ.'); e.httpStatus = 400; throw e; }

  const jlpt = JLPT_PROFILES[level] || null;
  const optCount = meta.options_count || 4;
  const isListening = meta.category === 'listening';
  const needsPassage = ['text_grammar', 'reading_short', 'reading_mid', 'reading_long',
    'integrated_reading', 'thematic_reading', 'info_retrieval'].includes(mondaiType);

  const jlptBlock = jlpt
    ? `\n═══ YÊU CẦU JLPT ${level} ═══
• Kanji được phép dùng: ${jlpt.kanji}
• Từ vựng: ${jlpt.vocab}
• Ngữ pháp: ${jlpt.grammar}
• Gợi ý distractor: ${jlpt.distractor_tip}
⚠️  TUYỆT ĐỐI KHÔNG dùng kanji hoặc từ vựng ngoài phạm vi JLPT ${level}.`
    : '';

  const passageRule = needsPassage
    ? (passageText
      ? `\nBài đọc đã có sẵn (bên dưới) — TẤT CẢ câu hỏi phải dựa trên bài đọc này, KHÔNG sinh passage mới:\n${passageText.slice(0, 4000)}`
      : `\nMondai này cần bài đọc: hãy sinh MỘT đoạn văn duy nhất đúng độ dài/độ khó của dạng bài và cấp ${level}, đặt vào trường "passage_text"; mọi câu hỏi đều dựa trên đoạn văn đó.`)
    : '';

  const listeningRule = isListening
    ? `\nĐây là câu hỏi NGHE: với mỗi câu, sinh thêm trường "audio_transcript" là script hội thoại/độc thoại tiếng Nhật hoàn chỉnh (kèm câu hỏi đọc trong audio) để admin thu âm.${meta.no_question_text ? ' Dạng bài này KHÔNG in câu hỏi trên giấy — "question_text" để null.' : ''}`
    : '';

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT chính thức. Bạn nắm rõ format từng 大問 (mondai) của đề thi thật.

BẮT BUỘC: Chỉ trả về MỘT object JSON hợp lệ, KHÔNG có văn bản nào khác.
${jlptBlock}

═══ DẠNG BÀI: 問題「${meta.ja}」 ═══
• Mô tả dạng bài: ${meta.ai_hint}
• Chỉ dẫn chuẩn in trên đề: ${meta.instruction}
• Số lựa chọn: ĐÚNG ${optCount} lựa chọn mỗi câu.${passageRule}${listeningRule}

═══ SCHEMA JSON ═══
{"passage_text": ${needsPassage && !passageText ? '"đoạn văn dùng chung"' : 'null'}, "questions": [{"question_text": "..." hoặc null, "options": [${optCount} chuỗi], "correct_index": số 0-${optCount - 1}, "explanation": "giải thích tiếng Việt ngắn gọn vì sao đáp án đúng"${isListening ? ', "audio_transcript": "script tiếng Nhật"' : ''}}]}`;

  const userMsg = `Tạo ${count} câu hỏi dạng 「${meta.ja}」 cấp độ JLPT ${level}.${topic ? `\nChủ đề: ${topic}` : ''}
Trả về ĐÚNG object JSON theo schema, "questions" có ${count} phần tử.`;

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    { max_tokens: 4096, temperature: 0.45 }
  );

  const raw = result.choices?.[0]?.message?.content || '';
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    const e = new Error('AI không trả về JSON hợp lệ.');
    e.httpStatus = 502; e.raw = raw.slice(0, 500);
    throw e;
  }

  let parsed;
  try { parsed = JSON.parse(match[0]); }
  catch {
    const e = new Error('Không thể parse JSON từ AI.');
    e.httpStatus = 502; e.raw = raw.slice(0, 300);
    throw e;
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = [];
  let skipped = 0;
  for (const q of rawQuestions) {
    const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()).filter(Boolean) : [];
    const ci = Number(q.correct_index);
    if (options.length !== optCount || !Number.isInteger(ci) || ci < 0 || ci >= options.length) { skipped++; continue; }
    questions.push({
      question_text:    q.question_text ? String(q.question_text).trim() : null,
      options,
      correct_index:    ci,
      explanation:      q.explanation || null,
      audio_transcript: isListening ? (q.audio_transcript || null) : undefined,
    });
  }
  if (!questions.length) {
    const e = new Error('AI không sinh được câu hỏi hợp lệ nào, hãy thử lại.');
    e.httpStatus = 502;
    throw e;
  }

  return {
    questions,
    skipped,
    passage_text: (needsPassage && !passageText && parsed.passage_text) ? String(parsed.passage_text) : null,
    usage: result.usage,
  };
}

module.exports = { generateQuestions, generateMondaiQuestions, JLPT_PROFILES, DIFFICULTY_GUIDE };