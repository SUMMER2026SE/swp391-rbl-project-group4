'use strict';

// ─── Sinh bài kiểm tra flashcard bằng AI (LLM) ───────────────────────────────
// Nhận danh sách thẻ (term/definition) + cấu hình (số câu, loại câu) → gọi
// chatCompletion sinh câu hỏi kiểu JLPT, VALIDATE bằng code (chống lộ đáp án,
// distractor hợp lệ), server TỰ TRỘN đáp án rồi trả mảng câu hỏi chuẩn.
// Nguyên tắc: không tin format LLM — mọi câu không đạt sẽ bị loại; đáp án đúng
// của loại "chọn từ" luôn ép = term (không nhờ LLM), server shuffle chống bias.

const { chatCompletion } = require('../config/ai');

const ALL_TYPES   = ['mcq_meaning', 'mcq_reading', 'mcq_kanji', 'fill_blank', 'written'];
const KANJI_TYPES = new Set(['mcq_reading', 'mcq_kanji']); // chỉ áp cho thẻ có kanji
const BLANK       = '（　）';                                 // ký hiệu chỗ trống hiển thị thống nhất

// ── Helper nhận diện chữ Nhật ──
const hasKanji    = (s) => /[一-鿿㐀-䶿]/.test(s || '');
const hasJapanese = (s) => /[぀-ヿ一-鿿㐀-䶿ｦ-ﾟ]/.test(s || '');
const isKanaOnly  = (s) => /^[぀-ヿー\s]+$/.test((s || '').trim()) && (s || '').trim().length > 0;

const normalize = (s) => (s || '').trim().toLowerCase();

