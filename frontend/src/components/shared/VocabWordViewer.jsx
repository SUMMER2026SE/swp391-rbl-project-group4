import { useEffect, useRef, useState } from 'react';
import FuriganaText from '../ui/FuriganaText';

const LEVEL_COLORS = {
  N5: 'bg-emerald-100 text-emerald-700', N4: 'bg-sky-100 text-sky-700',
  N3: 'bg-violet-100 text-violet-700',   N2: 'bg-orange-100 text-orange-700',
  N1: 'bg-red-100 text-red-700',
};
const LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

// Trình xem từ vựng kiểu flashcard dùng chung giữa bài đăng (StudyListDetail)
// và bài học trong khóa: cột danh sách từ bên trái + thẻ lớn bên phải + thanh
// tiến trình + nút Trước/Tiếp theo. Component thuần trình bày — mọi lời gọi API
// (lưu, upload ảnh, xóa) đưa từ ngoài vào qua callback.
//
// Props:
//  items           — mảng từ vựng { id, kanji, reading, meaning_vi, ... }
//  icon            — material symbol hiển thị khi từ không có ảnh
//  showLevel       — hiện badge cấp độ + bộ lọc cấp độ + sắp theo N5→N1
//                    (bài đăng: true; khóa học: false — cấp độ đã có ở cấp khóa)
//  showDetails     — hiện thêm nghĩa tiếng Nhật + loại từ trên thẻ (ngữ cảnh bài học)
//  furiganaEnabled — (tùy chọn) điều khiển furigana từ ngoài; bỏ qua thì
//                    FuriganaText tự render nút bật/tắt như cũ
//  editable        — cho sửa kanji/đọc/nghĩa/câu ví dụ/ảnh inline ngay trên thẻ
//                    (kèm nghĩa JA khi showDetails, loại từ khi có typeOptions)
//  typeOptions     — danh sách loại từ; khi editable hiện select sửa inline
//  saveItem(id, patch)   — bắt buộc khi editable
//  uploadImage(file)→url — cho nút "Đổi ảnh" khi editable
//  onRemoveItem(id)      — hiện nút X trong danh sách (+ nút xóa dưới thẻ khi editable)
//  removeTitle / removeCardLabel — nhãn cho các nút xóa
//  renderItemExtra(item) — slot phụ mỗi dòng danh sách (vd: checkbox chọn flashcard)
//  cardActions(item)     — slot dưới thẻ, thay cho nút xóa mặc định (vd: Sửa/Gỡ)
export default function VocabWordViewer({
  items,
  icon = 'translate',
  showLevel = true,
  showDetails = false,
  furiganaEnabled,
  editable = false,
  typeOptions,
  saveItem,
  uploadImage,
  onRemoveItem,
  removeTitle = 'Xóa khỏi bài đăng',
  removeCardLabel = 'Xóa từ này khỏi bài đăng',
  renderItemExtra,
  cardActions,
}) {
  const [levelFilter, setLevelFilter] = useState('');
  const [idx, setIdx] = useState(0);
  const [showExample, setShowExample] = useState(false);

  // Truyền enabled cho FuriganaText chỉ khi được điều khiển từ ngoài — nếu không,
  // giữ chế độ uncontrolled (tự có nút bật/tắt) như StudyListDetail cũ.
  const furiganaProps = furiganaEnabled === undefined ? {} : { enabled: furiganaEnabled };

  // Chỉ hiện các cấp độ thực sự có mặt trong bài — 1 chủ đề thường có từ ở
  // nhiều cấp độ khác nhau, lọc cấp độ nằm ở đây thay vì ngoài trang duyệt.
  const availableLevels = showLevel ? ['N5', 'N4', 'N3', 'N2', 'N1'].filter(l => items.some(it => it.level === l)) : [];
  const filtered = showLevel && levelFilter ? items.filter(it => it.level === levelFilter) : items;

  // Danh sách bên trái sắp N5 → N1 khi hiển thị cấp độ (từ chưa gắn cấp độ xếp
  // cuối) — thứ tự này cũng là thứ tự duyệt Trước/Tiếp theo. Khi ẩn cấp độ
  // (ngữ cảnh khóa học) giữ nguyên thứ tự gốc.
  const sorted = showLevel ? [...filtered].sort((a, b) => (LEVEL_ORDER[a.level] ?? 5) - (LEVEL_ORDER[b.level] ?? 5)) : filtered;

  useEffect(() => { setIdx(0); }, [levelFilter]);
  useEffect(() => { if (idx >= sorted.length) setIdx(Math.max(0, sorted.length - 1)); }, [sorted.length]);

  const item = sorted[idx] || sorted[0];
  const total = sorted.length;

  const [kanji, setKanji]         = useState(item?.kanji || '');
  const [reading, setReading]     = useState(item?.reading || '');
  const [meaning, setMeaning]     = useState(item?.meaning_vi || '');
  const [meaningJa, setMeaningJa] = useState(item?.meaning_ja || '');
  const [hanViet, setHanViet]     = useState(item?.han_viet || '');
  const [typeVal, setTypeVal]     = useState(item?.type || '');
  const [example, setExample]     = useState(item?.example_sentence || '');
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    setShowExample(false);
    setKanji(item.kanji || '');
    setReading(item.reading || '');
    setMeaning(item.meaning_vi || '');
    setMeaningJa(item.meaning_ja || '');
    setHanViet(item.han_viet || '');
    setTypeVal(item.type || '');
    setExample(item.example_sentence || '');
  }, [idx, item?.id]);

  if (!item) return <div className="glass-card rounded-2xl p-12 text-center text-on-muted">Không còn từ nào ở bộ lọc này.</div>;

  const save = async (patch) => {
    setSaving(true);
    try {
      await saveItem(item.id, patch);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file);
      await saveItem(item.id, { image_url: url });
    } catch (e2) { alert(e2.message); }
    finally { setSaving(false); }
  };

  const editInputClass = 'w-full text-center bg-transparent border-b border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors';

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto">
      {/* Danh sách từ vựng bên trái — bấm để nhảy tới từ đó */}
      <aside className="lg:w-64 shrink-0">
        <div className="glass-card rounded-2xl p-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto scrollbar-thin">
          <p className="px-2 py-1.5 text-xs font-semibold text-on-muted uppercase tracking-wide">Danh sách từ ({total})</p>
          <div className="space-y-0.5">
            {sorted.map((it, i) => (
              <div
                key={it.id}
                className={`flex items-center gap-1 rounded-lg ${i === idx ? 'bg-tsubaki-red/10' : 'hover:bg-surface-low'} transition-colors`}
              >
                {renderItemExtra && <span className="shrink-0 pl-2 flex items-center">{renderItemExtra(it)}</span>}
                <button
                  onClick={() => setIdx(i)}
                  className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 text-sm text-left ${i === idx ? 'text-tsubaki-red font-semibold' : 'text-on-muted'}`}
                >
                  <span className="truncate">{it.kanji || it.reading}</span>
                  {showLevel && it.level && <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[it.level] || 'bg-surface-low text-on-muted'}`}>{it.level}</span>}
                </button>
                {onRemoveItem && (
                  <button onClick={() => onRemoveItem(it.id)} title={removeTitle}
                    className="shrink-0 w-6 h-6 mr-1 rounded-full flex items-center justify-center text-on-muted hover:text-error hover:bg-error/10 transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
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
          {editable && uploadImage && (
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
              {kanji && (
                <input value={hanViet} onChange={e => setHanViet(e.target.value)} onBlur={() => hanViet !== (item.han_viet || '') && save({ han_viet: hanViet || null })}
                  placeholder="Hán Việt" className={`${editInputClass} text-sm text-amber-600 mt-1 py-1`} />
              )}
              <input value={meaning} onChange={e => setMeaning(e.target.value)} onBlur={() => meaning !== (item.meaning_vi || '') && save({ meaning_vi: meaning })}
                placeholder="Nghĩa tiếng Việt" className={`${editInputClass} text-lg font-medium text-tsubaki-red mt-3 py-1`} />
              {showDetails && (
                <input value={meaningJa} onChange={e => setMeaningJa(e.target.value)} onBlur={() => meaningJa !== (item.meaning_ja || '') && save({ meaning_ja: meaningJa || null })}
                  placeholder="Nghĩa tiếng Nhật (nếu có)" className={`${editInputClass} text-sm text-on-muted mt-1 py-1`} />
              )}
              {typeOptions && (
                <select value={typeVal}
                  onChange={e => { setTypeVal(e.target.value); save({ type: e.target.value || null }); }}
                  className="mt-3 px-2 py-1 rounded-full text-xs bg-surface-low text-on-muted border border-transparent hover:border-outline focus:border-tsubaki-red outline-none transition-colors">
                  <option value="">Loại từ…</option>
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <textarea value={example} onChange={e => setExample(e.target.value)} onBlur={() => example !== (item.example_sentence || '') && save({ example_sentence: example || null })}
                placeholder="Câu ví dụ..." rows={2}
                className="mt-4 w-full text-center text-sm italic text-on-muted bg-surface-low rounded-xl px-4 py-3 outline-none border border-transparent focus:border-tsubaki-red resize-none transition-colors" />
              {saving && <p className="text-xs text-on-muted mt-2">Đang lưu…</p>}
            </>
          ) : (
            <>
              <FuriganaText text={item.kanji || item.reading} enabled={false} textClassName="text-3xl font-bold text-charcoal" />
              {item.kanji && <p className="text-base text-on-muted mt-1">{item.reading}</p>}
              {item.kanji && item.han_viet && <p className="text-sm text-amber-600 mt-0.5">{item.han_viet}</p>}
              <p className="text-lg font-medium text-tsubaki-red mt-3">{item.meaning_vi}</p>
              {showDetails && item.meaning_ja && <p className="text-sm text-on-muted mt-1">{item.meaning_ja}</p>}
              {showDetails && item.type && <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs bg-surface-low text-on-muted">{item.type}</span>}
              {showLevel && item.level && <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[item.level] || 'bg-surface-low text-on-muted'}`}>{item.level}</span>}
            </>
          )}

          {!editable && item.example_sentence && (
            <div className="mt-4">
              {!showExample ? (
                <button onClick={() => setShowExample(true)} className="text-sm text-tsubaki-red font-semibold hover:underline">
                  Xem ví dụ
                </button>
              ) : (
                <p className="text-sm text-on-muted italic bg-surface-low rounded-xl px-4 py-3">
                  「<FuriganaText text={item.example_sentence} {...furiganaProps} textClassName="text-sm italic" />」
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {cardActions ? (
        <div className="mt-4">{cardActions(item)}</div>
      ) : (editable && onRemoveItem && (
        <div className="mt-4">
          <button onClick={() => onRemoveItem(item.id)}
            className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border border-outline text-xs text-on-muted hover:border-error hover:text-error transition-colors">
            <span className="material-symbols-outlined text-base">delete</span> {removeCardLabel}
          </button>
        </div>
      ))}

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
