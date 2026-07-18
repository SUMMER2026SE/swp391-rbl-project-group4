// Parse externally-provided kanji (typed text, pasted JSON, or an uploaded
// .txt/.json/.csv file) into the shape the writing worksheet uses: { char,
// reading_on?, reading_kun?, meaning_vi?, han_viet? }. The worksheet only needs
// `char`; readings/meaning are optional extras.

const HAN = /\p{Script=Han}/gu;

// Unique Han (kanji) characters found in a string, in order.
export function extractHan(str) {
  if (!str) return [];
  const seen = new Set();
  const out = [];
  for (const m of String(str).matchAll(HAN)) {
    const c = m[0];
    if (!seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

// Normalize a reading value to an array (worksheet guards on `.length`).
export function toArr(v) {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  if (v == null || v === '') return [];
  return String(v).split(/[、,;/]/).map(s => s.trim()).filter(Boolean);
}

// Map one JSON object to the page's kanji shape (only the first Han char is kept).
function fromObject(o) {
  const raw = o.character ?? o.char ?? o.kanji ?? '';
  const chars = extractHan(raw);
  if (!chars.length) return [];
  const char = chars[0];
  return [{
    char,
    reading_on:  toArr(o.reading_on ?? o.on ?? o.onyomi),
    reading_kun: toArr(o.reading_kun ?? o.kun ?? o.kunyomi),
    meaning_vi:  o.meaning_vi ?? o.meaning ?? o.nghia ?? '',
    han_viet:    o.han_viet ?? o.hanviet ?? '',
  }];
}

// Parse pasted text: JSON (array of strings/objects) or plain text → kanji items.
export function parseKanjiText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];

  if (trimmed[0] === '[' || trimmed[0] === '{') {
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : [data];
      const out = [];
      for (const el of arr) {
        if (typeof el === 'string') out.push(...extractHan(el).map(char => ({ char })));
        else if (el && typeof el === 'object') out.push(...fromObject(el));
      }
      return out;
    } catch {
      // fall through to plain-text extraction
    }
  }
  return extractHan(trimmed).map(char => ({ char }));
}

// Read an uploaded file (.txt/.json/.csv) and parse it the same way.
export async function parseFileText(file) {
  const text = await file.text();
  return parseKanjiText(text);
}

// Sample JSON showing both accepted element forms (object with metadata + bare string).
export const SAMPLE_KANJI_JSON = JSON.stringify([
  { character: '愛', reading_on: 'アイ', reading_kun: 'あい', meaning_vi: 'yêu thương', han_viet: 'ái' },
  { character: '平', reading_on: 'ヘイ', meaning_vi: 'bằng phẳng' },
  '和',
  '夢',
], null, 2);

// Trigger a client-side download of the sample JSON file.
export function downloadSampleJson(filename = 'mau-kanji.json') {
  const blob = new Blob([SAMPLE_KANJI_JSON], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
