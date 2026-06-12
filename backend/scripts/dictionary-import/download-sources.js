'use strict';

// ─── Tải dữ liệu nguồn cho pipeline import từ điển ───
// Tải về thư mục data/ (gitignored): JMdict (eng + examples), JLPT word list,
// KanjiDictVN (Hán Việt + KANJIDIC tiếng Anh). Không đụng tới database.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const DATA_DIR = path.join(__dirname, 'data');

// ─── Helpers ───
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, destPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error(`Quá nhiều redirect khi tải ${url}`));
    https.get(url, { headers: { 'User-Agent': 'kizuna-nihongo-dict-import' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(download(res.headers.location, destPath, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Tải thất bại ${url}: HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'kizuna-nihongo-dict-import', 'Accept': 'application/vnd.github+json' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GitHub API thất bại ${url}: HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function extractTgz(tgzPath, destDir) {
  ensureDir(destDir);
  execFileSync('tar', ['-xzf', tgzPath, '-C', destDir], { stdio: 'inherit' });
}

// ─── 1. JMdict (jmdict-simplified) ───
async function downloadJmdict() {
  console.log('→ Tra cứu release mới nhất của scriptin/jmdict-simplified...');
  const release = await fetchJson('https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest');

  const wantedAssets = {
    'jmdict-eng': /^jmdict-eng-.*\.json\.tgz$/,
    'jmdict-examples-eng': /^jmdict-examples-eng-.*\.json\.tgz$/,
  };

  for (const [label, regex] of Object.entries(wantedAssets)) {
    const asset = release.assets.find((a) => regex.test(a.name));
    if (!asset) throw new Error(`Không tìm thấy asset cho ${label}`);

    const tgzPath = path.join(DATA_DIR, asset.name);
    if (!fs.existsSync(tgzPath)) {
      console.log(`→ Tải ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
      await download(asset.browser_download_url, tgzPath);
    } else {
      console.log(`→ Đã có ${asset.name}, bỏ qua tải.`);
    }

    console.log(`→ Giải nén ${asset.name}...`);
    extractTgz(tgzPath, DATA_DIR);

    // Chuẩn hoá tên file JSON đầu ra (bỏ phần version+timestamp) để các script sau dùng tên cố định
    const jsonName = fs.readdirSync(DATA_DIR).find((f) => f.startsWith(label) && f.endsWith('.json'));
    if (jsonName) {
      const targetName = `${label}.json`;
      const src = path.join(DATA_DIR, jsonName);
      const dest = path.join(DATA_DIR, targetName);
      if (src !== dest) fs.renameSync(src, dest);
      console.log(`→ ${targetName} sẵn sàng.`);
    }
  }
}

// ─── 2. JLPT word list (elzup/jlpt-word-list) ───
async function downloadJlptWordList() {
  const dest = path.join(DATA_DIR, 'jlpt-all.csv');
  if (fs.existsSync(dest)) {
    console.log('→ Đã có jlpt-all.csv, bỏ qua tải.');
    return;
  }
  console.log('→ Tải elzup/jlpt-word-list out/all.csv...');
  await download('https://raw.githubusercontent.com/elzup/jlpt-word-list/master/out/all.csv', dest);
  console.log('→ jlpt-all.csv sẵn sàng.');
}

// ─── 3. KanjiDictVN (Hán Việt + KANJIDIC tiếng Anh) ───
async function downloadKanjiDictVN() {
  console.log('→ Tra cứu release mới nhất của trungnt2910/KanjiDictVN...');
  const release = await fetchJson('https://api.github.com/repos/trungnt2910/KanjiDictVN/releases/latest');

  const wantedAssets = {
    'kanjidic-vi': /^KANJIDIC_vietnamese\.zip$/,
    'kanjidic-en': /^KANJIDIC_english\.zip$/,
  };

  for (const [label, regex] of Object.entries(wantedAssets)) {
    const asset = release.assets.find((a) => regex.test(a.name));
    if (!asset) throw new Error(`Không tìm thấy asset cho ${label}`);

    const zipPath = path.join(DATA_DIR, `${label}.zip`);
    if (!fs.existsSync(zipPath)) {
      console.log(`→ Tải ${asset.name} (${(asset.size / 1024 / 1024).toFixed(1)}MB)...`);
      await download(asset.browser_download_url, zipPath);
    } else {
      console.log(`→ Đã có ${zipPath}, bỏ qua tải.`);
    }

    const extractDir = path.join(DATA_DIR, label);
    if (!fs.existsSync(extractDir)) {
      console.log(`→ Giải nén ${label}.zip...`);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);
    }
    console.log(`→ ${label}/ sẵn sàng.`);
  }
}

async function main() {
  ensureDir(DATA_DIR);
  await downloadJmdict();
  await downloadJlptWordList();
  await downloadKanjiDictVN();
  console.log('\nHoàn tất tải dữ liệu nguồn vào', DATA_DIR);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  });
}

module.exports = { DATA_DIR, ensureDir, download, fetchJson };
