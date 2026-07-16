// Parser SRT/VTT thuần frontend cho editor transcript video.
// Trả về mảng { start, end, text } (giây, số thực) — caller tự gắn lang thành parts.

// "01:02:03,450" / "02:03.450" / "00:00:05" → giây
function parseTimestamp(ts) {
  const m = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) {
    const m2 = ts.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
    if (!m2) return null;
    return (Number(m2[1] || 0) * 3600) + (Number(m2[2]) * 60) + Number(m2[3]);
  }
  return (Number(m[1] || 0) * 3600) + (Number(m[2]) * 60) + Number(m[3])
    + Number(String(m[4]).padEnd(3, '0')) / 1000;
}

// Nhận nội dung SRT hoặc VTT (tự nhận diện), trả về [{ start, end, text }] đã sort theo start.
export function parseSubtitles(raw) {
  if (!raw || !raw.trim()) return [];
  // Bỏ header WEBVTT + các khối NOTE/STYLE/REGION của VTT
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(lines[0]) && !lines[0].includes('-->')) continue;
    // Dòng chứa "-->" là dòng thời gian; dòng trước đó (nếu có) là số thứ tự/cue id — bỏ qua
    const timeIdx = lines.findIndex(l => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [rawStart, rawEnd] = lines[timeIdx].split('-->');
    if (!rawEnd) continue;
    // VTT có thể kèm setting sau end time ("00:05.000 --> 00:08.000 align:start")
    const start = parseTimestamp(rawStart);
    const end = parseTimestamp(rawEnd.trim().split(/\s+/)[0]);
    if (start == null || end == null) continue;
    const content = lines.slice(timeIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // bỏ tag VTT (<c>, <b>, timestamp tag...)
      .trim();
    if (!content) continue;
    cues.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text: content });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export default parseSubtitles;
