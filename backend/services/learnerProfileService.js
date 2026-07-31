'use strict';

const { supabaseAdmin } = require('../config/supabase');

const jlptDb     = supabaseAdmin.schema('jlpt_module');
const examDb     = supabaseAdmin.schema('exam_module');
const courseDb   = supabaseAdmin.schema('course_module');
const fcDb       = supabaseAdmin.schema('flashcard_module');
const practiceDb = supabaseAdmin.schema('practice_module');

// Dựng "hồ sơ năng lực" từ dữ liệu học tập THẬT để đưa vào prompt tạo lộ trình.
// Trước đây lộ trình chỉ dựa vào 4 trường khai báo tay nên AI phải đoán điểm yếu;
// giờ mỗi gợi ý đều tựa trên số liệu cụ thể và trích dẫn được.
//
// LƯU Ý: KHÔNG dùng ai_module.student_dashboards — bảng đó tồn tại nhưng không được
// cập nhật (mọi bản ghi đều 0/null), lấy vào sẽ ra hồ sơ rỗng.

// Ánh xạ section của đề JLPT → kỹ năng trong hệ thống
const SECTION_SKILL = {
  listening:        'listening',
  language_reading: 'reading',
  language:         'vocabulary',
  reading:          'reading',
  grammar:          'grammar',
  vocabulary:       'vocabulary',
};

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** Điểm từng phần của các lượt thi thử đã nộp (ưu tiên lượt gần nhất mỗi đề). */
function summarizeMock(attempts) {
  const done = (attempts || []).filter(a => a.status === 'submitted' && a.scores);
  if (!done.length) return { attempts: 0, sections: {}, lastAt: null };

  // Gom theo section, lấy lượt GẦN NHẤT có section đó (tránh trung bình che mất tiến bộ)
  const sections = {};
  for (const a of done) {
    for (const [key, s] of Object.entries(a.scores || {})) {
      if (!s || typeof s !== 'object') continue;
      if (sections[key]) continue;                    // done đã sắp xếp mới→cũ
      const correctRate = pct(s.correct, s.total);
      sections[key] = {
        skill:       SECTION_SKILL[key] || 'mixed',
        score:       s.score ?? null,
        max:         s.max ?? null,
        min:         s.min ?? null,
        correct:     s.correct ?? null,
        total:       s.total ?? null,
        correctRate,
        passed:      !!s.passed,
        scoreRate:   s.max > 0 ? Math.round((s.score / s.max) * 100) : null,
      };
    }
  }
  return {
    attempts: done.length,
    sections,
    lastAt: done[0]?.submitted_at || null,
    lastTotal: done[0]?.total_score ?? null,
    lastPassed: !!done[0]?.passed,
  };
}

function summarizeQuiz(rows) {
  const list = (rows || []).filter(r => (r.total_questions || 0) > 0);
  if (!list.length) return { attempts: 0, accuracy: null, failed: 0 };
  const rates = list.map(r => (r.score / r.total_questions) * 100);
  return {
    attempts: list.length,
    accuracy: Math.round(avg(rates)),
    failed: list.filter(r => r.passed === false).length,
  };
}

function summarizeWriting(rows) {
  const list = rows || [];
  if (!list.length) return { count: 0 };
  const pick = (k) => avg(list.map(r => r[k]).filter(v => v != null).map(Number));
  const grammar    = pick('ai_grammar_score');
  const vocabulary = pick('ai_vocabulary_score');
  const coherence  = pick('ai_coherence_score');
  const parts = { grammar, vocabulary, coherence };
  const valid = Object.entries(parts).filter(([, v]) => v != null);
  const weakest = valid.length ? valid.sort((a, b) => a[1] - b[1])[0][0] : null;
  return {
    count: list.length,
    overall: pick('ai_score') != null ? Math.round(pick('ai_score')) : null,
    grammar:    grammar    != null ? Math.round(grammar)    : null,
    vocabulary: vocabulary != null ? Math.round(vocabulary) : null,
    coherence:  coherence  != null ? Math.round(coherence)  : null,
    weakest,
  };
}

/**
 * Xếp hạng kỹ năng theo điểm chuẩn hoá 0-100 kèm bằng chứng số liệu.
 * Điểm càng thấp = càng yếu → ưu tiên đưa vào lộ trình trước.
 */
