'use strict';

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

// ── Optional: WebRTC VAD ──────────────────────────────────────────────────────
let NodeVAD = null;
try { NodeVAD = require('node-vad'); } catch {}

// ── ffmpeg (cached check) ─────────────────────────────────────────────────────
let _ffmpegOk = null;
function ffmpegAvailable() {
  if (_ffmpegOk !== null) return _ffmpegOk;
  try { require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' }); _ffmpegOk = true; }
  catch { _ffmpegOk = false; }
  return _ffmpegOk;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks = [];
    let stderr = '';
    proc.stdout.on('data', d => stdoutChunks.push(d));
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => resolve({ code, stdout: Buffer.concat(stdoutChunks), stderr }));
    proc.on('error', err => reject(new Error('ffmpeg unavailable: ' + err.message)));
  });
}

// ── VAD: detect actual voice frames (ignores background music/noise) ──────────
async function detectViaVAD(filePath) {
  if (!NodeVAD) throw new Error('node-vad not available');
  if (!ffmpegAvailable()) throw new Error('ffmpeg not available');

  const SAMPLE_RATE   = 16000;
  const FRAME_MS      = 30;
  const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;
  const FRAME_BYTES   = FRAME_SAMPLES * 2;

  const { stdout } = await runFfmpeg([
    '-i', filePath, '-ar', String(SAMPLE_RATE), '-ac', '1', '-f', 's16le', 'pipe:1',
  ]);
  const pcm = stdout;
  const totalDuration = pcm.length / 2 / SAMPLE_RATE;

  const vad    = new NodeVAD(NodeVAD.Mode.VERY_AGGRESSIVE);
  const frames = [];
  for (let offset = 0; offset + FRAME_BYTES <= pcm.length; offset += FRAME_BYTES) {
    const frame = pcm.slice(offset, offset + FRAME_BYTES);
    const timeS = offset / 2 / SAMPLE_RATE;
    const evt   = await vad.processAudio(frame, SAMPLE_RATE);
    frames.push({ timeS, isVoice: evt === NodeVAD.Event.VOICE });
  }

  return { speechSegments: mergeVoiceFrames(frames, FRAME_MS / 1000, totalDuration), totalDuration: r2(totalDuration) };
}

function mergeVoiceFrames(frames, frameDurS, totalDuration) {
  const GAP_S = 0.4; const MIN_S = 0.2; const PAD_S = 0.12;
  const gapN  = Math.ceil(GAP_S / frameDurS);
  const segs  = [];
  let start = null; let silence = 0;

  for (const { timeS, isVoice } of frames) {
    if (isVoice) {
      if (start === null) start = Math.max(0, timeS - PAD_S);
      silence = 0;
    } else if (start !== null) {
      if (++silence >= gapN) {
        const end = Math.min(totalDuration, timeS + PAD_S);
        if (end - start >= MIN_S) segs.push({ start: r2(start), end: r2(end) });
        start = null; silence = 0;
      }
    }
  }
  if (start !== null) {
    const last = frames[frames.length - 1].timeS;
    segs.push({ start: r2(start), end: r2(Math.min(totalDuration, last + PAD_S)) });
  }
  return segs;
}

// ── Fallback: bandpass silence detection ──────────────────────────────────────
async function detectViaSilence(filePath) {
  if (!ffmpegAvailable()) throw new Error('ffmpeg not available');
  const { stderr } = await runFfmpeg([
    '-i', filePath,
    '-af', 'highpass=f=200,lowpass=f=3500,silencedetect=noise=-25dB:duration=0.4',
    '-f', 'null', '-',
  ]);
  return parseSilenceOutput(stderr);
}

function parseSilenceOutput(stderr) {
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})[.,](\d+)/);
  let totalDuration = 0;
  if (m) {
    const ms = m[4].length === 2 ? 100 : 1000;
    totalDuration = +m[1]*3600 + +m[2]*60 + +m[3] + +m[4]/ms;
  }
  const starts = [...stderr.matchAll(/silence_start:\s*([\d.]+)/g)].map(x => +x[1]);
  const ends   = [...stderr.matchAll(/silence_end:\s*([\d.]+)/g)].map(x => +x[1]);
  const segs   = [];
  let cursor   = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] > cursor + 0.05) segs.push({ start: r2(cursor), end: r2(starts[i]) });
    cursor = ends[i] ?? totalDuration;
  }
  if (totalDuration > 0 && cursor < totalDuration - 0.1) segs.push({ start: r2(cursor), end: r2(totalDuration) });
  return { speechSegments: segs, totalDuration: r2(totalDuration) };
}

// ── Main: VAD → silencedetect fallback ───────────────────────────────────────
// Accepts either a Buffer or an existing file path (to avoid double-write).
async function analyzeSilence(audioBufferOrPath, ext) {
  const isPath = typeof audioBufferOrPath === 'string';
  const filePath = isPath ? audioBufferOrPath : tmpPath(`audio.${ext}`);
  if (!isPath) fs.writeFileSync(filePath, audioBufferOrPath);

  try {
    try {
      const r = await detectViaVAD(filePath);
      console.log('[Audio/VAD] duration:', r.totalDuration, 'segments:', r.speechSegments.length);
      return r;
    } catch (e) {
      console.log('[Audio] VAD unavailable (' + e.message + '), using bandpass');
      const r = await detectViaSilence(filePath);
      console.log('[Audio/Silence] duration:', r.totalDuration, 'segments:', r.speechSegments.length);
      return r;
    }
  } finally {
    if (!isPath) tryUnlink(filePath);
  }
}

// ── Extract a time slice of audio as mp3 buffer ───────────────────────────────
// inputPath: path to source audio file
// Returns a Buffer containing mp3 audio for [startS, startS+durationS]
async function extractAudioChunk(inputPath, startS, durationS) {
  if (!ffmpegAvailable()) throw new Error('ffmpeg not available');
  const { stdout } = await runFfmpeg([
    '-ss', String(Math.max(0, startS - 0.05)),
    '-i', inputPath,
    '-t', String(durationS + 0.1),
    '-f', 'mp3', '-ar', '16000', '-ac', '1', '-q:a', '5',
    'pipe:1',
  ]);
  if (!stdout || stdout.length < 100) throw new Error(`Empty chunk ${startS}-${startS + durationS}s`);
  return stdout;
}

// ── Merge speech segments into utterance groups ───────────────────────────────
// Consecutive segments with gap ≤ gapS are merged into one group.
// Groups shorter than minDurS are removed.
function mergeIntoGroups(speechSegments, gapS = 0.5, minDurS = 0.5) {
  if (!speechSegments.length) return [];
  const groups = [{ start: speechSegments[0].start, end: speechSegments[0].end }];
  for (let i = 1; i < speechSegments.length; i++) {
    const prev = groups[groups.length - 1];
    const curr = speechSegments[i];
    if (curr.start - prev.end <= gapS) prev.end = curr.end;
    else groups.push({ start: curr.start, end: curr.end });
  }
  return groups.filter(g => r2(g.end - g.start) >= minDurS);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function tmpPath(name) { return path.join(os.tmpdir(), `kn_${Date.now()}_${Math.random().toString(36).slice(2)}_${name}`); }
function tryUnlink(f) { try { fs.unlinkSync(f); } catch {} }

module.exports = { analyzeSilence, extractAudioChunk, mergeIntoGroups };
