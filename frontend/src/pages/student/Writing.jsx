import { useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

// ─── Data ────────────────────────────────────────────────────────────────────
const LEVELS = [
  { id:'N5', color:'#059669', bg:'#d1fae5', label:'Sơ cấp 1',   desc:'Câu đơn giản, từ vựng hằng ngày', example:'私は〜です。〜があります。' },
  { id:'N4', color:'#0284c7', bg:'#dbeafe', label:'Sơ cấp 2',   desc:'Câu phức, dùng て・に・が', example:'〜てから、〜たい、〜ている' },
  { id:'N3', color:'#7c3aed', bg:'#ede9fe', label:'Trung cấp',  desc:'Diễn đạt ý kiến, lý do', example:'〜ので、〜ために、〜と思う' },
  { id:'N2', color:'#d97706', bg:'#fef3c7', label:'Cao cấp',    desc:'Viết luận, phân tích vấn đề', example:'〜に対して、〜としては、〜ざるを得ない' },
  { id:'N1', color:'#ae2826', bg:'#fde8e8', label:'Thành thạo', desc:'Học thuật, nghị luận xã hội', example:'〜にほかならない、〜をめぐって、〜いかんによって' },
];

const TOPICS = {
  N5: [
    { jp:'家族', kana:'かぞく', vi:'Gia đình',        icon:'family_restroom', hint:'Giới thiệu thành viên, nghề nghiệp, tính cách...' },
    { jp:'食べ物', kana:'たべもの', vi:'Đồ ăn',         icon:'restaurant',      hint:'Món yêu thích, lý do thích, mô tả hương vị...' },
    { jp:'学校', kana:'がっこう', vi:'Trường học',      icon:'school',          hint:'Môn học yêu thích, giờ học, bạn bè ở trường...' },
    { jp:'天気', kana:'てんき', vi:'Thời tiết',         icon:'wb_sunny',        hint:'Mùa yêu thích, thời tiết hôm nay, thích làm gì khi trời...' },
    { jp:'私の一日', kana:'わたしのいちにち', vi:'Một ngày của tôi', icon:'today', hint:'Buổi sáng thức dậy lúc mấy giờ, làm gì trong ngày...' },
    { jp:'好きなこと', kana:'すきなこと', vi:'Điều tôi thích',   icon:'favorite',        hint:'Sở thích, lý do thích, thường làm khi nào...' },
  ],
  N4: [
    { jp:'趣味', kana:'しゅみ', vi:'Sở thích',          icon:'sports_esports',  hint:'Sở thích của bạn, khi nào bắt đầu, vì sao thích...' },
    { jp:'旅行', kana:'りょこう', vi:'Du lịch',          icon:'flight',          hint:'Nơi muốn đến, lý do, sẽ làm gì ở đó...' },
    { jp:'季節', kana:'きせつ', vi:'Mùa trong năm',      icon:'ac_unit',         hint:'Mùa yêu thích và lý do, hoạt động theo mùa...' },
    { jp:'友達', kana:'ともだち', vi:'Bạn bè',           icon:'group',           hint:'Người bạn thân, tính cách của họ, thường chơi gì...' },
    { jp:'将来の夢', kana:'しょうらいのゆめ', vi:'Ước mơ tương lai', icon:'rocket_launch', hint:'Nghề nghiệp muốn làm, lý do, cần chuẩn bị gì...' },
  ],
  N3: [
    { jp:'環境問題', kana:'かんきょうもんだい', vi:'Vấn đề môi trường', icon:'eco',    hint:'Vấn đề cụ thể, nguyên nhân, giải pháp bạn nghĩ đến...' },
    { jp:'技術と生活', kana:'ぎじゅつとせいかつ', vi:'Công nghệ & cuộc sống', icon:'devices', hint:'Công nghệ nào ảnh hưởng cuộc sống, tốt hay xấu...' },
    { jp:'健康', kana:'けんこう', vi:'Sức khỏe',          icon:'favorite',        hint:'Thói quen tốt cho sức khỏe, vì sao quan trọng...' },
    { jp:'文化の違い', kana:'ぶんかのちがい', vi:'Khác biệt văn hóa', icon:'public', hint:'So sánh văn hóa Nhật-Việt, điều thú vị khi tiếp xúc...' },
    { jp:'教育', kana:'きょういく', vi:'Giáo dục',         icon:'school',          hint:'Hệ thống giáo dục, điều tốt/chưa tốt, đề xuất cải thiện...' },
  ],
  N2: [
    { jp:'少子高齢化', kana:'しょうしこうれいか', vi:'Già hóa dân số',   icon:'elderly',         hint:'Nguyên nhân, tác động xã hội, chính sách đề xuất...' },
    { jp:'グローバル化', kana:'グローバルか', vi:'Toàn cầu hóa',         icon:'language',        hint:'Lợi ích và thách thức, ví dụ cụ thể...' },
    { jp:'働き方の変化', kana:'はたらきかたのへんか', vi:'Thay đổi lao động', icon:'work',          hint:'Xu hướng làm việc mới, remote work, tác động...' },
    { jp:'情報社会', kana:'じょうほうしゃかい', vi:'Xã hội thông tin',   icon:'wifi',            hint:'Tác động của mạng xã hội, fake news, quyền riêng tư...' },
  ],
  N1: [
    { jp:'倫理とAI', kana:'りんりとAI', vi:'Đạo đức và AI',           icon:'smart_toy',       hint:'AI có thể thay thế con người không, rủi ro đạo đức...' },
    { jp:'民主主義', kana:'みんしゅしゅぎ', vi:'Dân chủ',              icon:'how_to_vote',     hint:'Tầm quan trọng, thách thức trong thế giới hiện đại...' },
    { jp:'経済格差', kana:'けいざいかくさ', vi:'Bất bình đẳng kinh tế', icon:'bar_chart',       hint:'Nguyên nhân cấu trúc, giải pháp chính sách, ví dụ quốc gia...' },
    { jp:'持続可能な社会', kana:'じぞくかのうなしゃかい', vi:'Xã hội bền vững', icon:'park',   hint:'SDGs, vai trò cá nhân và chính phủ, thách thức thực tiễn...' },
  ],
};

const MIN_LEN = 30;
const LEVEL_MAP = Object.fromEntries(LEVELS.map(l => [l.id, l]));

// ─── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = ['Cấp độ', 'Chủ đề', 'Viết bài'];
  return (
    <div className="flex items-center mb-6">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center" style={{ flex: i < steps.length - 1 ? '1' : 'none' }}>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i + 1 < step ? 'bg-tsubaki-red text-white' : i + 1 === step ? 'bg-tsubaki-red/15 text-tsubaki-red border-2 border-tsubaki-red' : 'bg-surface-low text-on-muted border border-outline'}`}>
              {i + 1 < step ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i + 1 === step ? 'text-charcoal' : 'text-on-muted'}`}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i + 1 < step ? 'bg-tsubaki-red' : 'bg-outline'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#ae2826';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-on-muted">{label}</span>
        <span className="font-bold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-low overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Writing() {
  const [tab, setTab]     = useState('write');  // 'write' | 'history'
  const [step, setStep]   = useState(1);        // 1 | 2 | 3 | 4
  const [level, setLevel] = useState(null);
  const [topic, setTopic] = useState(null);
  const [text, setText]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]   = useState(null);
  const [submitErr, setSubmitErr] = useState('');
  // history
  const [history, setHistory]   = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [histLoaded, setHistLoaded]   = useState(false);
  const [detail, setDetail] = useState(null);

  const pickLevel = (lv) => { setLevel(lv); setTopic(null); setText(''); setResult(null); setStep(2); };
  const pickTopic = (t)  => { setTopic(t);  setText('');    setResult(null); setStep(3); };
  const goBack    = ()   => { setStep(s => Math.max(1, s - 1)); setResult(null); };

  const handleSubmit = async () => {
    if (text.trim().length < MIN_LEN || !topic || !level) return;
    setSubmitting(true); setSubmitErr('');
    try {
      const topicLabel = `${topic.jp}・${topic.kana} (${topic.vi})`;
      const r = await api.post('/writing/submit', { topic: topicLabel, level: level.id, text });
      setResult(r.data); setStep(4); setHistLoaded(false);
    } catch (e) { setSubmitErr(e.response?.data?.error || 'Gửi bài thất bại.'); }
    finally { setSubmitting(false); }
  };

  const reset = () => { setStep(1); setLevel(null); setTopic(null); setText(''); setResult(null); };

  const loadHistory = async () => {
    if (histLoaded) return;
    setLoadingHist(true);
    try { const r = await api.get('/writing/history?limit=20'); setHistory(r.data.data || []); setHistLoaded(true); }
    catch { /* ignore */ } finally { setLoadingHist(false); }
  };

  const scoreColor = (s, max = 100) => {
    const p = s / max;
    return p >= 0.8 ? '#16a34a' : p >= 0.5 ? '#d97706' : '#ae2826';
  };

  return (
    <StudentLayout title="Viết đoạn văn">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold">Luyện viết</h1>
            <p className="text-sm text-on-muted">Viết đoạn văn tiếng Nhật theo chủ đề, AI chấm điểm chi tiết.</p>
          </div>
        </div>

        {/* Tab chính */}
        <div className="flex rounded-xl border border-outline p-1 mb-6 bg-surface-low gap-1">
          {[['write','edit_note','Viết bài'],['history','history','Lịch sử']].map(([key,icon,label]) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'history') loadHistory(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab===key?'bg-white shadow text-charcoal':'text-on-muted hover:text-charcoal'}`}>
              <span className="material-symbols-outlined text-base">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* ═══ Tab Viết bài ═══ */}
        {tab === 'write' && (
          <div>
            {step < 4 && <Stepper step={step} />}

            {/* ── Bước 1: Chọn cấp độ ── */}
            {step === 1 && (
              <div className="space-y-3">
                {LEVELS.map(lv => (
                  <button key={lv.id} onClick={() => pickLevel(lv)}
                    className="w-full glass-card rounded-2xl p-4 text-left hover:shadow-md transition-all flex items-center gap-4 group">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center font-display font-bold text-xl shrink-0"
                      style={{ background: lv.bg, color: lv.color }}>{lv.id}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold">{lv.id}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: lv.bg, color: lv.color }}>{lv.label}</span>
                      </div>
                      <p className="text-sm text-on-muted">{lv.desc}</p>
                      <p className="text-xs text-on-muted/70 mt-0.5 font-mono truncate">{lv.example}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-muted group-hover:text-tsubaki-red transition-colors shrink-0">chevron_right</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Bước 2: Chọn chủ đề ── */}
            {step === 2 && level && (
              <div>
                <button onClick={goBack} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1 mb-4">
                  <span className="material-symbols-outlined text-base">arrow_back</span> Đổi cấp độ
                </button>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ background: level.bg, color: level.color }}>{level.id}</div>
                  <span className="font-semibold">{level.label}</span>
                  <span className="text-sm text-on-muted">— Chọn chủ đề để viết</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(TOPICS[level.id] || []).map(t => (
                    <button key={t.jp} onClick={() => pickTopic(t)}
                      className="glass-card rounded-2xl p-4 text-left hover:shadow-md transition-all group">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: level.bg }}>
                          <span className="material-symbols-outlined text-xl" style={{ color: level.color }}>{t.icon}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-base" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{t.jp}</p>
                          <p className="text-xs text-on-muted">{t.kana} · {t.vi}</p>
                        </div>
                      </div>
                      <p className="text-xs text-on-muted mt-2 line-clamp-2">{t.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Bước 3: Viết bài ── */}
            {step === 3 && level && topic && (
              <div className="space-y-4">
                <button onClick={goBack} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">arrow_back</span> Đổi chủ đề
                </button>

                {/* Context */}
                <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: level.bg }}>
                    <span className="material-symbols-outlined text-2xl" style={{ color: level.color }}>{topic.icon}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: level.bg, color: level.color }}>{level.id}</span>
                      <span className="font-bold text-lg" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{topic.jp}</span>
                    </div>
                    <p className="text-sm text-on-muted">{topic.vi}</p>
                  </div>
                </div>

                {/* Gợi ý */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5">lightbulb</span>
                  <p className="text-sm text-amber-800">{topic.hint}</p>
                </div>

                {/* Textarea */}
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex justify-between text-xs text-on-muted mb-2">
                    <span>Bài viết của bạn</span>
                    <span className={text.trim().length >= MIN_LEN ? 'text-emerald-600 font-semibold' : ''}>{text.trim().length} ký tự</span>
                  </div>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={9}
                    placeholder={`Viết về chủ đề "${topic.jp}" bằng tiếng Nhật...`}
                    className="w-full px-3 py-2.5 border border-outline rounded-xl text-base outline-none focus:border-tsubaki-red resize-none leading-relaxed"
                    style={{ fontFamily: "'Noto Sans JP', sans-serif" }} />
                  {text.trim().length < MIN_LEN && (
                    <p className="text-xs text-on-muted mt-1">Cần thêm {MIN_LEN - text.trim().length} ký tự nữa</p>
                  )}
                </div>

                {submitErr && <p className="text-sm text-tsubaki-red">{submitErr}</p>}
                <Button onClick={handleSubmit} loading={submitting} disabled={text.trim().length < MIN_LEN} className="w-full">
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  Nộp bài &amp; nhận điểm AI
                </Button>
              </div>
            )}

            {/* ── Bước 4: Kết quả ── */}
            {step === 4 && result && level && topic && (
              <div className="space-y-4">
                {/* Header kết quả */}
                <div className="glass-card rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: level.bg }}>
                      <span className="material-symbols-outlined text-xl" style={{ color: level.color }}>{topic.icon}</span>
                    </div>
                    <div>
                      <p className="font-bold" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{topic.jp}</p>
                      <p className="text-xs text-on-muted">{level.id} · {level.label}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-4xl font-display font-bold" style={{ color: scoreColor(result.score) }}>{result.score}</p>
                      <p className="text-xs text-on-muted">/100 điểm</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <ScoreBar label="Ngữ pháp (Grammar)"   value={result.grammar_score}    max={40} />
                    <ScoreBar label="Từ vựng (Vocabulary)"  value={result.vocabulary_score} max={30} />
                    <ScoreBar label="Mạch lạc (Coherence)"  value={result.coherence_score}  max={30} />
                  </div>

                  {result.overall_comment && (
                    <p className="text-sm text-charcoal mt-3 pt-3 border-t border-outline/40">{result.overall_comment}</p>
                  )}
                </div>

                {result.grammar_errors?.length > 0 && (
                  <div className="glass-card rounded-2xl p-4">
                    <p className="text-xs font-semibold text-on-muted mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-tsubaki-red">error</span> Lỗi ngữ pháp
                    </p>
                    <ul className="space-y-1.5">
                      {result.grammar_errors.map((e, i) => (
                        <li key={i} className="text-sm text-charcoal flex gap-2">
                          <span className="material-symbols-outlined text-base text-tsubaki-red shrink-0 mt-0.5">close</span>{e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.vocabulary_suggestions?.length > 0 && (
                  <div className="glass-card rounded-2xl p-4">
                    <p className="text-xs font-semibold text-on-muted mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-amber-500">lightbulb</span> Gợi ý từ vựng
                    </p>
                    <ul className="space-y-1.5">
                      {result.vocabulary_suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-charcoal flex gap-2">
                          <span className="material-symbols-outlined text-base text-amber-500 shrink-0 mt-0.5">arrow_right</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.corrected_text && (
                  <div className="glass-card rounded-2xl p-4">
                    <p className="text-xs font-semibold text-on-muted mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-emerald-600">spellcheck</span> Bản đã sửa
                    </p>
                    <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap bg-emerald-50 border border-emerald-200 rounded-xl p-3"
                      style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{result.corrected_text}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setStep(3); setResult(null); }} className="flex-1">
                    <span className="material-symbols-outlined text-lg">edit</span> Viết lại
                  </Button>
                  <Button onClick={reset} className="flex-1">
                    <span className="material-symbols-outlined text-lg">add</span> Bài mới
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab Lịch sử ═══ */}
        {tab === 'history' && (
          <div>
            {loadingHist && <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="glass-card rounded-xl h-20 animate-pulse"/>)}</div>}
            {!loadingHist && history.length === 0 && (
              <div className="glass-card rounded-2xl py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-on-muted/20 block mb-3">edit_note</span>
                <p className="font-semibold mb-1">Chưa có bài viết nào</p>
                <p className="text-on-muted text-sm">Chuyển sang tab "Viết bài" để bắt đầu.</p>
              </div>
            )}
            {!loadingHist && !detail && history.map(item => (
              <button key={item.id} onClick={async () => {
                const r = await api.get(`/writing/${item.id}`); setDetail(r.data);
              }} className="w-full glass-card rounded-xl p-4 text-left hover:shadow-md transition-shadow mb-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-sm line-clamp-1">{item.topic}</p>
                  {item.ai_score != null
                    ? <span className="font-bold text-sm shrink-0" style={{ color: scoreColor(item.ai_score) }}>{item.ai_score}/100</span>
                    : <span className="text-xs text-on-muted shrink-0">Chưa chấm</span>}
                </div>
                <p className="text-xs text-on-muted line-clamp-2">{item.submission_text}</p>
                <p className="text-xs text-on-muted mt-1">{new Date(item.submitted_at).toLocaleDateString('vi-VN')}</p>
              </button>
            ))}
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
                  <div className="glass-card rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <p className="text-3xl font-display font-bold" style={{ color: scoreColor(detail.ai_score) }}>{detail.ai_score}/100</p>
                      {detail.ai_feedback_vi && <p className="text-sm text-charcoal">{detail.ai_feedback_vi}</p>}
                    </div>
                    <ScoreBar label="Ngữ pháp"  value={detail.ai_grammar_score}    max={40} />
                    <ScoreBar label="Từ vựng"   value={detail.ai_vocabulary_score} max={30} />
                    <ScoreBar label="Mạch lạc"  value={detail.ai_coherence_score}  max={30} />
                    {detail.ai_corrected_text && (
                      <div>
                        <p className="text-xs font-semibold text-on-muted mb-1.5">Bản đã sửa</p>
                        <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap bg-emerald-50 border border-emerald-200 rounded-xl p-3"
                          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>{detail.ai_corrected_text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
