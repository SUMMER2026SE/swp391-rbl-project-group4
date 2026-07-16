'use strict';

// ─── Chép lời tự động cho lesson video ─────────────────────────────────────────
// Pipeline giống transcribeListeningPassage (adminController): tải file từ storage,
// VAD/silencedetect tách đoạn nói, Whisper chép lời từng đoạn ≤6s, rồi thêm bước mới:
// LLM xác định ngôn ngữ gốc của từng câu (bài giảng có thể xen Nhật/Việt/Anh) và dịch
// bổ sung sang 2 ngôn ngữ còn lại → parts: [{lang, text}] cho bản chép đồng bộ.
// ffmpeg đọc audio trực tiếp từ container video (mp4/webm) nên analyzeSilence/
// extractAudioChunk dùng thẳng trên file video — chỉ nhánh fallback (gửi nguyên file
// cho Whisper) mới cần tách audio riêng qua extractAudioTrack.
// KHÔNG ghi DB ở đây: kết quả là bản nháp, trả về cho editor để giáo viên duyệt rồi
// mới lưu qua PUT /lessons/:id (khác listening — tránh publish thẳng cho học sinh).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { whisperTranscribe, chatCompletion } = require('../config/ai');
const { analyzeSilence, extractAudioChunk, mergeIntoGroups, extractAudioTrack } = require('../config/audio');

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
        out.push({ start: seg.start, end: seg.end, parts });
      });
    } catch (e) {
      console.warn('[LessonTranscribe] translate batch', i / TRANSLATE_BATCH, 'failed:', e.message);
      batch.forEach(seg => out.push({ start: seg.start, end: seg.end, parts: [{ lang: 'ja', text: seg.text }] }));
    }
  }
  return out;
}

// contentUrl (video đã upload lên storage) → { segments, transcript }
async function runVideoTranscription(contentUrl) {
  const videoRes = await fetch(contentUrl);
  if (!videoRes.ok) throw new Error('Không thể tải file video từ storage.');
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
  const ext = (contentUrl.split('?')[0].split('.').pop() || 'mp4').toLowerCase();

  const tmpFile = path.join(os.tmpdir(), `kn_lesson_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpFile, videoBuffer);

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
          try {
            const chunk = await extractAudioChunk(tmpFile, g.start, dur);
            const r = await whisperTranscribe(chunk, 'chunk.mp3', 'audio/mpeg', null);
            const text = r.text?.trim();
            if (!isHallucination(text)) {
              return text ? { start: g.start, end: g.end, text } : null;
            }
            const chunk2 = await extractAudioChunk(tmpFile, g.start, dur, true);
            const r2 = await whisperTranscribe(chunk2, 'chunk.mp3', 'audio/mpeg', null);
            const text2 = r2.text?.trim();
            if (!text2 || isHallucination(text2)) return null;
            return { start: g.start, end: g.end, text: text2 };
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
      // Fallback: tách audio khỏi video rồi gửi nguyên file cho Whisper (không timestamp)
      console.warn('[LessonTranscribe] segmented approach failed, falling back:', audioErr.message);
      const audioTrack = await extractAudioTrack(tmpFile);
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

module.exports = { runVideoTranscription, isYouTubeUrl };
