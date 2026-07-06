'use strict';

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const c = require('../../controllers/subscriptionController');

// Public — list active plans (no auth needed for pricing page)
router.get('/plans', c.getPlans);

// User-authenticated
router.get('/me',                         requireAuth, c.getMySubscription);
router.post('/checkout',                  requireAuth, c.checkout);
router.get('/payment-order/:id',          requireAuth, c.getPaymentOrder);
router.post('/payment-order/:id/cancel',  requireAuth, c.cancelPaymentOrder);
router.get('/billing',                    requireAuth, c.getBillingHistory);
router.get('/usage',                      requireAuth, c.getUsage);

// Admin
router.get('/admin/subscriptions',                   requireAuth, requireAdmin, c.adminGetSubscriptions);
router.post('/admin/grant',                          requireAuth, requireAdmin, c.adminGrantSubscription);
router.delete('/admin/subscriptions/:userId/cancel', requireAuth, requireAdmin, c.adminCancelSubscription);
router.get('/admin/payments',                        requireAuth, requireAdmin, c.adminGetPayments);

module.exports = router;