function rankSkills({ mock, quiz, writing, flashcards }) {
  const scores = {};   // skill → { score, evidence }

  for (const [key, s] of Object.entries(mock.sections || {})) {
    const skill = s.skill;
    const val = s.scoreRate ?? s.correctRate;
    if (val == null) continue;
    const label = key === 'language_reading' ? 'Từ vựng–Đọc' : key === 'listening' ? 'Nghe' : key;
    const ev = `${label} ${s.score}/${s.max} (đúng ${s.correct}/${s.total}) ở đề thi thử gần nhất`;
    if (!scores[skill] || val < scores[skill].score) scores[skill] = { score: val, evidence: ev };
  }

  if (writing.count) {
    const map = { grammar: 'grammar', vocabulary: 'vocabulary', coherence: 'writing' };
    for (const [k, skill] of Object.entries(map)) {
      if (writing[k] == null) continue;
      // Điểm từng mặt của bài viết thang ~30 → quy về 100
      const val = Math.min(100, Math.round((writing[k] / 30) * 100));
      const ev = `Bài viết: ${k === 'grammar' ? 'ngữ pháp' : k === 'vocabulary' ? 'từ vựng' : 'mạch lạc'} ${writing[k]}/30`;
      if (!scores[skill] || val < scores[skill].score) scores[skill] = { score: val, evidence: ev };
    }
  }

  if (quiz.accuracy != null) {
    const ev = `Độ chính xác quiz gần đây ${quiz.accuracy}% (${quiz.attempts} lượt)`;
    if (!scores.mixed || quiz.accuracy < scores.mixed.score) scores.mixed = { score: quiz.accuracy, evidence: ev };
  }

  if (flashcards.total > 0) {
    const rate = pct(flashcards.mastered, flashcards.total);
    const ev = `Flashcard: thuộc ${flashcards.mastered}/${flashcards.total} thẻ`;
    if (!scores.vocabulary || rate < scores.vocabulary.score) scores.vocabulary = { score: rate, evidence: ev };
  }

  const list = Object.entries(scores)
    .map(([skill, v]) => ({ skill, score: v.score, evidence: v.evidence }))
    .sort((a, b) => a.score - b.score);

  return {
    weaknesses: list.filter(x => x.score < 70).slice(0, 3),
    strengths:  list.filter(x => x.score >= 70).slice(-2).reverse(),
    all: list,
  };
}

/**
 * @param {string} userId
 * @param {string[]} span  các cấp độ liên quan (vd ['N5','N4'])
 */
