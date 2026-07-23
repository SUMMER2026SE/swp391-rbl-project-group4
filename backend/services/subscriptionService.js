'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { invalidateTierCache } = require('./quotaService');
const billingDb = supabaseAdmin.schema('billing_module');

const DURATION_DAYS = parseInt(process.env.SUBSCRIPTION_DURATION_DAYS || '30', 10);

// ── Plan helpers ──────────────────────────────────────────────────────────────

async function getPlanByCode(code) {
  const { data, error } = await billingDb
    .from('subscription_plans')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function getActivePlans() {
  const { data, error } = await billingDb
    .from('subscription_plans')
    .select('id, code, name, tier, billing_cycle, price, currency, features_json')
    .eq('is_active', true)
    .order('price', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// ── Subscription helpers ──────────────────────────────────────────────────────

async function getActiveSubscription(userId) {
  const { data, error } = await billingDb
    .from('user_subscriptions')
    .select('*, plan:subscription_plans(code,name,tier,price,currency)')
    .eq('user_id', userId)
    .in('status', ['active', 'grace_period'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Activate or extend premium subscription after successful payment.
 * - No active subscription → create new
 * - Active premium → extend current_period_end by DURATION_DAYS
 * - Expired premium → reactivate from now
 */
async function activateSubscription(userId, planId, source = 'sepay') {
  const now  = new Date();
  const plan = await billingDb
    .from('subscription_plans')
    .select('tier')
    .eq('id', planId)
    .single();

  if (plan.error) throw new Error(plan.error.message);
  const tier = plan.data.tier;

  const existing = await getActiveSubscription(userId);

  if (existing && existing.plan?.tier === 'premium') {
    // Extend current period
    const currentEnd = existing.current_period_end
      ? new Date(existing.current_period_end)
      : now;
    const newEnd = new Date(Math.max(currentEnd.getTime(), now.getTime()));
    newEnd.setDate(newEnd.getDate() + DURATION_DAYS);

    const { error } = await billingDb
      .from('user_subscriptions')
      .update({
        current_period_end: newEnd.toISOString(),
        status: 'active',
        source,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    invalidateTierCache(userId);
    return existing.id;
  }

  // Create new subscription
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + DURATION_DAYS);

  const { data: newSub, error: cErr } = await billingDb
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      tier,
      status: 'active',
      started_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      source,
    })
    .select('id')
    .single();

  if (cErr) throw new Error(cErr.message);
  invalidateTierCache(userId);
  return newSub.id;
}

async function cancelSubscription(userId) {
  const sub = await getActiveSubscription(userId);
  if (!sub) return null;

  const { error } = await billingDb
    .from('user_subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', sub.id);
  if (error) throw new Error(error.message);
  invalidateTierCache(userId);
  return sub.id;
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

async function adminGrantPremium(userId, durationDays = DURATION_DAYS) {
  const plan = await getPlanByCode('premium_monthly');
  if (!plan) throw new Error('premium_monthly plan not found');
  return activateSubscription(userId, plan.id, 'admin_grant');
}

async function adminListSubscriptions({ page = 1, limit = 20, status } = {}) {
  let query = billingDb
    .from('user_subscriptions')
    .select(`
      id, user_id, tier, status, started_at, current_period_end, source, created_at,
      plan:subscription_plans(code, name, price)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { subscriptions: data || [], total: count || 0 };
}

module.exports = {
  getPlanByCode,
  getActivePlans,
  getActiveSubscription,
  activateSubscription,
  cancelSubscription,
  adminGrantPremium,
  adminListSubscriptions,
};
