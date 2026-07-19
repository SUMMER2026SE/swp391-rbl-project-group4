import { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../ui/Button';
import { useConfirm } from '../../contexts/ConfirmContext';
import api from '../../lib/api';
import SyncedVideoTranscript from '../shared/SyncedVideoTranscript';
import TranscriptSegmentsEditor, { segsToRows, rowsToSegments } from '../shared/TranscriptSegmentsEditor';
import ContentCard from './ContentCard';

// Quản lý nội dung nghe tự tạo (TTS / audio / video / YouTube) — dùng chung cho học
// sinh (riêng tư, có quota) và admin (công khai, không quota). Backend tự quyết
// is_public + quota theo vai trò; component chỉ đổi phần hiển thị quota qua prop `admin`.

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LEVEL_COLOR = { N5: '#059669', N4: '#0284c7', N3: '#7c3aed', N2: '#d97706', N1: '#ae2826' };
const LEVEL_BG    = { N5: '#d1fae5', N4: '#dbeafe', N3: '#ede9fe', N2: '#fef3c7', N1: '#fde8e8' };

const isYouTube = (u) => /(?:youtube\.com|youtu\.be)\//i.test(u || '');
// URL YouTube → link nhúng (chỉ khớp khi id đủ 11 ký tự nên không reload iframe mỗi lần gõ).
const ytEmbed = (u) => {
  const m = (u || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};
const SOURCES = [
  { key: 'tts',     icon: 'record_voice_over', label: 'TTS (gõ chữ)' },
  { key: 'audio',   icon: 'audio_file',        label: 'File âm thanh' },
  { key: 'video',   icon: 'movie',             label: 'File video' },
  { key: 'youtube', icon: 'smart_display',     label: 'Link YouTube' },
];

// Kiểu hiển thị theo loại thông báo (editor transcript gửi cả success/info, không chỉ error).
const NOTICE_STYLE = {
  error:   'text-red-600 bg-red-50',
  success: 'text-emerald-700 bg-emerald-50',
  info:    'text-on-muted bg-surface-low',
};

// onOpen(item): nếu cha truyền (trang học viên) → mở bằng player 3 tab (Nghe/Chép/Shadowing)
// của trang đó. Không truyền (admin) → dùng play view nội bộ để xem trước.
export default function ListeningContentManager({ admin = false, onOpen = null }) {
  const confirm = useConfirm();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota]     = useState(null);
  const [view, setView]       = useState('list'); // 'list' | 'create' | 'edit' | 'play'
  const [busy, setBusy]       = useState(false);
  const [notice, setNotice]   = useState(null);   // { type, msg }
  const [form, setForm]       = useState({ source_type: 'tts', title: '', level: 'N5', youtube_url: '', tts_text: '' });
  const [current, setCurrent] = useState(null);   // content đang sửa/nghe
  const [rows, setRows]       = useState([]);
  const [fileName, setFileName] = useState('');   // tên file đã chọn (hiển thị trong ô)
  const fileRef    = useRef(null);
  const previewRef = useRef(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/listening/content/mine').then(r => r.data).catch(() => []),
      admin ? Promise.resolve(null) : api.get('/subscription/usage').then(r => r.data).catch(() => null),
    ]).then(([list, usage]) => {
      setItems(list || []);
      setQuota(usage?.quotas?.find(x => x.feature === 'listening_create_monthly') || null);
    }).finally(() => setLoading(false));
  }, [admin]);
  useEffect(() => { refresh(); }, [refresh]);

  const outOfQuota = !admin && quota && quota.limit !== -1 && quota.remaining <= 0;

  const startCreate = () => {
    setForm({ source_type: 'tts', title: '', level: 'N5', youtube_url: '', tts_text: '' });
    setFileName(''); setNotice(null); setView('create');
  };

  const pickSource = (key) => {
    setForm(f => ({ ...f, source_type: key }));
    setFileName('');                       // đổi nguồn → bỏ file đã chọn
    if (fileRef.current) fileRef.current.value = '';
  };

  const submitCreate = async () => {
    setNotice(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('source_type', form.source_type);
      fd.append('title', form.title || 'Bài nghe');
      fd.append('level', form.level);
      if (form.source_type === 'youtube') fd.append('content_url', form.youtube_url);
      else if (form.source_type === 'tts') fd.append('transcript', form.tts_text);
      else {
        const file = fileRef.current?.files?.[0];
        if (!file) { setNotice({ type: 'error', msg: 'Chưa chọn file.' }); setBusy(false); return; }
        fd.append('media', file);
      }
      const r = await api.post('/listening/content', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
      });
      refresh();
      openEditor(r.data);
    } catch (e) {
      if (e.data?.error === 'quota_exceeded') setNotice({ type: 'error', msg: e.data.message + (e.data.upgradeRequired ? ' Hãy nâng cấp Premium để tạo không giới hạn.' : '') });
      else setNotice({ type: 'error', msg: e.data?.error || e.message || 'Không thể tạo bài nghe.' });
    } finally { setBusy(false); }
  };

  const openEditor = async (item) => {
    try {
      const r = await api.get(`/listening/content/${item.id}`);
      setCurrent(r.data);
      setRows(segsToRows(r.data.segments));
      setNotice(null); setView('edit');
    } catch (e) { setNotice({ type: 'error', msg: e.data?.error || e.message }); }
  };
  // Nguồn media chưa có transcript → mở thẳng chế độ AI để thấy nút chép lời; TTS đã có
  // transcript sẵn → mở bảng dòng (manual).
  const editorMode = (c) => ((c?.content_url || c?.audio_url) && !(c?.segments?.length) && c?.source_type !== 'tts') ? 'ai' : 'manual';

  const openPlayer = async (item) => {
    try {
      const r = await api.get(`/listening/content/${item.id}`);
      setCurrent(r.data); setView('play');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setNotice({ type: 'error', msg: e.data?.error || e.message }); }
  };

  const saveEdit = async () => {
    const { segments, error } = rowsToSegments(rows);
    if (error) { setNotice({ type: 'error', msg: error }); return; }
    setBusy(true); setNotice(null);
    try {
      await api.put(`/listening/content/${current.id}`, {
        title: current.title, title_vi: current.title_vi, level: current.level,
        transcript: segments.map(s => s.parts.map(p => p.text).join(' ')).join('\n'),
        segments,
      });
      refresh(); setView('list'); setCurrent(null);
    } catch (e) { setNotice({ type: 'error', msg: e.data?.error || e.message }); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!await confirm('Xóa bài nghe này?')) return;
    await api.delete(`/listening/content/${id}`);
    setItems(prev => prev.filter(a => a.id !== id));
    refresh();
  };

  const BackBtn = ({ label = 'Danh sách' }) => (
    <button onClick={() => { setView('list'); setCurrent(null); }} className="text-sm text-on-muted hover:text-tsubaki-red flex items-center gap-1">
      <span className="material-symbols-outlined text-base">arrow_back</span> {label}
    </button>
  );

  // ── Play ──
  if (view === 'play' && current) {
    return (
      <div className="space-y-4">
        <BackBtn />
        <div className="glass-card rounded-2xl p-3">
          <p className="font-bold text-lg mb-2">{current.title}</p>
          <div className="rounded-xl overflow-hidden">
            <SyncedVideoTranscript
              videoUrl={current.content_url || current.audio_url}
              audio={!current.content_url}
              segments={current.segments || []}
              title={current.title}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Edit ──
  if (view === 'edit' && current) {
    const mediaUrl = current.content_url || current.audio_url;
    const yt = isYouTube(current.content_url);
    const isVideo = current.source_type === 'video' || (current.content_url && !yt);
    return (
      <div className="space-y-4">
        <BackBtn />
        {notice?.msg && <div className={`text-sm rounded-xl px-3 py-2 ${NOTICE_STYLE[notice.type] || NOTICE_STYLE.error}`}>{notice.msg}</div>}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-on-muted">Tên bài nghe</label>
              <input value={current.title || ''} onChange={e => setCurrent(c => ({ ...c, title: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted">Cấp độ</label>
              <select value={current.level || 'N5'} onChange={e => setCurrent(c => ({ ...c, level: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm bg-white outline-none focus:border-tsubaki-red">
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {mediaUrl && (yt
            ? <div className="aspect-video rounded-xl overflow-hidden border border-outline/30">
                <iframe src={ytEmbed(current.content_url)} title={current.title} className="w-full h-full" allowFullScreen />
              </div>
            : isVideo
              ? <video ref={previewRef} src={mediaUrl} controls className="w-full rounded-xl max-h-56" />
              : <audio ref={previewRef} src={mediaUrl} controls className="w-full" />)}

          <TranscriptSegmentsEditor
            rows={rows}
            setRows={setRows}
            isYouTube={yt}
            simple={!admin}
            defaultMode={editorMode(current)}
            previewMediaRef={previewRef}
            canTranscribe={!!mediaUrl}
            onAlert={setNotice}
            onTranscribe={mediaUrl ? (async (signal) => (await api.post(`/listening/content/${current.id}/transcribe`, {}, { signal, timeout: 900000 })).data) : null}
            onAiResult={(segs) => setRows(segsToRows(segs))}
          />
          <Button onClick={saveEdit} loading={busy} disabled={busy} className="w-full">Lưu bài nghe</Button>
        </div>
      </div>
    );
  }

  // ── Create ──
  if (view === 'create') {
    return (
      <div className="space-y-4">
        <BackBtn />
        {notice?.msg && <div className={`text-sm rounded-xl px-3 py-2 ${NOTICE_STYLE[notice.type] || NOTICE_STYLE.error}`}>{notice.msg}</div>}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-on-muted mb-1 block">Nguồn tạo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SOURCES.map(s => (
                <button key={s.key} type="button" onClick={() => pickSource(s.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors ${form.source_type === s.key ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red'}`}>
                  <span className="material-symbols-outlined text-xl">{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-on-muted">Tên bài nghe</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="VD: Hội thoại quán cà phê"
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
            </div>
            <div>
              <label className="text-xs font-semibold text-on-muted">Cấp độ</label>
              <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm bg-white outline-none focus:border-tsubaki-red">
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {form.source_type === 'tts' && (
            <div>
              <label className="text-xs font-semibold text-on-muted">Lời thoại (mỗi câu 1 dòng; nhãn 男：/女： để đổi giọng)</label>
              <textarea value={form.tts_text} onChange={e => setForm(f => ({ ...f, tts_text: e.target.value }))} rows={6}
                placeholder={'男：おはようございます。\n女：おはよう、今日はいい天気ですね。'}
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red resize-none" />
              <p className="text-xs text-on-muted mt-1">Web sẽ đọc thành audio và tự tạo timestamp từng câu.</p>
            </div>
          )}
          {form.source_type === 'youtube' && (
            <div>
              <label className="text-xs font-semibold text-on-muted">Link YouTube</label>
              <input type="url" value={form.youtube_url} onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full mt-1 px-3 py-2 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red" />
              {ytEmbed(form.youtube_url) ? (
                <div className="mt-2 aspect-video rounded-xl overflow-hidden border border-outline/30">
                  <iframe src={ytEmbed(form.youtube_url)} title="Xem trước" className="w-full h-full" allowFullScreen />
                </div>
              ) : (
                <p className="text-xs text-on-muted mt-1">Chỉ dùng video công khai. Dán link hợp lệ để xem trước; sau khi tạo, bấm "Tự động chép lời (AI)".</p>
              )}
            </div>
          )}
          {(form.source_type === 'audio' || form.source_type === 'video') && (
            <div>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${fileName ? 'border-tsubaki-red/60 bg-tsubaki-red/5' : 'border-outline hover:border-tsubaki-red/40'}`} onClick={() => fileRef.current?.click()}>
                <span className="material-symbols-outlined text-3xl text-on-muted/40 block mb-2">{fileName ? 'check_circle' : form.source_type === 'audio' ? 'audio_file' : 'movie'}</span>
                {fileName ? (
                  <p className="text-sm font-semibold text-tsubaki-red truncate">{fileName}</p>
                ) : (
                  <p className="text-sm text-on-muted">Chọn file {form.source_type === 'audio' ? 'âm thanh' : 'video (MP4/WebM)'}</p>
                )}
                <p className="text-xs text-on-muted/60 mt-1">{fileName ? 'Bấm để chọn file khác' : 'Tối đa 50MB'}</p>
                <input ref={fileRef} type="file" accept={form.source_type === 'audio' ? 'audio/*' : 'video/mp4,video/webm'}
                  onChange={e => setFileName(e.target.files?.[0]?.name || '')} className="hidden" />
              </div>
              <p className="text-xs text-on-muted mt-1">Sau khi tạo, bấm "Tự động chép lời (AI)" ở bước sau để sinh transcript.</p>
            </div>
          )}
          <Button onClick={submitCreate} loading={busy}
            disabled={busy || (form.source_type === 'youtube' && !ytEmbed(form.youtube_url))}
            className="w-full">
            {busy ? 'Đang xử lý...' : 'Tạo & chỉnh sửa transcript'}
          </Button>
        </div>
      </div>
    );
  }

  // ── List ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-on-muted">
          {admin ? 'Bài nghe media công khai (TTS / audio / video / YouTube).' : 'Bài nghe riêng của bạn (TTS / audio / video / YouTube).'}
          {!admin && quota && quota.limit !== -1 && <> Còn <strong>{Math.max(0, quota.remaining)}/{quota.limit}</strong> lượt tạo tháng này.</>}
        </p>
        <button onClick={startCreate} disabled={outOfQuota}
          className="flex items-center gap-1.5 px-4 py-2 bg-tsubaki-red text-white text-sm font-semibold rounded-xl disabled:opacity-50 shrink-0">
          <span className="material-symbols-outlined text-base">add</span> Tạo bài nghe
        </button>
      </div>
      {outOfQuota && (
        <div className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
          Đã hết lượt tạo trong tháng. <a href="/subscription" className="font-semibold underline">Nâng cấp Premium</a> để tạo không giới hạn.
        </div>
      )}

      {loading && <div className="space-y-3">{[1, 2].map(i => <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />)}</div>}
      {!loading && items.length === 0 && (
        <div className="glass-card rounded-2xl py-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-muted/20 block mb-2">graphic_eq</span>
          <p className="text-sm text-on-muted">Chưa có bài nghe nào. Bấm "Tạo bài nghe" để bắt đầu.</p>
        </div>
      )}
      <div className="space-y-2">
        {items.map(a => (
          <ContentCard key={a.id} item={a}
            onClick={() => onOpen ? onOpen(a) : openPlayer(a)}
            onEdit={() => openEditor(a)}
            onDelete={() => remove(a.id)} />
        ))}
      </div>
    </div>
  );
}
