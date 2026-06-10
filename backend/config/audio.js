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
  // Total duration
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d+)/);
  let totalDuration = 0;
  if (durMatch) {
    const ms = durMatch[4].length === 2 ? 100 : 1000;
    totalDuration =
      Number(durMatch[1]) * 3600 +
      Number(durMatch[2]) * 60 +
      Number(durMatch[3]) +
      Number(durMatch[4]) / ms;
  }

  // Silence events
  const silenceStarts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(m => Number(m[1]));
  const silenceEnds   = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(m => Number(m[1]));

  // Derive speech segments from gaps between silences
  const speech = [];
  let cursor = 0;

  for (let i = 0; i < silenceStarts.length; i++) {
    const silStart = silenceStarts[i];
    const silEnd   = silenceEnds[i] ?? totalDuration;
    if (silStart > cursor + 0.05) {
      speech.push({ start: r2(cursor), end: r2(silStart) });
    }
    cursor = silEnd;
  }
  // Speech after last silence
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
    console.log('[Audio] silencedetect done, stderr length:', stderr.length);
    const result = parseSilenceOutput(stderr);
    console.log('[Audio] totalDuration:', result.totalDuration, 'speechSegments:', result.speechSegments.length);
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ── Map transcript sentences → speech segments ───────────────────────────────
// Splits text on Japanese/English sentence boundaries, then distributes each
// chunk proportionally across the detected speech intervals (skipping silences).
function mapTextToSegments(transcript, speechSegments, totalDuration) {
  const parts = splitSentences(transcript);
  if (parts.length === 0) return [];

  // Fallback: no speech segments detected → treat whole audio as one speech block
  const intervals = speechSegments.length > 0
    ? speechSegments
    : (totalDuration > 0 ? [{ start: 0, end: totalDuration }] : null);

  if (!intervals) return [];

  return distributeOverIntervals(parts, intervals);
}

// Split on sentence-ending punctuation, keeping the delimiter attached to the preceding chunk
function splitSentences(text) {
  return text
    .split(/(?<=[。！？\n])|(?<=[.!?]\s)/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Distribute text parts across time intervals proportionally by character count,
// honouring gap (silence) periods between intervals.
function distributeOverIntervals(parts, intervals) {
  const totalSpeech = intervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
  const totalChars  = parts.reduce((s, p) => s + p.length, 0) || 1;

  const result = [];
  let ivIdx = 0;               // current interval index
  let usedInIv = 0;            // seconds consumed within current interval

  for (const part of parts) {
    if (ivIdx >= intervals.length) break;

    const speechNeeded = (part.length / totalChars) * totalSpeech;
    const segStart     = r2(intervals[ivIdx].start + usedInIv);
    let remaining      = speechNeeded;

    // Consume time across intervals (skipping silence gaps)
    while (remaining > 1e-4 && ivIdx < intervals.length) {
      const ivAvail = intervals[ivIdx].end - intervals[ivIdx].start - usedInIv;
      if (remaining <= ivAvail) {
        usedInIv += remaining;
        remaining = 0;
      } else {
        remaining -= ivAvail;
        ivIdx++;
        usedInIv = 0;
      }
    }

    const segEnd = ivIdx < intervals.length
      ? r2(intervals[ivIdx].start + usedInIv)
      : r2(intervals[intervals.length - 1].end);

    result.push({ start: segStart, end: segEnd, text: part });
  }

  return result;
}

function r2(n) { return Math.round(n * 100) / 100; }

module.exports = { analyzeSilence, mapTextToSegments };
