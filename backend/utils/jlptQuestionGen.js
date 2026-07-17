'use strict';

// Sinh câu hỏi bằng AI cho đề thi thử JLPT (mock test) — tách riêng khỏi
// questionGen.js (bank khóa học). Dùng chung JLPT_PROFILES + stripHtmlMarkup.

const { chatCompletion } = require('../config/ai');
const { JLPT_PROFILES, stripHtmlMarkup } = require('./questionGen');

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

// Các dạng bài cần passage dùng chung.
const PASSAGE_TYPES = ['text_grammar', 'reading_short', 'reading_mid', 'reading_long',
  'integrated_reading', 'thematic_reading', 'info_retrieval'];

function getMondaiMeta(mondaiType) {
  // require tại chỗ để tránh vòng require nếu sau này jlptMock cần module này
  const { MONDAI_TYPES } = require('./jlptMock');
  const meta = MONDAI_TYPES[mondaiType];
  if (!meta) { const e = new Error('Loại mondai không hợp lệ.'); e.httpStatus = 400; throw e; }
  return meta;
}

// Khối "YÊU CẦU JLPT <level>" dùng chung cho mọi prompt mock.
function jlptLevelBlock(level) {
  const jlpt = JLPT_PROFILES[level] || null;
  return jlpt
    ? `\n═══ YÊU CẦU JLPT ${level} ═══
• Kanji được phép dùng: ${jlpt.kanji}
• Từ vựng: ${jlpt.vocab}
• Ngữ pháp: ${jlpt.grammar}
• Gợi ý distractor: ${jlpt.distractor_tip}
⚠️  TUYỆT ĐỐI KHÔNG dùng kanji hoặc từ vựng ngoài phạm vi JLPT ${level}.`
    : '';
}

// Khối chống trùng lặp: liệt kê câu đã có, cấm AI hỏi lại.
function existingQuestionsBlock(existingQuestions) {
  const list = (existingQuestions || []).map(s => String(s).trim()).filter(Boolean);
  if (!list.length) return '';
  let joined = list.map(s => `- ${s}`).join('\n');
  if (joined.length > 3000) joined = joined.slice(0, 3000) + '\n- …';
  return `\n═══ CÂU ĐÃ CÓ TRONG ĐỀ — CẤM TRÙNG LẶP ═══
${joined}
⚠️  TUYỆT ĐỐI KHÔNG hỏi lại từ vựng/kanji/mẫu ngữ pháp đã xuất hiện trong danh sách trên (kể cả đảo vị trí đáp án hay đổi câu ví dụ). Phải chọn từ/kanji/mẫu câu KHÁC HẲN và đa dạng chủ đề (đời sống, công việc, học tập, du lịch, thiên nhiên…).`;
}

function listeningRuleBlock(meta, level, mondaiType) {
  if (meta.category !== 'listening') return '';
  return `\nĐây là câu hỏi NGHE: với mỗi câu, sinh thêm trường "audio_transcript" là script tiếng Nhật hoàn chỉnh để thu âm/đọc bằng máy.
• TRÌNH TỰ SCRIPT: ${MOCK_TRANSCRIPT_FORMATS[mondaiType] || 'Đọc câu hỏi trước, rồi nội dung, rồi lặp lại câu hỏi ở cuối.'}
• ĐỊNH DẠNG BẮT BUỘC: mỗi lượt thoại một dòng, mở đầu bằng nhãn người nói 「男：」(nam) hoặc 「女：」(nữ) — nếu có 2 người cùng giới thì dùng 「男１：」「男２：」. Dòng câu hỏi và các dòng đánh số lựa chọn KHÔNG có nhãn.
• ĐỘ DÀI hội thoại/độc thoại: khoảng ${MOCK_TRANSCRIPT_LENGTHS[level] || '100–200'} chữ.${meta.no_question_text ? '\n• Dạng bài này KHÔNG in câu hỏi trên giấy — "question_text" để null.' : ''}`;
}

