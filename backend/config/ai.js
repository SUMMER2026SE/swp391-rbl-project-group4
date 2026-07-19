'use strict';

const FPT_AI_BASE = 'https://mkp-api.fptcloud.com/v1';

// options.timeoutMs (tùy chọn): hủy request nếu AI trả lời quá lâu — mặc định KHÔNG timeout
// để không ảnh hưởng các caller hiện có (chat AI Sensei, sinh quiz...).
async function chatCompletion(messages, options = {}) {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
  try {
    const res = await fetch(`${FPT_AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FPT_AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || process.env.FPT_AI_MODEL || 'gemma-4-31B-it',
        messages,
        max_tokens: options.max_tokens || 1024,
        temperature: options.temperature ?? 0.7,
      }),
      signal: controller?.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
      throw new Error(err.error?.message || `FPT AI error ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`FPT AI timeout sau ${options.timeoutMs}ms`);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Parse SRT subtitle text into segment array
function parseSRT(srt) {
  if (!srt || !srt.trim()) return [];
  const blocks = srt.trim().split(/\n\s*\n/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const m = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!m) continue;
    const toSec = (h, mi, s, ms) => Number(h) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end   = toSec(m[5], m[6], m[7], m[8]);
    const idx   = lines.indexOf(timeLine);
    const text  = lines.slice(idx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (text) segments.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text });
  }
  return segments;
}

async function whisperTranscribe(audioBuffer, filename, mimeType, language, { verbose = false } = {}) {
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  // FPT AI Cloud không có whisper-large-v3 bản đầy đủ (đã kiểm tra GET /v1/models
  // 2026-07: chỉ có turbo và medium) — turbo là bản chính xác nhất hiện có.
  formData.append('model', process.env.FPT_AI_WHISPER_MODEL || 'whisper-large-v3-turbo');
  // verbose_json: lấy avg_logprob/no_speech_prob mỗi câu (dùng để chấm độ tin cậy &
  // lọc âm thanh nền). SRT: đường cũ cho các caller khác (không đổi hành vi).
  formData.append('response_format', verbose ? 'verbose_json' : 'srt');
  // temperature 0: bám sát audio, giảm "sáng tác" nội dung khi nghe không rõ.
  formData.append('temperature', '0');
  if (language) formData.append('language', language);

  const res = await fetch(`${FPT_AI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.FPT_AI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `Whisper error ${res.status}`);
  }

  const raw = await res.text();

  // verbose_json / JSON: giữ avg_logprob + no_speech_prob theo câu.
  const parseJson = (jsonStr) => {
    const json = JSON.parse(jsonStr);
    const jsonSegs = json.segments || json.chunks || [];
    const segments = jsonSegs.map(s => ({
      start: Math.round(Number(s.start) * 100) / 100,
      end:   Math.round(Number(s.end)   * 100) / 100,
      text:  String(s.text).trim(),
      ...(s.avg_logprob    != null ? { avgLogprob:  Number(s.avg_logprob) }    : {}),
      ...(s.no_speech_prob != null ? { noSpeechProb: Number(s.no_speech_prob) } : {}),
    })).filter(s => s.text);
    return { text: json.text || segments.map(s => s.text).join(' '), segments, language: json.language || language || 'ja' };
  };

  if (verbose) {
    try { return parseJson(raw); }
    catch { /* rơi xuống SRT/plain bên dưới */ }
  }

  // Try SRT parse
  let segments = parseSRT(raw);

  // If SRT parse failed, API may have returned JSON
  if (segments.length === 0) {
    try {
      return parseJson(raw);
    } catch {
      return { text: raw.trim(), segments: [], language: language || 'ja' };
    }
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, language: language || 'ja' };
}

module.exports = { chatCompletion, whisperTranscribe };
