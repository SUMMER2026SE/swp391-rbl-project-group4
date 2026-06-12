import TeacherLayout from '../../components/layout/TeacherLayout';
import DictionaryView from '../shared/DictionaryView';
import { useLang } from '../../contexts/LangContext';

export default function TeacherDictionary() {
  const { t } = useLang();
  return (
    <TeacherLayout title={t('dictionary.title')}>
      <DictionaryView />
    </TeacherLayout>
  );
}
