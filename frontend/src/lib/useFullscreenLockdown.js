import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

export const MAX_FULLSCREEN_VIOLATIONS = 5;

// Chế độ toàn màn hình nghiêm ngặt (strict_fullscreen), độc lập với proctoring webcam:
// bắt buộc fullscreen khi làm bài; mọi hành vi rời bài thi (thoát fullscreen, chuyển tab,
// Alt+Tab sang cửa sổ khác) đều tính là 1 vi phạm ("breach") — che đề và báo về server
// (POST fullscreen-violation) để đếm phía server. Đạt 5 lần server khóa thi 20 phút
// và trả locked: true. Đề chỉ mở lại khi gọi resume() (vào lại fullscreen).
export function useFullscreenLockdown(quizId, { enabled, onLocked }) {
  const [active, setActive]                 = useState(false);
  const [breached, setBreached]             = useState(false); // đang rời bài thi → che đề
  const [violationCount, setViolationCount] = useState(0);

  const activeRef   = useRef(false);
  const breachRef   = useRef(false);
  const onLockedRef = useRef(onLocked);
  onLockedRef.current = onLocked;

  // Vào chế độ nghiêm ngặt: xin fullscreen rồi bắt đầu theo dõi
  const start = useCallback(async () => {
    await document.documentElement.requestFullscreen();
    activeRef.current = true;
    setActive(true);
    breachRef.current = false;
    setBreached(false);
  }, []);

  // Bắt đầu theo dõi khi fullscreen đã được xin ở nơi khác (vd. proctor.start)
  const activate = useCallback(() => {
    activeRef.current = true;
    setActive(true);
  }, []);

  // Quay lại làm bài sau vi phạm: phải vào lại fullscreen thì mới mở đề
  const resume = useCallback(async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
    if (!document.fullscreenElement) return; // chưa vào lại được → vẫn che đề
    breachRef.current = false;
    setBreached(false);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Mỗi lần rời bài thi chỉ tính 1 vi phạm (breachRef chặn đếm trùng khi
    // blur + visibilitychange + fullscreenchange cùng bắn cho 1 hành động)
    const breach = async () => {
      if (!activeRef.current || breachRef.current) return;
      breachRef.current = true;
      setBreached(true);
      try {
        const r = await api.post(`/quizzes/${quizId}/fullscreen-violation`);
        if (r.data?.locked) {
          activeRef.current = false;
          setActive(false);
          onLockedRef.current?.(r.data.lockedUntil);
        } else {
          setViolationCount(r.data?.violationCount ?? 0);
        }
      } catch {
        setViolationCount(v => v + 1);
      }
    };
    const onFsChange   = () => { if (!document.fullscreenElement) breach(); };
    const onVisibility = () => { if (document.hidden) breach(); };
    const onBlur       = () => breach();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, quizId]);

  return { active, breached, violationCount, start, activate, stop, resume };
}
