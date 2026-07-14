import StudentLayout from '../../components/layout/StudentLayout';
import StudyListPreview from '../../components/shared/StudyListPreview';

export default function Kanji() {
  return (
    <StudentLayout title="Kanji">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Kanji</h1>
      </div>

      <StudyListPreview type="kanji" />
    </StudentLayout>
  );
}
