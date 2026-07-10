-- Migration 015: "Giám sát" (mode = proctored) nay đồng nghĩa với toàn màn hình nghiêm ngặt.
-- Webcam/face-detection đã bị bỏ khỏi luồng quiz; enforcement (FE + khóa 20 phút phía server)
-- đều gate theo strict_fullscreen. Backfill các quiz/đề thi proctored cũ để chúng bật cờ này.

UPDATE exam_module.quizzes
  SET strict_fullscreen = TRUE
  WHERE mode = 'proctored' AND strict_fullscreen = FALSE;
