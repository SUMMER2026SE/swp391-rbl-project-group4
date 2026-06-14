import { useEffect, useRef, useState } from 'react';
import { loadFaceDetector, analyzeGaze } from '../../lib/faceDetector';

const GAZE_VI = { straight: 'Nhìn thẳng', left: 'Quay trái', right: 'Quay phải', up: 'Ngẩng lên', down: 'Cúi xuống' };

// Card kiểm tra AI nhận diện khuôn mặt (dùng cho thi giám sát) ngay trên trình duyệt admin.
export default function FaceDetectionTest() {
  const [status, setStatus]     = useState('idle'); // idle | loading | running | error
  const [faceCount, setFaceCount] = useState(null);
  const [gaze, setGaze]         = useState(null); // 'straight'|'left'|'right'|'down'
  const [loadMs, setLoadMs]     = useState(null);
  const [error, setError]       = useState('');

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const timerRef    = useRef(null);

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    try { detectorRef.current?.close?.(); } catch {}
    detectorRef.current = null;
    setStatus('idle');
    setFaceCount(null);
    setGaze(null);
  };

  const start = async () => {
    setError(''); setFaceCount(null); setLoadMs(null);
    setStatus('loading');
    try {
      // 1. Webcam
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }

      // 2. Tải model MediaPipe (đo thời gian)
      const t0 = performance.now();
      detectorRef.current = await loadFaceDetector();
      setLoadMs(Math.round(performance.now() - t0));

      // 3. Vòng lặp nhận diện
      setStatus('running');
      timerRef.current = setInterval(() => {
        const det = detectorRef.current, video = videoRef.current;
        if (!det || !video || video.readyState < 2) return;
        try {
          const res = det.detectForVideo(video, performance.now());
          const dets = res?.detections || [];
          setFaceCount(dets.length);
          setGaze(dets.length === 1 ? (analyzeGaze(dets[0])?.direction ?? null) : null);
        } catch { /* bỏ qua frame lỗi */ }
      }, 500);
    } catch (e) {
      stop();
      setStatus('error');
      setError(
        e.name === 'NotAllowedError' ? 'Cần cấp quyền webcam để kiểm tra.'
        : 'Không tải được mô hình AI (kiểm tra mạng/CDN): ' + (e.message || e.name)
      );
    }
  };

  useEffect(() => () => stop(), []); // dọn khi rời trang

  const oneFace        = faceCount === 1;
  const lookingStraight = oneFace && gaze === 'straight';
  const faceOk   = lookingStraight;
  const faceTone = faceCount == null ? 'text-on-muted'
    : lookingStraight ? 'text-emerald-600'
    : oneFace ? 'text-amber-500'           // có mặt nhưng nhìn lệch
    : faceCount === 0 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="font-display font-bold text-base mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-tsubaki-red">face_retouching_natural</span>
        Phát hiện khuôn mặt (thi giám sát)
      </h2>
      <p className="text-sm text-on-muted mb-4">
        Kiểm tra AI nhận diện khuôn mặt (MediaPipe) chạy được trên trình duyệt này — dùng cho bài thi có giám sát.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Video preview */}
        <div className="relative w-full sm:w-56 shrink-0">
          <video ref={videoRef} muted playsInline
            style={{ transform: 'scaleX(-1)' }}
            className="w-full rounded-xl bg-charcoal/90 aspect-[4/3] object-cover" />
          {status === 'running' && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 ${faceTone}`}>
              {oneFace ? (GAZE_VI[gaze] || 'Khuôn mặt')
                : faceCount === 0 ? 'Không thấy mặt' : `${faceCount} khuôn mặt`}
            </span>
          )}
          {status !== 'running' && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40">
              <span className="material-symbols-outlined text-4xl">videocam_off</span>
            </div>
          )}
        </div>

        {/* Status + control */}
        <div className="flex-1 space-y-3">
          <div className="space-y-1.5 text-sm">
            <Row label="Trạng thái" value={
              status === 'idle' ? 'Chưa chạy' :
              status === 'loading' ? 'Đang tải mô hình...' :
              status === 'running' ? 'Đang nhận diện' : 'Lỗi'
            } tone={status === 'running' ? 'text-emerald-600' : status === 'error' ? 'text-red-500' : 'text-on-muted'} />
            {loadMs != null && <Row label="Tải mô hình AI" value={`${loadMs} ms`} tone="text-charcoal" />}
            {status === 'running' && (
              <Row label="Khuôn mặt phát hiện" value={faceCount == null ? '—' : faceCount} tone={faceTone} />
            )}
            {status === 'running' && oneFace && (
              <Row label="Hướng nhìn" value={GAZE_VI[gaze] || '—'} tone={gaze === 'straight' ? 'text-emerald-600' : 'text-amber-500'} />
            )}
          </div>

          {status === 'running' && (
            <div className={`flex items-center gap-2 text-sm font-medium ${faceOk ? 'text-emerald-600' : 'text-amber-600'}`}>
              <span className="material-symbols-outlined text-lg">{faceOk ? 'check_circle' : 'info'}</span>
              {faceOk ? 'AI hoạt động tốt — phát hiện 1 khuôn mặt nhìn thẳng màn hình.'
                : !oneFace ? 'Hãy ngồi vào khung hình để kiểm tra (cần đúng 1 khuôn mặt).'
                : 'Phát hiện khuôn mặt nhưng chưa nhìn thẳng — hãy nhìn vào màn hình.'}
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <span className="material-symbols-outlined text-lg">error</span>{error}
            </div>
          )}

          <button
            onClick={status === 'running' || status === 'loading' ? stop : start}
            disabled={status === 'loading'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
              status === 'running' || status === 'loading'
                ? 'border border-outline text-on-muted hover:bg-surface-low'
                : 'bg-tsubaki-red text-white hover:opacity-90'
            }`}>
            <span className={`material-symbols-outlined text-lg ${status === 'loading' ? 'animate-spin' : ''}`}>
              {status === 'loading' ? 'progress_activity' : status === 'running' ? 'stop' : 'play_arrow'}
            </span>
            {status === 'running' ? 'Dừng' : status === 'loading' ? 'Đang tải...' : 'Bắt đầu kiểm tra'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex justify-between border-b border-outline/10 py-1.5">
      <span className="text-on-muted">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}
