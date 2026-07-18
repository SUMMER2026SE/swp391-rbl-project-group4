'use strict';

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../../middleware/auth');
const c = require('../../controllers/courseController');
const enrollment = require('../../controllers/enrollmentController');
const review = require('../../controllers/reviewController');
const payment = require('../../controllers/coursePaymentController');

// Public listing/detail — optionalAuth để khách xem được, user đăng nhập thấy is_enrolled/tiến độ.
router.get('/',    optionalAuth, c.list);
// Lịch sử mua khóa học của học viên — đặt TRƯỚC '/:id' để không bị route param nuốt.
router.get('/my-purchases', requireAuth, payment.myPurchases);
router.get('/:id', optionalAuth, c.getOne);

// Enrollment
router.post('/:id/enroll',           requireAuth, enrollment.enroll);
router.get('/:id/enrollment-status', requireAuth, enrollment.status);
router.delete('/:id/unenroll',       requireAuth, enrollment.unenroll);

// Thanh toán khóa có phí qua SePay (mirror luồng /subscription)
router.post('/:id/checkout',                    requireAuth, payment.checkout);
router.get('/payment-orders/:orderId',          requireAuth, payment.getOrder);
router.post('/payment-orders/:orderId/cancel',  requireAuth, payment.cancelOrder);

// Reviews (đọc công khai; ghi cần đăng nhập)
router.get('/:id/reviews',              review.getReviews);
router.post('/:id/reviews',             requireAuth, review.createReview);
router.put('/:id/reviews/:reviewId',    requireAuth, review.updateReview);
router.delete('/:id/reviews/:reviewId', requireAuth, review.deleteReview);

module.exports = router;
