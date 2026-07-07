-- ═══════════════════════════════════════════════════════════════════════════════
-- 010_study_lists.sql — Study list posts (Từ vựng / Kanji / Ngữ pháp) + grammar_points
--
-- - Giáo viên (hoặc admin) tạo "bài đăng danh sách" (vd "Kanji thường gặp trong đề N4"),
--   xuất bản NGAY, không cần admin duyệt. Đây là tính năng SONG SONG với workflow
--   teacher_vocabulary/teacher_kanji (nháp -> chờ duyệt) hiện có, không thay thế.
-- - Mỗi bài đăng tham chiếu tới các mục có sẵn trong vocabulary/kanji/grammar_points
--   (item_id không có FK cứng vì có thể trỏ tới 1 trong 3 bảng khác nhau tùy list_type
--   — validate ở tầng controller).
-- - grammar_points là bảng mới, độc lập với content_module.lesson_grammar (ngữ pháp
--   gắn với bài học) — Ngữ pháp trước giờ chưa có bảng riêng để làm "từ điển chuẩn".
-- - Đặt trong schema public (không dùng content_module/module riêng): tránh lặp lại lỗi
--   "schema exposure" mà Listening từng gặp khi dùng schema riêng (xem commit
--   0b31c98 "move tables to public schema... bypass schema exposure issue"). public
--   luôn được PostgREST expose sẵn, không cần cấu hình thêm trên Supabase Dashboard.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / guard policy
-- bằng pg_policies — chạy lại an toàn.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. public.grammar_points — từ điển ngữ pháp chuẩn (sibling vocabulary/kanji) ──
CREATE TABLE IF NOT EXISTS public.grammar_points (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text NOT NULL,                 -- vd "～ば"
  title_ja         text,
  meaning_vi       text NOT NULL,
  explanation      text,                          -- giải thích cách dùng, markdown-ok
  example_sentence text,
  level            text CHECK (level IN ('N5','N4','N3','N2','N1')),
  created_at       timestamptz DEFAULT now()
);

GRANT ALL ON public.grammar_points TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_grammar_points_level ON public.grammar_points (level);

ALTER TABLE public.grammar_points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='grammar_points' AND policyname='grammar_points: read all') THEN
    CREATE POLICY "grammar_points: read all" ON public.grammar_points
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;


-- ─── 2. public.study_list_posts — bài đăng danh sách (xuất bản ngay, không duyệt) ──
CREATE TABLE IF NOT EXISTS public.study_list_posts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_type    text NOT NULL CHECK (list_type IN ('vocabulary','kanji','grammar')),
  title        text NOT NULL,
  description  text,
  creator_type varchar(10) NOT NULL CHECK (creator_type IN ('admin','teacher')),
  created_by   uuid NOT NULL REFERENCES users_module.users(id) ON DELETE CASCADE,
  view_count   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

GRANT ALL ON public.study_list_posts TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_study_list_posts_type_created ON public.study_list_posts (list_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_list_posts_type_views   ON public.study_list_posts (list_type, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_study_list_posts_created_by   ON public.study_list_posts (created_by);

ALTER TABLE public.study_list_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Đọc công khai — luôn xuất bản ngay, không có trạng thái nháp
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_posts' AND policyname='study_list_posts: read all') THEN
    CREATE POLICY "study_list_posts: read all" ON public.study_list_posts
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Tạo bài đăng của chính mình (ghi thực tế đi qua service_role ở backend;
  -- policy này là lớp phòng thủ cho đường PostgREST trực tiếp, giống rationale ở 008)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_posts' AND policyname='study_list_posts: insert own') THEN
    CREATE POLICY "study_list_posts: insert own" ON public.study_list_posts
      FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_posts' AND policyname='study_list_posts: update own') THEN
    CREATE POLICY "study_list_posts: update own" ON public.study_list_posts
      FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_posts' AND policyname='study_list_posts: delete own') THEN
    CREATE POLICY "study_list_posts: delete own" ON public.study_list_posts
      FOR DELETE TO authenticated USING (created_by = auth.uid());
  END IF;
END $$;


-- ─── 3. public.study_list_items — mục trong bài đăng ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_list_items (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid NOT NULL REFERENCES public.study_list_posts(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL,  -- KHÔNG có FK: trỏ tới vocabulary.id / kanji.id / grammar_points.id
                             -- tùy list_type của post cha — validate ở controller, không ở DB
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, item_id)
);

GRANT ALL ON public.study_list_items TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_study_list_items_post ON public.study_list_items (post_id);
CREATE INDEX IF NOT EXISTS idx_study_list_items_item ON public.study_list_items (item_id);

ALTER TABLE public.study_list_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_items' AND policyname='study_list_items: read all') THEN
    CREATE POLICY "study_list_items: read all" ON public.study_list_items
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Ghi item chỉ khi sở hữu bài đăng cha (chủ list mới được thêm/xóa mục)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_list_items' AND policyname='study_list_items: write own post') THEN
    CREATE POLICY "study_list_items: write own post" ON public.study_list_items
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.study_list_posts p WHERE p.id = study_list_items.post_id AND p.created_by = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.study_list_posts p WHERE p.id = study_list_items.post_id AND p.created_by = auth.uid()));
  END IF;
END $$;


-- PostgREST: nạp lại schema để thấy bảng mới (public luôn được expose sẵn)
NOTIFY pgrst, 'reload schema';
