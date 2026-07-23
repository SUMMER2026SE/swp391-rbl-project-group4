'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { getSetting, setSetting } = require('../services/settingsService');
const { computePeriod, finalizePeriod } = require('../services/revenuePoolService');
const billingDb = supabaseAdmin.schema('billing_module');

const curPeriod = () => new Date().toISOString().slice(0, 7);

async function attachTeacherNames(rows) {
  const ids = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
  if (!ids.length) return rows.map(r => ({ ...r, teacher: null }));
  const { data } = await supabaseAdmin.from('users').select('id,full_name,email').in('id', ids);
  const m = Object.fromEntries((data || []).map(u => [u.id, u]));
  return rows.map(r => ({ ...r, teacher: m[r.teacher_id] || { email: r.teacher_id } }));
}

// ── Admin: config ─────────────────────────────────────────────────────────────
exports.getConfig = async (_req, res) => {
  const cfg = await getSetting('revenue_pool', { pool_pct: 0.30 });
  res.json(cfg);
};

exports.updateConfig = async (req, res) => {
  const pct = Number(req.body.pool_pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
    return res.status(400).json({ error: 'pool_pct phải trong khoảng 0–1 (vd 0.3 = 30%).' });
  }
  const cfg = await setSetting('revenue_pool', { pool_pct: pct });
  res.json(cfg);
};

// ── Admin: view a period (finalized rows, or live preview if not yet) ──────────
exports.getPeriod = async (req, res) => {
  const periodKey = req.query.period || curPeriod();
  try {
    const { data: period } = await billingDb
      .from('revenue_pool_periods').select('*').eq('period_key', periodKey).maybeSingle();

    if (period) {
      const { data: payouts } = await billingDb
        .from('teacher_payouts').select('*').eq('period_key', periodKey).order('amount', { ascending: false });
      return res.json({ period, payouts: await attachTeacherNames(payouts || []), finalized: true });
    }

    // Not finalized yet → live preview
    const c = await computePeriod(periodKey);
    const payouts = [...c.payouts].sort((a, b) => b.amount - a.amount);
    return res.json({
      period: {
        period_key: c.period_key, total_vip_revenue: c.total_vip_revenue, pool_pct: c.pool_pct,
        pool_amount: c.pool_amount, total_uses: c.total_uses, status: 'preview',
      },
      payouts: await attachTeacherNames(payouts),
      finalized: false,
    });
  } catch (err) {
    console.error('revenuePool.getPeriod:', err);
    res.status(500).json({ error: 'Không thể tải dữ liệu quỹ.' });
  }
};

// ── Admin: finalize a period manually ─────────────────────────────────────────
exports.finalize = async (req, res) => {
  try {
    const r = await finalizePeriod(req.params.period);
    if (r.skipped) return res.status(409).json({ error: 'Kỳ này đã được chốt sổ trước đó.' });
    res.json({ message: 'Đã chốt sổ và ghi nhận thu nhập giáo viên.', pool_amount: r.pool_amount, total_uses: r.total_uses });
  } catch (err) {
    console.error('revenuePool.finalize:', err);
    res.status(500).json({ error: 'Không thể chốt sổ.' });
  }
};

// ── Admin: mark a payout as paid ──────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const { error } = await billingDb.from('teacher_payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Đã đánh dấu đã trả.' });
  } catch (err) {
    console.error('revenuePool.markPaid:', err);
    res.status(500).json({ error: 'Không thể cập nhật.' });
  }
};

// ── Teacher: my earnings (finalized payouts + current-month live estimate) ─────
exports.teacherEarnings = async (req, res) => {
  const teacherId = req.user.id;
  try {
    const { data: payouts } = await billingDb
      .from('teacher_payouts').select('*').eq('teacher_id', teacherId).order('period_key', { ascending: false });

    // Live estimate for the current (not-yet-finalized) month.
    const period = curPeriod();
    let estimate = null;
    if (!(payouts || []).some(p => p.period_key === period)) {
      const c = await computePeriod(period);
      const mine = c.payouts.find(p => p.teacher_id === teacherId);
      estimate = {
        period_key: period,
        pool_amount: c.pool_amount,
        total_uses: c.total_uses,
        uses: mine?.uses || 0,
        share_pct: mine?.share_pct || 0,
        amount: mine?.amount || 0,
      };
    }

    const total_earned = (payouts || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    res.json({ payouts: payouts || [], estimate, total_earned });
  } catch (err) {
    console.error('revenuePool.teacherEarnings:', err);
    res.status(500).json({ error: 'Không thể tải thu nhập.' });
  }
};
