'use strict';

const { supabaseAdmin }       = require('../config/supabase');
const { activateSubscription } = require('./subscriptionService');
const { normalizeTransaction }  = require('./sepayClient');
const { COURSE_PREFIX, completeCoursePayment } = require('./coursePaymentService');
const { sendReceiptEmail } = require('../config/mailer');

const contentDb = supabaseAdmin.schema('course_module');
const billingDb = supabaseAdmin.schema('billing_module');

// Gửi biên lai qua email — best-effort, không được làm hỏng luồng khớp thanh toán.
async function emailReceiptSafe({ userId, typeLabel, itemName, amount, currency, orderCode, paymentCode, paidAt }) {
  try {
    const { data: u } = await supabaseAdmin.from('users').select('email, full_name').eq('id', userId).maybeSingle();
    if (!u?.email) return;
    await sendReceiptEmail(u.email, {
      typeLabel, itemName, amount, currency,
      orderCode, paymentCode, paidAt,
      buyerName: u.full_name || u.email,
    });
  } catch (err) {
    console.error('[paymentMatching] sendReceiptEmail failed:', err.message);
  }
}

/**
 * Idempotent transaction processor.
 * Can be called from both webhook and polling paths with the same raw payload.
 *
 * Returns: 'matched' | 'already_matched' | 'no_match' | 'error'
 */
async function processTransaction(rawPayload) {
  const tx = normalizeTransaction(rawPayload);

  // 1. Upsert the transaction record (idempotent by external_transaction_id)
  let txRecord;
  {
    const { data, error } = await billingDb
      .from('payment_transactions')
      .upsert(
        {
          provider:                'sepay',
          external_transaction_id: tx.externalId,
          reference_number:        tx.referenceNumber,
          account_number:          tx.accountNumber,
          bank_brand_name:         tx.bankBrandName,
          amount_in:               tx.amountIn,
          amount_out:              tx.amountOut,
          transaction_content:     tx.content,
          transaction_date:        tx.transactionDate,
          raw_payload:             rawPayload,
        },
        { onConflict: 'provider,external_transaction_id', ignoreDuplicates: false }
      )
      .select('id, matched_order_id, matched_course_order_id')
      .single();

    if (error) {
      console.error('[paymentMatching] upsert tx error', error.message);
      return 'error';
    }
    txRecord = data;
  }

  // Already matched in a previous call
  if (txRecord.matched_order_id || txRecord.matched_course_order_id) return 'already_matched';

  // 2. Find a matching pending order
  if (!tx.content || tx.amountIn <= 0) return 'no_match';

  // Extract potential payment code from content (PREFIX + 8 hex chars).
  // Hai loại prefix: PREM → premium subscription, COURSE → mua khóa học.
  const PREFIX   = process.env.TRANSFER_CONTENT_PREFIX || 'PREM';
  const codeRegex = new RegExp(`((?:${PREFIX}|${COURSE_PREFIX})[A-F0-9]{8})`, 'i');
  const match     = tx.content.match(codeRegex);
  if (!match) return 'no_match';

  const paymentCode = match[1].toUpperCase();

  if (paymentCode.startsWith(COURSE_PREFIX)) {
    return matchCourseOrder(paymentCode, tx, txRecord, rawPayload);
  }

  const { data: order, error: oErr } = await billingDb
    .from('payment_orders')
    .select('id, user_id, plan_id, amount, status, expires_at, order_code, payment_code')
    .eq('payment_code', paymentCode)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (oErr || !order) return 'no_match';

  // Verify amount exactly matches
  if (Number(order.amount) !== Number(tx.amountIn)) return 'no_match';

  // 3. Mark order as paid (atomic via update with status check)
  const now = new Date().toISOString();
  const { data: updated, error: uErr } = await billingDb
    .from('payment_orders')
    .update({
      status:                   'paid',
      paid_at:                  now,
      matched_transaction_id:   tx.externalId,
      matched_reference_number: tx.referenceNumber,
      matched_transaction_time: tx.transactionDate,
      raw_match_payload:        rawPayload,
      updated_at:               now,
    })
    .eq('id', order.id)
    .eq('status', 'pending')   // optimistic lock — only update if still pending
    .select('id')
    .maybeSingle();

  if (uErr || !updated) return 'no_match'; // race condition, another handler won

  // 4. Link transaction → order
  const { error: lErr } = await billingDb
    .from('payment_transactions')
    .update({ matched_order_id: order.id })
    .eq('id', txRecord.id);
  if (lErr) console.error('[paymentMatching] link tx→order error', lErr.message);

  // 5. Activate subscription — nếu lỗi, fulfilled_at ở lại NULL để
  // retryUnfulfilledOrders() tự cấp lại quyền ở lần chạy sau.
  try {
    await activateSubscription(order.user_id, order.plan_id, 'sepay', order.id);
    await billingDb
      .from('payment_orders')
      .update({ fulfilled_at: new Date().toISOString() })
      .eq('id', order.id);
  } catch (err) {
    console.error('[paymentMatching] activateSubscription error', err.message);
  }

  // 6. Email biên lai (best-effort)
  const { data: plan } = await billingDb.from('subscription_plans').select('name').eq('id', order.plan_id).maybeSingle();
  await emailReceiptSafe({
    userId: order.user_id, typeLabel: 'Gói', itemName: plan?.name || 'Premium',
    amount: order.amount, currency: 'VND', orderCode: order.order_code, paymentCode: order.payment_code, paidAt: now,
  });

  console.log(`[paymentMatching] matched order ${order.id} ← tx ${tx.externalId}`);
  return 'matched';
}

