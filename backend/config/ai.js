'use strict';

const FPT_AI_BASE = 'https://mkp-api.fptcloud.com/v1';

async function chatCompletion(messages, options = {}) {
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
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `FPT AI error ${res.status}`);
  }

  return res.json();
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

async function whisperTranscribe(audioBuffer, filename, mimeType, language) {
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  formData.append('model', process.env.FPT_AI_WHISPER_MODEL || 'whisper-large-v3-turbo');
  formData.append('response_format', 'srt');
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
  console.log('[Whisper SRT raw (first 300)]:', raw.slice(0, 300));

  // Try SRT parse
  let segments = parseSRT(raw);

  // If SRT parse failed, API may have returned JSON
  if (segments.length === 0) {
    try {
      const json = JSON.parse(raw);
      const text = json.text || '';
      const jsonSegs = json.segments || json.chunks || [];
      if (jsonSegs.length > 0) {
        segments = jsonSegs.map(s => ({
          start: Math.round(Number(s.start) * 100) / 100,
          end:   Math.round(Number(s.end)   * 100) / 100,
          text:  String(s.text).trim(),
        })).filter(s => s.text);
      }
      // No estimation fallback — frontend estimates using real audio duration
      return { text, segments, language: json.language || language || 'ja' };
    } catch {
      return { text: raw.trim(), segments: [], language: language || 'ja' };
    }
  }

  const text = segments.map(s => s.text).join(' ');
  return { text, segments, language: language || 'ja' };
}

module.exports = { chatCompletion, whisperTranscribe };
