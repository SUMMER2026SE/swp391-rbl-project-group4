-- ═══════════════════════════════════════════════════════════════════════════════
-- 008_paid_courses.sql — Khóa học có phí, đánh giá (rating) & hoa hồng
--
-- - Khóa ADMIN → miễn phí (is_free = true), tham chiếu giáo trình Minna/Marugoto.
-- - Khóa TEACHER → có phí (price > 0); web giữ 10% hoa hồng (commission_rate).
-- - Đánh giá: chỉ học viên ĐÃ ENROLL mới được rating (1-5) + comment, 1 review/khóa.
-- - enrollment_count / avg_rating là cột cache, tự cập nhật qua trigger.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS / CREATE OR
-- REPLACE / DROP TRIGGER IF EXISTS / guard policy bằng pg_policies — chạy lại an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. content_module.courses: thêm cột giá / hoa hồng / cache ────────────────
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS is_free              boolean NOT NULL DEFAULT true;
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS price                numeric(12,2) DEFAULT 0;
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS commission_rate      numeric(4,3) DEFAULT 0.10;  -- web giữ 10%
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS creator_type         varchar(10) CHECK (creator_type IN ('admin','teacher'));
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS enrollment_count     integer DEFAULT 0;          -- cache, cập nhật qua trigger
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS avg_rating           numeric(3,2) DEFAULT 0;     -- cache, cập nhật qua trigger
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS thumbnail_url        text;                       -- đã tồn tại dạng varchar → no-op
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS difficulty_level     varchar(10) CHECK (difficulty_level IN ('N5','N4','N3','N2','N1','mixed'));
ALTER TABLE content_module.courses ADD COLUMN IF NOT EXISTS reference_curriculum text;                       -- vd 'Minna no Nihongo Shokyu 1'


-- ─── 2. content_module.course_reviews ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_module.course_reviews (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id  uuid NOT NULL REFERENCES content_module.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users_module.users(id)     ON DELETE CASCADE,
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (course_id, student_id)              -- 1 review / student / course
);


-- ─── 3. content_module.payments (stub cho cổng thanh toán sau) ─────────────────
CREATE TABLE IF NOT EXISTS content_module.payments (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id              uuid NOT NULL REFERENCES users_module.users(id),
  course_id               uuid NOT NULL REFERENCES content_module.courses(id),
  amount                  numeric(12,2) NOT NULL,
  platform_fee            numeric(12,2) NOT NULL,
  teacher_payout          numeric(12,2) NOT NULL,
  payment_status          varchar(20) DEFAULT 'pending'
                            CHECK (payment_status IN ('pending','completed','refunded','failed')),
  payment_provider        varchar(20),                -- 'vnpay','momo','stripe'
  provider_transaction_id text,
  created_at              timestamptz DEFAULT now()
);

-- Grant theo đúng convention các bảng module khác (RLS bên dưới mới là lớp chặn thực sự)
GRANT ALL ON content_module.course_reviews TO anon, authenticated, service_role;
GRANT ALL ON content_module.payments       TO anon, authenticated, service_role;


