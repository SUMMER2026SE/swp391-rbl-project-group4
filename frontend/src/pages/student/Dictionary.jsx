import StudentLayout from '../../components/layout/StudentLayout';
import DictionaryView from '../shared/DictionaryView';
import { useLang } from '../../contexts/LangContext';

export default function Dictionary() {
  const { t } = useLang();
  return (
    <StudentLayout title={t('dictionary.title')}>
      <DictionaryView />
    </StudentLayout>
  );
}
