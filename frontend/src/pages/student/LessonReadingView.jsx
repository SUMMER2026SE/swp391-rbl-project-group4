import { useParams } from 'react-router-dom';
import ReadingReader from './ReadingReader';

// Trang đọc của Mục "Bài đọc" trong khóa học — tái dùng nguyên ReadingReader
// (furigana, dịch từng câu, quiz, từ vựng/ngữ pháp, tra từ, trợ lý AI).
// apiBase="/lessons/reading" → GET /lessons/reading/:lessonId (quyền qua enrollment).
export default function LessonReadingView() {
  const { id } = useParams();
  return (
    <ReadingReader
      apiBase="/lessons/reading"
      listPath={`/lessons/${id}`}
      backLabel="Quay lại bài học"
    />
  );
}
