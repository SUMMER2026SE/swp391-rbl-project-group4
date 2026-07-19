'use strict';

// ─── Chép lời tự động cho lesson video ─────────────────────────────────────────
// Pipeline giống transcribeListeningPassage (adminController): lấy nguồn audio/video,
// VAD/silencedetect tách đoạn nói, Whisper chép lời từng đoạn ≤6s, rồi thêm bước mới:
// LLM xác định ngôn ngữ gốc của từng câu (bài giảng có thể xen Nhật/Việt/Anh) và dịch
// bổ sung sang 2 ngôn ngữ còn lại → parts: [{lang, text}] cho bản chép đồng bộ.
// Nguồn: video upload (fetch từ storage — ffmpeg đọc audio trực tiếp từ container
// mp4/webm) hoặc link YouTube (tải audio-only qua yt-dlp, xem config/youtube.js).
// KHÔNG ghi DB ở đây: kết quả là bản nháp, trả về cho editor để giáo viên duyệt rồi
// mới lưu qua PUT /lessons/:id (khác listening — tránh publish thẳng cho học sinh).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { whisperTranscribe, chatCompletion } = require('../config/ai');
const { analyzeSilence, extractAudioChunk, mergeIntoGroups, extractAudioTrack } = require('../config/audio');
const { downloadYouTubeAudio } = require('../config/youtube');

const TRANSLATE_BATCH = 20;

function isYouTubeUrl(url) {
  return /(?:youtube\.com|youtu\.be)\//i.test(url || '');
}

// Trích mảng JSON đầu tiên (cân bằng [ ]), bỏ qua ngoặc trong chuỗi — pattern từ
// scripts/dictionary-import/translate-senses.js (script offline, không import runtime được).
function extractFirstJsonArray(text) {
  const start = text.indexOf('[');
  if (start === -1) throw new Error('Không tìm thấy mảng JSON trong phản hồi');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Mảng JSON không cân bằng ngoặc');
}

// [{start,end,text}] → [{start,end,parts:[{lang,text}]}]
// LLM xác định ngôn ngữ gốc từng câu + dịch sang 2 ngôn ngữ còn lại (batch 20 câu/lần).
// Batch lỗi → giữ nguyên câu gốc với lang 'ja' (bản nháp, giáo viên sửa lại trong editor).
async function translateSegments(rawSegments) {
  const out = [];
  for (let i = 0; i < rawSegments.length; i += TRANSLATE_BATCH) {
    const batch = rawSegments.slice(i, i + TRANSLATE_BATCH);
    const input = batch.map((s, idx) => ({ id: idx, text: s.text }));
    try {
      const r = await chatCompletion([
        {
          role: 'system',
          content:
            'Bạn là biên dịch viên Nhật-Việt-Anh cho video bài giảng tiếng Nhật. ' +
            'Mỗi câu là lời thoại trong video, có thể là tiếng Nhật, tiếng Việt hoặc tiếng Anh. ' +
            'Với từng câu: xác định ngôn ngữ gốc và dịch sang 2 ngôn ngữ còn lại, ngắn gọn, giữ đúng ngữ cảnh giảng dạy. ' +
            'Chỉ trả về JSON hợp lệ, không thêm giải thích, không bọc trong markdown.',
        },
        {
          role: 'user',
          content:
            'Với mỗi câu, trả về ngôn ngữ gốc ("lang": "ja"|"vi"|"en") và đủ 3 trường ja/vi/en ' +
            '(trường của ngôn ngữ gốc giữ nguyên văn bản gốc). Giữ nguyên "id". ' +
            'Trả về JSON dạng: [{"id":0,"lang":"ja","ja":"...","vi":"...","en":"..."}]\n\n' +
            JSON.stringify(input),
        },
      ], { max_tokens: 4096, temperature: 0.2 });

      const content = r.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(extractFirstJsonArray(
        content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      ));
      const byId = new Map(parsed.map(p => [p.id, p]));

      batch.forEach((seg, idx) => {
        const t = byId.get(idx);
        const srcLang = ['ja', 'vi', 'en'].includes(t?.lang) ? t.lang : 'ja';
        // Ngôn ngữ gốc đứng đầu (đúng văn bản Whisper nghe được), bản dịch theo sau
        const order = [srcLang, ...['ja', 'vi', 'en'].filter(l => l !== srcLang)];
        const parts = order
          .map(l => ({ lang: l, text: l === srcLang ? seg.text : String(t?.[l] || '').trim() }))
          .filter(p => p.text);
        out.push({ start: seg.start, end: seg.end, parts, ...(seg.needsReview ? { needsReview: true } : {}) });
      });
    } catch (e) {
      console.warn('[LessonTranscribe] translate batch', i / TRANSLATE_BATCH, 'failed:', e.message);
      batch.forEach(seg => out.push({ start: seg.start, end: seg.end, parts: [{ lang: 'ja', text: seg.text }], ...(seg.needsReview ? { needsReview: true } : {}) }));
    }
  }
  return out;
}

