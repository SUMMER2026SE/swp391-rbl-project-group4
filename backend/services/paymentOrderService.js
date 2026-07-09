'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const PREFIX     = process.env.TRANSFER_CONTENT_PREFIX || 'PREM';
const EXPIRE_MIN = parseInt(process.env.PAYMENT_ORDER_EXPIRE_MINUTES || '30', 10);
const QR_BASE    = process.env.QR_PROVIDER === 'vietqr'
  ? 'https://img.vietqr.io/image'
  : 'https://qr.sepay.vn/img';

function generatePaymentCode() {
  return PREFIX + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function buildQrUrl(paymentCode, amount) {
  const bank    = process.env.QR_BANK_CODE || '';
  const account = process.env.QR_ACCOUNT_NUMBER || '';

  if (process.env.QR_PROVIDER === 'vietqr') {
    return `${QR_BASE}/${bank}-${account}-compact2.png?amount=${amount}&addInfo=${paymentCode}`;
  }
  return `${QR_BASE}?acc=${account}&bank=${bank}&amount=${amount}&des=${paymentCode}`;
}

// ─────────────────────────────────────────────────────────────────────────────

async function createOrder(userId, planId) {
  const { data: plan, error: pErr } = await supabaseAdmin
    .from('subscription_plans')
    .select('id, code, price, currency')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle();

  if (pErr || !plan) throw new Error('Plan không tồn tại hoặc không hoạt động.');

  // Cancel any old pending orders for this user+plan
  await supabaseAdmin
    .from('payment_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('status', 'pending');

  const paymentCode = generatePaymentCode();
  const orderCode   = `SUB-${userId.slice(0, 6).toUpperCase()}-${Date.now()}`;
  const expiresAt   = new Date(Date.now() + EXPIRE_MIN * 60_000).toISOString();
  const qrUrl       = buildQrUrl(paymentCode, plan.price);

  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .insert({
      user_id:        userId,
      plan_id:        planId,
      order_code:     orderCode,
      payment_code:   paymentCode,
      amount:         plan.price,
      currency:       plan.currency,
      provider:       process.env.PAYMENT_PROVIDER || 'sepay',
      bank_code:      process.env.QR_BANK_CODE || '',
      account_number: process.env.QR_ACCOUNT_NUMBER || '',
      qr_url:         qrUrl,
      status:         'pending',
      expires_at:     expiresAt,
    })
    .select('id, order_code, payment_code, amount, currency, qr_url, expires_at, status')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function getOrder(orderId, userId = null) {
  let query = supabaseAdmin
    .from('payment_orders')
    .select(`
      id, order_code, payment_code, amount, currency, qr_url,
      status, expires_at, paid_at, created_at,
      plan:subscription_plans(code, name, tier, price)
    `)
    .eq('id', orderId);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function cancelOrder(orderId, userId) {
  const order = await getOrder(orderId, userId);
  if (!order) throw new Error('Order không tồn tại.');
  if (order.status !== 'pending') throw new Error('Chỉ có thể huỷ order đang chờ thanh toán.');

  const { error } = await supabaseAdmin
    .from('payment_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw new Error(error.message);
  return true;
}

async function expireOldOrders() {
  const { error } = await supabaseAdmin
    .from('payment_orders')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());
  if (error) console.error('[expireOldOrders]', error.message);
}

async function getUserPendingOrder(userId, planId) {
  const { data } = await supabaseAdmin
    .from('payment_orders')
    .select('id, order_code, payment_code, amount, currency, qr_url, expires_at, status, plan:subscription_plans(code,name)')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

module.exports = { createOrder, getOrder, cancelOrder, expireOldOrders, getUserPendingOrder, buildQrUrl };
