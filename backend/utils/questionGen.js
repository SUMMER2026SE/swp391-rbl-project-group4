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

// Model đôi khi trả thẻ HTML (<u>…</u>) để đánh dấu từ — FE render text thô
// nên phải chuyển về dạng ＿…＿ và loại bỏ mọi thẻ còn sót.
function stripHtmlMarkup(str) {
  if (str == null) return str;
  return String(str)
    .replace(/<u>([\s\S]*?)<\/u>/gi, '＿$1＿')
    .replace(/<\/?[a-z][^>]*>/gi, '');
}

// ── Chuẩn hóa prompt cho đề thi thử (mock) ───────────────────────────────────
// Độ dài bài đọc (số chữ tiếng Nhật) theo dạng bài × cấp — bám đề JLPT thật.
// Dạng bài không có ở một cấp thì không cần key (blueprint không sinh ra).
const MOCK_PASSAGE_LENGTHS = {
  text_grammar:       { N5: 150, N4: 200, N3: 350, N2: 450, N1: 500 },
  reading_short:      { N5: 80,  N4: 120, N3: 180, N2: 200, N1: 220 },
  reading_mid:        { N5: 180, N4: 250, N3: 350, N2: 500, N1: 500 },
  reading_long:       { N5: 300, N4: 400, N3: 550, N2: 700, N1: 1000 },
  integrated_reading: { N2: 600, N1: 600 },
  thematic_reading:   { N2: 900, N1: 1000 },
  info_retrieval:     { N5: 200, N4: 300, N3: 400, N2: 600, N1: 600 },
};

// Độ dài script hội thoại/độc thoại (số chữ) theo cấp.
const MOCK_TRANSCRIPT_LENGTHS = { N5: '40–80', N4: '80–130', N3: '130–220', N2: '220–350', N1: '300–500' };

// Trình tự script riêng của từng dạng nghe (đề thật đọc gì trước/sau).
const MOCK_TRANSCRIPT_FORMATS = {
  task_comprehension:    'Đọc câu hỏi TRƯỚC hội thoại, rồi hội thoại, rồi LẶP LẠI đúng câu hỏi đó ở cuối.',
  point_comprehension:   'Đọc câu hỏi TRƯỚC hội thoại (thí sinh có thời gian đọc lựa chọn in trên giấy), rồi hội thoại, rồi LẶP LẠI câu hỏi ở cuối.',
  summary_comprehension: 'KHÔNG có câu hỏi trước. Độc thoại/hội thoại trước, sau đó mới đọc câu hỏi rồi đọc lần lượt cả 4 lựa chọn (đánh số １　２　３　４ mỗi lựa chọn một dòng) — lựa chọn KHÔNG in trên giấy.',
  utterance_expression:  'Một câu mô tả tình huống (khớp với tranh) + câu hỏi 「何と言いますか」, rồi đọc 3 lựa chọn (１　２　３ mỗi lựa chọn một dòng).',
  quick_response:        'Một câu mở lời ngắn của người nói thứ nhất, rồi 3 câu đáp của người nói thứ hai (１　２　３ mỗi câu một dòng). Không có câu hỏi.',
  integrated_listening:  'Hội thoại/độc thoại dài (thường 2–3 người hoặc phần giới thiệu + trao đổi), câu hỏi chỉ đọc Ở CUỐI.',
};

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

  const passageChars = MOCK_PASSAGE_LENGTHS[mondaiType]?.[level] || null;
  const passageRule = needsPassage
    ? (passageText
      ? `\nBài đọc đã có sẵn (bên dưới) — TẤT CẢ câu hỏi phải dựa trên bài đọc này, KHÔNG sinh passage mới:\n${passageText.slice(0, 4000)}`
      : `\nMondai này cần bài đọc: hãy sinh MỘT đoạn văn duy nhất đặt vào trường "passage_text"; mọi câu hỏi đều dựa trên đoạn văn đó.${
        passageChars ? `\n• ĐỘ DÀI BẮT BUỘC: khoảng ${passageChars} chữ tiếng Nhật (cho phép lệch ±20%). Không viết ngắn hơn — đề JLPT ${level} dạng này luôn dài cỡ đó.` : ''
      }`)
    : '';

  const listeningRule = isListening
    ? `\nĐây là câu hỏi NGHE: với mỗi câu, sinh thêm trường "audio_transcript" là script tiếng Nhật hoàn chỉnh để thu âm/đọc bằng máy.
• TRÌNH TỰ SCRIPT: ${MOCK_TRANSCRIPT_FORMATS[mondaiType] || 'Đọc câu hỏi trước, rồi nội dung, rồi lặp lại câu hỏi ở cuối.'}
• ĐỊNH DẠNG BẮT BUỘC: mỗi lượt thoại một dòng, mở đầu bằng nhãn người nói 「男：」(nam) hoặc 「女：」(nữ) — nếu có 2 người cùng giới thì dùng 「男１：」「男２：」. Dòng câu hỏi và các dòng đánh số lựa chọn KHÔNG có nhãn.
• ĐỘ DÀI hội thoại/độc thoại: khoảng ${MOCK_TRANSCRIPT_LENGTHS[level] || '100–200'} chữ.${meta.no_question_text ? '\n• Dạng bài này KHÔNG in câu hỏi trên giấy — "question_text" để null.' : ''}`
    : '';

  const exampleRule = meta.example
    ? `\n\n═══ VÍ DỤ MẪU 1 CÂU ĐÚNG FORMAT (bám sát cấu trúc này, KHÔNG chép lại nội dung) ═══\n${meta.example}`
    : '';

  // Bản dịch tiếng Việt hiện ở màn xem đáp án của học viên (không hiện lúc thi).
  const translationRule = `\nMỗi câu phải có trường "translation_vi": bản dịch tiếng Việt tự nhiên của ${
    isListening ? 'nội dung audio (tóm tắt script) + câu hỏi' : 'câu hỏi'
  } và cả ${optCount} lựa chọn (đánh số 1–${optCount}, mỗi lựa chọn một dòng).`;

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT chính thức. Bạn nắm rõ format từng 大問 (mondai) của đề thi thật.

