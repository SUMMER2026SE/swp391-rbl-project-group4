import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Stars from '../../components/ui/Stars';
import { useAuth } from '../../contexts/AuthContext';
import { formatVnd, formatCount } from '../../lib/format';
import api, { enrollCourse, getCourseReviews, createReview, updateReview, deleteReview } from '../../lib/api';

const LEVEL_BADGE = {
  N5: 'bg-green-100 text-green-700 border-green-200',
  N4: 'bg-blue-100 text-blue-700 border-blue-200',
  N3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  N2: 'bg-orange-100 text-orange-700 border-orange-200',
  N1: 'bg-red-100 text-red-700 border-red-200',
  mixed: 'bg-purple-100 text-purple-700 border-purple-200',
};
const LEVEL_GRADIENT = {
  N5: 'from-green-500/10 to-emerald-400/10',
  N4: 'from-blue-500/10 to-sky-400/10',
  N3: 'from-yellow-500/10 to-amber-400/10',
  N2: 'from-orange-500/10 to-red-400/10',
  N1: 'from-red-600/15 to-rose-400/10',
  mixed: 'from-purple-500/10 to-violet-400/10',
};
const TYPE_META = {
  video:      { icon: 'play_circle', color: 'text-sumire-purple' },
  reading:    { icon: 'article',     color: 'text-primary' },
  vocabulary: { icon: 'translate',   color: 'text-green-600' },
  kanji:      { icon: 'draw',        color: 'text-purple-600' },
  grammar:    { icon: 'spellcheck',  color: 'text-amber-600' },
  quiz:       { icon: 'quiz',        color: 'text-tsubaki-red' },
};

const REVIEW_PAGE_SIZE = 5;

