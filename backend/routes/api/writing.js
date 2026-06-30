'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/writingController');

router.use(requireAuth);
router.post('/submit',  c.submit);
router.get('/history',  c.history);
router.get('/:id',      c.getOne);

module.exports = router;