// contentUrl (video đã upload lên storage HOẶC link YouTube) → { segments, transcript }
async function runVideoTranscription(contentUrl) {
  const fromYouTube = isYouTubeUrl(contentUrl);
  let tmpFile;
  let ext;

  if (fromYouTube) {
    // yt-dlp tải audio-only về file tạm — đã là audio thuần, không cần tách track
    tmpFile = await downloadYouTubeAudio(contentUrl);
    ext = 'mp3';
  } else {
    const videoRes = await fetch(contentUrl);
    if (!videoRes.ok) throw new Error('Không thể tải file video từ storage.');
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    ext = (contentUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
    tmpFile = path.join(os.tmpdir(), `kn_lesson_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpFile, videoBuffer);
  }

  let rawSegments = [];
  let transcript = '';

  try {
    try {
      const { speechSegments, totalDuration } = await analyzeSilence(tmpFile, ext);
      const groups = mergeIntoGroups(speechSegments, 0.3, 0.3, 6);
      console.log('[LessonTranscribe]', groups.length, 'utterance groups / total', totalDuration, 's');

      const BATCH = 3;
      for (let i = 0; i < groups.length; i += BATCH) {
        const batch = groups.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (g) => {
          const dur = g.end - g.start;
          const isHallucination = (text) => {
            if (!text) return false;
            return /(.{2,})\1{4,}/.test(text) || text.length > dur * 18;
          };
          // needsReview: gợi ý cho giáo viên dòng cần soát kỹ trong editor (không lưu DB).
          // Chunk cực ngắn (<0.6s) là chỗ Whisper dễ đoán sai nhất.
          const tooShort = dur < 0.6;
          try {
            const chunk = await extractAudioChunk(tmpFile, g.start, dur);
            const r = await whisperTranscribe(chunk, 'chunk.mp3', 'audio/mpeg', null);
            const text = r.text?.trim();
            if (!isHallucination(text)) {
              return text ? { start: g.start, end: g.end, text, ...(tooShort ? { needsReview: true } : {}) } : null;
            }
            const chunk2 = await extractAudioChunk(tmpFile, g.start, dur, true);
            const r2 = await whisperTranscribe(chunk2, 'chunk.mp3', 'audio/mpeg', null);
            const text2 = r2.text?.trim();
            if (!text2 || isHallucination(text2)) return null;
            // Từng nghi hallucination, chỉ đạt sau khi lọc nhiễu — luôn đánh dấu cần soát
            return { start: g.start, end: g.end, text: text2, needsReview: true };
          } catch (e) {
            console.warn('[LessonTranscribe] chunk', g.start, '-', g.end, 'failed:', e.message);
            return null;
          }
        }));
        rawSegments.push(...results.filter(Boolean));
      }
      rawSegments.sort((a, b) => a.start - b.start);
      transcript = rawSegments.map(s => s.text).join(' ');
    } catch (audioErr) {
      // Fallback: gửi nguyên file audio cho Whisper (không timestamp).
      // Nguồn YouTube đã là mp3; video upload cần tách audio khỏi container trước.
      console.warn('[LessonTranscribe] segmented approach failed, falling back:', audioErr.message);
      const audioTrack = fromYouTube ? fs.readFileSync(tmpFile) : await extractAudioTrack(tmpFile);
      const r = await whisperTranscribe(audioTrack, 'audio.mp3', 'audio/mpeg', 'ja');
      transcript = r.text?.trim() || '';
      rawSegments = [];
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }

  const segments = rawSegments.length ? await translateSegments(rawSegments) : [];
  return { segments, transcript };
}

// ── Chép lời cho bài nghe (audio/video/YouTube) — ƯU TIÊN chép NGUYÊN file ──────
// Whisper (SRT) tự tách câu kèm timestamp → transcript ĐẦY ĐỦ, không rớt đoạn như
// cách VAD-chunk (vốn loại bỏ chunk bị nghi hallucination / lỗi). Dùng cho phần
// "Luyện nghe" tự tạo. Chỉ khi audio quá lớn / Whisper không ra segment mới lui về
// pipeline chunk (runVideoTranscription).
const QA_BATCH = 20;

const clampConf = (n) => (n == null || isNaN(n)) ? null : Math.max(0, Math.min(100, Math.round(Number(n))));

// FPT AI chỉ trả timestamp qua SRT (verbose_json không có segments/logprob) → không có
// tín hiệu âm học. Độ tự tin & lọc âm nền dựa hoàn toàn vào lượt QA bằng LLM bên dưới.

// ── QA tiếng Nhật (LLM): ép kana/kanji, phát hiện âm nền, chấm điểm, ghi chú ─────
// lines: [{text}] → [{ ja, vi, drop, conf, note }] (cùng thứ tự).
async function japaneseQaSegments(lines) {
  const out = new Array(lines.length).fill(null);
  for (let i = 0; i < lines.length; i += QA_BATCH) {
    const batch = lines.slice(i, i + QA_BATCH);
    const input = batch.map((s, idx) => ({ id: idx, text: s.text }));
    try {
      const r = await chatCompletion([
        {
          role: 'system',
          content:
            'Bạn là chuyên gia kiểm định phụ đề tiếng Nhật cho bài luyện nghe. Âm thanh gốc là TIẾNG NHẬT. ' +
            'Với mỗi câu do máy nhận dạng (ASR) đưa ra, hãy: ' +
            '(1) Trả về câu đó bằng CHỮ NHẬT (kana/kanji) — nếu đầu vào là romaji hoặc phiên âm tiếng Anh của tiếng Nhật thì VIẾT LẠI bằng kana/kanji cho đúng; ' +
            '(2) Nếu KHÔNG phải lời nói (hiệu ứng âm thanh, tiếng chuông, nhạc nền, tiếng động, hoặc chuỗi vô nghĩa do ASR bịa ra) thì đặt "drop": true; ' +
            '(3) Chấm "conf" 0-100 = mức chắc chắn câu tiếng Nhật này ĐÚNG với điều thực sự được nói; ' +
            '(4) "note": lý do ngắn khi conf thấp (vd "nghe không rõ", "có thể là âm nền", "ASR trả romaji"); ' +
            '(5) "vi": DỊCH câu tiếng Nhật sang TIẾNG VIỆT, ngắn gọn, tự nhiên, đúng ngữ cảnh. ' +
            'KHÔNG bịa nội dung; trường "ja" chỉ chứa tiếng Nhật. Chỉ trả JSON hợp lệ, không markdown.',
        },
        {
          role: 'user',
          content:
            'Trả về JSON mảng, giữ nguyên "id": [{"id":0,"ja":"...","vi":"...","drop":false,"conf":95,"note":""}]\n\n' +
            JSON.stringify(input),
        },
      ], { max_tokens: 4096, temperature: 0.1 });

      const content = r.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(extractFirstJsonArray(
        content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      ));
      const byId = new Map(parsed.map(p => [p.id, p]));
      batch.forEach((s, idx) => {
        const q = byId.get(idx);
        out[i + idx] = q
          ? { ja: (String(q.ja || '').trim() || s.text), vi: String(q.vi || '').trim(), drop: !!q.drop, conf: clampConf(q.conf), note: String(q.note || '').trim() }
          : { ja: s.text, vi: '', drop: false, conf: null, note: '' };
      });
    } catch (e) {
      console.warn('[ListeningQA] batch', i / QA_BATCH, 'failed:', e.message);
      batch.forEach((s, idx) => { out[i + idx] = { ja: s.text, vi: '', drop: false, conf: null, note: '' }; });
    }
  }
  return out;
}

async function runAudioTranscription(contentUrl) {
  const fromYouTube = isYouTubeUrl(contentUrl);
  let tmpFile, ext;
  if (fromYouTube) {
    tmpFile = await downloadYouTubeAudio(contentUrl);
    ext = 'mp3';
  } else {
    const res = await fetch(contentUrl);
    if (!res.ok) throw new Error('Không thể tải file audio/video từ storage.');
    const buf = Buffer.from(await res.arrayBuffer());
    ext = (contentUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
    tmpFile = path.join(os.tmpdir(), `kn_lc_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpFile, buf);
  }

  try {
    // ── B1: VAD lấy MỐC THỜI GIAN (FPT Whisper KHÔNG trả timestamp — chỉ trả text),
    // rồi Whisper từng đoạn nói với language='ja' (ÉP tiếng Nhật → giảm romaji/tiếng Anh).
    const { speechSegments } = await analyzeSilence(tmpFile, ext);
    const groups = mergeIntoGroups(speechSegments, 0.3, 0.3, 6);
    let raw = [];
    const BATCH = 4;
    for (let i = 0; i < groups.length; i += BATCH) {
      const batch = groups.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (g) => {
        const dur = Math.max(0.4, g.end - g.start);
        try {
          const chunk = await extractAudioChunk(tmpFile, g.start, dur);
          const r = await whisperTranscribe(chunk, 'chunk.mp3', 'audio/mpeg', 'ja');
          const text = (r.text || '').trim();
          return text ? { start: g.start, end: g.end, text } : null;
        } catch { return null; }
      }));
      raw.push(...results.filter(Boolean));
    }
    raw.sort((a, b) => a.start - b.start);
    if (!raw.length) throw new Error('Whisper không ra text.');

    // ── B2: QA tiếng Nhật (LLM) — ép kana, drop âm nền, chấm điểm + ghi chú ──
    let qa = await japaneseQaSegments(raw);

    // ── B3: Tự sửa (auto-fix) câu điểm thấp — chép lại (lọc nhiễu) rồi QA lại, giữ bản tốt hơn ──
    const FIX_THRESHOLD = 55, MAX_FIX = 40;
    const cand = qa
      .map((q, i) => ({ i, c: q.conf }))
      .filter(x => x.c != null && x.c < FIX_THRESHOLD && !qa[x.i].drop)
      .sort((a, b) => a.c - b.c).slice(0, MAX_FIX).map(x => x.i);
    if (cand.length) {
      const fixed = [];
      for (const i of cand) {
        const s = raw[i]; const dur = Math.max(0.4, s.end - s.start);
        try {
          const chunk = await extractAudioChunk(tmpFile, s.start, dur, true);   // voiceFilter = lọc nhiễu
          const r = await whisperTranscribe(chunk, 'fix.mp3', 'audio/mpeg', 'ja');
          fixed.push({ i, text: (r.text || '').trim() || s.text });
        } catch { fixed.push({ i, text: s.text }); }
      }
      const reqa = await japaneseQaSegments(fixed.map(f => ({ text: f.text })));
      fixed.forEach((f, k) => {
        const nq = reqa[k];
        if (nq && nq.conf != null && (qa[f.i].conf == null || nq.conf > qa[f.i].conf)) {
          raw[f.i].text = f.text; qa[f.i] = nq;
        }
      });
    }

    // ── B4: Ghép segment cuối, bỏ âm nền (LLM drop), tính điểm ──
    const segments = [];
    let dropped = 0, flagged = 0, sumConf = 0;
    raw.forEach((s, idx) => {
      const q = qa[idx] || { ja: s.text, drop: false, conf: null, note: '' };
      if (q.drop) { dropped++; return; }
      const confidence = q.conf ?? 70;
      const needsReview = confidence < 70;
      if (needsReview) flagged++;
      sumConf += confidence;
      segments.push({
        start: s.start, end: s.end,
        parts: [{ lang: 'ja', text: q.ja }, ...(q.vi ? [{ lang: 'vi', text: q.vi }] : [])],
        confidence,
        ...(needsReview ? { needsReview: true } : {}),
        ...(q.note ? { note: q.note } : {}),
      });
    });

    if (segments.length) {
      return {
        segments,
        transcript: segments.map(s => s.parts[0].text).join('\n'),
        confidence: Math.round(sumConf / segments.length), flagged, dropped,
      };
    }
  } catch (e) {
    console.warn('[ListeningTranscribe] whole/window failed, fallback to VAD chunk:', e.message);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }

  // Dự phòng cuối: Whisper không ra gì → pipeline VAD-chunk.
  return runVideoTranscription(contentUrl);
}

module.exports = { runVideoTranscription, runAudioTranscription, isYouTubeUrl };
