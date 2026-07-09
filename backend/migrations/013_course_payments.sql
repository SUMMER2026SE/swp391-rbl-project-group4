-- ═══════════════════════════════════════════════════════════════════════════════
-- 013_course_payments.sql — Thanh toán khóa học có phí qua SePay
--
-- Mirror pattern 2 bảng đã chạy ổn ở premium subscription (public.payment_orders +
-- public.payment_transactions): order riêng cho khóa học với payment_code prefix
-- riêng (COURSE, khác PREM) để webhook SePay phân biệt được 2 loại giao dịch.
-- Khi khớp giao dịch → backend ghi row 'completed' vào content_module.payments
-- (bảng có sẵn từ 008) → trigger trg_payments_enroll tự tạo course_enrollments.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / guard policy.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. content_module.course_payment_orders ──────────────────────────────────
CREATE TABLE IF NOT EXISTS content_module.course_payment_orders (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id               uuid NOT NULL REFERENCES users_module.users(id)     ON DELETE CASCADE,
  course_id                uuid NOT NULL REFERENCES content_module.courses(id) ON DELETE CASCADE,
  order_code               text NOT NULL UNIQUE,
  payment_code             text NOT NULL UNIQUE,
  amount                   numeric(12,2) NOT NULL,
  currency                 text NOT NULL DEFAULT 'VND',
  provider                 text NOT NULL DEFAULT 'sepay',
  bank_code                text,
  account_number           text,
  qr_url                   text,
  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at               timestamptz NOT NULL,
  paid_at                  timestamptz,
  matched_transaction_id   text,
  matched_reference_number text,
  matched_transaction_time timestamptz,
  raw_match_payload        jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_payment_orders_student ON content_module.course_payment_orders (student_id);
CREATE INDEX IF NOT EXISTS idx_course_payment_orders_status  ON content_module.course_payment_orders (status);


-- ─── 2. Link giao dịch SePay → order khóa học ──────────────────────────────────
-- public.payment_transactions.matched_order_id có FK cứng → public.payment_orders
-- (order premium), không dùng chung được → thêm cột link riêng cho order khóa học.
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS matched_course_order_id uuid REFERENCES content_module.course_payment_orders(id);


-- ─── 3. Grant + RLS (theo convention các bảng module: grant rộng, RLS mới là lớp chặn) ──
GRANT ALL ON content_module.course_payment_orders TO anon, authenticated, service_role;

ALTER TABLE content_module.course_payment_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Student chỉ SELECT order của mình (mọi thao tác ghi do backend/service_role)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='course_payment_orders' AND policyname='course_payment_orders: read own') THEN
    CREATE POLICY "course_payment_orders: read own" ON content_module.course_payment_orders
      FOR SELECT TO authenticated USING (student_id = auth.uid());
  END IF;
END $$;


-- PostgREST: nạp lại schema để thấy bảng/cột mới
NOTIFY pgrst, 'reload schema';
