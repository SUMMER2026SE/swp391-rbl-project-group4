import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import FuriganaText from '../../components/ui/FuriganaText';
import FuriganaToggle from '../../components/ui/FuriganaToggle';
import KanjiWritingPracticeModal from '../../components/kanji/KanjiWritingPracticeModal';
import KanjiPdfPanel from '../../components/kanji/KanjiPdfPanel';
import VocabWordViewer from '../../components/shared/VocabWordViewer';
import GrammarItemCard from '../../components/shared/GrammarItemCard';
import api from '../../lib/api';
import { renderMarkdown } from '../../lib/renderPreview';

function toEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return yt ? `https://www.youtube.com/embed/${yt[1]}` : null;
}

// Slug hóa tên bài học để đặt tên file PDF (bỏ dấu tiếng Việt, ký tự đặc biệt).
function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'bai-hoc';
}

const QUIZ_TYPE_LABEL = {
  single_choice:   'Trắc nghiệm',
  multiple_choice: 'Nhiều đáp án',
  matching:        'Ghép cặp',
  fill_blank:      'Điền vào chỗ trống',
  short_answer:    'Trả lời ngắn',
};

// Layout: mặc định StudentLayout; trang preview admin/teacher truyền layout riêng.
// previewBase ('/admin' | '/teacher'): các link khóa học/mục/quiz trỏ sang route preview
// cùng phía để giữ nguyên khung admin/teacher xuyên suốt (pattern như CourseDetail).
export default function LessonView({ Layout = StudentLayout, previewBase = '' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const lessonPath = (lid) => previewBase ? `${previewBase}/lessons/preview/${lid}` : `/lessons/${lid}`;
  const coursePath = (cid) => previewBase ? `${previewBase}/courses/preview/${cid}` : `/courses/${cid}`;
  const quizPath   = (qid) => previewBase ? `${previewBase}/quizzes/preview/${qid}` : `/quizzes/${qid}`;
  // Bài đọc của Mục mở bằng ReadingReader; preview admin/teacher giữ nguyên layout riêng
  const readingPath = (lid) => previewBase ? `${previewBase}/lessons/${lid}/reading-view` : `/lessons/${lid}/reading`;
  const [lesson, setLesson]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [finishError, setFinishError] = useState(''); // lỗi khi bấm Hoàn thành (vd: chưa đạt ngưỡng quiz)
  const [paywall, setPaywall] = useState(null); // body 403 ENROLLMENT_REQUIRED { course_id }
  const [furigana, setFurigana] = useState(false);
  const [working, setWorking] = useState(false);
  const [writingOpen, setWritingOpen] = useState(false); // modal luyện viết kanji
  const [pdfOpen, setPdfOpen] = useState(false);         // panel tạo PDF luyện viết

  // Chọn vocab/kanji để thêm vào flashcard cá nhân. Key: `v-<id>` | `k-<id>`.
  const [selecting, setSelecting] = useState(false); // bật/tắt chế độ chọn (hiện checkbox)
  const [selected, setSelected] = useState({});
  const [notice, setNotice] = useState(null); // { type, msg } — Alert cấp trang
  const [fcModalOpen, setFcModalOpen] = useState(false);
  const [fcSets, setFcSets] = useState([]);
  const [fcSetsLoading, setFcSetsLoading] = useState(false);
  const [fcMode, setFcMode] = useState('existing'); // 'existing' | 'new'
  const [fcTargetId, setFcTargetId] = useState('');
  const [fcNewTitle, setFcNewTitle] = useState('');
  const [fcSaving, setFcSaving] = useState(false);
  const [fcError, setFcError] = useState('');

  useEffect(() => {
    setLoading(true);
    setSelecting(false);
    setSelected({});
    setNotice(null);
    setPaywall(null);
    setWritingOpen(false);
    setPdfOpen(false);
    api.get(`/lessons/${id}`)
      .then(r => setLesson(r.data))
      .catch(e => {
        if (e.status === 403 && e.data?.code === 'ENROLLMENT_REQUIRED') setPaywall(e.data);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <Layout title="...">
      <div className="flex justify-center py-16">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    </Layout>
  );

  if (paywall) return (
    <Layout title="Khóa học có phí">
      <div className="max-w-md mx-auto text-center py-16">
        <span className="material-symbols-outlined text-5xl text-amber-400 mb-4 block">lock</span>
        <h2 className="font-display text-xl font-bold text-on-surface mb-2">Nội dung dành cho học viên đã mua khóa học</h2>
        <p className="text-sm text-on-muted mb-6">Bạn cần mua khóa học này để xem nội dung bài học.</p>
        <Link to={`/courses/${paywall.course_id}`}>
          <Button>
            <span className="material-symbols-outlined text-lg">shopping_cart</span>
            Mua khóa học
          </Button>
        </Link>
      </div>
    </Layout>
  );

  if (error || !lesson) return (
    <Layout title="Lỗi">
      <Alert type="error">{error || 'Không tìm thấy mục học.'}</Alert>
    </Layout>
  );

  const nav = lesson.nav || {};
  const embed = toEmbed(lesson.content_url);
  // Nút furigana chỉ có nghĩa với mục nhiều văn bản tiếng Nhật dài cần đọc.
  const showFuriganaToggle = ['reading', 'grammar'].includes(lesson.lesson_type);

  // Bộ luyện viết chỉ gồm đúng các kanji của bài học (map `character` → `char` cho worksheet).
  const worksheetList = (lesson.kanji || []).map(k => ({
    char: k.character,
    reading_on: k.reading_on,
    reading_kun: k.reading_kun,
    meaning_vi: k.meaning_vi,
    han_viet: k.han_viet,
  }));

  // Đánh dấu hoàn thành rồi đi tiếp (hoặc về khóa học nếu là mục cuối).
  const finishAndContinue = async () => {
    setWorking(true);
    setFinishError('');
    try {
      await api.post(`/lessons/${id}/complete`);
      if (nav.nextId) navigate(lessonPath(nav.nextId));
      else navigate(coursePath(lesson.course_id));
    } catch (e) {
      // Vd: quiz có ngưỡng đạt mà học sinh chưa đạt → hiển thị ngay tại chỗ, giữ nguyên trang để làm lại bài.
      setFinishError(e.message);
    } finally {
      setWorking(false);
    }
  };

  const nextLabel = !nav.nextId
    ? 'Hoàn thành khóa học'
    : nav.nextIsNewUnit ? 'Hoàn thành • Bài học tiếp theo' : 'Hoàn thành • Mục tiếp theo';

  // ── Chọn vocab/kanji → thêm vào flashcard ─────────────────────────
  const vocabList = lesson.vocabulary || [];
  const kanjiList = lesson.kanji || [];
  const selectedCount = Object.keys(selected).length;

  const toggleSelect = (key) => setSelected(s => {
    const next = { ...s };
    if (next[key]) delete next[key]; else next[key] = true;
    return next;
  });
  const allVocabSelected = vocabList.length > 0 && vocabList.every(v => selected[`v-${v.id}`]);
  const allKanjiSelected = kanjiList.length > 0 && kanjiList.every(k => selected[`k-${k.id}`]);
  const toggleAllVocab = () => setSelected(s => {
    const next = { ...s };
    vocabList.forEach(v => { if (allVocabSelected) delete next[`v-${v.id}`]; else next[`v-${v.id}`] = true; });
    return next;
  });
  const toggleAllKanji = () => setSelected(s => {
    const next = { ...s };
    kanjiList.forEach(k => { if (allKanjiSelected) delete next[`k-${k.id}`]; else next[`k-${k.id}`] = true; });
    return next;
  });

  // Map các mục đã chọn sang {term, definition}; bỏ term trùng ngay trong lựa chọn.
  const buildSelectedCards = () => {
    const cards = [];
    const seen = new Set();
    vocabList.forEach(v => {
      if (!selected[`v-${v.id}`]) return;
      const term = v.kanji || v.reading;
      const definition = v.kanji ? `${v.reading} - ${v.meaning_vi}` : (v.meaning_vi || '');
      if (term && definition && !seen.has(term)) { seen.add(term); cards.push({ term, definition }); }
    });
    kanjiList.forEach(k => {
      if (!selected[`k-${k.id}`]) return;
      if (!k.character || seen.has(k.character)) return;
      seen.add(k.character);
      cards.push({
        term: k.character,
        definition: `On: ${k.reading_on?.join(', ') || '-'} / Kun: ${k.reading_kun?.join(', ') || '-'} - ${k.meaning_vi || ''}`,
      });
    });
    return cards;
  };

  const openFcModal = async () => {
    setFcError('');
    setFcNewTitle(`Từ bài: ${lesson.title}`);
    setFcModalOpen(true);
    setFcSetsLoading(true);
    try {
      const r = await api.get('/flashcards/sets');
      const sets = r.data.data || [];
      setFcSets(sets);
      setFcMode(sets.length ? 'existing' : 'new');
      setFcTargetId(sets.length ? String(sets[0].id) : '');
    } catch {
      setFcSets([]);
      setFcMode('new');
      setFcTargetId('');
    } finally {
      setFcSetsLoading(false);
    }
  };

  const addToFlashcards = async () => {
    const newCards = buildSelectedCards();
    if (!newCards.length) return;
    setFcError('');
    setFcSaving(true);
    try {
      if (fcMode === 'existing') {
        // PUT ghi đè toàn bộ cards → lấy cards hiện tại, nối thêm rồi gửi lại nguyên mảng.
        const r = await api.get(`/flashcards/sets/${fcTargetId}`);
        const set = r.data.data || r.data;
        const existing = (set.cards || []).map(c => ({ term: c.term, definition: c.definition }));
        const existingTerms = new Set(existing.map(c => c.term));
        const toAdd = newCards.filter(c => !existingTerms.has(c.term));
        if (!toAdd.length) {
          setNotice({ type: 'info', msg: `Các mục đã chọn đều có sẵn trong bộ "${set.title}".` });
        } else {
          await api.put(`/flashcards/sets/${fcTargetId}`, {
            title: set.title,
            description: set.description || '',
            cards: [...existing, ...toAdd],
          });
          setNotice({ type: 'success', msg: `Đã thêm ${toAdd.length} thẻ vào bộ "${set.title}".` });
        }
      } else {
        const title = fcNewTitle.trim();
        await api.post('/flashcards/sets', { title, description: '', cards: newCards });
        setNotice({ type: 'success', msg: `Đã thêm ${newCards.length} thẻ vào bộ mới "${title}".` });
      }
      setFcModalOpen(false);
      setSelecting(false);
      setSelected({});
    } catch (e) {
      setFcError(e.response?.data?.error || e.message);
    } finally {
      setFcSaving(false);
    }
  };

  return (
    <Layout title={lesson.title}>
      <div className="max-w-3xl mx-auto">
        <Link to={coursePath(lesson.course_id)} className="inline-flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-6 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại khoá học
        </Link>

        {notice && (
          <div className="mb-6">
            <Alert type={notice.type} onClose={() => setNotice(null)}>{notice.msg}</Alert>
          </div>
        )}

        {/* ── Title card ──────────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-8 mb-6">
          <div className="flex justify-between items-start gap-4 mb-2">
            <h1 className="font-display text-3xl font-bold">{lesson.title}</h1>
            <div className="flex items-center gap-2 shrink-0">
              {lesson.completed && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium">
                  <span className="material-symbols-outlined text-base">check_circle</span> Đã hoàn thành
                </span>
              )}
              {showFuriganaToggle && (
                <FuriganaToggle active={furigana} onToggle={() => setFurigana(v => !v)} />
              )}
            </div>
          </div>
          {lesson.title_ja && (
            <FuriganaText text={lesson.title_ja} enabled={furigana} textClassName="text-on-muted" block />
          )}
        </div>

        {/* ── Mô tả (teacher/admin ghi cho học sinh, tùy chọn) ─────────── */}
        {lesson.description && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-tsubaki-red">info</span> Mô tả
              </h2>
            </div>
            <div className="p-6 text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
              {lesson.description}
            </div>
          </div>
        )}

        {/* ── Video ───────────────────────────────────────────────────── */}
        {lesson.content_url && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="aspect-video bg-black">
              {embed
                ? <iframe src={embed} title={lesson.title} className="w-full h-full" allowFullScreen />
                : <video src={lesson.content_url} controls className="w-full h-full" />}
            </div>
            {lesson.transcript && (
              <div className="p-5 text-sm text-on-surface whitespace-pre-wrap leading-relaxed border-t border-outline/20">
                {lesson.transcript}
              </div>
            )}
          </div>
        )}

        {/* ── Grammar points — thẻ dùng chung với Study List, bấm mở trang chi tiết ── */}
        {lesson.grammar_points?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-600">spellcheck</span>
              Ngữ pháp trong bài ({lesson.grammar_points.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lesson.grammar_points.map((g, i) => (
                <GrammarItemCard key={g.id} item={g} index={i} to={`/lessons/${id}/grammar/${g.id}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── Grammar notes (ghi chú tổng quan markdown, tùy chọn) ────── */}
        {lesson.grammar_notes && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">spellcheck</span> Ngữ pháp
              </h2>
            </div>
            <div className="p-6 prose prose-sm max-w-none text-on-surface leading-relaxed"
              dangerouslySetInnerHTML={{ __html: `<p class="mb-3">${renderMarkdown(lesson.grammar_notes)}</p>` }} />
          </div>
        )}

        {/* ── Reading — mở trải nghiệm đọc đầy đủ (ReadingReader) qua route riêng ── */}
        {lesson.lesson_type === 'reading' && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">article</span> Bài đọc
              </h2>
            </div>
            <div className="p-6">
              {lesson.reading_article_id ? (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-on-muted">
                    Đọc bài với furigana, bản dịch từng câu, tra từ nhanh, quiz đọc hiểu và từ vựng/ngữ pháp trong bài.
                  </p>
                  <Link
                    to={readingPath(id)}
                    className="inline-flex items-center gap-2 bg-tsubaki-red text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary transition-colors shadow-md shadow-tsubaki-red/20 shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">auto_stories</span>
                    Đọc bài
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-on-muted italic">Mục này chưa có bài đọc.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Vocabulary — flashcard viewer dùng chung với bài đăng ───── */}
        {lesson.vocabulary?.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-tsubaki-red">translate</span>
                Từ vựng trong bài ({lesson.vocabulary.length})
              </h2>
              {selecting ? (
                <label className="flex items-center gap-2 text-xs text-on-muted cursor-pointer select-none">
                  <input type="checkbox" checked={allVocabSelected} onChange={toggleAllVocab} className="w-4 h-4 accent-tsubaki-red" />
                  Chọn tất cả
                </label>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setSelecting(true)}>
                  <span className="material-symbols-outlined text-lg">library_add</span> Thêm vào thẻ ghi nhớ
                </Button>
              )}
            </div>
            <VocabWordViewer
              items={vocabList}
              showLevel={false}
              showDetails
              furiganaEnabled={false}
              renderItemExtra={selecting ? (v) => (
                <input
                  type="checkbox"
                  checked={!!selected[`v-${v.id}`]}
                  onChange={() => toggleSelect(`v-${v.id}`)}
                  className="w-4 h-4 accent-tsubaki-red"
                />
              ) : undefined}
            />
          </div>
        )}

        {/* ── Kanji ──────────────────────────────────────────────────── */}
        {lesson.kanji?.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden mb-6">
            <div className="p-5 border-b border-outline/30 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-sumire-purple">draw</span>
                Kanji trong bài ({lesson.kanji.length})
              </h2>
              <div className="flex items-center gap-4">
                {selecting ? (
                  <label className="flex items-center gap-2 text-xs text-on-muted cursor-pointer select-none">
                    <input type="checkbox" checked={allKanjiSelected} onChange={toggleAllKanji} className="w-4 h-4 accent-tsubaki-red" />
                    Chọn tất cả
                  </label>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setSelecting(true)}>
                    <span className="material-symbols-outlined text-lg">library_add</span> Thêm vào thẻ ghi nhớ
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setWritingOpen(true)}>
                  <span className="material-symbols-outlined text-lg">draw</span> Luyện viết
                </Button>
                <Button size="sm" onClick={() => setPdfOpen(true)}>
                  <span className="material-symbols-outlined text-lg">article</span> Tạo PDF luyện viết
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
              {lesson.kanji.map(k => (
                <div key={k.id} className="bg-white rounded-xl border border-outline-variant/50 p-4 flex gap-4 items-start hover:border-sumire-purple/40 transition-colors">
                  {selecting && (
                    <input
                      type="checkbox"
                      checked={!!selected[`k-${k.id}`]}
                      onChange={() => toggleSelect(`k-${k.id}`)}
                      className="w-4 h-4 accent-tsubaki-red shrink-0 mt-1"
                    />
                  )}
                  <div className="flex flex-col items-center shrink-0">
                    <span className="text-5xl font-bold text-on-surface leading-none" style={{ fontFamily: 'serif' }}>{k.character}</span>
                    {k.stroke_count && <span className="text-[10px] text-on-muted mt-1">{k.stroke_count} nét</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {k.level && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-bold mb-1.5">{k.level}</span>}
                    <p className="font-bold text-sm text-tsubaki-red mb-1.5">{k.meaning_vi}</p>
                    {k.han_viet && <p className="text-xs text-on-muted mb-2 italic">{k.han_viet}</p>}
                    <div className="flex flex-wrap gap-1">
                      {k.reading_on?.map(r => <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-tsubaki-red/10 text-tsubaki-red font-mono">{r}</span>)}
                      {k.reading_kun?.map(r => <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-muted font-mono">{r}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Panel tạo PDF luyện viết (cài đặt + xem trước + tải) ────── */}
        {pdfOpen && lesson.kanji?.length > 0 && (
          <KanjiPdfPanel
            className="mb-6"
            list={worksheetList}
            filename={`bo-luyen-viet-${slugify(lesson.title)}.pdf`}
            onClose={() => setPdfOpen(false)}
          />
        )}

        {/* ── Quiz ───────────────────────────────────────────────────── */}
        {lesson.quiz && (
          <div className="glass-card rounded-2xl p-6 mb-6 border border-sumire-purple/20">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-sumire-purple">quiz</span> Bài kiểm tra
            </h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-on-surface">{lesson.quiz.title}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {lesson.quiz.type && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-sumire-purple/10 text-sumire-purple font-medium">
                      {QUIZ_TYPE_LABEL[lesson.quiz.type] || lesson.quiz.type}
                    </span>
                  )}
                  {lesson.quiz.time_limit && (
                    <span className="flex items-center gap-1 text-xs text-on-muted">
                      <span className="material-symbols-outlined text-sm">schedule</span>{lesson.quiz.time_limit} phút
                    </span>
                  )}
                </div>
              </div>
              <Link to={quizPath(lesson.quiz.id)} className="inline-flex items-center gap-2 bg-sumire-purple text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-md shadow-sumire-purple/20 shrink-0">
                Làm bài <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}

        {/* Chưa đạt ngưỡng quiz → chặn hoàn thành, hiển thị ngay tại đây */}
        {finishError && (
          <div className="mt-6">
            <Alert type="error" onClose={() => setFinishError('')}>
              {finishError}
              {lesson.quiz && (
                <Link to={quizPath(lesson.quiz.id)} className="ml-1 font-semibold underline">Làm lại bài kiểm tra</Link>
              )}
            </Alert>
          </div>
        )}

        {/* ── Footer nav ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-outline-variant/30">
          {nav.prevId ? (
            <Link to={lessonPath(nav.prevId)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-outline text-sm font-medium text-on-surface hover:bg-surface-low transition-all">
              <span className="material-symbols-outlined text-base">arrow_back</span> Mục trước
            </Link>
          ) : <span />}

          <button
            onClick={finishAndContinue}
            disabled={working}
            className="inline-flex items-center gap-2 bg-tsubaki-red text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary transition-colors shadow-md shadow-tsubaki-red/20 disabled:opacity-60"
          >
            {working ? 'Đang lưu...' : nextLabel}
            <span className="material-symbols-outlined text-lg">{nav.nextId ? 'arrow_forward' : 'task_alt'}</span>
          </button>
        </div>
      </div>

      {/* ── Thanh hành động: thêm mục đã chọn vào flashcard ─────────── */}
      {selecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white border border-outline/40 rounded-2xl shadow-xl px-5 py-3">
          <p className="text-sm text-on-surface">
            Đã chọn <strong className="text-tsubaki-red">{selectedCount}</strong> mục
          </p>
          <Button size="sm" disabled={!selectedCount} onClick={openFcModal}>
            <span className="material-symbols-outlined text-lg">library_add</span> Thêm vào flashcard
          </Button>
          <button
            type="button"
            onClick={() => { setSelecting(false); setSelected({}); }}
            title="Hủy chọn"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-muted hover:text-charcoal hover:bg-surface-low transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* ── Modal luyện viết Kanji ──────────────────────────────────── */}
      {writingOpen && (
        <KanjiWritingPracticeModal items={lesson.kanji || []} onClose={() => setWritingOpen(false)} />
      )}

      {/* ── Modal chọn bộ flashcard ─────────────────────────────────── */}
      <Modal
        open={fcModalOpen}
        onClose={() => !fcSaving && setFcModalOpen(false)}
        title="Thêm vào flashcard"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFcModalOpen(false)} disabled={fcSaving}>Hủy</Button>
            <Button
              variant="primary"
              loading={fcSaving}
              disabled={fcMode === 'existing' ? !fcTargetId : !fcNewTitle.trim()}
              onClick={addToFlashcards}
            >
              Thêm {selectedCount} thẻ
            </Button>
          </>
        }
      >
        {fcError && (
          <div className="mb-4">
            <Alert type="error" onClose={() => setFcError('')}>{fcError}</Alert>
          </div>
        )}
        <p className="text-sm text-on-muted mb-4">
          Thêm <strong className="text-on-surface">{selectedCount}</strong> mục đã chọn vào một bộ thẻ ghi nhớ của bạn.
        </p>

        <div className="space-y-4">
          <div>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${!fcSets.length && !fcSetsLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="fcMode"
                checked={fcMode === 'existing'}
                onChange={() => setFcMode('existing')}
                disabled={!fcSets.length && !fcSetsLoading}
                className="accent-tsubaki-red"
              />
              Thêm vào bộ có sẵn
            </label>
            {fcMode === 'existing' && (
              fcSetsLoading ? (
                <p className="text-xs text-on-muted mt-2 ml-6">Đang tải danh sách bộ thẻ...</p>
              ) : (
                <select
                  value={fcTargetId}
                  onChange={e => setFcTargetId(e.target.value)}
                  className="w-full mt-2 px-3 py-2.5 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"
                >
                  {fcSets.map(s => (
                    <option key={s.id} value={s.id}>{s.title} ({s.card_count} thẻ)</option>
                  ))}
                </select>
              )
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="fcMode"
                checked={fcMode === 'new'}
                onChange={() => setFcMode('new')}
                className="accent-tsubaki-red"
              />
              Tạo bộ mới
            </label>
            {fcMode === 'new' && (
              <input
                value={fcNewTitle}
                onChange={e => setFcNewTitle(e.target.value)}
                placeholder="Tiêu đề bộ thẻ mới"
                className="w-full mt-2 px-3 py-2.5 bg-surface-low border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red"
              />
            )}
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
