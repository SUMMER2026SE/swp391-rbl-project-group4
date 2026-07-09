import StudentLayout from '../../components/layout/StudentLayout';
import StudyListPreview from '../../components/shared/StudyListPreview';

export default function Grammar() {
  return (
    <StudentLayout title="Ngữ pháp">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Ngữ pháp</h1>
      </div>

      <StudyListPreview type="grammar" />
    </StudentLayout>
  );
}
