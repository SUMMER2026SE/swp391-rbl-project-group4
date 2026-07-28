'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app  = require('./app');
const cron = require('node-cron');
const { finalizePreviousMonth } = require('./services/revenuePoolService');
// Host deploy (Render/Railway) tự cấp PORT — phải nghe đúng port đó thì health check mới qua.
// Local dev không có PORT nên rơi về API_PORT (tránh xung đột với app khác) rồi mới tới 3001.
const port = process.env.PORT || process.env.API_PORT || 3001;

app.listen(port, () => {
  console.log(`Kizuna Nihongo API running at http://localhost:${port}`);
});

// Chốt quỹ chia sẻ doanh thu: chạy mỗi ngày 00:05 — nếu tháng trước đã kết thúc
// và chưa được chốt thì tính & ghi nhận thu nhập giáo viên (idempotent).
cron.schedule('5 0 * * *', () => { finalizePreviousMonth(); }, { timezone: 'Asia/Ho_Chi_Minh' });
