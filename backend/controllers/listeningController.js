'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { whisperTranscribe } = require('../config/ai');

const db = () => supabaseAdmin.schema('listening_module');

// GET /api/listening?level=N5
exports.list = async (req, res) => {
  let q = db().from('dialogues').select('id, title, title_vi, level, topic, thumbnail_icon').order('level').order('created_at');
  if (req.query.level) q = q.eq('level', req.query.level);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Không tải được danh sách.' });
  res.json(data);
};

// GET /api/listening/:id
exports.getOne = async (req, res) => {
  const [{ data: dlg, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    db().from('dialogues').select('*').eq('id', req.params.id).single(),
    db().from('dialogue_lines').select('id, line_order, speaker, text_jp, text_plain, text_vi')
      .eq('dialogue_id', req.params.id).order('line_order'),
  ]);
  if (e1 || !dlg) return res.status(404).json({ error: 'Không tìm thấy hội thoại.' });
  if (e2) return res.status(500).json({ error: 'Không tải được nội dung.' });
  res.json({ ...dlg, lines });
};

// POST /api/listening/score-pronunciation  { audioBase64, mimeType, target }
exports.scorePronunciation = async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm', target } = req.body || {};
  if (!audioBase64 || !target) return res.status(400).json({ error: 'Thiếu audio hoặc văn bản mục tiêu.' });

  let transcript = '';
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
    const result = await whisperTranscribe(buffer, `rec.${ext}`, mimeType, 'ja');
    transcript = result.text.trim();
  } catch (e) {
    console.error('Whisper error:', e.message);
    return res.status(502).json({ error: 'Lỗi nhận dạng giọng nói.' });
  }

  const score = pronunciationScore(transcript, target);
  const feedback = score >= 90 ? 'Tuyệt vời! Phát âm rất chuẩn.'
    : score >= 75 ? 'Tốt lắm! Phát âm khá tốt.'
    : score >= 60 ? 'Cần luyện thêm một chút nữa là ổn.'
    : 'Hãy nghe mẫu thêm và luyện tập lại nhé.';

  res.json({ score, transcript, feedback });
};

function pronunciationScore(a, b) {
  const norm = s => s.replace(/[。、！？\s「」『』・]/g, '');
  const na = norm(a), nb = norm(b);
  if (!nb) return 0;
  const dp = Array.from({ length: na.length + 1 }, (_, i) =>
    Array.from({ length: nb.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= na.length; i++)
    for (let j = 1; j <= nb.length; j++)
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return Math.max(0, Math.round((1 - dp[na.length][nb.length] / Math.max(na.length, nb.length)) * 100));
}
