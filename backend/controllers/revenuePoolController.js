'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { getSetting, setSetting } = require('../services/settingsService');
const { computePeriod, finalizePeriod, refinalizePeriod } = require('../services/revenuePoolService');
const { getTeacherCourseRevenue, getPlatformCourseRevenue } = require('../services/courseRevenueService');
const billingDb = supabaseAdmin.schema('billing_module');

const curPeriod = () => new Date().toISOString().slice(0, 7);

async function attachTeacherNames(rows) {
  const ids = [...new Set(rows.map(r => r.teacher_id).filter(Boolean))];
  if (!ids.length) return rows.map(r => ({ ...r, teacher: null }));
  // Kèm tài khoản ngân hàng để admin chuyển khoản ngay trên màn hình lệnh chi.
  const { data } = await supabaseAdmin.from('users')
    .select('id,full_name,email,bank_name,bank_account_number,bank_account_name').in('id', ids);
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

// ── Admin: chốt sổ lại một kỳ ─────────────────────────────────────────────────
// POST /api/admin/revenue-pool/:period/refinalize
exports.refinalize = async (req, res) => {
  try {
    const r = await refinalizePeriod(req.params.period);
    res.json({
      message: 'Đã tính lại và chốt sổ theo số liệu mới nhất.',
      pool_amount: r.pool_amount,
      total_uses: r.total_uses,
    });
  } catch (err) {
    console.error('revenuePool.refinalize:', err);
    res.status(400).json({ error: err.message });
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

    // Ước tính tháng hiện tại — LUÔN tính, kể cả khi admin đã chốt sổ sớm.
    // Tháng chưa kết thúc thì số đã chốt là số dở dang; giáo viên cần thấy con số
    // đang chạy theo dữ liệu thực tế, nếu không sẽ thắc mắc vì sao tiền bị hụt.
    const period = curPeriod();
    const c = await computePeriod(period);
    const mine = c.payouts.find(p => p.teacher_id === teacherId);
    const estimate = {
      period_key: period,
      pool_amount: c.pool_amount,
      total_uses: c.total_uses,
      uses: mine?.uses || 0,
      share_pct: mine?.share_pct || 0,
      amount: mine?.amount || 0,
      // Kỳ đã chốt nhưng tháng chưa xong → số trong bảng lịch sử là tạm, chưa phải số cuối.
      finalized_early: (payouts || []).some(p => p.period_key === period),
    };

    const total_earned = (payouts || []).reduce((s, p) => s + Number(p.amount || 0), 0);

    // Doanh thu bán khóa học — nguồn tiền riêng, không nằm trong quỹ chia sẻ.
    const course = await getTeacherCourseRevenue(teacherId);

    res.json({ payouts: payouts || [], estimate, total_earned, course });
  } catch (err) {
    console.error('revenuePool.teacherEarnings:', err);
    res.status(500).json({ error: 'Không thể tải thu nhập.' });
  }
};

// ── Admin: doanh thu bán khóa học toàn hệ thống ───────────────────────────────
// GET /api/admin/course-revenue?page=&limit=
exports.adminCourseRevenue = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  try {
    res.json(await getPlatformCourseRevenue({ page, limit }));
  } catch (err) {
    console.error('revenuePool.adminCourseRevenue:', err);
    res.status(500).json({ error: 'Không thể tải doanh thu khóa học.' });
  }
};
