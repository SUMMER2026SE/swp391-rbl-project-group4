'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/learningPathController');
const checkQuota = require('../../middleware/checkQuota');

router.use(requireAuth);

router.get('/',            c.getPath);
router.post('/generate',   checkQuota('learning_path_generate_monthly'), c.generatePath);
router.post('/regenerate', checkQuota('learning_path_generate_monthly'), c.regeneratePath);
router.patch('/steps/:id', c.updateStep);

module.exports = router;
