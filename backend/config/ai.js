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

async function whisperTranscribe(audioBuffer, filename, mimeType, language) {
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
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

  return res.json();
}

module.exports = { chatCompletion, whisperTranscribe };
