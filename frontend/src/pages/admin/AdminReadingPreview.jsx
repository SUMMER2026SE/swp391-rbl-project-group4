import { useParams } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import ReadingList from '../student/ReadingList';
import ReadingReader from '../student/ReadingReader';

// Admin "Xem như học viên": tái dùng giao diện student nhưng fetch qua /admin/reading
// (không tốn quota, không tăng lượt xem) và khóa tương tác (quiz/từ vựng/chat AI).
export default function AdminReadingPreview() {
  const { id } = useParams();

  if (id) {
    return (
      <ReadingReader
        Layout={AdminLayout}
        apiBase="/admin/reading"
        listPath="/admin/reading/preview"
        preview
      />
    );
  }

  return (
    <ReadingList
      Layout={AdminLayout}
      apiBase="/admin/reading"
      linkBase="/admin/reading/preview"
      preview
    />
  );
}
