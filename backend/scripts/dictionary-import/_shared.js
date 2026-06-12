'use strict';

// ─── Tiện ích dùng chung cho pipeline import từ điển ───

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DATA_DIR = path.join(__dirname, 'data');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Client gắn schema dictionary_module — dùng cho mọi thao tác bảng dict_*
const dictDb = supabaseAdmin.schema('dictionary_module');

// Đọc file checkpoint JSON, trả về defaultValue nếu chưa tồn tại
function readCheckpoint(name, defaultValue) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return defaultValue;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultValue; }
}

function writeCheckpoint(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data));
}

function appendFailedBatch(name, entry) {
  const file = path.join(DATA_DIR, name);
  const list = readCheckpoint(name, []);
  list.push(entry);
  fs.writeFileSync(file, JSON.stringify(list, null, 1));
}

// Chia mảng thành các batch kích thước cố định
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Đọc giới hạn --limit=N từ argv (dùng cho dry-run)
function getLimitArg() {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1], 10) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  DATA_DIR,
  supabaseAdmin,
  dictDb,
  readCheckpoint,
  writeCheckpoint,
  appendFailedBatch,
  chunk,
  getLimitArg,
  sleep,
};
