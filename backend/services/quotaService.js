'use strict';

const { supabaseAdmin } = require('../config/supabase');

// ── Period key helpers ────────────────────────────────────────────────────────

function getCurrentPeriodKey(periodType) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  if (periodType === 'daily')   return `${yyyy}-${mm}-${dd}`;
  if (periodType === 'monthly') return `${yyyy}-${mm}`;
  return 'global';
}

// ── Tier resolution ───────────────────────────────────────────────────────────

// Cache: userId → { tier, expiresAt }
const _tierCache = new Map();
const TIER_CACHE_TTL_MS = 60_000;

async function getUserTier(userId) {
  const cached = _tierCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.tier;

  const { data } = await supabaseAdmin
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .in('status', ['active', 'grace_period'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tier = data?.tier === 'premium' ? 'premium' : 'free';
  _tierCache.set(userId, { tier, expiresAt: Date.now() + TIER_CACHE_TTL_MS });
  return tier;
}

function invalidateTierCache(userId) {
  _tierCache.delete(userId);
}

// ── Entitlement lookup ────────────────────────────────────────────────────────

// Cache all entitlements at startup (small table)
let _entitlements = null;
let _entitlementsFetchedAt = 0;

async function getEntitlement(tier, featureCode) {
  if (!_entitlements || Date.now() - _entitlementsFetchedAt > 300_000) {
    const { data } = await supabaseAdmin
      .from('feature_entitlements')
      .select('tier, feature_code, limit_value, period_type');
    _entitlements = {};
    for (const row of data || []) {
      _entitlements[`${row.tier}::${row.feature_code}`] = row;
    }
    _entitlementsFetchedAt = Date.now();
  }
  return _entitlements[`${tier}::${featureCode}`] || null;
}

// ── Usage counter ─────────────────────────────────────────────────────────────

async function getUsage(userId, featureCode, periodKey) {
  const { data } = await supabaseAdmin
    .from('feature_usage_counters')
    .select('used_count, used_amount')
    .eq('user_id', userId)
    .eq('feature_code', featureCode)
    .eq('period_key', periodKey)
    .maybeSingle();
  return { used_count: data?.used_count ?? 0, used_amount: data?.used_amount ?? 0 };
}

async function incrementUsage(userId, featureCode, amount = 1, tier = null) {
  const ent = await getEntitlement(tier || (await getUserTier(userId)), featureCode);
  const periodType = ent?.period_type ?? 'monthly';
  const periodKey  = getCurrentPeriodKey(periodType);

  const { data: existing } = await supabaseAdmin
    .from('feature_usage_counters')
    .select('id, used_count')
    .eq('user_id', userId)
    .eq('feature_code', featureCode)
    .eq('period_key', periodKey)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from('feature_usage_counters')
      .update({
        used_count: existing.used_count + 1,
        used_amount: existing.used_amount + amount,
        tier_at_time: tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabaseAdmin.from('feature_usage_counters').insert({
      user_id: userId,
      feature_code: featureCode,
      period_type: periodType,
      period_key: periodKey,
      used_count: 1,
      used_amount: amount,
      tier_at_time: tier,
    });
  }
}

// ── Main access check ─────────────────────────────────────────────────────────

/**
 * Check if user can use a feature.
 * @returns {{ allowed: boolean, used: number, limit: number, tier: string, resetInfo: string }}
 */
async function checkAccess(userId, featureCode) {
  const tier = await getUserTier(userId);
  const ent  = await getEntitlement(tier, featureCode);

  if (!ent) return { allowed: true, used: 0, limit: -1, tier, resetInfo: '' };

  // Unlimited
  if (ent.limit_value === -1) return { allowed: true, used: 0, limit: -1, tier, resetInfo: '' };

  // Non-time-based (e.g. chars per file): just return the limit for validation upstream
  if (ent.period_type === 'none') {
    return { allowed: true, used: 0, limit: ent.limit_value, tier, resetInfo: '' };
  }

  const periodKey  = getCurrentPeriodKey(ent.period_type);
  const { used_count } = await getUsage(userId, featureCode, periodKey);
  const allowed = used_count < ent.limit_value;

  const resetInfo = ent.period_type === 'daily' ? 'Giới hạn reset lúc 0:00 mỗi ngày.'
                  : 'Giới hạn reset đầu tháng.';

  return {
    allowed,
    used: used_count,
    limit: ent.limit_value,
    tier,
    resetInfo,
  };
}

/**
 * Check access then immediately increment if allowed.
 * Returns same shape as checkAccess.
 */
async function useFeature(userId, featureCode, amount = 1) {
  const result = await checkAccess(userId, featureCode);
  if (!result.allowed) return result;
  await incrementUsage(userId, featureCode, amount, result.tier);
  return { ...result, used: result.used + 1 };
}

/**
 * Get remaining uses for a feature this period.
 */
async function getRemaining(userId, featureCode) {
  const tier = await getUserTier(userId);
  const ent  = await getEntitlement(tier, featureCode);
  if (!ent || ent.limit_value === -1) return { remaining: -1, used: 0, limit: -1, tier };

  if (ent.period_type === 'none') return { remaining: ent.limit_value, used: 0, limit: ent.limit_value, tier };

  const periodKey  = getCurrentPeriodKey(ent.period_type);
  const { used_count } = await getUsage(userId, featureCode, periodKey);
  return {
    remaining: Math.max(0, ent.limit_value - used_count),
    used: used_count,
    limit: ent.limit_value,
    tier,
  };
}

/**
 * Get all feature quotas for a user (for the /usage/me endpoint).
 */
async function getAllQuotas(userId) {
  const tier = await getUserTier(userId);
  const featureCodes = [
    'placement_test_monthly',
    'kanji_file_monthly',
    'kanji_chars_per_file',
    'listening_practice_monthly',
    'ai_chat_daily',
    'flashcard_ai_suggest_daily',
  ];

  const quotas = await Promise.all(featureCodes.map(async code => {
    const ent = await getEntitlement(tier, code);
    if (!ent) return { feature: code, used: 0, limit: -1, remaining: -1 };
    if (ent.limit_value === -1) return { feature: code, used: 0, limit: -1, remaining: -1, periodType: ent.period_type };
    if (ent.period_type === 'none') return { feature: code, used: 0, limit: ent.limit_value, remaining: ent.limit_value, periodType: 'none' };
    const periodKey = getCurrentPeriodKey(ent.period_type);
    const { used_count } = await getUsage(userId, code, periodKey);
    return {
      feature: code,
      used: used_count,
      limit: ent.limit_value,
      remaining: Math.max(0, ent.limit_value - used_count),
      periodType: ent.period_type,
      periodKey,
    };
  }));

  return { tier, quotas };
}

module.exports = {
  getUserTier,
  invalidateTierCache,
  getEntitlement,
  checkAccess,
  useFeature,
  incrementUsage,
  getRemaining,
  getAllQuotas,
  getCurrentPeriodKey,
};
