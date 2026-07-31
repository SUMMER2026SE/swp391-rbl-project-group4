// Khối "Phân tích năng lực" — cho học viên thấy lộ trình được xây trên SỐ LIỆU THẬT
// (điểm từng phần thi thử, quiz, bài viết, tiến độ) chứ không phải gợi ý chung chung.
// Dữ liệu lấy từ learning_paths.learner_snapshot (backend/services/learnerProfileService.js).

const SKILL_LABEL = {
  vocabulary: 'Từ vựng',
  kanji:      'Kanji',
  grammar:    'Ngữ pháp',
  reading:    'Đọc hiểu',
  listening:  'Nghe',
  writing:    'Viết',
  mixed:      'Tổng hợp',
};

const STRATEGY_LABEL = {
  weakness_first:   { label: 'Tập trung khắc phục điểm yếu', icon: 'target' },
  foundation_first: { label: 'Xây nền tảng trước',           icon: 'foundation' },
  balanced:         { label: 'Cân bằng các kỹ năng',         icon: 'balance' },
  exam_oriented:    { label: 'Bám sát đề thi',               icon: 'fact_check' },
};

const SECTION_LABEL = {
  listening:        'Nghe',
  language_reading: 'Từ vựng – Ngữ pháp – Đọc',
  language:         'Từ vựng – Ngữ pháp',
  reading:          'Đọc hiểu',
};

function Bar({ value, danger }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="h-2 rounded-full bg-surface-low overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${danger ? 'bg-tsubaki-red' : 'bg-sumire-purple'}`}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-outline/30 p-3">
      <p className="text-xs text-on-muted">{label}</p>
      <p className="font-display text-lg font-bold mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-on-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export default function LearnerAnalysis({ snapshot }) {
  if (!snapshot) return null;

  const strategy = STRATEGY_LABEL[snapshot.strategy] || null;
  const { mock = {}, quiz = {}, writing = {}, study = {}, weaknesses = [], strengths = [] } = snapshot;

  // Học viên mới: nói thẳng là chưa đủ dữ liệu thay vì bịa ra phân tích
  if (!snapshot.hasData) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600">info</span>
          <div>
            <p className="font-semibold text-charcoal">Lộ trình nhập môn</p>
            <p className="text-sm text-on-muted mt-1">
              Bạn chưa có dữ liệu học tập nên lộ trình này được xây theo hướng nhập môn an toàn.
              Hãy <strong>làm một đề thi thử</strong> hoặc vài bài quiz — lần tạo lại sau sẽ bám sát
              đúng điểm mạnh/điểm yếu thật của bạn.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sections = Object.entries(mock.sections || {});

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-sumire-purple">insights</span>
          Phân tích năng lực của bạn
        </h2>
        {strategy && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sumire-purple/10 text-sumire-purple text-xs font-bold">
            <span className="material-symbols-outlined text-[15px]">{strategy.icon}</span>
            {strategy.label}
          </span>
        )}
      </div>

      {/* Điểm từng phần của đề thi thử gần nhất — bằng chứng rõ nhất về điểm yếu */}
      {sections.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-on-muted uppercase tracking-wider mb-2">
            Đề thi thử gần nhất {mock.lastPassed ? '· ĐẠT' : '· chưa đạt'}
          </p>
          <div className="space-y-3">
            {sections.map(([key, s]) => {
              const danger = !s.passed;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{SECTION_LABEL[key] || key}</span>
                    <span className={danger ? 'text-tsubaki-red font-semibold' : 'text-on-muted'}>
                      {s.score}/{s.max} điểm · đúng {s.correct}/{s.total}
                      {danger && s.min != null && ` (ngưỡng ${s.min})`}
                    </span>
                  </div>
                  <Bar value={s.scoreRate ?? s.correctRate} danger={danger} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Số liệu học tập khác */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {quiz.attempts > 0 && (
          <Stat label="Độ chính xác quiz" value={`${quiz.accuracy}%`} hint={`${quiz.attempts} lượt gần đây`} />
        )}
        {writing.count > 0 && (
          <Stat
            label="Bài viết"
            value={writing.overall != null ? `${writing.overall}/100` : '—'}
            hint={`NP ${writing.grammar} · TV ${writing.vocabulary} · ML ${writing.coherence}`}
          />
        )}
        {study.flashcardsTotal > 0 && (
          <Stat label="Flashcard đã thuộc" value={`${study.flashcardsMastered}/${study.flashcardsTotal}`} />
        )}
        <Stat
          label="Bài học hoàn thành"
          value={study.lessonsCompleted ?? 0}
          hint={study.coursesEnrolled ? `${study.coursesEnrolled} khóa đã ghi danh` : null}
        />
      </div>

      {/* Điểm yếu / điểm mạnh kèm bằng chứng */}
      <div className="grid sm:grid-cols-2 gap-3">
        {weaknesses.length > 0 && (
          <div className="rounded-xl bg-tsubaki-red/5 border border-tsubaki-red/20 p-3">
            <p className="text-xs font-bold text-tsubaki-red uppercase tracking-wider mb-2">Cần cải thiện</p>
            <ul className="space-y-1.5">
              {weaknesses.map(w => (
                <li key={w.skill} className="text-sm">
                  <span className="font-semibold">{SKILL_LABEL[w.skill] || w.skill}</span>
                  <span className="text-on-muted"> — {w.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {strengths.length > 0 && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Điểm mạnh</p>
            <ul className="space-y-1.5">
              {strengths.map(s => (
                <li key={s.skill} className="text-sm">
                  <span className="font-semibold">{SKILL_LABEL[s.skill] || s.skill}</span>
                  <span className="text-on-muted"> — {s.evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