/**
 * Luồng mua khóa học (payment_code prefix COURSE) — mirror luồng subscription ở trên:
 * khớp order pending → set paid (optimistic lock) → link transaction → ghi payments
 * 'completed' để trigger tự tạo enrollment.
 */
async function matchCourseOrder(paymentCode, tx, txRecord, rawPayload) {
  const { data: order, error: oErr } = await billingDb
    .from('course_payment_orders')
    .select('id, student_id, course_id, amount, status, expires_at, order_code, payment_code')
    .eq('payment_code', paymentCode)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (oErr || !order) return 'no_match';

  // Verify amount exactly matches
  if (Number(order.amount) !== Number(tx.amountIn)) return 'no_match';

  const now = new Date().toISOString();
  const { data: updated, error: uErr } = await billingDb
    .from('course_payment_orders')
    .update({
      status:                   'paid',
      paid_at:                  now,
      matched_transaction_id:   tx.externalId,
      matched_reference_number: tx.referenceNumber,
      matched_transaction_time: tx.transactionDate,
      raw_match_payload:        rawPayload,
      updated_at:               now,
    })
    .eq('id', order.id)
    .eq('status', 'pending')   // optimistic lock — only update if still pending
    .select('id')
    .maybeSingle();

  if (uErr || !updated) return 'no_match'; // race condition, another handler won

  const { error: lErr } = await billingDb
    .from('payment_transactions')
    .update({ matched_course_order_id: order.id })
    .eq('id', txRecord.id);
  if (lErr) console.error('[paymentMatching] link tx→course order error', lErr.message);

  // Ghi danh — nếu lỗi, fulfilled_at ở lại NULL để retryUnfulfilledOrders() cấp lại.
  try {
    await completeCoursePayment(order, tx.externalId);
    await billingDb
      .from('course_payment_orders')
      .update({ fulfilled_at: new Date().toISOString() })
      .eq('id', order.id);
  } catch (err) {
    console.error('[paymentMatching] completeCoursePayment error', err.message);
  }

  // Email biên lai (best-effort)
  const { data: course } = await contentDb.from('courses').select('title').eq('id', order.course_id).maybeSingle();
  await emailReceiptSafe({
    userId: order.student_id, typeLabel: 'Khóa học', itemName: course?.title || 'Khóa học',
    amount: order.amount, currency: 'VND', orderCode: order.order_code, paymentCode: order.payment_code, paidAt: now,
  });

  console.log(`[paymentMatching] matched course order ${order.id} ← tx ${tx.externalId}`);
  return 'matched';
}

// ─── Đối soát chủ động ────────────────────────────────────────────────────────

// Chặn hai lượt đối soát chạy chồng nhau (cron + nút admin + poll của học viên).
let _reconcileRunning = false;