-- ─── 4. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_creator_free   ON content_module.courses (creator_type, is_free);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty     ON content_module.courses (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_course_reviews_course  ON content_module.course_reviews (course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_student ON content_module.course_reviews (student_id);


-- ─── 5. Triggers: cache avg_rating / enrollment_count + auto-enroll ───────────
-- SECURITY DEFINER bắt buộc: courses/course_enrollments bật RLS không có policy ghi,
-- nên hàm phải chạy quyền owner (postgres) mới UPDATE/INSERT được cột cache. Tất cả
-- định danh đều schema-qualified và search_path='' để an toàn.

-- 5a. avg_rating khi course_reviews thay đổi (INSERT/UPDATE/DELETE)
CREATE OR REPLACE FUNCTION content_module.trg_recalc_course_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_course uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
BEGIN
  UPDATE content_module.courses c
  SET avg_rating = COALESCE((
        SELECT round(avg(r.rating)::numeric, 2)
        FROM content_module.course_reviews r
        WHERE r.course_id = v_course), 0)
  WHERE c.id = v_course;

  -- Hiếm: review đổi course_id khi UPDATE → tính lại cả course cũ
  IF TG_OP = 'UPDATE' AND NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    UPDATE content_module.courses c
    SET avg_rating = COALESCE((
          SELECT round(avg(r.rating)::numeric, 2)
          FROM content_module.course_reviews r
          WHERE r.course_id = OLD.course_id), 0)
    WHERE c.id = OLD.course_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_reviews_rating ON content_module.course_reviews;
CREATE TRIGGER trg_course_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON content_module.course_reviews
  FOR EACH ROW EXECUTE FUNCTION content_module.trg_recalc_course_rating();

-- 5b. enrollment_count khi course_enrollments thay đổi (INSERT/DELETE)
CREATE OR REPLACE FUNCTION content_module.trg_recalc_enrollment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_course uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_id ELSE NEW.course_id END;
BEGIN
  UPDATE content_module.courses c
  SET enrollment_count = (
        SELECT count(*) FROM content_module.course_enrollments e
        WHERE e.course_id = v_course)
  WHERE c.id = v_course;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_enrollments_count ON content_module.course_enrollments;
CREATE TRIGGER trg_course_enrollments_count
  AFTER INSERT OR DELETE ON content_module.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION content_module.trg_recalc_enrollment_count();

-- 5c. payment 'completed' → tự tạo course_enrollments nếu chưa có.
-- Bắt cả INSERT (status='completed' ngay) lẫn UPDATE pending→completed (luồng cổng
-- thanh toán thực tế: tạo pending trước, callback mới completed). NOT EXISTS đảm bảo
-- idempotent — việc INSERT này lại kích hoạt trigger 5b cập nhật enrollment_count.
CREATE OR REPLACE FUNCTION content_module.trg_payment_completed_enroll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'completed') THEN
    INSERT INTO content_module.course_enrollments (course_id, student_id)
    SELECT NEW.course_id, NEW.student_id
    WHERE NOT EXISTS (
      SELECT 1 FROM content_module.course_enrollments e
      WHERE e.course_id = NEW.course_id AND e.student_id = NEW.student_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_enroll ON content_module.payments;
CREATE TRIGGER trg_payments_enroll
  AFTER INSERT OR UPDATE OF payment_status ON content_module.payments
  FOR EACH ROW EXECUTE FUNCTION content_module.trg_payment_completed_enroll();

-- 5d. Khóa quyền gọi trực tiếp: 3 hàm trên chỉ dùng làm trigger. CREATE FUNCTION mặc
-- định cấp EXECUTE cho PUBLIC, mà content_module được expose qua PostgREST → anon/
-- authenticated có thể gọi /rest/v1/rpc/<fn>. Trigger vẫn fire bình thường sau revoke
-- (PostgreSQL chỉ kiểm tra EXECUTE lúc CREATE TRIGGER, không kiểm tra lúc trigger chạy).
REVOKE EXECUTE ON FUNCTION content_module.trg_recalc_course_rating()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION content_module.trg_recalc_enrollment_count()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION content_module.trg_payment_completed_enroll() FROM PUBLIC, anon, authenticated;


-- ─── 6. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE content_module.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_module.payments       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Đọc review công khai
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='course_reviews' AND policyname='course_reviews: read all') THEN
    CREATE POLICY "course_reviews: read all" ON content_module.course_reviews
      FOR SELECT TO authenticated USING (true);
  END IF;

  -- Tạo review: chính chủ + phải đã enroll khóa học đó
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='course_reviews' AND policyname='course_reviews: insert own enrolled') THEN
    CREATE POLICY "course_reviews: insert own enrolled" ON content_module.course_reviews
      FOR INSERT TO authenticated
      WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (SELECT 1 FROM content_module.course_enrollments e
                    WHERE e.course_id = course_reviews.course_id AND e.student_id = auth.uid())
      );
  END IF;

  -- Sửa review của chính mình
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='course_reviews' AND policyname='course_reviews: update own') THEN
    CREATE POLICY "course_reviews: update own" ON content_module.course_reviews
      FOR UPDATE TO authenticated
      USING (student_id = auth.uid())
      WITH CHECK (student_id = auth.uid());
  END IF;

  -- Xóa review của chính mình
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='course_reviews' AND policyname='course_reviews: delete own') THEN
    CREATE POLICY "course_reviews: delete own" ON content_module.course_reviews
      FOR DELETE TO authenticated
      USING (student_id = auth.uid());
  END IF;

  -- payments: student chỉ SELECT thanh toán của mình (ghi do backend/service_role)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='content_module' AND tablename='payments' AND policyname='payments: read own') THEN
    CREATE POLICY "payments: read own" ON content_module.payments
      FOR SELECT TO authenticated USING (student_id = auth.uid());
  END IF;
END $$;


-- PostgREST: nạp lại schema để thấy bảng mới (content_module đã được expose sẵn)
NOTIFY pgrst, 'reload schema';
