'use strict';

// In-memory request metrics, bucketed theo giờ.
// Lưu 24h gần nhất — mất khi restart server (chấp nhận được cho dashboard).
const HOUR_MS  = 3600000;
const KEEP_HOURS = 24;
const buckets  = new Map(); // hourTimestamp -> { count, totalMs, errors }

function currentHour() {
  return Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
}

// Middleware: đếm request + đo thời gian phản hồi cho mọi API call
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const hour = currentHour();
    const b = buckets.get(hour) || { count: 0, totalMs: 0, errors: 0 };
    b.count   += 1;
    b.totalMs += Date.now() - start;
    if (res.statusCode >= 500) b.errors += 1;
    buckets.set(hour, b);

    // Dọn bucket cũ
    const cutoff = hour - KEEP_HOURS * HOUR_MS;
    for (const k of buckets.keys()) if (k < cutoff) buckets.delete(k);
  });
  next();
}

// Trả về N bucket gần nhất (mặc định 12 giờ), bucket trống = 0
function getMetrics(hours = 12) {
  const now = currentHour();
  const out = [];
  for (let i = hours - 1; i >= 0; i--) {
    const h = now - i * HOUR_MS;
    const b = buckets.get(h);
    out.push({
      hour: h,
      requests: b?.count || 0,
      avgMs: b?.count ? Math.round(b.totalMs / b.count) : 0,
      errors: b?.errors || 0,
    });
  }
  return out;
}

module.exports = { metricsMiddleware, getMetrics };
