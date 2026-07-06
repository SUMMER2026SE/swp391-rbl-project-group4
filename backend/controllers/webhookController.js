'use strict';

const { processTransaction }  = require('../services/paymentMatchingService');
const { reconcilePendingOrders } = require('../services/paymentMatchingService');

/**
 * POST /api/webhooks/sepay
 *
 * SePay sends a POST with transaction data on every new transaction.
 * Webhook key verification: SePay includes apiKey in the payload body.
 */
async function sePayWebhook(req, res) {
  // Verify webhook key
  const webhookKey = process.env.SEPAY_WEBHOOK_KEY;
  if (webhookKey) {
    const provided = req.body?.apiKey || req.headers['authorization']?.replace('Apikey ', '');
    if (provided !== webhookKey) {
      return res.status(401).json({ error: 'Invalid webhook key.' });
    }
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload.' });
  }

  try {
    const result = await processTransaction(payload);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[webhook/sepay]', err.message);
    // Always 200 to prevent SePay from retrying with bad data
    res.json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/jobs/subscription/reconcile
 * Internal/admin endpoint to manually trigger polling reconciliation.
 */
async function triggerReconcile(req, res) {
  try {
    const result = await reconcilePendingOrders();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { sePayWebhook, triggerReconcile };
