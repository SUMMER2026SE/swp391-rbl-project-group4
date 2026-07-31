'use strict';

const {
  createCourseOrder,
  getCourseOrder,
  cancelCourseOrder,
  getPendingCourseOrder,
  listMyCoursePurchases,
} = require('../services/coursePaymentService');
const { reconcileOnDemand } = require('../services/paymentMatchingService');

// GET /api/courses/my-purchases — lịch sử khóa học đã mua của học viên (để tải lại biên lai)
exports.myPurchases = async (req, res) => {
  try {
    const orders = await listMyCoursePurchases(req.user.id);
    res.json({ orders });
  } catch (err) {
    console.error('myPurchases error:', err.message);
    res.status(500).json({ error: 'Không thể tải lịch sử mua khóa học.' });
  }
};

// POST /api/courses/:id/checkout — tạo order SePay cho khóa có phí (mirror /subscription/checkout)
exports.checkout = async (req, res) => {
  try {
    // Admin không cần thanh toán — enroll trực tiếp qua POST /courses/:id/enroll.
    if (req.user.user_metadata?.role === 'admin')
      return res.status(400).json({ error: 'Admin được miễn phí khóa học — hãy đăng ký học trực tiếp.' });

    // Tái dùng order pending còn hạn nếu có
    const existing = await getPendingCourseOrder(req.user.id, req.params.id);
    if (existing) return res.json({ order: existing });

    const order = await createCourseOrder(req.user.id, req.params.id);
    res.json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/courses/payment-orders/:orderId — polling trạng thái order
exports.getOrder = async (req, res) => {
  try {
    let order = await getCourseOrder(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order không tồn tại.' });

    // Học viên đang đứng chờ trước màn hình QR → đối soát ngay rồi đọc lại trạng thái,
    // thay vì đợi chu kỳ cron. reconcileOnDemand tự chặn tần suất 15s.
    if (order.status === 'pending') {
      await reconcileOnDemand();
      order = await getCourseOrder(req.params.orderId, req.user.id);
    }
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/courses/payment-orders/:orderId/cancel
exports.cancelOrder = async (req, res) => {
  try {
    // Đối soát trước: nếu tiền đã về thì cancelCourseOrder sẽ từ chối huỷ,
    // tránh trường hợp huỷ mất đơn đã thanh toán và giao dịch không còn gì để khớp.
    await reconcileOnDemand();
    await cancelCourseOrder(req.params.orderId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
