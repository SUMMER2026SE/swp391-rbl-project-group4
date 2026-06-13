import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

// MediaPipe Tasks Vision — tải động từ CDN (không bundle vào app).
// Nếu tải lỗi, giám sát vẫn chạy: chỉ thiếu phần AI nhận diện khuôn mặt.
const MP_VERSION = '0.10.18';
const MP_BASE    = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const SNAPSHOT_INTERVAL_MS = 20000; // chụp ảnh mỗi 20s
const FACE_CHECK_MS        = 1500;  // kiểm tra khuôn mặt mỗi 1.5s

const VIOLATION_LABELS = {
  fullscreen_exit: 'Thoát toàn màn hình',
  tab_hidden:      'Rời khỏi tab / cửa sổ',
  no_face:         'Không thấy khuôn mặt',
  multiple_faces:  'Phát hiện nhiều người',
  camera_lost:     'Mất kết nối webcam',
};

export { VIOLATION_LABELS };

export function useProctoring(quizId, { enabled }) {
  const [status, setStatus]         = useState('idle'); // idle | requesting | active | denied | stopped
  const [isFullscreen, setIsFull]   = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceStatus, setFaceStatus] = useState('unknown'); // ok | no_face | multiple | unknown
  const [violations, setViolations] = useState(0);
  const [errorMsg, setErrorMsg]     = useState('');

  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const eventsRef  = useRef([]);     // [{type, at}]
  const snapsRef   = useRef([]);     // [storagePath]
  const detectorRef = useRef(null);
  const faceStateRef = useRef('ok'); // trạng thái khuôn mặt hiện tại để debounce
  const activeRef  = useRef(false);
  const timersRef  = useRef([]);

  const logEvent = useCallback((type) => {
    eventsRef.current.push({ type, at: new Date().toISOString() });
    setViolations(v => v + 1);
  }, []);

  // ── Webcam snapshot → upload ──────────────────────────────────────────────
  const captureSnapshot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
    try {
      const r = await api.post(`/quizzes/${quizId}/proctor-snapshot`, { image: dataUrl });
      if (r.data?.path) snapsRef.current.push(r.data.path);
    } catch { /* bỏ qua lỗi upload lẻ */ }
  }, [quizId]);

  // ── AI nhận diện khuôn mặt (tùy chọn) ─────────────────────────────────────
  const loadDetector = useCallback(async () => {
    try {
      const vision = await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      detectorRef.current = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
    } catch {
      detectorRef.current = null; // graceful degrade
    }
  }, []);

  const checkFace = useCallback(() => {
    const det = detectorRef.current;
    const video = videoRef.current;
    if (!det || !video || video.readyState < 2) return;
    let count = 0;
    try {
      const res = det.detectForVideo(video, performance.now());
      count = res?.detections?.length || 0;
    } catch { return; }

    const next = count === 0 ? 'no_face' : count > 1 ? 'multiple' : 'ok';
    setFaceStatus(next);
    // Chỉ ghi vi phạm khi CHUYỂN từ ok sang xấu (tránh spam mỗi frame)
    if (next !== 'ok' && faceStateRef.current === 'ok') {
      logEvent(next === 'no_face' ? 'no_face' : 'multiple_faces');
    }
    faceStateRef.current = next;
  }, [logEvent]);

  // ── Bắt đầu giám sát: xin fullscreen + webcam ─────────────────────────────
  const start = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');
    try {
      await document.documentElement.requestFullscreen();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
      activeRef.current = true;
      setStatus('active');

      await loadDetector();

      timersRef.current.push(setInterval(captureSnapshot, SNAPSHOT_INTERVAL_MS));
      timersRef.current.push(setInterval(checkFace, FACE_CHECK_MS));
      captureSnapshot(); // chụp ngay 1 ảnh đầu
    } catch (e) {
      setStatus('denied');
      setErrorMsg(
        e.name === 'NotAllowedError'
          ? 'Bạn cần cho phép camera và toàn màn hình để vào phòng thi giám sát.'
          : 'Không thể khởi động giám sát: ' + e.message
      );
    }
  }, [captureSnapshot, checkFace, loadDetector]);

  const reenterFullscreen = useCallback(async () => {
    try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    timersRef.current.forEach(clearInterval);
    timersRef.current = [];
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    try { detectorRef.current?.close?.(); } catch {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setStatus('stopped');
  }, []);

  // Gắn stream vào <video> khi nó mount (video chỉ render ở màn làm bài,
  // sau khi start() đã chạy ở màn hình chờ → videoRef lúc đó còn null).
  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [status]);

  // ── Theo dõi fullscreen + chuyển tab ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const onFsChange = () => {
      const full = !!document.fullscreenElement;
      setIsFull(full);
      if (!full && activeRef.current) logEvent('fullscreen_exit');
    };
    const onVisibility = () => {
      if (document.hidden && activeRef.current) logEvent('tab_hidden');
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, logEvent]);

  // ── Phát hiện webcam bị ngắt giữa chừng ───────────────────────────────────
  useEffect(() => {
    if (!enabled || !cameraReady) return;
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const onEnded = () => { if (activeRef.current) { logEvent('camera_lost'); setCameraReady(false); } };
    track.addEventListener('ended', onEnded);
    return () => track.removeEventListener('ended', onEnded);
  }, [enabled, cameraReady, logEvent]);

  // Dọn dẹp khi unmount
  useEffect(() => () => {
    timersRef.current.forEach(clearInterval);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try { detectorRef.current?.close?.(); } catch {}
  }, []);

  return {
    status, isFullscreen, cameraReady, faceStatus, violations, errorMsg,
    videoRef, start, stop, reenterFullscreen,
    getProctorData: () => ({
      violation_count: eventsRef.current.length,
      proctor_events:  eventsRef.current,
      snapshots:       snapsRef.current,
    }),
  };
}