BẮT BUỘC: Chỉ trả về MỘT object JSON hợp lệ, KHÔNG có văn bản nào khác.
Độ khó phải ở mức TRUNG BÌNH của đề thi JLPT ${level} thật — không lấy từ/ngữ pháp dễ nhất cấp, cũng không vượt cấp.
${jlptBlock}

═══ DẠNG BÀI: 問題「${meta.ja}」 ═══
• Mô tả dạng bài: ${meta.ai_hint}
• Chỉ dẫn chuẩn in trên đề: ${meta.instruction}
• Số lựa chọn: ĐÚNG ${optCount} lựa chọn mỗi câu.
• Khi cần đánh dấu từ trong câu, bọc từ đó trong dấu gạch dưới full-width ＿ ＿ (ví dụ: きのう＿光る＿星を見た). TUYỆT ĐỐI KHÔNG dùng thẻ HTML như <u>, <b>, <i>.${passageRule}${listeningRule}${translationRule}

═══ SCHEMA JSON ═══
{"passage_text": ${needsPassage && !passageText ? '"đoạn văn dùng chung"' : 'null'}, "questions": [{"question_text": "..." hoặc null, "options": [${optCount} chuỗi], "correct_index": số 0-${optCount - 1}, "explanation": "giải thích tiếng Việt ngắn gọn vì sao đáp án đúng", "translation_vi": "bản dịch tiếng Việt của câu hỏi và các lựa chọn"${isListening ? ', "audio_transcript": "script tiếng Nhật"' : ''}}]}${exampleRule}`;

  const userMsg = `Tạo ${count} câu hỏi dạng 「${meta.ja}」 cấp độ JLPT ${level}.${topic ? `\nChủ đề: ${topic}` : ''}
Trả về ĐÚNG object JSON theo schema, "questions" có ${count} phần tử.`;

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    // payload lớn hơn vì kèm bản dịch (nhất là đọc hiểu dài)
    { max_tokens: 8192, temperature: 0.45 }
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
    const options = Array.isArray(q.options) ? q.options.map(o => stripHtmlMarkup(String(o).trim())).filter(Boolean) : [];
    const ci = Number(q.correct_index);
    if (options.length !== optCount || !Number.isInteger(ci) || ci < 0 || ci >= options.length) { skipped++; continue; }
    questions.push({
      question_text:    q.question_text ? stripHtmlMarkup(String(q.question_text).trim()) : null,
      options,
      correct_index:    ci,
      explanation:      q.explanation ? stripHtmlMarkup(q.explanation) : null,
      translation_vi:   q.translation_vi ? stripHtmlMarkup(String(q.translation_vi).trim()) : null,
      audio_transcript: isListening ? (q.audio_transcript ? stripHtmlMarkup(q.audio_transcript) : null) : undefined,
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
    passage_text: (needsPassage && !passageText && parsed.passage_text) ? stripHtmlMarkup(String(parsed.passage_text)) : null,
    usage: result.usage,
  };
}

module.exports = { generateQuestions, generateMondaiQuestions, JLPT_PROFILES, DIFFICULTY_GUIDE };