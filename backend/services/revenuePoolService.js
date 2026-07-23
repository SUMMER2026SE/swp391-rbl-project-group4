'use strict';

// Monthly revenue-share pool: skim a % of VIP subscription revenue and split it
// among teachers proportional to how many times students used their content.

const { supabaseAdmin } = require('../config/supabase');
const { getPoolPct } = require('./settingsService');

const billingDb = supabaseAdmin.schema('billing_module');

const round = (n) => Math.round(Number(n) || 0);

// Month boundaries for a 'YYYY-MM' period key (UTC).
function periodBounds(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end   = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function prevPeriodKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

// Compute (without persisting) the pool + per-teacher breakdown for a period.
async function computePeriod(periodKey) {
  const { start, end } = periodBounds(periodKey);
  const pool_pct = await getPoolPct();

  const { data: revData } = await supabaseAdmin.rpc('vip_revenue', { p_start: start, p_end: end });
  const total_vip_revenue = Number(revData) || 0;
  const pool_amount = round(total_vip_revenue * pool_pct);

  const { data: useRows } = await supabaseAdmin.rpc('teacher_uses', { p_period: periodKey });
  const teachers = (useRows || []).map(r => ({ teacher_id: r.teacher_id, uses: Number(r.uses) || 0 }));
  const total_uses = teachers.reduce((s, t) => s + t.uses, 0);

  // Proportional split; give any rounding remainder to the top-use teacher.
  const payouts = teachers.map(t => {
    const share_pct = total_uses > 0 ? t.uses / total_uses : 0;
    return { teacher_id: t.teacher_id, uses: t.uses, share_pct, amount: round(pool_amount * share_pct) };
  });
  if (total_uses > 0 && payouts.length) {
    const distributed = payouts.reduce((s, p) => s + p.amount, 0);
    const remainder = pool_amount - distributed;
    if (remainder !== 0) {
      payouts.sort((a, b) => b.uses - a.uses);
      payouts[0].amount += remainder;
    }
  }

  return { period_key: periodKey, pool_pct, total_vip_revenue, pool_amount, total_uses, payouts };
}

// Persist the distribution for a period. Idempotent: skips if already finalized.
async function finalizePeriod(periodKey) {
  const { data: existing } = await billingDb
    .from('revenue_pool_periods').select('period_key').eq('period_key', periodKey).maybeSingle();
  if (existing) return { skipped: true, period_key: periodKey };

  const c = await computePeriod(periodKey);

  await billingDb.from('revenue_pool_periods').insert({
    period_key: periodKey,
    total_vip_revenue: c.total_vip_revenue,
    pool_pct: c.pool_pct,
    pool_amount: c.pool_amount,
    total_uses: c.total_uses,
    status: 'finalized',
    finalized_at: new Date().toISOString(),
  });

  if (c.payouts.length) {
    await billingDb.from('teacher_payouts').insert(
      c.payouts.map(p => ({ period_key: periodKey, teacher_id: p.teacher_id, uses: p.uses, share_pct: p.share_pct, amount: p.amount }))
    );
  }
  return { skipped: false, ...c };
}

// Run by cron: finalize last month if the month has ended and isn't finalized yet.
async function finalizePreviousMonth() {
  const periodKey = prevPeriodKey();
  try {
    const r = await finalizePeriod(periodKey);
    if (!r.skipped) console.log(`[revenuePool] finalized ${periodKey}: pool=${r.pool_amount}, uses=${r.total_uses}`);
    return r;
  } catch (e) {
    console.error('[revenuePool] finalizePreviousMonth failed:', e.message);
  }
}

module.exports = { computePeriod, finalizePeriod, finalizePreviousMonth, prevPeriodKey };