// Bản dịch tiếng Việt hiện ở màn xem đáp án của học viên (không hiện lúc thi).
// Tách 2 trường: translation_vi = dịch câu hỏi/script; option_translations = dịch từng lựa chọn.
function translationRuleBlock(isListening, optCount) {
  return `\nMỗi câu phải có trường "translation_vi": bản dịch tiếng Việt tự nhiên của ${
    isListening ? 'nội dung audio (tóm tắt script) + câu hỏi' : 'câu hỏi'
  } — KHÔNG kèm bản dịch các lựa chọn ở đây.
Mỗi câu phải có thêm trường "option_translations": mảng ĐÚNG ${optCount} chuỗi, là bản dịch tiếng Việt của từng lựa chọn theo đúng thứ tự.`;
}

function questionSchemaBlock(meta, { withPassage }) {
  const optCount = meta.options_count || 4;
  const isListening = meta.category === 'listening';
  return `{"passage_text": ${withPassage ? '"đoạn văn dùng chung"' : 'null'}, "questions": [{"question_text": "..." hoặc null, "options": [${optCount} chuỗi], "correct_index": số 0-${optCount - 1}, "explanation": "giải thích tiếng Việt ngắn gọn vì sao đáp án đúng", "translation_vi": "bản dịch tiếng Việt của ${isListening ? 'tóm tắt script + câu hỏi' : 'câu hỏi'}", "option_translations": [${optCount} chuỗi dịch tiếng Việt của từng lựa chọn]${isListening ? ', "audio_transcript": "script tiếng Nhật"' : ''}}]}`;
}

// Gọi AI → parse object JSON {passage_text?, questions[]} → validate/sanitize từng câu.
async function callAndParse(SYSTEM, userMsg, meta) {
  const optCount = meta.options_count || 4;
  const isListening = meta.category === 'listening';

  const result = await chatCompletion(
    [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
    // payload lớn hơn vì kèm bản dịch (nhất là đọc hiểu dài);
    // temperature cao hơn bank khóa học để tăng đa dạng, giảm trùng lặp.
    // Model riêng cho sinh đề JLPT (FPT_AI_JLPT_MODEL) — KHÔNG đổi FPT_AI_MODEL toàn cục
    // vì AI Sensei chat cần model đọc được ảnh (gemma); sinh đề thuần text nên
    // dùng được model mạnh hơn (vd gpt-oss-120b). Không set → rơi về FPT_AI_MODEL.
    { max_tokens: 8192, temperature: 0.7, model: process.env.FPT_AI_JLPT_MODEL || undefined }
  );
  // Log model thực tế phục vụ request — để biết chắc env FPT_AI_JLPT_MODEL đã được nạp
  console.log('[JLPT-AI] model:', result.model || process.env.FPT_AI_JLPT_MODEL || process.env.FPT_AI_MODEL || '(mặc định)');

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
    // Bản dịch lựa chọn: chỉ nhận khi đủ đúng số phần tử (lệch → null, admin tự bổ sung)
    const optTrans = Array.isArray(q.option_translations) && q.option_translations.length === options.length
      ? q.option_translations.map(t => stripHtmlMarkup(String(t).trim()))
      : null;
    questions.push({
      question_text:    q.question_text ? stripHtmlMarkup(String(q.question_text).trim()) : null,
      options,
      correct_index:    ci,
      explanation:      q.explanation ? stripHtmlMarkup(q.explanation) : null,
      translation_vi:   q.translation_vi ? stripHtmlMarkup(String(q.translation_vi).trim()) : null,
      option_translations: optTrans,
      audio_transcript: isListening ? (q.audio_transcript ? stripHtmlMarkup(q.audio_transcript) : null) : undefined,
    });
  }
  return { parsed, questions, skipped, usage: result.usage };
}

