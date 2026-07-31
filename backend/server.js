'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app  = require('./app');
const cron = require('node-cron');
const { finalizePreviousMonth } = require('./services/revenuePoolService');
const { reconcilePendingOrders, retryUnfulfilledOrders } = require('./services/paymentMatchingService');
const { expireSubscriptions } = require('./services/subscriptionService');
const { expireOldOrders }     = require('./services/paymentOrderService');
const { expireOldCourseOrders } = require('./services/coursePaymentService');
const port = process.env.API_PORT || 3001; // Dùng API_PORT để tránh xung đột với PORT=3000 của EJS app

app.listen(port, () => {
  console.log(`Kizuna Nihongo API running at http://localhost:${port}`);
});

// Chốt quỹ chia sẻ doanh thu: chạy mỗi ngày 00:05 — nếu tháng trước đã kết thúc
// và chưa được chốt thì tính & ghi nhận thu nhập giáo viên (idempotent).
cron.schedule('5 0 * * *', () => { finalizePreviousMonth(); }, { timezone: 'Asia/Ho_Chi_Minh' });

// Đối soát SePay mỗi 2 phút — đây là đường CHÍNH để mở khóa tự động, vì webhook của
// SePay không gọi vào được backend chạy nội bộ. Hàm tự bỏ qua khi không có đơn nào
// đang chờ nên lúc rảnh không tốn API call.
cron.schedule('*/2 * * * *', async () => {
  try { await reconcilePendingOrders(); }
  catch (err) { console.error('[cron/reconcile]', err.message); }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// Cấp lại quyền cho đơn đã nhận tiền nhưng bước cấp quyền thất bại — mỗi 5 phút.
cron.schedule('*/5 * * * *', async () => {
  try { await retryUnfulfilledOrders(); }
  catch (err) { console.error('[cron/retryFulfill]', err.message); }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// Dọn dẹp hàng giờ: hạ gói đã quá hạn + đánh dấu đơn chờ thanh toán đã hết hạn.
cron.schedule('10 * * * *', async () => {
  try {
    await expireSubscriptions();
    await expireOldOrders();
    await expireOldCourseOrders();
  } catch (err) { console.error('[cron/cleanup]', err.message); }
}, { timezone: 'Asia/Ho_Chi_Minh' });
