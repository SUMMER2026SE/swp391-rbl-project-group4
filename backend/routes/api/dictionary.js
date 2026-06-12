'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const c = require('../../controllers/dictionaryController');

router.use(requireAuth);
router.get('/search', c.search);
router.get('/:id',    c.getOne);

module.exports = router;
