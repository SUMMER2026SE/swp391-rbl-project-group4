'use strict';

// ─── Orchestrator: chạy toàn bộ pipeline import từ điển theo thứ tự ───
// Dùng --limit=N để dry-run (chỉ xử lý N từ JLPT đầu tiên).
//
// Thứ tự: download -> jlpt-index -> entries -> kanji-readings -> translate-senses
//         -> examples -> furigana -> related-words

const { execFileSync } = require('child_process');
const path = require('path');

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const extraArgs = limitArg ? [limitArg] : [];

const STEPS = [
  'download-sources.js',
  'build-jlpt-index.js',
  'import-entries.js',
  'import-kanji-readings.js',
  'translate-senses.js',
  'import-examples.js',
  'generate-furigana.js',
  'build-related-words.js',
];

for (const step of STEPS) {
  console.log(`\n=== ${step} ${extraArgs.join(' ')} ===`);
  execFileSync(process.execPath, [path.join(__dirname, step), ...extraArgs], { stdio: 'inherit' });
}

console.log('\n✅ Hoàn tất toàn bộ pipeline import từ điển.');
