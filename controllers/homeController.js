'use strict';

const { getData } = require('../models/siteData');
const { appName } = require('../config/site');

exports.getHomePage = (req, res) => {
  const lang = req.session.lang || 'vi';
  const { philosophyPoints, aiFeatures, testimonials } = getData(lang);
  res.render('index', {
    title: `${appName} | ${req.t('index.page_title')}`,
    philosophyPoints,
    aiFeatures,
    testimonials,
  });
};
