import { ListeningManager } from '../admin/AdminListening';
import TeacherLayout from '../../components/layout/TeacherLayout';

const TEACHER_EP = {
  list: '/teacher/my-listening',
  create: '/teacher/my-listening',
  update: (id) => `/teacher/my-listening/${id}`,
  remove: (id) => `/teacher/my-listening/${id}`,
  addLine: (id) => `/teacher/my-listening/${id}/lines`,
  updateLine: (lineId) => `/teacher/my-listening/lines/${lineId}`,
  removeLine: (lineId) => `/teacher/my-listening/lines/${lineId}`,
};

export default function TeacherListening() {
  return <ListeningManager Layout={TeacherLayout} ep={TEACHER_EP} title="Luyện nghe của tôi" />;
}
