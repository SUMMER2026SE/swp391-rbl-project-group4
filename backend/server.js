'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app  = require('./app');
const cron = require('node-cron');
const { finalizePreviousMonth } = require('./services/revenuePoolService');
const port = process.env.API_PORT || 3001; // Dùng API_PORT để tránh xung đột với PORT=3000 của EJS app

app.listen(port, () => {
  console.log(`Kizuna Nihongo API running at http://localhost:${port}`);
});

// Chốt quỹ chia sẻ doanh thu: chạy mỗi ngày 00:05 — nếu tháng trước đã kết thúc
// và chưa được chốt thì tính & ghi nhận thu nhập giáo viên (idempotent).
cron.schedule('5 0 * * *', () => { finalizePreviousMonth(); }, { timezone: 'Asia/Ho_Chi_Minh' });
