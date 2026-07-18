'use strict';

const nodemailer = require('nodemailer');

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Chưa cấu hình SMTP_USER / SMTP_PASS trong file .env');
  }
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

async function sendOtpEmail(to, otp, fullname) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || `"Kizuna Nihongo" <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: `${otp} là mã xác thực Kizuna Nihongo của bạn`,
    html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fffaf7;border-radius:16px;border:1px solid #f0e4dc">
  <h1 style="color:#c93a40;font-size:22px;margin:0 0 4px">Kizuna Nihongo</h1>
  <p style="color:#8a7d75;font-size:13px;margin:0 0 24px">Học tiếng Nhật cùng nhau</p>
  <p style="color:#3d3733;font-size:15px">Xin chào <strong>${fullname || 'bạn'}</strong>,</p>
  <p style="color:#3d3733;font-size:15px">Mã xác thực (OTP) để hoàn tất đăng ký tài khoản của bạn là:</p>
  <div style="text-align:center;margin:24px 0">
    <span style="display:inline-block;background:#c93a40;color:#fff;font-size:32px;font-weight:bold;letter-spacing:10px;padding:14px 28px;border-radius:12px">${otp}</span>
  </div>
  <p style="color:#8a7d75;font-size:13px">Mã có hiệu lực trong <strong>10 phút</strong>. Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>
</div>`,
  });
}

// Biên lai xác nhận thanh toán (mua khóa học / đăng ký VIP)
// data: { typeLabel, buyerName, itemName, amount, currency, orderCode, paymentCode, paidAt }
async function sendReceiptEmail(to, data) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || `"Kizuna Nihongo" <${process.env.SMTP_USER}>`;

  const vnd = (n) => `${new Intl.NumberFormat('vi-VN').format(Number(n) || 0)} ₫`;
  const when = (() => {
    try { return new Date(data.paidAt || Date.now()).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }); }
    catch { return '—'; }
  })();

  // Biên lai đen trắng, bố cục như biên lai in giấy (monospace + đường kẻ đứt)
  const row = (label, value) =>
    `<tr><td style="padding:3px 0;white-space:nowrap">${label}</td>` +
    `<td style="padding:3px 0 3px 12px;text-align:right;font-weight:bold;word-break:break-word">${value}</td></tr>`;
  const rule = (style = 'dashed') =>
    `<div style="border-top:${style === 'double' ? '3px double #000' : `1px ${style} #000`};margin:10px 0"></div>`;

  await transporter.sendMail({
    from,
    to,
    subject: 'Biên lai thanh toán — Kizuna Nihongo',
    html: `
<div style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;color:#000;background:#fff;width:380px;max-width:100%;margin:0 auto;padding:24px 22px;border:1px solid #000">
  <div style="text-align:center">
    <div style="font-size:17px;font-weight:bold;letter-spacing:2px">KIZUNA NIHONGO</div>
    <div style="font-size:10px;margin-top:2px">Học tiếng Nhật cùng nhau</div>
    <div style="font-size:13px;font-weight:bold;margin-top:12px;letter-spacing:1px">BIÊN LAI THANH TOÁN</div>
  </div>
  ${rule()}
  <div style="text-align:center;font-weight:bold;letter-spacing:1px">*** ĐÃ THANH TOÁN ***</div>
  ${rule()}
  <table style="width:100%;border-collapse:collapse">
    ${row('Người mua', data.buyerName || '—')}
    ${row(data.typeLabel || 'Sản phẩm', data.itemName || '—')}
    ${row('Mã đơn', data.orderCode || '—')}
    ${row('Nội dung CK', data.paymentCode || '—')}
    ${row('Thời gian', when)}
    ${row('Phương thức', 'Chuyển khoản (SePay)')}
  </table>
  ${rule('double')}
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="font-size:13px;font-weight:bold;letter-spacing:1px;white-space:nowrap">TỔNG CỘNG</td>
      <td style="font-size:16px;font-weight:bold;text-align:right">${vnd(data.amount)}</td>
    </tr>
  </table>
  ${rule('double')}
  <div style="text-align:center;font-size:11px">
    <div style="font-weight:bold">Cảm ơn bạn đã tin tưởng</div>
    <div style="font-weight:bold">Kizuna Nihongo!</div>
    <div style="margin-top:8px;font-size:10px">Biên lai xác nhận thanh toán,</div>
    <div style="font-size:10px">không phải hóa đơn GTGT.</div>
  </div>
  ${rule()}
</div>`,
  });
}

module.exports = { sendOtpEmail, sendReceiptEmail };
