'use strict';

const router = require('express').Router();
const { buildQrUrl } = require('../../services/paymentOrderService');

// Proxy ảnh QR SePay qua backend để trình duyệt tải từ chính origin của app
// (/api/...) thay vì gọi thẳng qr.sepay.vn. Nhờ đó không bị Tracking Prevention
// (Edge) / adblock chặn domain bên thứ ba — nguyên nhân "Không tải được mã QR".
//
// Endpoint public: thẻ <img> không đính kèm được token Authorization. An toàn vì
// KHÔNG nhận URL từ client (chống SSRF) — chỉ dựng lại từ env bank/account của ta;
// client chỉ truyền amount + payment_code vốn đã hiển thị công khai trong modal.
// QR sinh ra là QR nhận tiền vào tài khoản của ta nên không có rủi ro lộ thông tin.
router.get('/qr', async (req, res) => {
  const amount = String(req.query.amount || '').replace(/\D/g, '');
  const des    = String(req.query.des || '').replace(/[^A-Za-z0-9]/g, '');
  if (!amount || !des) return res.status(400).send('missing params');

  try {
    const upstream = buildQrUrl(des, amount); // (paymentCode, amount)
    const r = await fetch(upstream);
    const ct = r.headers.get('content-type') || '';
    // SePay trả text/html (trang lỗi) khi thiếu bank/account — coi như thất bại
    // để <img> onError kích hoạt fallback chuyển khoản thủ công ở frontend.
    if (!r.ok || !ct.startsWith('image/')) return res.status(502).send('qr upstream error');
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'no-store');
    res.send(buf);
  } catch {
    res.status(502).send('qr fetch failed');
  }
});

module.exports = router;
