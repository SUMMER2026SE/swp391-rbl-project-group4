'use strict';

const {
  getActivePlans,
  getActiveSubscription,
  getPlanByCode,
  adminGrantPremium,
  adminListSubscriptions,
  cancelSubscription,
} = require('../services/subscriptionService');

const {
  createOrder,
  getOrder,
  cancelOrder,
  getUserPendingOrder,
} = require('../services/paymentOrderService');

const { getAllQuotas } = require('../services/quotaService');
const { supabaseAdmin } = require('../config/supabase');

// ── Public / user endpoints ───────────────────────────────────────────────────

async function getPlans(req, res) {
  try {
    const plans = await getActivePlans();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMySubscription(req, res) {
  try {
    const sub    = await getActiveSubscription(req.user.id);
    const quotas = await getAllQuotas(req.user.id);
    res.json({ subscription: sub, ...quotas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function checkout(req, res) {
  const { plan_code } = req.body;
  if (!plan_code) return res.status(400).json({ error: 'plan_code là bắt buộc.' });

  try {
    const plan = await getPlanByCode(plan_code);
    if (!plan) return res.status(404).json({ error: 'Gói không tồn tại.' });
    if (plan.tier === 'free') return res.status(400).json({ error: 'Gói miễn phí không cần thanh toán.' });

    // Reuse existing pending order if still valid
    const existing = await getUserPendingOrder(req.user.id, plan.id);
    if (existing) return res.json({ order: existing });

    const order = await createOrder(req.user.id, plan.id);
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPaymentOrder(req, res) {
  try {
    const order = await getOrder(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order không tồn tại.' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function cancelPaymentOrder(req, res) {
  try {
    await cancelOrder(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getBillingHistory(req, res) {
  const page  = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));

  try {
    const { data, count, error } = await supabaseAdmin
      .from('payment_orders')
      .select(`
        id, order_code, payment_code, amount, currency,
        status, paid_at, created_at,
        plan:subscription_plans(code, name)
      `, { count: 'exact' })
      .eq('user_id', req.user.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ orders: data || [], total: count || 0, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUsage(req, res) {
  try {
    const data = await getAllQuotas(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Admin endpoints ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/subscriptions/users?search=&page=&tier=
 * Returns all users enriched with their subscription tier and expiry.
 */
async function adminGetUsersWithSubscription(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const search = req.query.search?.trim() || '';
  const tier   = req.query.tier  || '';   // 'free' | 'premium' | ''
  const offset = (page - 1) * limit;

  try {
    // 1. Query users table (paginated + search)
    let userQuery = supabaseAdmin
      .from('users')
      .select('id, full_name, email, avatar_url, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) userQuery = userQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: users, count, error: uErr } = await userQuery;
    if (uErr) throw new Error(uErr.message);

    if (!users || users.length === 0) {
      return res.json({ users: [], total: 0, page, limit });
    }

    // 2. Fetch active subscriptions for these users in one query
    const userIds = users.map(u => u.id);
    const { data: subs } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, tier, status, current_period_end, started_at, source')
      .in('user_id', userIds)
      .in('status', ['active', 'grace_period'])
      .order('created_at', { ascending: false });

    // Build map: userId → subscription
    const subMap = {};
    for (const s of subs || []) {
      if (!subMap[s.user_id]) subMap[s.user_id] = s;
    }

    // 3. Merge & compute days remaining
    const now = Date.now();
    let enriched = users.map(u => {
      const sub = subMap[u.id] || null;
      const isPremium = sub?.tier === 'premium';
      const daysLeft = isPremium && sub.current_period_end
        ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - now) / 86_400_000))
        : null;
      return {
        ...u,
        tier:               isPremium ? 'premium' : 'free',
        subscription_status: sub?.status || null,
        current_period_end:  sub?.current_period_end || null,
        days_left:           daysLeft,
        sub_source:          sub?.source || null,
      };
    });

    // 4. Filter by tier if requested
    if (tier === 'premium') enriched = enriched.filter(u => u.tier === 'premium');
    if (tier === 'free')    enriched = enriched.filter(u => u.tier === 'free');

    res.json({ users: enriched, total: count || 0, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function adminGetSubscriptions(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const status = req.query.status || null;

  try {
    const result = await adminListSubscriptions({ page, limit, status });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function adminGrantSubscription(req, res) {
  const { user_id, duration_days } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id là bắt buộc.' });

  try {
    const subId = await adminGrantPremium(user_id, duration_days);
    res.json({ ok: true, subscription_id: subId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function adminCancelSubscription(req, res) {
  try {
    const subId = await cancelSubscription(req.params.userId);
    if (!subId) return res.status(404).json({ error: 'Không có subscription đang hoạt động.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function adminGetPayments(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const status = req.query.status || null;

  let query = supabaseAdmin
    .from('payment_orders')
    .select(`
      id, user_id, order_code, payment_code, amount, currency,
      status, paid_at, created_at,
      plan:subscription_plans(code, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);

  try {
    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ orders: data || [], total: count || 0, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getPlans,
  getMySubscription,
  checkout,
  getPaymentOrder,
  cancelPaymentOrder,
  getBillingHistory,
  getUsage,
  adminGetUsersWithSubscription,
  adminGetSubscriptions,
  adminGrantSubscription,
  adminCancelSubscription,
  adminGetPayments,
};
