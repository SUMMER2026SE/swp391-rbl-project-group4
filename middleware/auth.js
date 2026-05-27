'use strict';

// Bảo vệ route — redirect về /login nếu chưa đăng nhập
exports.requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  return res.redirect(303, '/login');
};

// Ngăn user đã đăng nhập vào lại trang login/register
exports.redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.user) return res.redirect(303, '/');
  return next();
};
