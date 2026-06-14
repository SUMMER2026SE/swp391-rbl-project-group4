// MediaPipe Tasks Vision — tải động từ CDN (dùng chung cho thi giám sát + trang test).
const MP_VERSION = '0.10.18';
const MP_BASE    = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Tạo FaceDetector ở chế độ VIDEO. Ném lỗi nếu CDN/model tải thất bại — caller tự xử lý.
export async function loadFaceDetector() {
  const vision  = await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  return vision.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });
}

// Ước lượng hướng nhìn từ 6 điểm mốc của BlazeFace (2 mắt + mũi).
// Trả về { direction: 'straight'|'left'|'right'|'up'|'down', facingForward, yaw, pitch }.
// Heuristic 2D: head quay trái/phải làm mũi lệch khỏi trung điểm 2 mắt (yaw);
// cúi/ngẩng làm mũi tụt thấp/cao hơn so với khoảng cách 2 mắt (pitch).
// Hướng trái/phải theo góc nhìn của người dùng (preview đã lật như gương).
const YAW_THRESHOLD   = 0.22; // |lệch ngang| > ngưỡng → quay đầu
const PITCH_DOWN_MAX  = 1.05; // mũi quá thấp → cúi xuống
const PITCH_UP_MIN    = 0.35; // mũi quá cao → ngẩng lên
export function analyzeGaze(detection) {
  const kp = detection?.keypoints;
  if (!kp || kp.length < 3) return null;
  const [eyeA, eyeB, nose] = kp; // [0],[1] = hai mắt, [2] = đầu mũi
  const eyeMidX = (eyeA.x + eyeB.x) / 2;
  const eyeMidY = (eyeA.y + eyeB.y) / 2;
  const eyeDist = Math.hypot(eyeA.x - eyeB.x, eyeA.y - eyeB.y) || 1e-6;
  const yaw   = (nose.x - eyeMidX) / eyeDist; // ~0 khi nhìn thẳng
  const pitch = (nose.y - eyeMidY) / eyeDist; // tăng khi cúi, giảm khi ngẩng

  let direction = 'straight';
  if (yaw < -YAW_THRESHOLD) direction = 'right';      // ảnh raw lệch trái = người quay phải
  else if (yaw >  YAW_THRESHOLD) direction = 'left';
  else if (pitch > PITCH_DOWN_MAX) direction = 'down';
  else if (pitch < PITCH_UP_MIN)  direction = 'up';

  return { direction, facingForward: direction === 'straight', yaw, pitch };
}