async function buildLearnerProfile(userId, span = []) {
  const [mockRes, quizRes, lessonRes, enrollRes, fcRes, writeRes, readRes] = await Promise.all([
    jlptDb.from('mock_attempts')
      .select('id, exam_id, status, scores, total_score, passed, submitted_at')
      .eq('user_id', userId).eq('status', 'submitted')
      .order('submitted_at', { ascending: false }).limit(10),
    examDb.from('quiz_attempts')
      .select('score, total_questions, passed, completed_at')
      .eq('user_id', userId).order('completed_at', { ascending: false }).limit(10),
    courseDb.from('lesson_progress')
      .select('lesson_id, status').eq('student_id', userId).eq('status', 'completed'),
    courseDb.from('course_enrollments')
      .select('course_id, progress_pct').eq('student_id', userId),
    fcDb.from('flashcard_progress')
      .select('status').eq('student_id', userId),
    practiceDb.from('writing_submissions')
      .select('ai_score, ai_grammar_score, ai_vocabulary_score, ai_coherence_score')
      .eq('student_id', userId).order('submitted_at', { ascending: false }).limit(5),
    practiceDb.from('article_reads')
      .select('article_id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const mock   = summarizeMock(mockRes.data);
  const quiz   = summarizeQuiz(quizRes.data);
  const writing = summarizeWriting(writeRes.data);

  const fcRows = fcRes.data || [];
  const flashcards = {
    total: fcRows.length,
    mastered: fcRows.filter(r => r.status === 'mastered').length,
  };

  const enrollments = enrollRes.data || [];
  const study = {
    lessonsCompleted: (lessonRes.data || []).length,
    coursesEnrolled:  enrollments.length,
    coursesCompleted: enrollments.filter(e => (e.progress_pct || 0) >= 100).length,
    inProgress:       enrollments.filter(e => (e.progress_pct || 0) > 0 && (e.progress_pct || 0) < 100)
                        .map(e => ({ course_id: e.course_id, progress_pct: e.progress_pct })),
    flashcardsMastered: flashcards.mastered,
    flashcardsTotal:    flashcards.total,
    articlesRead:       readRes.count || 0,
  };

  // Học liệu nên loại khỏi gợi ý: khoá đã hoàn thành 100%, đề thi thử đã ĐẠT
  const completedResourceIds = new Set([
    ...enrollments.filter(e => (e.progress_pct || 0) >= 100).map(e => e.course_id),
    ...(mockRes.data || []).filter(a => a.passed).map(a => a.exam_id),
  ]);
  // Khoá đang học dở → không loại, nhưng đánh dấu để AI biết mà nói "học tiếp"
  const inProgressPct = new Map(study.inProgress.map(c => [c.course_id, c.progress_pct]));

  const { weaknesses, strengths, all } = rankSkills({ mock, quiz, writing, flashcards });

  const hasData = mock.attempts > 0 || quiz.attempts > 0 || writing.count > 0
    || study.lessonsCompleted > 0 || flashcards.total > 0;

  return {
    hasData, span, mock, quiz, writing, study,
    weaknesses, strengths, skillRanking: all,
    completedResourceIds, inProgressPct,
  };
}

/** Rút gọn để lưu vào learning_paths.learner_snapshot + trả cho frontend hiển thị. */
function toSnapshot(profile, strategy) {
  return {
    strategy,
    hasData: profile.hasData,
    generated_at: new Date().toISOString(),
    mock: {
      attempts: profile.mock.attempts,
      lastAt: profile.mock.lastAt,
      lastTotal: profile.mock.lastTotal,
      lastPassed: profile.mock.lastPassed,
      sections: profile.mock.sections,
    },
    quiz: profile.quiz,
    writing: profile.writing,
    study: {
      lessonsCompleted:   profile.study.lessonsCompleted,
      coursesEnrolled:    profile.study.coursesEnrolled,
      coursesCompleted:   profile.study.coursesCompleted,
      flashcardsMastered: profile.study.flashcardsMastered,
      flashcardsTotal:    profile.study.flashcardsTotal,
      articlesRead:       profile.study.articlesRead,
    },
    weaknesses: profile.weaknesses,
    strengths:  profile.strengths,
  };
}

/** Chuyển hồ sơ thành đoạn text tiếng Việt để nhét vào prompt. */
function profileToPrompt(profile) {
  if (!profile.hasData) {
    return 'HỒ SƠ NĂNG LỰC: Học viên MỚI, chưa có dữ liệu học tập (chưa thi thử, chưa làm quiz).\n'
      + '→ Hãy thiết kế lộ trình nhập môn an toàn, bắt đầu từ nền tảng, và đưa 1 mốc thi thử sớm để đo năng lực.\n'
      + '→ TUYỆT ĐỐI KHÔNG bịa ra điểm số hay điểm yếu cụ thể của học viên.';
  }

  const L = ['HỒ SƠ NĂNG LỰC (số liệu THẬT — hãy trích dẫn khi giải thích):'];

  if (profile.mock.attempts) {
    L.push(`- Thi thử: ${profile.mock.attempts} lượt đã nộp. Lần gần nhất tổng ${profile.mock.lastTotal ?? '?'} điểm, ${profile.mock.lastPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}.`);
    for (const [key, s] of Object.entries(profile.mock.sections)) {
      const label = key === 'language_reading' ? 'Từ vựng–Ngữ pháp–Đọc' : key === 'listening' ? 'Nghe' : key;
      L.push(`  • ${label}: ${s.score}/${s.max} điểm (đúng ${s.correct}/${s.total} câu = ${s.correctRate}%) — ${s.passed ? 'qua ngưỡng' : 'DƯỚI ngưỡng ' + s.min}`);
    }
  } else {
    L.push('- Thi thử: chưa làm lượt nào.');
  }

  if (profile.quiz.attempts) L.push(`- Quiz: ${profile.quiz.attempts} lượt gần đây, độ chính xác trung bình ${profile.quiz.accuracy}%, trượt ${profile.quiz.failed} lượt.`);
  if (profile.writing.count) L.push(`- Bài viết (${profile.writing.count} bài): ngữ pháp ${profile.writing.grammar}/30, từ vựng ${profile.writing.vocabulary}/30, mạch lạc ${profile.writing.coherence}/30.`);

  const s = profile.study;
  L.push(`- Tiến độ: hoàn thành ${s.lessonsCompleted} bài học, ghi danh ${s.coursesEnrolled} khoá (xong ${s.coursesCompleted}), thuộc ${s.flashcardsMastered}/${s.flashcardsTotal} thẻ, đọc ${s.articlesRead} bài.`);

  if (profile.weaknesses.length) {
    L.push('- ĐIỂM YẾU cần ưu tiên:');
    profile.weaknesses.forEach((w, i) => L.push(`  ${i + 1}. ${w.skill} (${w.score}/100) — ${w.evidence}`));
  }
  if (profile.strengths.length) {
    L.push('- Điểm mạnh: ' + profile.strengths.map(x => `${x.skill} (${x.score}/100)`).join(', '));
  }

  return L.join('\n');
}

module.exports = { buildLearnerProfile, toSnapshot, profileToPrompt };
