'use strict';

// Sinh audio tiếng Nhật cho phần Nghe của đề thi thử JLPT từ transcript admin soạn.
// Dùng msedge-tts (giọng neural của Edge Read Aloud, miễn phí, không cần API key).
// Transcript đã được prompt AI (đợt 4) chuẩn hóa: mỗi lượt thoại một dòng, có nhãn
// 男：/女： (hoặc 男１：/女２： khi trùng giới) — util chỉ việc tách nhãn để map giọng.

const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const OUTPUT_MP3 = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

// Edge chỉ có đúng 2 giọng ja-JP. Dòng không nhãn (câu dẫn, đánh số câu) đọc bằng
// giọng nữ — giống vai người dẫn của đề thi thật.
const VOICES = { male: 'ja-JP-KeitaNeural', female: 'ja-JP-NanamiNeural' };
const NARRATOR = 'female';

const SPEAKER_RE = /^\s*(男|女|M|F)\s*[0-9０-９]*\s*[：:]\s*/;
const GAP_MS = 700;          // khoảng lặng giữa hai lượt thoại
const MAX_LINES = 60;        // chặn transcript bất thường (mỗi dòng = 1 request TTS)
const LINE_TIMEOUT_MS = 30000;

// Endpoint TTS của Edge từ chối thẻ SSML <break/> (đóng kết nối giữa chừng), nên
// khoảng lặng phải tự ghép: 1 khung MPEG2 Layer III 24kHz/48kbps mono = 4 byte
// header + 140 byte 0 = 24ms tiếng lặng — cùng định dạng với audio TTS trả về nên
// nối thẳng vào chuỗi mp3 được.
const SILENT_FRAME = Buffer.concat([Buffer.from([0xff, 0xf3, 0x64, 0xc0]), Buffer.alloc(140)]);
const FRAME_MS = 24;
const silence = ms => Buffer.concat(Array(Math.round(ms / FRAME_MS)).fill(SILENT_FRAME));

// Text đi thẳng vào template SSML của lib (không được escape sẵn)
const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Transcript → [{ voice: 'male'|'female', text }]. Dòng trống bị bỏ.
function parseTranscript(transcript) {
  return String(transcript || '')
    .split(/\r?\n/)
    .map(line => {
      const m = SPEAKER_RE.exec(line);
      const text = (m ? line.slice(m[0].length) : line).trim();
      if (!text) return null;
      const tag = m?.[1];
      const voice = tag === '男' || tag === 'M' ? 'male'
                  : tag === '女' || tag === 'F' ? 'female'
                  : NARRATOR;
      return { voice, text };
    })
    .filter(Boolean);
}

function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => { stream.destroy(); reject(new Error('TTS timeout.')); }, LINE_TIMEOUT_MS);
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
    stream.on('error', e => { clearTimeout(timer); reject(e); });
  });
}

// transcript → Buffer mp3 (các lượt thoại nối tiếp, chèn khoảng lặng ở giữa).
// Ném lỗi nếu transcript rỗng hoặc dịch vụ TTS không phản hồi.
async function synthesizeTranscript(transcript) {
  const lines = parseTranscript(transcript);
  if (!lines.length) { const e = new Error('Transcript trống — không có nội dung để đọc.'); e.httpStatus = 400; throw e; }
  if (lines.length > MAX_LINES) {
    const e = new Error(`Transcript quá dài (${lines.length} dòng, tối đa ${MAX_LINES}).`);
    e.httpStatus = 400; throw e;
  }

  const clients = {};
  const clientFor = async (voice) => {
    if (!clients[voice]) {
      clients[voice] = new MsEdgeTTS();
      await clients[voice].setMetadata(VOICES[voice], OUTPUT_MP3);
    }
    return clients[voice];
  };

  try {
    const parts = [];
    for (const [i, line] of lines.entries()) {
      const tts = await clientFor(line.voice);
      parts.push(await collect(tts.toStream(escapeXml(line.text)).audioStream));
      if (i < lines.length - 1) parts.push(silence(GAP_MS));
    }
    return Buffer.concat(parts);
  } finally {
    Object.values(clients).forEach(c => c.close());
  }
}

module.exports = { synthesizeTranscript, parseTranscript };