// ── Trộn ngẫu nhiên (Fisher–Yates) ──
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Bù distractor từ pool (các term khác) cho đủ n, tránh trùng đáp án đúng ──
function pad(existing, correct, pool, n = 3) {
  const out  = existing.slice();
  const seen = new Set([normalize(correct), ...out.map(normalize)]);
  for (const t of shuffle(pool)) {
    if (out.length >= n) break;
    const k = normalize(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

// ── Lọc distractor: khác đáp án đúng, khác nhau, thỏa điều kiện `ok` ──
function cleanDistractors(list, correct, ok) {
  const seen = new Set([normalize(correct)]);
  const out  = [];
  for (const d of (Array.isArray(list) ? list : [])) {
    const s = String(d).trim();
    const k = normalize(s);
    if (!k || seen.has(k) || !ok(s)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// ── Chuẩn hóa chỗ trống của câu điền: thay mọi biểu diễn về BLANK, 1 chỗ ──
function normalizeBlank(prompt) {
  const patterns = [/（\s*）/, /\(\s*\)/, /＿{2,}/, /_{2,}/, /〇{2,}/, /□{2,}/, /\.{3,}/];
  for (const p of patterns) {
    if (p.test(prompt)) return prompt.replace(p, BLANK);
  }
  return null; // không tìm thấy chỗ trống
}

// ── System prompt (tiếng Việt) ──
const SYSTEM = `Bạn là chuyên gia ra đề kiểm tra tiếng Nhật (kiểu JLPT). Đầu vào là một mảng JSON, mỗi phần tử gồm: "i" (chỉ số), "term" (từ/cụm tiếng Nhật), "definition" (giải thích tiếng Việt, có thể lộn xộn), "type" (loại câu cần tạo). Với MỖI phần tử, tạo ĐÚNG một câu hỏi theo loại yêu cầu.

QUY TẮC CHUNG (bắt buộc):
- TUYỆT ĐỐI không để lộ đáp án: câu hỏi (prompt) KHÔNG chứa chính từ đáp án, KHÔNG chứa cách đọc của nó, KHÔNG chứa romaji.
- 3 đáp án nhiễu (distractors) phải HỢP LÝ nhưng SAI: cùng loại từ, độ dài tương đương đáp án đúng, khác nhau và khác đáp án đúng.
- Ưu tiên distractor dễ gây nhầm: cùng trường nghĩa, kanji gần hình, nhầm on/kun, trường âm (dài/ngắn), rendaku (âm đục).
- "explanation": giải thích bằng tiếng Việt vì sao đáp án đúng, NGẮN GỌN tối đa 1 câu (riêng loại "fill_blank" theo luật riêng bên dưới).

THEO TỪNG LOẠI (giá trị "type"):
- "mcq_meaning": prompt = NGHĨA tiếng Việt ngắn gọn, viết lại SẠCH (KHÔNG chứa chữ Nhật, không romaji). correct = term. distractors = 3 từ tiếng Nhật khác.
- "mcq_reading": prompt = "" (để trống). correct = cách đọc ĐÚNG của term bằng HIRAGANA. distractors = 3 cách đọc SAI bằng hiragana.
- "mcq_kanji": prompt = cách đọc của term bằng HIRAGANA. correct = term (dạng kanji). distractors = 3 từ KANJI khác gần giống.
- "fill_blank": prompt = MỘT câu tiếng Nhật tự nhiên có dùng term, nhưng thay term bằng đúng ký hiệu （　）. correct = term. distractors = 3 từ tiếng Nhật cùng loại. "explanation" BẮT BUỘC bắt đầu bằng NGHĨA TIẾNG VIỆT của CẢ câu (sau khi đã điền từ đúng vào chỗ trống), rồi mới tới lý do ngắn vì sao chọn từ đó.
- "written": prompt = NGHĨA tiếng Việt ngắn gọn SẠCH (không chứa chữ Nhật). correct = term. Thêm "reading" = cách đọc term bằng hiragana. distractors = [].

Trả về ĐÚNG một mảng JSON, mỗi phần tử: { "i": <số>, "type": "<loại>", "prompt": "...", "correct": "...", "distractors": [...], "reading": "...", "explanation": "..." }.
Chỉ trả JSON, không giải thích gì ngoài JSON.`;

// ── Dựng 1 câu hỏi đã validate + trộn từ output thô của LLM (null nếu loại) ──
// pools = { allTerms, kanjiTerms } để bù distractor khi thiếu.
function buildQuestion(card, type, raw, pools) {
  if (!raw || typeof raw !== 'object') return null;

  const term        = (card.term || '').trim();
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const promptRaw   = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const reading     = typeof raw.reading === 'string' ? raw.reading.trim() : '';
  if (!term) return null;

  const base = { type, explanation, sourceTerm: term };

  if (type === 'mcq_meaning') {
    if (!promptRaw || hasJapanese(promptRaw)) return null; // rỗng hoặc lộ chữ Nhật
    let ds = cleanDistractors(raw.distractors, term, hasJapanese);
    ds = pad(ds, term, pools.allTerms);
    if (ds.length < 3) return null;
    return { ...base, prompt: promptRaw, options: shuffle([term, ...ds.slice(0, 3)]), answer: term };
  }

  if (type === 'mcq_reading') {
    if (!isKanaOnly(raw.correct)) return null; // cách đọc đúng phải là kana
    const correct = String(raw.correct).trim();
    const ds = cleanDistractors(raw.distractors, correct, isKanaOnly);
    if (ds.length < 3) return null; // không bù được cách đọc → loại
    return { ...base, prompt: term, options: shuffle([correct, ...ds.slice(0, 3)]), answer: correct };
  }

  if (type === 'mcq_kanji') {
    if (!isKanaOnly(promptRaw)) return null; // prompt = cách đọc (kana)
    if (!hasKanji(term)) return null;
    let ds = cleanDistractors(raw.distractors, term, hasKanji);
    ds = pad(ds, term, pools.kanjiTerms);
    if (ds.length < 3) return null;
    return { ...base, prompt: promptRaw, options: shuffle([term, ...ds.slice(0, 3)]), answer: term };
  }

  if (type === 'fill_blank') {
    if (!promptRaw || promptRaw.includes(term)) return null; // chưa khoét chỗ trống → lộ đáp án
    const p = normalizeBlank(promptRaw);
    if (!p || p.includes(term)) return null;
    let ds = cleanDistractors(raw.distractors, term, hasJapanese);
    ds = pad(ds, term, pools.allTerms);
    if (ds.length < 3) return null;
    // Câu điền dài cần giải thích có nghĩa tiếng Việt cả câu — thiếu thì bù tối thiểu
    const exp = explanation || `Điền từ「${term}」vào chỗ trống cho đúng ngữ cảnh câu.`;
    return { ...base, explanation: exp, prompt: p, options: shuffle([term, ...ds.slice(0, 3)]), answer: term };
  }

  if (type === 'written') {
    if (!promptRaw || hasJapanese(promptRaw)) return null;
    const accept = [term];
    if (isKanaOnly(reading) && normalize(reading) !== normalize(term)) accept.push(reading.trim());
    return { ...base, prompt: promptRaw, options: [], answer: term, answersAccept: accept };
  }

  return null;
}

// ── Fallback cục bộ (không cần LLM): luôn dựng được 1 câu "chọn từ theo nghĩa" ──
// Dùng khi AI không tạo nổi câu hợp lệ cho thẻ → bảo đảm mọi thẻ đều có câu hỏi.
function buildFallback(card, pools) {
  const term = (card.term || '').trim();
  if (!term) return null;
  // Prompt = nghĩa tiếng Việt (bỏ mọi chữ Nhật để không lộ đáp án); rỗng → prompt chung.
  let prompt = String(card.definition || '')
    .split('\n')[0]
    .replace(/[぀-ヿ一-鿿㐀-䶿ｦ-ﾟ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (prompt.length < 2) prompt = 'Chọn từ tiếng Nhật đúng với nghĩa đã cho.';
  const ds = pad([], term, pools.allTerms, 3);
  if (ds.length < 3) return null; // set quá ít thẻ, không đủ đáp án nhiễu
  return {
    type: 'mcq_meaning',
    sourceTerm: term,
    prompt,
    options: shuffle([term, ...ds.slice(0, 3)]),
    answer: term,
    explanation: `Đáp án đúng là「${term}」.`,
  };
}

// ── Gọi LLM cho 1 lô task, trả map { i → object thô } ──
async function runBatch(batch) {
  const payload = batch.map(b => ({ i: b.idx, term: b.card.term, definition: b.card.definition || '', type: b.type }));
  const result = await chatCompletion(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: 'Tạo câu hỏi cho danh sách sau:\n' + JSON.stringify(payload) },
    ],
    { max_tokens: 2048, temperature: 0.4, timeoutMs: 60000 }
  );
  const rawText = result.choices?.[0]?.message?.content || '';
  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) return {};
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return {}; }
  const byI = {};
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item.i === 'number') byI[item.i] = item;
    }
  }
  return byI;
}

// ── Xử lý danh sách task (theo lô 4, các lô chạy song song), ghi câu hợp lệ vào results[idx] ──
// Lô nhỏ → mỗi lần gọi AI sinh ít token → thời gian chờ = lô chậm nhất, nhanh hơn nhiều so với lô to.
async function fillResults(indices, results, cardByIdx, typeByIdx, pools) {
  const BATCH = 4;
  const chunks = [];
  for (let i = 0; i < indices.length; i += BATCH) chunks.push(indices.slice(i, i + BATCH));

  await Promise.all(chunks.map(async (chunk) => {
    const batch = chunk.map(idx => ({ idx, card: cardByIdx[idx], type: typeByIdx[idx] }));
    let byI = {};
    try { byI = await runBatch(batch); } catch { byI = {}; }
    for (const idx of chunk) {
      const q = buildQuestion(cardByIdx[idx], typeByIdx[idx], byI[idx], pools);
      if (q) results[idx] = q;
    }
  }));
}

// ── Gán loại câu cho từng thẻ (round-robin, bỏ qua loại kanji với thẻ không kanji) ──
function assignTypes(cards, enabledTypes, numQuestions) {
  const eligible = cards.filter(c =>
    enabledTypes.some(t => !KANJI_TYPES.has(t) || hasKanji(c.term))
  );
  const picked = shuffle(eligible).slice(0, numQuestions);

  const tasks = [];
  let cursor = 0;
  for (const card of picked) {
    const cardHasKanji = hasKanji(card.term);
    let chosen = null;
    for (let k = 0; k < enabledTypes.length; k++) {
      const t = enabledTypes[(cursor + k) % enabledTypes.length];
      if (KANJI_TYPES.has(t) && !cardHasKanji) continue;
      chosen = t;
      cursor = (cursor + k + 1) % enabledTypes.length;
      break;
    }
    if (chosen) tasks.push({ card, type: chosen });
  }
  return tasks;
}

/**
 * Sinh bài kiểm tra.
 * @param {Array<{id,term,definition}>} cards
 * @param {{ numQuestions:number, types:string[] }} config
 * @returns {Promise<Array>} mảng câu hỏi đã validate + trộn
 */
async function generateTest(cards, config) {
  const enabledTypes = (config.types || []).filter(t => ALL_TYPES.includes(t));
  if (!enabledTypes.length) throw new Error('Không có loại câu hỏi hợp lệ.');

  const num   = Math.max(1, Math.min(config.numQuestions || cards.length, cards.length));
  const tasks = assignTypes(cards, enabledTypes, num);
  if (!tasks.length) throw new Error('Không có thẻ phù hợp để tạo câu hỏi.');

  const cardByIdx = {};
  const typeByIdx = {};
  tasks.forEach((t, i) => { cardByIdx[i] = t.card; typeByIdx[i] = t.type; });

  const pools = {
    allTerms:   cards.map(c => c.term),
    kanjiTerms: cards.map(c => c.term).filter(hasKanji),
  };

  const results = new Array(tasks.length).fill(null);
  const allIdx  = tasks.map((_, i) => i);

  const missing = () => results.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);

  // Lần 1
  await fillResults(allIdx, results, cardByIdx, typeByIdx, pools);

  // Retry DUY NHẤT 1 đợt: câu trượt → ép luôn sang mcq_meaning (loại dễ validate nhất).
  // Tối đa 2 đợt AI nối tiếp — giữ tổng thời gian sinh đề thấp; sót lại đã có fallback cục bộ.
  const retryIdx = missing();
  if (retryIdx.length) {
    retryIdx.forEach(i => { typeByIdx[i] = 'mcq_meaning'; });
    await fillResults(retryIdx, results, cardByIdx, typeByIdx, pools);
  }

  // Fallback cục bộ: bảo đảm MỖI thẻ đều có 1 câu → số câu = số thẻ đã chọn
  for (const i of missing()) {
    const fb = buildFallback(cardByIdx[i], pools);
    if (fb) results[i] = fb;
  }

  const questions = results.filter(Boolean);
  if (!questions.length) throw new Error('AI không tạo được bài kiểm tra.');
  return questions;
}

module.exports = { generateTest };
