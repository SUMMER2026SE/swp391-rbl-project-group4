-- ═══════════════════════════════════════════════════════════════════════════════
-- 004 — Mở khoá tự động sau thanh toán SePay (fulfillment)
--
-- Chạy file này trên Supabase SQL Editor. Idempotent — chạy lại nhiều lần an toàn.
--
-- LÝ DO: luồng thanh toán hiện gộp hai giai đoạn khác nhau làm một —
--   (1) 'paid'      = đã nhận được tiền, order khớp giao dịch ngân hàng
--   (2) fulfilled   = đã thực sự cấp quyền (kích hoạt gói / ghi danh khoá học)
-- Khi bước (2) lỗi, code chỉ console.error rồi bỏ qua: order vẫn 'paid' nhưng học
-- viên không có quyền, và KHÔNG còn dấu vết nào trong DB để job dò lại.
--
-- Cột fulfilled_at dưới đây tách bạch hai giai đoạn đó, để job retry biết chính xác
-- đơn nào đã nhận tiền mà chưa cấp quyền.
--
-- Hai khoá idempotency (uq_payments_provider_tx, last_order_id) là ĐIỀU KIỆN BẮT BUỘC
-- trước khi bật retry tự động: không có chúng, retry sẽ cộng dồn 30 ngày gói premium
-- và nhân đôi doanh thu chia cho giáo viên.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Đánh dấu đã cấp quyền ─────────────────────────────────────────────────
ALTER TABLE billing_module.payment_orders
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

ALTER TABLE billing_module.course_payment_orders
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

-- Không cần backfill: tại thời điểm viết migration chưa có đơn nào ở trạng thái 'paid'.

-- Job retry chỉ quét các đơn đã nhận tiền mà chưa cấp quyền → index partial rất nhỏ.
CREATE INDEX IF NOT EXISTS ix_po_unfulfilled
  ON billing_module.payment_orders (paid_at)
  WHERE status = 'paid' AND fulfilled_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_cpo_unfulfilled
  ON billing_module.course_payment_orders (paid_at)
  WHERE status = 'paid' AND fulfilled_at IS NULL;

-- matched_order_id đã có index sẵn, matched_course_order_id thì chưa.
CREATE INDEX IF NOT EXISTS ix_pt_matched_course_order
  ON billing_module.payment_transactions (matched_course_order_id);

-- ── 2. Chống ghi nhận doanh thu hai lần ──────────────────────────────────────
-- Một giao dịch SePay chỉ khớp đúng một đơn, nên external transaction id là khoá
-- tự nhiên. Partial (WHERE NOT NULL) để không chặn các bản ghi cấp tay không có id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_tx
  ON billing_module.payments (provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- ── 3. Chống cộng dồn chu kỳ gói hai lần ─────────────────────────────────────
-- activateSubscription() gia hạn thêm 30 ngày mỗi lần gọi. Ghi lại đơn cuối cùng đã
-- áp dụng để webhook, cron đối soát và job retry có chạy chồng nhau cũng chỉ cộng 1 lần.
ALTER TABLE billing_module.user_subscriptions
  ADD COLUMN IF NOT EXISTS last_order_id uuid;

-- ── 4. Đồng bộ CHECK status giữa hai bảng order ──────────────────────────────
-- payment_orders đã cho phép 'failed', course_payment_orders thì chưa.
ALTER TABLE billing_module.course_payment_orders
  DROP CONSTRAINT IF EXISTS course_payment_orders_status_check;
ALTER TABLE billing_module.course_payment_orders
  ADD CONSTRAINT course_payment_orders_status_check
  CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed'));

-- ── 5. Ghi đúng nguồn ghi danh khi mua khoá học ──────────────────────────────
-- Trigger cũ không set source nên enrollment mua bằng tiền rơi về DEFAULT 'self',
-- đúng như cảnh báo ở migration 001 — làm báo cáo doanh thu sai và lẫn với tự đăng ký.
CREATE OR REPLACE FUNCTION course_module.trg_payment_completed_enroll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.payment_status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'completed') THEN
    INSERT INTO course_module.course_enrollments (course_id, student_id, source)
    SELECT NEW.course_id, NEW.student_id, 'purchase'
    WHERE NOT EXISTS (
      SELECT 1 FROM course_module.course_enrollments e
      WHERE e.course_id = NEW.course_id AND e.student_id = NEW.student_id);
  END IF;
  RETURN NULL;
END;
$function$;

NOTIFY pgrst, 'reload schema';
