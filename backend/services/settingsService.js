'use strict';

// Generic key/value app settings (jsonb), mirrors the placement_test_configs
// cache+upsert pattern. Used for the revenue-pool percentage, etc.

const { supabaseAdmin } = require('../config/supabase');

const _cache = new Map(); // key → { value, at }
const TTL_MS = 60_000;

async function getSetting(key, fallback = {}) {
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle();
  const value = data?.value ?? fallback;
  _cache.set(key, { value, at: Date.now() });
  return value;
}

async function setSetting(key, value) {
  await supabaseAdmin.from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  _cache.set(key, { value, at: Date.now() });
  return value;
}

// Revenue-pool config helpers
async function getPoolPct() {
  const cfg = await getSetting('revenue_pool', { pool_pct: 0.30 });
  const pct = Number(cfg.pool_pct);
  return Number.isFinite(pct) && pct >= 0 && pct <= 1 ? pct : 0.30;
}

module.exports = { getSetting, setSetting, getPoolPct };
