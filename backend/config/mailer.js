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

module.exports = { sendOtpEmail };