function ItemRow({ item }) {
  const meta = TYPE_META[item.lesson_type] || TYPE_META.reading;
  return (
    <Link to={`/lessons/${item.id}`} className="flex items-center gap-3 py-3 pl-10 pr-5 hover:bg-surface-container-low transition-colors group">
      <span className={`material-symbols-outlined text-xl shrink-0 ${item.completed ? 'text-green-600' : meta.color}`}>
        {item.completed ? 'check_circle' : meta.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-on-surface group-hover:text-tsubaki-red transition-colors line-clamp-1">{item.title}</p>
        {item.title_ja && <p className="text-xs text-on-muted mt-0.5">{item.title_ja}</p>}
      </div>
      <span className="material-symbols-outlined text-lg text-on-muted/40 group-hover:text-tsubaki-red group-hover:translate-x-1 transition-all shrink-0">chevron_right</span>
    </Link>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [course, setCourse]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [enrolled, setEnrolled] = useState(false);
  const [alert, setAlert]     = useState({ type: '', msg: '' });

  const [enrollModal, setEnrollModal] = useState(null); // 'free' | 'paid' | null
  const [enrolling, setEnrolling]     = useState(false);
  const [expanded, setExpanded]       = useState(() => new Set());

  // Reviews — tải toàn bộ một lần, phân trang client-side để tối ưu optimistic update.
  const [reviews, setReviews] = useState([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert({ type: '', msg: '' }), 4000);
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/courses/${id}`)
      .then(r => { setCourse(r.data); setEnrolled(!!r.data.is_enrolled); setExpanded(new Set((r.data.units || []).map(u => u.id))); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    getCourseReviews(id, 1, 1000)
      .then(r => setReviews(r.data || []))
      .catch(() => {});
  }, [id]);

  if (loading) return (
    <StudentLayout title="...">
      <div className="flex justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-tsubaki-red text-4xl">progress_activity</span>
      </div>
    </StudentLayout>
  );

  if (error || !course) return (
    <StudentLayout title="Lỗi">
      <Alert type="error">{error || 'Không tìm thấy khóa học.'}</Alert>
    </StudentLayout>
  );

  const units = course.units || [];
  const allItems = units.flatMap(u => u.lessons || []);
  const totalItems = allItems.length;
  const completedCount = allItems.filter(i => i.completed).length;
  const progressPct = course.progress_pct ?? (totalItems ? Math.round((completedCount / totalItems) * 100) : 0);
  const resumeItem = allItems.find(i => !i.completed) || allItems[0] || null;
  const lvl = course.difficulty_level || course.level;
  const isAdmin = course.creator_type === 'admin';
  const author = course.creator_name || (isAdmin ? 'Kizuna Nihongo' : 'Giáo viên');

  // Tổng hợp đánh giá từ mảng reviews (chính xác sau optimistic update).
  const reviewTotal = reviews.length;
  const avgRating = reviewTotal ? reviews.reduce((s, r) => s + r.rating, 0) / reviewTotal : 0;
  const dist = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(r => r.rating === star).length }));
  const myReview = user ? reviews.find(r => r.student_id === user.id) : null;
  const reviewPages = Math.ceil(reviewTotal / REVIEW_PAGE_SIZE) || 1;
  const pageReviews = reviews.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE);

  const toggleUnit = (uid) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });

  const handleEnrollClick = () => setEnrollModal(course.is_free ? 'free' : 'paid');

  const confirmEnroll = async () => {
    setEnrolling(true);
    try {
      await enrollCourse(id);
      setEnrolled(true);
      setEnrollModal(null);
      showAlert('success', 'Đăng ký thành công! Chúc bạn học tốt.');
      if (resumeItem) navigate(`/lessons/${resumeItem.id}`);
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const startEdit = () => {
    if (!myReview) return;
    setEditing(true);
    setFormRating(myReview.rating);
    setFormComment(myReview.comment || '');
  };

  const submitReview = async () => {
    if (formRating < 1 || formRating > 5) return showAlert('error', 'Vui lòng chọn số sao từ 1 đến 5.');
    setSubmitting(true);
    const payload = { rating: formRating, comment: formComment.trim() || null };
    try {
      const saved = myReview
        ? await updateReview(id, myReview.id, payload)
        : await createReview(id, payload);
      // Gắn lại thông tin người dùng để hiển thị ngay (server trả về bản ghi thô).
      const withUser = {
        ...saved,
        user: myReview?.user || {
          id: user.id,
          display_name: user.user_metadata?.full_name || 'Bạn',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      };
      setReviews(prev => {
        const rest = prev.filter(r => r.id !== saved.id && r.student_id !== user.id);
        return [withUser, ...rest];
      });
      setEditing(false);
      setFormRating(0);
      setFormComment('');
      setReviewPage(1);
      showAlert('success', myReview ? 'Đã cập nhật đánh giá.' : 'Cảm ơn bạn đã đánh giá!');
    } catch (e) {
      showAlert('error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeReview = async (reviewId) => {
    const prev = reviews;
    setReviews(reviews.filter(r => r.id !== reviewId)); // optimistic
    setConfirmDelete(null);
    try {
      await deleteReview(id, reviewId);
      showAlert('success', 'Đã xóa đánh giá.');
    } catch (e) {
      setReviews(prev); // revert
      showAlert('error', e.message);
    }
  };

  return (
    <StudentLayout title={course.title}>
      {alert.msg && (
        <div className="mb-4"><Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })}>{alert.msg}</Alert></div>
      )}

      <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-6 group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Danh mục khóa học
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── LEFT: nội dung ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-10">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {lvl && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${LEVEL_BADGE[lvl] || 'bg-surface-container text-on-muted border-outline-variant'}`}>
                  {lvl === 'mixed' ? 'Tổng hợp' : `JLPT ${lvl}`}
                </span>
              )}
              {totalItems > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-muted border border-outline-variant">
                  {units.length} bài học • {totalItems} mục
                </span>
              )}
              {course.reference_curriculum && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sumire-purple/10 text-sumire-purple border border-sumire-purple/20">
                  {course.reference_curriculum}
                </span>
              )}
            </div>
            <h1 className="font-display text-display-mobile font-bold text-on-surface leading-tight">{course.title}</h1>
            {course.title_ja && <p className="text-lg text-on-muted">{course.title_ja}</p>}
            <p className="text-base text-on-surface-variant leading-relaxed whitespace-pre-line">
              {course.description || 'Khám phá nội dung và bắt đầu hành trình học tiếng Nhật của bạn.'}
            </p>

            {enrolled && totalItems > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs text-on-muted">
                  <span>Tiến độ</span>
                  <span>{completedCount}/{totalItems} mục • {progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-tsubaki-red rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Nội dung khóa học */}
          <div>
            <h2 className="font-display text-xl font-bold text-on-surface flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-tsubaki-red">list_alt</span>
              Nội dung khóa học
            </h2>

            {totalItems === 0 ? (
              <div className="glass-card rounded-xl p-12 text-center text-on-muted border border-outline-variant/40">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-20">article</span>
                <p className="font-semibold">Chưa có nội dung nào</p>
              </div>
            ) : (
              <div className="space-y-4">
                {units.map((unit, uIdx) => {
                  const open = expanded.has(unit.id);
                  const lessons = unit.lessons || [];
                  return (
                    <div key={unit.id} className="glass-card rounded-2xl overflow-hidden border border-outline-variant/60">
                      <button
                        onClick={() => toggleUnit(unit.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 bg-surface-container-low border-b border-outline-variant/30 text-left hover:bg-surface-container transition-colors"
                      >
                        <span className="w-7 h-7 rounded-full bg-tsubaki-red/10 text-tsubaki-red text-xs font-bold flex items-center justify-center shrink-0">{uIdx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-on-surface truncate">{unit.title}</p>
                          {unit.title_ja && <p className="text-xs text-on-muted truncate">{unit.title_ja}</p>}
                        </div>
                        <span className="text-xs text-on-muted shrink-0">{lessons.length} mục</span>
                        <span className={`material-symbols-outlined text-on-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
                      </button>
                      {open && (
                        <div className="divide-y divide-outline-variant/20">
                          {lessons.map(item => <ItemRow key={item.id} item={item} />)}
                          {lessons.length === 0 && <p className="px-5 py-4 text-sm text-on-muted italic">Chưa có mục nào.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Reviews ─────────────────────────────────────────────── */}
          <div>
            <h2 className="font-display text-xl font-bold text-on-surface flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-amber-400 fill">star</span>
              Đánh giá ({reviewTotal})
            </h2>

            {/* Form viết/sửa review — chỉ học viên đã đăng ký */}
            {enrolled && (!myReview || editing) && (
              <div className="glass-card rounded-2xl border border-outline-variant/60 p-5 mb-6">
                <p className="font-semibold text-sm text-on-surface mb-3">{editing ? 'Chỉnh sửa đánh giá của bạn' : 'Viết đánh giá của bạn'}</p>
                <Stars value={formRating} interactive size="text-3xl" onChange={setFormRating} className="mb-3" />
                <textarea
                  value={formComment}
                  onChange={e => setFormComment(e.target.value)}
                  rows={3}
                  placeholder="Chia sẻ cảm nhận của bạn về khóa học..."
                  className="w-full px-4 py-3 bg-white border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red focus:ring-2 focus:ring-tsubaki-red/10 transition-all resize-none"
                />
                <div className="flex justify-end gap-2 mt-3">
                  {editing && <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setFormRating(0); setFormComment(''); }}>Hủy</Button>}
                  <Button size="sm" loading={submitting} onClick={submitReview}>{editing ? 'Lưu thay đổi' : 'Gửi đánh giá'}</Button>
                </div>
              </div>
            )}
            {!enrolled && (
              <p className="text-sm text-on-muted mb-6 italic">Đăng ký khóa học để viết đánh giá.</p>
            )}

            {/* Danh sách reviews */}
            {reviewTotal === 0 ? (
              <p className="text-sm text-on-muted">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
            ) : (
              <div className="space-y-4">
                {pageReviews.map(r => {
                  const mine = user && r.student_id === user.id;
                  return (
                    <div key={r.id} className="glass-card rounded-2xl border border-outline-variant/60 p-5">
                      <div className="flex items-start gap-3">
                        {r.user?.avatar_url ? (
                          <img src={r.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-tsubaki-red/10 text-tsubaki-red flex items-center justify-center shrink-0 font-bold text-sm">
                            {(r.user?.display_name || 'H').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm text-on-surface truncate">
                              {r.user?.display_name || 'Học viên'}{mine && <span className="text-xs text-on-muted font-normal"> (Bạn)</span>}
                            </p>
                            <span className="text-xs text-on-muted shrink-0">{r.created_at ? new Date(r.created_at).toLocaleDateString('vi') : ''}</span>
                          </div>
                          <Stars value={r.rating} size="text-sm" className="my-1" />
                          {r.comment && <p className="text-sm text-on-surface-variant leading-relaxed mt-1">{r.comment}</p>}

                          {mine && (
                            confirmDelete === r.id ? (
                              <div className="flex items-center gap-2 mt-2 text-xs">
                                <span className="text-on-muted">Xóa đánh giá này?</span>
                                <button onClick={() => removeReview(r.id)} className="text-error font-semibold hover:underline">Xóa</button>
                                <button onClick={() => setConfirmDelete(null)} className="text-on-muted hover:underline">Hủy</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <button onClick={startEdit} className="text-on-muted hover:text-tsubaki-red font-medium transition-colors">Sửa</button>
                                <button onClick={() => setConfirmDelete(r.id)} className="text-on-muted hover:text-error font-medium transition-colors">Xóa</button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {reviewPages > 1 && (
                  <div className="flex justify-center items-center gap-2 pt-2">
                    <button disabled={reviewPage === 1} onClick={() => setReviewPage(p => p - 1)}
                      className="px-4 py-2 rounded-xl border border-outline-variant text-sm disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">←</button>
                    <span className="px-3 text-sm text-on-muted">{reviewPage} / {reviewPages}</span>
                    <button disabled={reviewPage >= reviewPages} onClick={() => setReviewPage(p => p + 1)}
                      className="px-4 py-2 rounded-xl border border-outline-variant text-sm disabled:opacity-40 hover:border-tsubaki-red hover:text-tsubaki-red transition-colors">→</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: sidebar (xuống dưới trên mobile) ────────────────── */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            {/* Thumbnail */}
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-outline-variant/60 shadow-lg relative">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${LEVEL_GRADIENT[lvl] || 'from-tsubaki-red/10 to-sumire-purple/10'} flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-7xl text-tsubaki-red/15">menu_book</span>
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl border border-outline-variant/60 p-5 space-y-4">
              {/* Giá */}
              <div>
                {course.is_free ? (
                  <p className="text-2xl font-display font-bold text-green-600">Miễn phí</p>
                ) : (
                  <p className="text-2xl font-display font-bold text-on-surface">{formatVnd(course.price)}</p>
                )}
              </div>

              {/* CTA */}
              {enrolled ? (
                resumeItem ? (
                  <Link to={`/lessons/${resumeItem.id}`} className="w-full">
                    <Button className="w-full">
                      {completedCount > 0 ? 'Tiếp tục học' : 'Vào học'}
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </Button>
                  </Link>
                ) : (
                  <p className="text-sm text-on-muted italic text-center py-2">Khóa học chưa có nội dung</p>
                )
              ) : (
                <Button className="w-full" onClick={handleEnrollClick}>
                  <span className="material-symbols-outlined text-lg">{course.is_free ? 'school' : 'shopping_cart'}</span>
                  {course.is_free ? 'Đăng ký học miễn phí' : `Mua khóa học - ${formatVnd(course.price)}`}
                </Button>
              )}

              {/* Lượt đăng ký */}
              <div className="flex items-center gap-2 text-sm text-on-muted">
                <span className="material-symbols-outlined text-base">group</span>
                {formatCount(course.enrollment_count)} học viên đã đăng ký
              </div>

              {/* Giáo viên */}
              <div className="flex items-center gap-2 text-sm text-on-surface pt-3 border-t border-outline-variant/40">
                <span className={`material-symbols-outlined text-lg ${isAdmin ? 'text-tsubaki-red fill' : 'text-on-muted'}`}>{isAdmin ? 'verified' : 'person'}</span>
                <span className="font-medium">{author}</span>
              </div>
            </div>

            {/* Rating summary */}
            <div className="glass-card rounded-2xl border border-outline-variant/60 p-5">
              <div className="flex items-center gap-4 mb-3">
                <div className="text-center">
                  <p className="text-4xl font-display font-bold text-on-surface leading-none">{avgRating.toFixed(1)}</p>
                  <Stars value={Math.round(avgRating)} size="text-base" className="mt-1" />
                  <p className="text-xs text-on-muted mt-1">{reviewTotal} đánh giá</p>
                </div>
                <div className="flex-1 space-y-1">
                  {dist.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-on-muted w-3 text-right">{star}</span>
                      <span className="material-symbols-outlined text-amber-400 fill text-sm">star</span>
                      <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${reviewTotal ? (count / reviewTotal) * 100 : 0}%` }} />
                      </div>
                      <span className="text-xs text-on-muted w-5 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Enroll modals ──────────────────────────────────────────── */}
      <Modal
        open={enrollModal === 'free'}
        onClose={() => setEnrollModal(null)}
        title="Đăng ký khóa học"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnrollModal(null)}>Hủy</Button>
            <Button loading={enrolling} onClick={confirmEnroll}>Đăng ký ngay</Button>
          </>
        }
      >
        <p className="text-sm text-on-surface-variant">
          Bạn sắp đăng ký khóa học <strong>"{course.title}"</strong> miễn phí. Sau khi đăng ký, bạn có thể bắt đầu học ngay.
        </p>
      </Modal>

      <Modal
        open={enrollModal === 'paid'}
        onClose={() => setEnrollModal(null)}
        title="Đăng ký khóa học có phí"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnrollModal(null)}>Hủy</Button>
            <Button loading={enrolling} onClick={confirmEnroll}>Đăng ký (miễn phí tạm thời)</Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-sumire-purple text-2xl shrink-0">payments</span>
          <p className="text-sm text-on-surface-variant">
            Khóa học <strong>"{course.title}"</strong> có giá <strong>{formatVnd(course.price)}</strong>. Cổng thanh toán
            đang được hoàn thiện — tạm thời bạn có thể <strong>đăng ký miễn phí</strong> để trải nghiệm luồng học.
          </p>
        </div>
      </Modal>
    </StudentLayout>
  );
}