/**
 * Sinh nháp câu hỏi cho MỘT mondai của đề thi thử JLPT (mock test).
 * Chỉ trả nháp để admin duyệt/sửa — KHÔNG ghi DB.
 * `existingQuestions`: mảng chuỗi mô tả câu đã có trong CẢ ĐỀ (chống trùng lặp).
 * `instruction`: yêu cầu thêm của admin (tự do), chèn vào user prompt.
 * Throws Error với `.httpStatus` khi AI/parse lỗi.
 * @returns {Promise<{ questions: object[], skipped: number, passage_text: string|null, usage: object }>}
 */
async function generateMondaiQuestions({ level, mondaiType, count = 5, passageText = '', topic = '',
  instruction = '', existingQuestions = [] }) {
  const meta = getMondaiMeta(mondaiType);
  const optCount = meta.options_count || 4;
  const isListening = meta.category === 'listening';
  const needsPassage = PASSAGE_TYPES.includes(mondaiType);

  const passageChars = MOCK_PASSAGE_LENGTHS[mondaiType]?.[level] || null;
  const passageRule = needsPassage
    ? (passageText
      ? `\nBài đọc đã có sẵn (bên dưới) — TẤT CẢ câu hỏi phải dựa trên bài đọc này, KHÔNG sinh passage mới:\n${passageText.slice(0, 4000)}`
      : `\nMondai này cần bài đọc: hãy sinh MỘT đoạn văn duy nhất đặt vào trường "passage_text"; mọi câu hỏi đều dựa trên đoạn văn đó.${
        passageChars ? `\n• ĐỘ DÀI BẮT BUỘC: khoảng ${passageChars} chữ tiếng Nhật (cho phép lệch ±20%). Không viết ngắn hơn — đề JLPT ${level} dạng này luôn dài cỡ đó.` : ''
      }`)
    : '';

  const exampleRule = meta.example
    ? `\n\n═══ VÍ DỤ MẪU 1 CÂU ĐÚNG FORMAT (bám sát cấu trúc này, KHÔNG chép lại nội dung) ═══\n${meta.example}`
    : '';

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT chính thức. Bạn nắm rõ format từng 大問 (mondai) của đề thi thật.

BẮT BUỘC: Chỉ trả về MỘT object JSON hợp lệ, KHÔNG có văn bản nào khác.
Độ khó phải ở mức TRUNG BÌNH của đề thi JLPT ${level} thật — không lấy từ/ngữ pháp dễ nhất cấp, cũng không vượt cấp.
${jlptLevelBlock(level)}${existingQuestionsBlock(existingQuestions)}

═══ DẠNG BÀI: 問題「${meta.ja}」 ═══
• Mô tả dạng bài: ${meta.ai_hint}
• Chỉ dẫn chuẩn in trên đề: ${meta.instruction}
• Số lựa chọn: ĐÚNG ${optCount} lựa chọn mỗi câu.
• Khi cần đánh dấu từ trong câu, bọc từ đó trong dấu gạch dưới full-width ＿ ＿ (ví dụ: きのう＿光る＿星を見た). TUYỆT ĐỐI KHÔNG dùng thẻ HTML như <u>, <b>, <i>.${passageRule}${listeningRuleBlock(meta, level, mondaiType)}${translationRuleBlock(isListening, optCount)}

═══ SCHEMA JSON ═══
${questionSchemaBlock(meta, { withPassage: needsPassage && !passageText })}${exampleRule}`;

  const userMsg = `Tạo ${count} câu hỏi dạng 「${meta.ja}」 cấp độ JLPT ${level}.${topic ? `\nChủ đề: ${topic}` : ''}${
    instruction ? `\nYÊU CẦU THÊM CỦA NGƯỜI SOẠN ĐỀ (phải tuân thủ): ${String(instruction).slice(0, 1000)}` : ''}
Trả về ĐÚNG object JSON theo schema, "questions" có ${count} phần tử.`;

  const { parsed, questions, skipped, usage } = await callAndParse(SYSTEM, userMsg, meta);
  if (!questions.length) {
    const e = new Error('AI không sinh được câu hỏi hợp lệ nào, hãy thử lại.');
    e.httpStatus = 502;
    throw e;
  }

  return {
    questions,
    skipped,
    passage_text: (needsPassage && !passageText && parsed.passage_text) ? stripHtmlMarkup(String(parsed.passage_text)) : null,
    usage,
  };
}

/**
 * Sinh lại ĐÚNG MỘT câu theo yêu cầu của admin (nháp bị chê).
 * `currentQuestion`: object câu hiện tại (question_text/options/correct_index/…).
 * `siblingQuestions`: mảng chuỗi mô tả các câu khác trong mondai/đề — cấm trùng.
 * @returns {Promise<{ question: object, usage: object }>}
 */
async function regenerateOneQuestion({ level, mondaiType, instruction = '', currentQuestion,
  siblingQuestions = [], passageText = '' }) {
  const meta = getMondaiMeta(mondaiType);
  const optCount = meta.options_count || 4;
  const isListening = meta.category === 'listening';
  const needsPassage = PASSAGE_TYPES.includes(mondaiType);

  const passageRule = (needsPassage && passageText)
    ? `\nBài đọc dùng chung (câu mới PHẢI dựa trên bài đọc này, KHÔNG sinh passage mới):\n${passageText.slice(0, 4000)}`
    : '';

  const SYSTEM = `Bạn là chuyên gia biên soạn đề thi JLPT chính thức. Bạn nắm rõ format từng 大問 (mondai) của đề thi thật.

BẮT BUỘC: Chỉ trả về MỘT object JSON hợp lệ, KHÔNG có văn bản nào khác.
Độ khó phải ở mức TRUNG BÌNH của đề thi JLPT ${level} thật — không lấy từ/ngữ pháp dễ nhất cấp, cũng không vượt cấp.
${jlptLevelBlock(level)}${existingQuestionsBlock(siblingQuestions)}

═══ DẠNG BÀI: 問題「${meta.ja}」 ═══
• Mô tả dạng bài: ${meta.ai_hint}
• Số lựa chọn: ĐÚNG ${optCount} lựa chọn mỗi câu.
• Khi cần đánh dấu từ trong câu, bọc từ đó trong dấu gạch dưới full-width ＿ ＿. TUYỆT ĐỐI KHÔNG dùng thẻ HTML như <u>, <b>, <i>.${passageRule}${listeningRuleBlock(meta, level, mondaiType)}${translationRuleBlock(isListening, optCount)}

═══ SCHEMA JSON ═══
${questionSchemaBlock(meta, { withPassage: false })}
"questions" phải có ĐÚNG 1 phần tử.`;

  const userMsg = `Câu nháp hiện tại dạng 「${meta.ja}」 cấp JLPT ${level} cần được SINH LẠI:
${JSON.stringify(currentQuestion || {}, null, 0).slice(0, 2000)}

${instruction
    ? `YÊU CẦU CỦA NGƯỜI SOẠN ĐỀ (phải tuân thủ khi sinh lại): ${String(instruction).slice(0, 1000)}`
    : 'Hãy sinh một câu KHÁC HẲN cùng dạng bài (từ vựng/mẫu câu khác, không lặp lại câu trên).'}

Trả về ĐÚNG object JSON theo schema với "questions" gồm đúng 1 câu.`;

  const { questions, usage } = await callAndParse(SYSTEM, userMsg, meta);
  if (!questions.length) {
    const e = new Error('AI không sinh được câu hợp lệ, hãy thử lại.');
    e.httpStatus = 502;
    throw e;
  }
  return { question: questions[0], usage };
}

module.exports = {
  generateMondaiQuestions,
  regenerateOneQuestion,
  MOCK_PASSAGE_LENGTHS,
  MOCK_TRANSCRIPT_LENGTHS,
  MOCK_TRANSCRIPT_FORMATS,
};
