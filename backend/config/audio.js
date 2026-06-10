'use strict';

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

// ── ffmpeg availability (cached) ──────────────────────────────────────────────
let _ffmpegOk = null;
function ffmpegAvailable() {
  if (_ffmpegOk !== null) return _ffmpegOk;
  try {
    require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
    _ffmpegOk = true;
  } catch {
    _ffmpegOk = false;
  }
  return _ffmpegOk;
}

// ── Run ffmpeg ────────────────────────────────────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => resolve({ code, stdout, stderr }));
    proc.on('error', err => reject(new Error('ffmpeg unavailable: ' + err.message)));
  });
}

// ── Parse ffmpeg silencedetect output ────────────────────────────────────────
function parseSilenceOutput(stderr) {
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d+)/);
  let totalDuration = 0;
  if (durMatch) {
    const ms = durMatch[4].length === 2 ? 100 : 1000;
    totalDuration =
      Number(durMatch[1]) * 3600 +
      Number(durMatch[2]) * 60  +
      Number(durMatch[3])       +
      Number(durMatch[4]) / ms;
  }

  const silenceStarts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => Number(m[1]));
  const silenceEnds   = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => Number(m[1]));

  const speech = [];
  let cursor = 0;
  for (let i = 0; i < silenceStarts.length; i++) {
    const silStart = silenceStarts[i];
    const silEnd   = silenceEnds[i] ?? totalDuration;
    if (silStart > cursor + 0.05) speech.push({ start: r2(cursor), end: r2(silStart) });
    cursor = silEnd;
  }
  if (totalDuration > 0 && cursor < totalDuration - 0.1) {
    speech.push({ start: r2(cursor), end: r2(totalDuration) });
  }

  return { speechSegments: speech, totalDuration: r2(totalDuration) };
}

// ── Analyse audio for speech/silence periods ─────────────────────────────────
async function analyzeSilence(audioBuffer, ext) {
  if (!ffmpegAvailable()) throw new Error('ffmpeg not installed');

  const tmpFile = path.join(os.tmpdir(), `kn_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(tmpFile, audioBuffer);

  try {
    const { stderr } = await runFfmpeg([
      '-i', tmpFile,
      '-af', 'silencedetect=noise=-35dB:duration=0.4',
      '-f', 'null', '-',
    ]);
    const result = parseSilenceOutput(stderr);
    console.log('[Audio] totalDuration:', result.totalDuration, 'speechSegments:', result.speechSegments.length);
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ── Map transcript → timed segments (1:1 with speech bursts) ─────────────────
//
// Strategy: split the transcript into exactly N text chunks where N = number of
// detected speech bursts, then assign chunk[i] the timestamp of burst[i].
// This way timing is 100% from the audio analysis — no character-rate assumption.
//
function mapTextToSegments(transcript, speechSegments, totalDuration) {
  const intervals = speechSegments.length > 0
    ? speechSegments
    : (totalDuration > 0 ? [{ start: 0, end: r2(totalDuration) }] : null);

  if (!intervals || !transcript) return [];

  const chunks = splitIntoNChunks(transcript.trim(), intervals.length);

  return chunks
    .map((text, i) => ({
      start: intervals[i]?.start ?? intervals[intervals.length - 1].start,
      end:   intervals[i]?.end   ?? intervals[intervals.length - 1].end,
      text,
    }))
    .filter(s => s.text.trim());
}

// ── Split text into exactly N chunks, preferring natural boundaries ───────────
//
// Tries to break at punctuation/space near each ideal cut point so chunks look
// natural. Falls back to hard character cut if no boundary is found nearby.
//
const SPLIT_CHARS = new Set(['。', '！', '？', '、', ' ', '\n', ')', '）', '」', '』', '…']);

function splitIntoNChunks(text, n) {
  if (!text) return [];
  if (n <= 1) return [text];

  const len = text.length;
  if (n >= len) return [...text].filter(c => c.trim()); // one char per segment

  const idealSize = len / n;
  const chunks    = [];
  let pos = 0;

  for (let i = 1; i < n; i++) {
    const target = Math.round(i * idealSize);
    if (target >= len) break;

    // Search window: ±35% of ideal chunk size, max 8 chars
    const window = Math.min(8, Math.max(1, Math.round(idealSize * 0.35)));
    let bestPos  = target;

    for (let d = 0; d <= window; d++) {
      // Prefer to break AFTER a punctuation character
      if (target + d < len && SPLIT_CHARS.has(text[target + d])) {
        bestPos = target + d + 1;
        break;
      }
      if (d > 0 && target - d > pos && SPLIT_CHARS.has(text[target - d])) {
        bestPos = target - d + 1;
        break;
      }
    }

    const chunk = text.slice(pos, bestPos).trim();
    if (chunk) chunks.push(chunk);
    pos = bestPos;
  }

  const last = text.slice(pos).trim();
  if (last) chunks.push(last);

  return chunks;
}

function r2(n) { return Math.round(n * 100) / 100; }

module.exports = { analyzeSilence, mapTextToSegments };
