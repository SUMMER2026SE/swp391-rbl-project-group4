'use strict';

const {
  createCourseOrder,
  getCourseOrder,
  cancelCourseOrder,
  getPendingCourseOrder,
} = require('../services/coursePaymentService');

// POST /api/courses/:id/checkout — tạo order SePay cho khóa có phí (mirror /subscription/checkout)
exports.checkout = async (req, res) => {
  try {
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
    const order = await getCourseOrder(req.params.orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order không tồn tại.' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/courses/payment-orders/:orderId/cancel
exports.cancelOrder = async (req, res) => {
  try {
    await cancelCourseOrder(req.params.orderId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
