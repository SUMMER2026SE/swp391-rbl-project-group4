import { useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

const TOPICS = {
  N5: ['家族・かぞく (Gia đình)', '食べ物・たべもの (Đồ ăn)', '学校・がっこう (Trường học)',
       '天気・てんき (Thời tiết)', '私の一日・わたしのいちにち (Một ngày của tôi)', '好きなこと (Điều tôi thích)'],
  N4: ['趣味・しゅみ (Sở thích)', '旅行・りょこう (Du lịch)', '季節・きせつ (Mùa trong năm)',
       '友達・ともだち (Bạn bè)', '将来の夢・しょうらいのゆめ (Ước mơ tương lai)'],
  N3: ['環境問題・かんきょうもんだい (Vấn đề môi trường)', '技術と生活 (Công nghệ và cuộc sống)',
       '健康・けんこう (Sức khỏe)', '文化の違い (Sự khác biệt văn hóa)', '教育・きょういく (Giáo dục)'],
  N2: ['少子高齢化 (Già hóa dân số)', 'グローバル化 (Toàn cầu hóa)',
       '働き方の変化 (Thay đổi trong lao động)', '情報社会 (Xã hội thông tin)'],
  N1: ['倫理とAI (Đạo đức và AI)', '民主主義 (Dân chủ)', '経済格差 (Bất bình đẳng kinh tế)',
       '持続可能な社会 (Xã hội bền vững)'],
};
const LEVELS = ['N5','N4','N3','N2','N1'];
const MIN_LEN = 30;

const scoreColor = (s, max) => {
  const pct = s / max;
  return pct >= 0.8 ? '#16a34a' : pct >= 0.5 ? '#d97706' : '#ae2826';
};

function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  const color = scoreColor(value, max);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-on-muted">{label}</span>
        <span className="font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-low overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function HistoryCard({ item, onClick }) {
  return (
    <button onClick={onClick} className="w-full glass-card rounded-xl p-4 text-left hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold text-sm line-clamp-1">{item.topic}</p>
        {item.ai_score != null
          ? <span className="text-sm font-bold shrink-0" style={{ color: scoreColor(item.ai_score, 100) }}>{item.ai_score}/100</span>
          : <span className="text-xs text-on-muted shrink-0">Chưa chấm</span>}
      </div>
      <p className="text-xs text-on-muted line-clamp-2">{item.submission_text}</p>
      <p className="text-xs text-on-muted mt-1">{new Date(item.submitted_at).toLocaleDateString('vi-VN')}</p>
    </button>
  );
}