/**
 * Poll SePay for recent transactions and try to match pending orders.
 * Đây là đường CHÍNH để mở khóa khi backend chạy nội bộ: webhook của SePay không
 * gọi vào được localhost, còn hàm này gọi ra SePay nên luôn hoạt động.
 * Được gọi từ cron trong server.js, từ reconcileOnDemand(), và từ nút admin.
 */
async function reconcilePendingOrders() {
  if (_reconcileRunning) return { checked: 0, matched: 0, skipped: true };
  _reconcileRunning = true;
  try {
    return await runReconcile();
  } finally {
    _reconcileRunning = false;
  }
}

async function runReconcile() {
  const { listTransactions } = require('./sepayClient');

  // Only run if there are pending orders (subscription hoặc mua khóa học)
  const nowIso = new Date().toISOString();
  const [{ count: subCount }, { count: courseCount }] = await Promise.all([
    billingDb
      .from('payment_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gt('expires_at', nowIso),
    billingDb
      .from('course_payment_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gt('expires_at', nowIso),
  ]);

  if (!subCount && !courseCount) return { checked: 0, matched: 0 };

  let transactions;
  try {
    const accountNumber = process.env.QR_ACCOUNT_NUMBER || '';
    // Fetch last 50 transactions; enough for any reasonable volume
    transactions = await listTransactions({ account_number: accountNumber, limit: 50 });
  } catch (err) {
    console.error('[reconcile] SePay fetch error', err.message);
    return { checked: 0, matched: 0, error: err.message };
  }

  let matched = 0;
  for (const raw of transactions) {
    const result = await processTransaction(raw);
    if (result === 'matched') matched++;
  }

  return { checked: transactions.length, matched };
}

// Đối soát theo yêu cầu, chặn tần suất 15s. Gọi từ endpoint mà frontend poll để học
// viên đang đứng trước màn hình QR được mở khóa sau ~15s, thay vì chờ hết chu kỳ cron.
let _lastOnDemand = 0;

async function reconcileOnDemand() {
  if (Date.now() - _lastOnDemand < 15_000) return;
  _lastOnDemand = Date.now();
  try {
    await reconcilePendingOrders();
  } catch (err) {
    console.error('[reconcileOnDemand]', err.message);
  }
}

/**
 * Cấp lại quyền cho các đơn đã 'paid' nhưng bước cấp quyền thất bại (fulfilled_at NULL).
 * An toàn khi chạy lại nhiều lần nhờ last_order_id (gói premium) và unique index
 * uq_payments_provider_tx (mua khóa học).
 */
async function retryUnfulfilledOrders() {
  let fixed = 0, failed = 0;

  const { data: subOrders } = await billingDb
    .from('payment_orders')
    .select('id, user_id, plan_id')
    .eq('status', 'paid')
    .is('fulfilled_at', null)
    .limit(20);

  for (const order of subOrders || []) {
    try {
      await activateSubscription(order.user_id, order.plan_id, 'sepay', order.id);
      await billingDb
        .from('payment_orders')
        .update({ fulfilled_at: new Date().toISOString() })
        .eq('id', order.id);
      fixed++;
    } catch (err) {
      failed++;
      console.error('[retryFulfill] order', order.id, err.message);
    }
  }

  const { data: courseOrders } = await billingDb
    .from('course_payment_orders')
    .select('id, student_id, course_id, amount, matched_transaction_id')
    .eq('status', 'paid')
    .is('fulfilled_at', null)
    .limit(20);

  for (const order of courseOrders || []) {
    try {
      await completeCoursePayment(order, order.matched_transaction_id);
      await billingDb
        .from('course_payment_orders')
        .update({ fulfilled_at: new Date().toISOString() })
        .eq('id', order.id);
      fixed++;
    } catch (err) {
      failed++;
      console.error('[retryFulfill] course order', order.id, err.message);
    }
  }

  if (fixed || failed) console.log(`[retryFulfill] cấp lại ${fixed} đơn, lỗi ${failed}`);
  return { fixed, failed };
}

module.exports = {
  processTransaction,
  reconcilePendingOrders,
  reconcileOnDemand,
  retryUnfulfilledOrders,
};
