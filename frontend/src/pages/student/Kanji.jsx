import { Link } from 'react-router-dom';
import StudentLayout from '../../components/layout/StudentLayout';
import StudyListPreview from '../../components/shared/StudyListPreview';

export default function Kanji() {
  return (
    <StudentLayout title="Kanji">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Kanji</h1>
        <Link to="/kanji/writing"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tsubaki-red text-white text-sm font-semibold hover:opacity-90 transition-all">
          <span className="material-symbols-outlined text-base">draw</span> Luyện viết
        </Link>
      </div>

      <StudyListPreview type="kanji" />
    </StudentLayout>
  );
}
