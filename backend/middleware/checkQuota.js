'use strict';

const { checkAccess } = require('../services/quotaService');

/**
 * Express middleware factory.
 * Usage: router.post('/start', checkQuota('placement_test_monthly'), handler)
 *
 * Returns 403 with upgrade info if user has exhausted their quota.
 * The allowed access result is attached to req.quotaResult for downstream use.
 */
function checkQuota(featureCode) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await checkAccess(userId, featureCode);
      if (!result.allowed) {
        return res.status(403).json({
          error: 'quota_exceeded',
          message: `Bạn đã dùng hết ${result.used}/${result.limit} lượt cho tính năng này. ${result.resetInfo}`,
          feature: featureCode,
          used: result.used,
          limit: result.limit,
          tier: result.tier,
          resetInfo: result.resetInfo,
          upgradeRequired: result.tier === 'free',
        });
      }
      req.quotaResult = result;
      next();
    } catch (err) {
      console.error('[checkQuota]', featureCode, err.message);
      // On quota service error, allow through (fail open) to avoid blocking users
      next();
    }
  };
}

module.exports = checkQuota;
