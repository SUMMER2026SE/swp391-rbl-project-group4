-- 020_lesson_reading_article.sql
-- Mục "Bài đọc" trong khóa học dùng chung cơ chế reading_module.articles:
-- lessons.reading_article_id (1-1, nullable) trỏ tới bài đọc có cấu trúc đầy đủ
-- (segments/questions/vocab/grammar) thay cho content_body JSON {text, imageUrl}.
-- KHÔNG đổi cấu trúc reading_module.articles — tính năng Luyện đọc độc lập giữ nguyên.
-- articles.creator_type không có CHECK constraint (text, default 'admin') nên dùng
-- thêm giá trị 'lesson' để đánh dấu bài đọc thuộc khóa học (ẩn khỏi danh sách công khai).

ALTER TABLE content_module.lessons
  ADD COLUMN IF NOT EXISTS reading_article_id uuid
    REFERENCES reading_module.articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_reading_article
  ON content_module.lessons (reading_article_id)
  WHERE reading_article_id IS NOT NULL;

-- ── Chuyển dữ liệu cũ ──────────────────────────────────────────────────────────
-- Với mọi lesson reading có content_body dạng JSON {text, imageUrl} (hoặc text thuần
-- legacy) và chưa có reading_article_id: tạo 1 article mới rồi gán vào lesson.
-- Giữ nguyên content_body để rollback an toàn — chỉ ngừng dùng cho hiển thị.
DO $$
DECLARE
  l record;
  v_text text;
  v_image text;
  v_article_id uuid;
BEGIN
  FOR l IN
    SELECT id, title, content_body, is_published, created_by
    FROM content_module.lessons
    WHERE content_type = 'reading'
      AND reading_article_id IS NULL
      AND content_body IS NOT NULL
      AND btrim(content_body) <> ''
  LOOP
    BEGIN
      v_text  := l.content_body::jsonb ->> 'text';
      v_image := l.content_body::jsonb ->> 'imageUrl';
    EXCEPTION WHEN others THEN
      -- content_body không phải JSON → coi toàn bộ là text (legacy)
      v_text  := l.content_body;
      v_image := NULL;
    END;
    CONTINUE WHEN v_text IS NULL OR btrim(v_text) = '';

    INSERT INTO reading_module.articles
      (title, content, thumbnail_url, segments, questions, vocab, grammar,
       is_published, created_by, creator_type)
    VALUES
      (l.title, v_text, v_image, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
       COALESCE(l.is_published, false), l.created_by, 'lesson')
    RETURNING id INTO v_article_id;

    UPDATE content_module.lessons
    SET reading_article_id = v_article_id
    WHERE id = l.id;
  END LOOP;
END $$;
