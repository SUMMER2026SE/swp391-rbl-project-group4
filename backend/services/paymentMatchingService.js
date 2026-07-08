'use strict';

const { supabaseAdmin }       = require('../config/supabase');
const { activateSubscription } = require('./subscriptionService');
const { normalizeTransaction }  = require('./sepayClient');

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
    const { data, error } = await supabaseAdmin
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
      .select('id, matched_order_id')
      .single();

    if (error) {
      console.error('[paymentMatching] upsert tx error', error.message);
      return 'error';
    }
    txRecord = data;
  }

  // Already matched in a previous call
  if (txRecord.matched_order_id) return 'already_matched';

  // 2. Find a matching pending order
  if (!tx.content || tx.amountIn <= 0) return 'no_match';

  // Extract potential payment code from content (PREFIX + 8 hex chars)
  const PREFIX   = process.env.TRANSFER_CONTENT_PREFIX || 'PREM';
  const codeRegex = new RegExp(`(${PREFIX}[A-F0-9]{8})`, 'i');
  const match     = tx.content.match(codeRegex);
  if (!match) return 'no_match';

  const paymentCode = match[1].toUpperCase();

  const { data: order, error: oErr } = await supabaseAdmin
    .from('payment_orders')
    .select('id, user_id, plan_id, amount, status, expires_at')
    .eq('payment_code', paymentCode)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (oErr || !order) return 'no_match';

  // Verify amount exactly matches
  if (Number(order.amount) !== Number(tx.amountIn)) return 'no_match';

  // 3. Mark order as paid (atomic via update with status check)
  const now = new Date().toISOString();
  const { data: updated, error: uErr } = await supabaseAdmin
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
  await supabaseAdmin
    .from('payment_transactions')
    .update({ matched_order_id: order.id })
    .eq('id', txRecord.id);

  // 5. Activate subscription
  try {
    await activateSubscription(order.user_id, order.plan_id, 'sepay');
  } catch (err) {
    console.error('[paymentMatching] activateSubscription error', err.message);
    // Order is marked paid but subscription failed — log for manual review
  }

  console.log(`[paymentMatching] matched order ${order.id} ← tx ${tx.externalId}`);
  return 'matched';
}

/**
 * Poll SePay for recent transactions and try to match pending orders.
 * Called by the reconcile job and periodically by the polling scheduler.
 */
async function reconcilePendingOrders() {
  const { listTransactions } = require('./sepayClient');

  // Only run if there are pending orders
  const { count } = await supabaseAdmin
    .from('payment_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (!count) return { checked: 0, matched: 0 };

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

module.exports = { processTransaction, reconcilePendingOrders };
