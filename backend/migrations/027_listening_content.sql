-- Nâng cấp Luyện nghe: mở rộng "bài nghe cá nhân" (listening_user_audios) thành
-- model nội dung chung cho cả admin (công khai) lẫn học sinh (riêng tư), nhiều nguồn
-- tạo (tts/audio/video/youtube) + transcript đồng bộ có thể sửa.

ALTER TABLE public.listening_user_audios
  ADD COLUMN IF NOT EXISTS creator_type text    DEFAULT 'student',   -- 'student' | 'admin'
  ADD COLUMN IF NOT EXISTS is_public    boolean DEFAULT false,        -- admin → true; học sinh luôn false
  ADD COLUMN IF NOT EXISTS source_type  text,                         -- 'tts' | 'audio' | 'video' | 'youtube'
  ADD COLUMN IF NOT EXISTS content_url  text,                         -- link YouTube / URL video (audio ở audio_url)
  ADD COLUMN IF NOT EXISTS title_vi     text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- Nguồn youtube/video lưu ở content_url → audio_url có thể null (trước đây NOT NULL vì
-- chỉ có nguồn upload audio).
ALTER TABLE public.listening_user_audios ALTER COLUMN audio_url DROP NOT NULL;

-- Lọc danh sách công khai theo cấp độ + lọc nội dung riêng của học sinh.
CREATE INDEX IF NOT EXISTS idx_listening_user_audios_public
  ON public.listening_user_audios (is_public, level);
CREATE INDEX IF NOT EXISTS idx_listening_user_audios_owner
  ON public.listening_user_audios (student_id, created_at DESC);

-- Quota tạo bài nghe: free 2 bài/tháng, premium không giới hạn.
INSERT INTO public.feature_entitlements (tier, feature_code, limit_value, period_type)
VALUES
  ('free',    'listening_create_monthly',  2, 'monthly'),
  ('premium', 'listening_create_monthly', -1, 'monthly')
ON CONFLICT (tier, feature_code)
  DO UPDATE SET limit_value = EXCLUDED.limit_value,
                period_type = EXCLUDED.period_type,
                updated_at  = now();
