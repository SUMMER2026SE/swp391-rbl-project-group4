import StudentLayout from '../../components/layout/StudentLayout';
import StudyListPreview from '../../components/shared/StudyListPreview';
import { useLang } from '../../contexts/LangContext';

export default function Vocabulary() {
  const { t } = useLang();

  return (
    <StudentLayout title={t('vocab.title')}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">{t('vocab.title')}</h1>
      </div>

      <StudyListPreview type="vocabulary" />
    </StudentLayout>
  );
}
