'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { sePayWebhook, triggerReconcile } = require('../../controllers/webhookController');

// SePay webhook — no auth middleware (uses apiKey in payload instead)
router.post('/sepay', sePayWebhook);

// Internal reconcile trigger (admin only)
router.post('/reconcile', requireAuth, requireAdmin, triggerReconcile);

module.exports = router;
