'use strict';

const express = require('express');
const router  = express.Router();

router.post('/lang', (req, res) => {
  const { lang } = req.body;
  if (['vi', 'ja'].includes(lang)) {
    req.session.lang = lang;
  }
  const back = req.get('Referer') || '/';
  req.session.save(() => res.redirect(303, back));
});

module.exports = router;
