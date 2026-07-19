'use strict';

// ─── Tải audio từ YouTube qua yt-dlp (binary ngoài, cài riêng như ffmpeg) ──────
// Dùng cho chép lời tự động lesson video nguồn YouTube: tải audio-only về file tạm
// rồi đưa vào pipeline VAD/Whisper có sẵn. Lưu ý vận hành: yt-dlp có thể bị YouTube
// chặn/đổi cơ chế bất kỳ lúc nào — lỗi tải về là rủi ro biết trước, phải fail mềm
// với message rõ ràng, không crash server.

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

// ── Giải quyết cách gọi yt-dlp ────────────────────────────────────────────────
// Ưu tiên binary `yt-dlp` trên PATH; nếu không có thì thử module Python (`python -m
// yt_dlp`) — pip cài module nhưng không phải lúc nào cũng tạo exe trên PATH. Nhờ vậy
// chạy được cả trên máy dev (Windows) lẫn server deploy mà không phụ thuộc PATH.
// Cache kết quả: undefined = chưa dò, null = không có, [bin, ...prefixArgs] = có.
let _ytDlpCmd;
function resolveYtDlp() {
  if (_ytDlpCmd !== undefined) return _ytDlpCmd;
  const candidates = [['yt-dlp'], ['python', '-m', 'yt_dlp'], ['python3', '-m', 'yt_dlp'], ['py', '-m', 'yt_dlp']];
  for (const c of candidates) {
    try { execSync([...c, '--version'].join(' '), { stdio: 'ignore' }); _ytDlpCmd = c; return c; }
    catch { /* thử cách tiếp theo */ }
  }
  _ytDlpCmd = null;
  return null;
}

function ytDlpAvailable() { return resolveYtDlp() !== null; }

// Dịch stderr của yt-dlp sang message tiếng Việt dễ hiểu cho giáo viên.
function friendlyError(stderr) {
  const s = (stderr || '').toLowerCase();
  if (s.includes('private video')) return 'Video ở chế độ riêng tư, không thể tải.';
  if (s.includes('age') && (s.includes('restrict') || s.includes('confirm')))
    return 'Video bị giới hạn độ tuổi, không thể tải tự động.';
  if (s.includes('video unavailable') || s.includes('removed') || s.includes('does not exist'))
    return 'Video không tồn tại hoặc đã bị gỡ.';
  if (s.includes('not available in your country') || s.includes('geo'))
    return 'Video bị giới hạn khu vực, máy chủ không xem được.';
  if (s.includes('sign in') || s.includes('bot'))
    return 'YouTube đang chặn tải tự động từ máy chủ (yêu cầu đăng nhập). Thử lại sau hoặc dùng chế độ "Dán SRT/VTT".';
  return 'Không tải được audio từ YouTube. Thử lại sau hoặc dùng chế độ "Dán SRT/VTT".';
}

// Tải audio-only (mp3) của 1 video YouTube về file tạm. Trả về đường dẫn file —
// caller chịu trách nhiệm xóa sau khi dùng (cả khi thành công lẫn lỗi).
function downloadYouTubeAudio(url) {
  const cmd = resolveYtDlp();
  if (!cmd) {
    throw new Error('yt-dlp chưa được cài trên server — chép lời tự động cho YouTube không khả dụng.');
  }
  const [bin, ...prefix] = cmd;
  const outPath = path.join(os.tmpdir(), `kn_yt_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [
      ...prefix,
      '-x', '--audio-format', 'mp3', '--audio-quality', '5',
      '--no-playlist',
      '-o', outPath,
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else {
        console.warn('[YouTube] yt-dlp failed (code', code + '):', stderr.slice(0, 500));
        reject(new Error(friendlyError(stderr)));
      }
    });
    proc.on('error', err => reject(new Error('Không chạy được yt-dlp: ' + err.message)));
  });
}

module.exports = { ytDlpAvailable, downloadYouTubeAudio };
