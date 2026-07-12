import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import FuriganaText from '../../components/ui/FuriganaText';
import WorksheetPreview from '../../components/kanji/WorksheetPreview';
import { downloadWorksheetPDF } from '../../lib/kanjiWorksheet';
import { TOPIC_ICONS } from '../../lib/studyListTopics';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};

function NumberBadge({ n }) {
  return (
    <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-charcoal/80 text-white text-xs font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function ItemCard({ item, listType, index, type, postId }) {
  if (listType === 'vocabulary') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        <FuriganaText text={item.kanji || item.reading} textClassName="text-2xl font-bold text-tsubaki-red mb-1" />
        {item.kanji && <p className="text-sm text-on-muted">{item.reading}</p>}
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  if (listType === 'kanji') {
    return (
      <div className="relative glass-card rounded-2xl p-5 pt-8 text-center">
        <NumberBadge n={index + 1} />
        <p className="text-4xl font-bold text-tsubaki-red mb-1">{item.character}</p>
        <p className="text-xs text-on-muted">On: {(item.reading_on || []).join('、') || '—'}</p>
        <p className="text-xs text-on-muted">Kun: {(item.reading_kun || []).join('、') || '—'}</p>
        <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
        {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
      </div>
    );
  }
  // grammar — thẻ gọn, bấm vào mở trang chi tiết riêng (URL thật, back trình duyệt hoạt động đúng)
  return (
    <Link
      to={`/study-lists/${type}/${postId}/${item.id}`}
      className="relative glass-card rounded-2xl p-5 pt-8 block hover:shadow-lg hover:-translate-y-0.5 hover:border-tsubaki-red/30 border border-transparent transition-all"
    >
      <NumberBadge n={index + 1} />
      <p className="text-xl font-bold text-tsubaki-red">{item.title}</p>
      {item.title_ja && <p className="text-sm text-on-muted">{item.title_ja}</p>}
      <p className="text-sm font-medium mt-2">{item.meaning_vi}</p>
      <div className="flex items-center justify-between mt-3">
        {item.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
        <span className="flex items-center gap-1 text-xs text-tsubaki-red font-semibold ml-auto">
          Xem chi tiết <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </span>
      </div>
    </Link>
  );
}

// Xem từng từ một, giống bố cục thẻ tra từ tham khảo: ảnh/icon minh họa, từ +
// đọc, nghĩa, ví dụ có thể mở rộng, thanh tiến trình và nút Trước/Tiếp theo.
// editable=true (chủ bài đăng hoặc admin) cho phép sửa kanji/đọc/nghĩa/ảnh
// ngay trên chính trang này, không cần qua modal riêng.
function VocabWordViewer({ items, topic, editable, onItemSaved }) {
  const [levelFilter, setLevelFilter] = useState('');
  const [idx, setIdx] = useState(0);
  const [showExample, setShowExample] = useState(false);

  // Chỉ hiện các cấp độ thực sự có mặt trong bài — 1 chủ đề thường có từ ở
  // nhiều cấp độ khác nhau, lọc cấp độ nằm ở đây thay vì ngoài trang duyệt.
  const availableLevels = ['N5', 'N4', 'N3', 'N2', 'N1'].filter(l => items.some(it => it.level === l));
  const filtered = levelFilter ? items.filter(it => it.level === levelFilter) : items;

  // Danh sách bên trái luôn sắp N5 → N1 (từ chưa gắn cấp độ xếp cuối) — thứ tự
  // này cũng là thứ tự duyệt Trước/Tiếp theo để nhất quán với danh sách.
  const LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };
  const sorted = [...filtered].sort((a, b) => (LEVEL_ORDER[a.level] ?? 5) - (LEVEL_ORDER[b.level] ?? 5));

  useEffect(() => { setIdx(0); }, [levelFilter]);

  const item = sorted[idx] || sorted[0];
  const total = sorted.length;
  const icon = (topic && TOPIC_ICONS[topic]) || 'translate';

  const [kanji, setKanji]     = useState(item.kanji || '');
  const [reading, setReading] = useState(item.reading || '');
  const [meaning, setMeaning] = useState(item.meaning_vi || '');
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setShowExample(false);
    setKanji(item.kanji || '');
    setReading(item.reading || '');
    setMeaning(item.meaning_vi || '');
  }, [idx, item.id]);

  const save = async (patch) => {
    setSaving(true);
    try {
      await api.put(`/teacher/vocabulary/${item.id}`, patch);
      onItemSaved(item.id, patch);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const up = await api.post('/teacher/vocabulary/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await save({ image_url: up.data.url });
    } catch (e2) { alert(e2.message); setSaving(false); }
  };

  const editInputClass = 'w-full text-center bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors';

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Danh sách từ vựng bên trái — sắp theo cấp độ N5 → N1, bấm để nhảy tới từ đó */}
      <aside className="lg:w-64 shrink-0">
        <div className="glass-card rounded-2xl p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-thin">
          <p className="px-2 py-1.5 text-xs font-semibold text-on-muted uppercase tracking-wide">Danh sách từ ({total})</p>
          <div className="space-y-0.5">
            {sorted.map((it, i) => (
              <button
                key={it.id}
                onClick={() => setIdx(i)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${i === idx ? 'bg-tsubaki-red/10 text-tsubaki-red font-semibold' : 'text-on-muted hover:bg-surface-low'}`}
              >
                <span className="truncate">{it.kanji || it.reading}</span>
                {it.level && <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[it.level] || 'bg-surface-low text-on-muted'}`}>{it.level}</span>}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 max-w-xl mx-auto lg:mx-0 w-full">
      {availableLevels.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <button onClick={() => setLevelFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!levelFilter ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
            Tất cả
          </button>
          {availableLevels.map(l => (
            <button key={l} onClick={() => setLevelFilter(l)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${levelFilter === l ? 'bg-tsubaki-red text-white' : 'bg-white border border-outline text-on-muted hover:border-tsubaki-red'}`}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className={`h-64 relative flex items-center justify-center overflow-hidden ${item.image_url ? '' : 'bg-gradient-to-br from-tsubaki-red/80 to-sumire-purple/80'} ${editable ? 'group' : ''}`}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.kanji || item.reading} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-7xl text-white/90">{icon}</span>
          )}
          {editable && (
            <>
              <button onClick={() => fileRef.current?.click()}
                className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-base">add_photo_alternate</span> Đổi ảnh
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </>
          )}
        </div>
        <div className="p-6 text-center">
          {editable ? (
            <>
              <input value={kanji} onChange={e => setKanji(e.target.value)} onBlur={() => kanji !== (item.kanji || '') && save({ kanji })}
                placeholder="Kanji (nếu có)" className={`${editInputClass} text-3xl font-bold text-charcoal py-1`} />
              <input value={reading} onChange={e => setReading(e.target.value)} onBlur={() => reading !== (item.reading || '') && save({ reading })}
                placeholder="Cách đọc" className={`${editInputClass} text-base text-on-muted mt-1 py-1`} />
              <input value={meaning} onChange={e => setMeaning(e.target.value)} onBlur={() => meaning !== (item.meaning_vi || '') && save({ meaning_vi: meaning })}
                placeholder="Nghĩa tiếng Việt" className={`${editInputClass} text-lg font-medium text-tsubaki-red mt-3 py-1`} />
              {saving && <p className="text-xs text-on-muted mt-2">Đang lưu…</p>}
            </>
          ) : (
            <>
              <FuriganaText text={item.kanji || item.reading} textClassName="text-3xl font-bold text-charcoal" />
              {item.kanji && <p className="text-base text-on-muted mt-1">{item.reading}</p>}
              <p className="text-lg font-medium text-tsubaki-red mt-3">{item.meaning_vi}</p>
              {item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
            </>
          )}

          {item.example_sentence && (
            <div className="mt-4">
              {!showExample ? (
                <button onClick={() => setShowExample(true)} className="text-sm text-tsubaki-red font-semibold hover:underline">
                  Xem ví dụ
                </button>
              ) : (
                <p className="text-sm text-on-muted italic bg-surface-low rounded-xl px-4 py-3">
                  「<FuriganaText text={item.example_sentence} textClassName="text-sm italic" />」
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-1.5 bg-surface-low rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <p className="text-center text-xs text-on-muted mt-1">{idx + 1} / {total}</p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl border border-outline text-sm text-on-muted hover:border-tsubaki-red hover:text-tsubaki-red disabled:opacity-30 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span> Trước
        </button>
        <button
          onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
          disabled={idx === total - 1}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-tsubaki-red text-white text-sm font-semibold hover:opacity-90 disabled:opacity-30 transition-colors"
        >
          Tiếp theo <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
      </div>
    </div>
  );
}

export default function StudyListDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isTeacher } = useAuth();
  const [post, setPost]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const canEdit = !!user && !!post && (user.id === post.created_by || isAdmin());

  const handleItemSaved = (itemId, patch) => {
    setPost(p => ({ ...p, items: p.items.map(it => it.id === itemId ? { ...it, ...patch } : it) }));
  };

  const [showPdf, setShowPdf]       = useState(false);
  const [pdfList, setPdfList]       = useState([]);
  const [boxSize, setBoxSize]       = useState(68);
  const [guideCount, setGuideCount] = useState(3);
  const [downloading, setDownloading] = useState(false);

  const openPdf = (items) => {
    setPdfList(items.map(item => ({
      char: item.character,
      reading_on:  item.reading_on  || [],
      reading_kun: item.reading_kun || [],
      meaning_vi:  item.meaning_vi  || '',
      han_viet:    item.han_viet    || '',
    })));
    setShowPdf(true);
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/study-lists/${id}`)
      .then(r => setPost(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <StudentLayout title="Chi tiết bài đăng">
      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      <button
        onClick={() => navigate(isAdmin() ? '/admin/study-lists' : isTeacher() ? '/teacher/study-lists' : `/${type}`)}
        className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span> Quay lại danh sách
      </button>

      {loading ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted animate-pulse">Đang tải...</div>
      ) : !post ? (
        <div className="glass-card rounded-2xl p-8 text-center text-on-muted">Không tìm thấy bài đăng.</div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold mb-1">{post.title}</h1>
            {post.description && <p className="text-on-muted mb-2">{post.description}</p>}
            <div className="flex items-center gap-4 text-sm text-on-muted flex-wrap">
              {post.level && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[post.level] || 'bg-surface-low text-on-muted'}`}>{post.level}</span>}
              {post.topic && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{post.topic}</span>}
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">person</span>{post.creator_name || '—'}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">bookmarks</span>{post.items.length} mục</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base">visibility</span>{post.view_count} lượt xem</span>
            </div>
          </div>

          {post.items.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Bài đăng này chưa có mục nào.</div>
          ) : post.list_type === 'vocabulary' ? (
            <VocabWordViewer items={post.items} topic={post.topic} editable={canEdit} onItemSaved={handleItemSaved} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {post.items.map((item, i) => (
                  <ItemCard key={item.id} item={item} listType={post.list_type} index={i} type={type} postId={id} />
                ))}
              </div>

              {type === 'kanji' && (
                <div className="mt-8 flex justify-center">
                  <Button onClick={() => openPdf(post.items)}>
                    <span className="material-symbols-outlined text-lg">article</span>
                    Tạo PDF luyện viết
                  </Button>
                </div>
              )}

              {type === 'kanji' && showPdf && (
                <div className="mt-6 glass-card rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-base">Bộ luyện viết PDF</h2>
                    <button onClick={() => setShowPdf(false)} className="text-on-muted hover:text-charcoal">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Danh sách kanji — X để xóa khỏi PDF */}
                  <div className="flex flex-wrap gap-1.5">
                    {pdfList.map((k, i) => (
                      <div key={i} className="relative group">
                        <div className="w-10 h-10 rounded-lg border border-outline bg-surface text-xl flex items-center justify-center">
                          {k.char}
                        </div>
                        <button
                          onClick={() => setPdfList(l => l.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-charcoal/70 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {pdfList.length === 0 ? (
                    <p className="text-sm text-on-muted text-center py-4">Không còn kanji nào — thêm lại bằng cách nhấn "Tạo PDF luyện viết".</p>
                  ) : (
                    <>
                      {/* Cài đặt */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <label className="flex items-center gap-2 text-sm">Cỡ ô
                          <select value={boxSize} onChange={e => setBoxSize(Number(e.target.value))}
                            className="px-2 py-1 border border-outline rounded-lg text-sm">
                            <option value={56}>Nhỏ</option>
                            <option value={68}>Vừa</option>
                            <option value={84}>Lớn</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-sm">Ô chữ mờ
                          <select value={guideCount} onChange={e => setGuideCount(Number(e.target.value))}
                            className="px-2 py-1 border border-outline rounded-lg text-sm">
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={0}>Không</option>
                          </select>
                        </label>
                        <div className="ml-auto">
                          <Button
                            loading={downloading}
                            onClick={async () => {
                              setDownloading(true);
                              try {
                                await downloadWorksheetPDF('ws-print', `luyen-viet-${post.title}.pdf`);
                              } finally { setDownloading(false); }
                            }}>
                            <span className="material-symbols-outlined text-lg">download</span> Tải PDF
                          </Button>
                        </div>
                      </div>

                      {/* Preview */}
                      <WorksheetPreview list={pdfList} boxSize={boxSize} guideCount={guideCount} />
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </StudentLayout>
  );
}
