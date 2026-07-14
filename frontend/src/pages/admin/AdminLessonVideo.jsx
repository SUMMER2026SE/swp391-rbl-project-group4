import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEditorArea } from '../../lib/useEditorArea';
import Alert from '../../components/ui/Alert';
import LessonInfoPanel from '../../components/shared/LessonInfoPanel';
import api from '../../lib/api';

// Chuyển link YouTube thường sang dạng nhúng để xem trước.
function toEmbed(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return null;
}

// Trần upload mỗi file của Supabase gói free — phải khớp giới hạn multer + bucket lesson-videos ở backend.
const MAX_VIDEO_MB = 50;

export default function AdminLessonVideo() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { apiBase, Layout } = useEditorArea();

  const [lesson, setLesson]       = useState(null);
  const [contentUrl, setContentUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [sourceMode, setSourceMode] = useState('link'); // 'link' | 'upload'
  const [uploading, setUploading]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [alert, setAlert]         = useState({ type: '', msg: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`${apiBase}/lessons/${lessonId}`);
        setLesson(r.data);
        setContentUrl(r.data.content_url || '');
        setTranscript(r.data.transcript || '');
      } catch (e) {
        setAlert({ type: 'error', msg: e.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lessonId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${apiBase}/lessons/${lessonId}`, { content_url: contentUrl.trim() || null, transcript: transcript.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setAlert({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng file sau khi lỗi
    if (!file) return;
    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      setAlert({ type: 'error', msg: 'Chỉ chấp nhận file video MP4 hoặc WebM.' });
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setAlert({ type: 'error', msg: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa ${MAX_VIDEO_MB}MB.` });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', file);
      const r = await api.post(`${apiBase}/lessons/upload-video`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setContentUrl(r.data.url);
      setAlert({ type: 'success', msg: 'Đã tải video lên. Nhấn "Lưu nội dung" để lưu vào bài học.' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.error || err.message });
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (lesson?.course_id) navigate(`${apiBase}/courses/${lesson.course_id}/edit`);
    else navigate(`${apiBase}/courses`);
  };

  const embed = toEmbed(contentUrl);

  return (
    <Layout title="Soạn video">
      {alert.msg && (
        <Alert type={alert.type} onClose={() => setAlert({ type: '', msg: '' })} className="mb-5">{alert.msg}</Alert>
      )}

      <section className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={goBack} className="flex items-center gap-1 text-sm text-on-muted hover:text-tsubaki-red transition-colors mb-2">
            <span className="material-symbols-outlined text-base">arrow_back</span> Quay lại Course Builder
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-sumire-purple/10 text-sumire-purple px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">play_circle</span> Video
            </span>
          </div>
          <h1 className="font-display text-xl font-bold text-on-surface">{loading ? 'Đang tải...' : lesson?.title || 'Mục video'}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium animate-pulse">
              <span className="material-symbols-outlined text-base">check_circle</span> Đã lưu
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-tsubaki-red text-white rounded-xl text-sm font-medium hover:shadow-lg active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Đang lưu...' : 'Lưu nội dung'}
          </button>
        </div>
      </section>

      <LessonInfoPanel lesson={lesson} apiBase={apiBase} onSaved={u => setLesson(l => ({ ...l, ...u }))} />

      <div className="bg-white rounded-2xl border border-outline/20 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Nguồn video *</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSourceMode('link')}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${sourceMode === 'link' ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red'}`}
            >
              Dán link YouTube/URL
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${sourceMode === 'upload' ? 'bg-tsubaki-red text-white border-tsubaki-red' : 'border-outline text-on-muted hover:border-tsubaki-red'}`}
            >
              Tải file video lên
            </button>
          </div>

          {sourceMode === 'link' ? (
            <>
              <input
                type="url"
                value={contentUrl}
                onChange={e => setContentUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors"
              />
              <p className="text-xs text-on-muted mt-1">Hỗ trợ link YouTube hoặc URL video trực tiếp (.mp4).</p>
            </>
          ) : (
            <>
              <label className={`flex items-center justify-center gap-2 w-full px-4 py-6 border-2 border-dashed border-outline rounded-xl text-sm text-on-muted transition-colors ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:border-tsubaki-red hover:text-tsubaki-red'}`}>
                <span className="material-symbols-outlined text-base">{uploading ? 'hourglass_empty' : 'upload_file'}</span>
                {uploading ? 'Đang tải video lên...' : 'Chọn file video (MP4/WebM)'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-on-muted mt-1">Định dạng MP4 hoặc WebM, tối đa {MAX_VIDEO_MB}MB. Sau khi tải lên, URL sẽ được điền tự động.</p>
            </>
          )}
        </div>

        {/* Preview */}
        {contentUrl && (
          <div className="rounded-xl overflow-hidden border border-outline/20 bg-black/5 aspect-video">
            {embed ? (
              <iframe src={embed} title="preview" className="w-full h-full" allowFullScreen />
            ) : (
              <video src={contentUrl} controls className="w-full h-full" />
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-on-muted mb-1">Transcript / Ghi chú (tuỳ chọn)</label>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={8}
            placeholder="Lời thoại hoặc ghi chú nội dung video..."
            className="w-full px-4 py-3 border border-outline rounded-xl text-sm outline-none focus:border-tsubaki-red transition-colors resize-none"
          />
        </div>
      </div>
    </Layout>
  );
}