export default function Writing() {
  const [tab, setTab]     = useState('write'); // 'write' | 'history'
  const [level, setLevel] = useState('N5');
  const [topic, setTopic] = useState(TOPICS['N5'][0]);
  const [text, setText]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]   = useState(null);
  const [submitErr, setSubmitErr] = useState('');
  // history
  const [history, setHistory]   = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [histLoaded, setHistLoaded]   = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const onLevelChange = (lv) => { setLevel(lv); setTopic(TOPICS[lv][0]); setResult(null); };

  const handleSubmit = async () => {
    if (text.trim().length < MIN_LEN) return;
    setSubmitting(true); setResult(null); setSubmitErr('');
    try {
      const r = await api.post('/writing/submit', { topic, level, text });
      setResult(r.data);
      setHistLoaded(false); // reset history cache
    } catch (e) {
      setSubmitErr(e.response?.data?.error || 'Gửi bài thất bại, thử lại.');
    } finally { setSubmitting(false); }
  };

  const loadHistory = async () => {
    if (histLoaded) return;
    setLoadingHist(true);
    try { const r = await api.get('/writing/history?limit=20'); setHistory(r.data.data || []); setHistLoaded(true); }
    catch { /* ignore */ } finally { setLoadingHist(false); }
  };

  const loadDetail = async (id) => {
    setLoadingDetail(true); setDetail(null);
    try { const r = await api.get(`/writing/${id}`); setDetail(r.data); }
    catch { /* ignore */ } finally { setLoadingDetail(false); }
  };

  const onTabChange = (t) => { setTab(t); if (t === 'history') loadHistory(); };

  const remaining = Math.max(0, MIN_LEN - text.trim().length);

  return (
    <StudentLayout title="Viết đoạn văn">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold">Viết đoạn văn theo chủ đề</h1>
          <p className="text-sm text-on-muted">Chọn chủ đề, viết đoạn văn tiếng Nhật và nhận điểm từ AI.</p>
        </div>

        {/* Tab */}
        <div className="flex rounded-xl border border-outline p-1 mb-5 bg-surface-low gap-1">
          {[['write','edit_note','Viết bài'],['history','history','Lịch sử']].map(([key,icon,label]) => (
            <button key={key} onClick={() => onTabChange(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab===key?'bg-white shadow text-charcoal':'text-on-muted hover:text-charcoal'}`}>
              <span className="material-symbols-outlined text-base">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* ── Tab Viết bài ── */}
        {tab === 'write' && (
          <div className="space-y-4">
            {/* Chọn cấp độ + chủ đề */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {LEVELS.map(lv => (
                  <button key={lv} onClick={() => onLevelChange(lv)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${level===lv?'bg-tsubaki-red text-white border-tsubaki-red':'border-outline text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red'}`}>
                    {lv}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-on-muted block mb-1.5">Chủ đề</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {TOPICS[level].map(t => (
                    <button key={t} onClick={() => { setTopic(t); setResult(null); }}
                      className={`px-3 py-2 rounded-lg border text-sm text-left transition-all ${topic===t?'bg-tsubaki-red/10 border-tsubaki-red text-tsubaki-red font-medium':'border-outline text-charcoal hover:bg-surface-low'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ô viết */}
            <div className="glass-card rounded-2xl p-4">
              <label className="text-xs font-semibold text-on-muted block mb-2">
                Bài viết của bạn
                <span className="ml-2 font-normal text-charcoal">{text.trim().length} ký tự</span>
              </label>
              <textarea value={text} onChange={e => { setText(e.target.value); setResult(null); }}
                rows={8} placeholder={`Viết đoạn văn về "${topic}" bằng tiếng Nhật...`}
                className="w-full px-3 py-2 border border-outline rounded-xl text-base outline-none focus:border-tsubaki-red resize-y leading-relaxed"
                style={{ fontFamily: "'Noto Sans JP', sans-serif" }} />
              {remaining > 0 && <p className="text-xs text-on-muted mt-1">Còn thiếu {remaining} ký tự để gửi</p>}
            </div>

            <Button onClick={handleSubmit} loading={submitting} disabled={text.trim().length < MIN_LEN} className="w-full">
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              Gửi bài & nhận điểm AI
            </Button>
            {submitErr && <p className="text-sm text-tsubaki-red text-center">{submitErr}</p>}

            {/* Kết quả */}
            {result && (
              <div className="glass-card rounded-2xl p-5 space-y-4">
                {/* Tổng điểm */}
                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="text-center">
                    <p className="text-xs text-on-muted mb-1">Tổng điểm</p>
                    <p className="text-5xl font-display font-bold" style={{ color: scoreColor(result.score, 100) }}>
                      {result.score}
                    </p>
                    <p className="text-xs text-on-muted">/100</p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2.5">
                  <ScoreBar label="Ngữ pháp (Grammar)"  value={result.grammar_score}    max={40} />
                  <ScoreBar label="Từ vựng (Vocabulary)" value={result.vocabulary_score} max={30} />
                  <ScoreBar label="Mạch lạc (Coherence)" value={result.coherence_score}  max={30} />
                </div>

                {/* Nhận xét tổng */}
                {result.overall_comment && (
                  <div className="bg-surface-low rounded-xl p-3">
                    <p className="text-xs font-semibold text-on-muted mb-1">Nhận xét</p>
                    <p className="text-sm text-charcoal">{result.overall_comment}</p>
                  </div>
                )}

                {/* Lỗi ngữ pháp */}
                {result.grammar_errors?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-on-muted mb-1.5">Lỗi ngữ pháp</p>
                    <ul className="space-y-1">
                      {result.grammar_errors.map((e, i) => (
                        <li key={i} className="text-sm flex gap-1.5 text-charcoal">
                          <span className="material-symbols-outlined text-base text-tsubaki-red shrink-0">close</span>{e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gợi ý từ vựng */}
                {result.vocabulary_suggestions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-on-muted mb-1.5">Gợi ý từ vựng</p>
                    <ul className="space-y-1">
                      {result.vocabulary_suggestions.map((s, i) => (
                        <li key={i} className="text-sm flex gap-1.5 text-charcoal">
                          <span className="material-symbols-outlined text-base text-amber-500 shrink-0">lightbulb</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bài đã sửa */}
                {result.corrected_text && (
                  <div>
                    <p className="text-xs font-semibold text-on-muted mb-1.5">Bản đã sửa</p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-charcoal leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
                      {result.corrected_text}
                    </div>
                  </div>
                )}

                <Button variant="secondary" onClick={() => { setText(''); setResult(null); setTopic(TOPICS[level][0]); }} className="w-full">
                  Viết bài mới
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab Lịch sử ── */}
        {tab === 'history' && (
          <div>
            {loadingHist && (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="glass-card rounded-xl h-20 animate-pulse" />)}
              </div>
            )}
            {!loadingHist && history.length === 0 && (
              <div className="glass-card rounded-2xl py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">edit_note</span>
                <p className="font-semibold mb-1">Chưa có bài viết nào</p>
                <p className="text-on-muted text-sm">Chuyển sang tab "Viết bài" để bắt đầu.</p>
              </div>
            )}
            {!loadingHist && history.length > 0 && !detail && (
              <div className="space-y-3">
                {history.map(item => (
                  <HistoryCard key={item.id} item={item} onClick={() => loadDetail(item.id)} />
                ))}
              </div>
            )}
            {/* Chi tiết bài cũ */}
            {detail && (
              <div className="space-y-4">
                <button onClick={() => setDetail(null)} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại
                </button>
                <div className="glass-card rounded-2xl p-4">
                  <p className="text-xs text-on-muted mb-1">{detail.level} · {new Date(detail.submitted_at).toLocaleDateString('vi-VN')}</p>
                  <p className="font-semibold mb-2">{detail.topic}</p>
                  <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed bg-surface-low rounded-xl p-3"
                    style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{detail.submission_text}</p>
                </div>
                {detail.ai_score != null && (
                  <div className="glass-card rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <p className="text-3xl font-display font-bold" style={{ color: scoreColor(detail.ai_score, 100) }}>{detail.ai_score}/100</p>
                      {detail.ai_feedback_vi && <p className="text-sm text-charcoal">{detail.ai_feedback_vi}</p>}
                    </div>
                    <ScoreBar label="Ngữ pháp"  value={detail.ai_grammar_score}    max={40} />
                    <ScoreBar label="Từ vựng"   value={detail.ai_vocabulary_score} max={30} />
                    <ScoreBar label="Mạch lạc"  value={detail.ai_coherence_score}  max={30} />
                    {detail.ai_corrected_text && (
                      <div>
                        <p className="text-xs font-semibold text-on-muted mb-1.5">Bản đã sửa</p>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-charcoal leading-relaxed whitespace-pre-wrap"
                          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{detail.ai_corrected_text}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {loadingDetail && (
              <div className="glass-card rounded-2xl h-48 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
