import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import StudentRoute from './components/shared/StudentRoute';
import AdminRoute from './components/shared/AdminRoute';
import TeacherRoute from './components/shared/TeacherRoute';

// Public pages
import Home           from './pages/public/Home';
import Login          from './pages/public/Login';
import Register       from './pages/public/Register';
import ForgotPassword from './pages/public/ForgotPassword';
import ResetPassword  from './pages/public/ResetPassword';

// Student pages
import Dashboard    from './pages/student/Dashboard';
import Profile      from './pages/student/Profile';
import Courses      from './pages/student/Courses';
import CourseDetail from './pages/student/CourseDetail';
import LessonView   from './pages/student/LessonView';
import Vocabulary   from './pages/student/Vocabulary';
import Grammar      from './pages/student/Grammar';
import Kanji        from './pages/student/Kanji';
import KanjiWriting from './pages/student/KanjiWriting';
import Writing      from './pages/student/Writing';
import Listening            from './pages/student/Listening';
import PlacementTest        from './pages/student/PlacementTest';
import Pricing              from './pages/student/Pricing';
import SubscriptionStatus   from './pages/student/SubscriptionStatus';
import BillingHistory       from './pages/student/BillingHistory';
import Classes      from './pages/student/Classes';
import Quiz         from './pages/student/Quiz';
import Dictionary   from './pages/student/Dictionary';
import NewsList     from './pages/student/NewsList';
import NewsReader   from './pages/student/NewsReader';
import Exams        from './pages/student/Exams';
import TakeExam     from './pages/student/TakeExam';
import MockExamList    from './pages/student/MockExamList';
import MockExamDetail  from './pages/student/MockExamDetail';
import MockExamRoom    from './pages/student/MockExamRoom';
import MockExamResult  from './pages/student/MockExamResult';
import MockExamReview  from './pages/student/MockExamReview';
import MockExamHistory from './pages/student/MockExamHistory';
import Flashcards            from './pages/student/Flashcards';
import FlashcardSetForm      from './pages/student/FlashcardSetForm';
import FlashcardStudy        from './pages/student/FlashcardStudy';
import FlashcardLearn        from './pages/student/FlashcardLearn';
import FlashcardTest         from './pages/student/FlashcardTest';
import FlashcardFolderDetail from './pages/student/FlashcardFolderDetail';
import StudyListBrowse from './pages/student/StudyListBrowse';
import StudyListDetail from './pages/student/StudyListDetail';
// Teacher pages
import TeacherDashboard  from './pages/teacher/TeacherDashboard';
import TeacherCourses    from './pages/teacher/TeacherCourses';
import TeacherCourseContent from './pages/teacher/TeacherCourseContent';
import UnitEditPage      from './pages/shared/UnitEditPage';
import TeacherVocabulary from './pages/teacher/TeacherVocabulary';
import TeacherKanji      from './pages/teacher/TeacherKanji';
import TeacherClasses    from './pages/teacher/TeacherClasses';
import TeacherDictionary from './pages/teacher/TeacherDictionary';
import TeacherQuestionBank from './pages/teacher/TeacherQuestionBank';
import TeacherExams      from './pages/teacher/TeacherExams';
import ExamEditor        from './pages/teacher/ExamEditor';
import TeacherStudyLists from './pages/teacher/TeacherStudyLists';
// Admin pages
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminUsers      from './pages/admin/AdminUsers';
import AdminCourses    from './pages/admin/AdminCourses';
import AdminVocabulary from './pages/admin/AdminVocabulary';
import AdminKanji      from './pages/admin/AdminKanji';
import AdminQuizzes      from './pages/admin/AdminQuizzes';
import AdminSubmissions  from './pages/admin/AdminSubmissions';
import AdminClasses      from './pages/admin/AdminClasses';
import AdminSystemStatus  from './pages/admin/AdminSystemStatus';
import AdminQuestionBank       from './pages/admin/AdminQuestionBank';
import AdminMockExams          from './pages/admin/AdminMockExams';
import AdminMockExamEditor     from './pages/admin/AdminMockExamEditor';
import AdminNews               from './pages/admin/AdminNews';
import AdminListening               from './pages/admin/AdminListening';
import AdminPlacementQuestions      from './pages/admin/AdminPlacementQuestions';
import AdminSubscriptions           from './pages/admin/AdminSubscriptions';
import AdminPayments                from './pages/admin/AdminPayments';
import ManageCourseContent     from './pages/admin/ManageCourseContent';
import AdminLessonVocabulary   from './pages/admin/AdminLessonVocabulary';
import AdminGrammar            from './pages/admin/AdminGrammar';
import AdminLessonGrammar      from './pages/admin/AdminLessonGrammar';
import AdminLessonQuiz         from './pages/admin/AdminLessonQuiz';
import AdminLessonReading      from './pages/admin/AdminLessonReading';
import AdminLessonKanji        from './pages/admin/AdminLessonKanji';
import AdminLessonVideo        from './pages/admin/AdminLessonVideo';
import AdminGrammarPoints      from './pages/admin/AdminGrammarPoints';

import ChatPage from './pages/ChatPage';
import ClassBoard from './pages/ClassBoard';

// 404
function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-center p-6">
      <p className="text-9xl font-bold text-tsubaki-red/10 leading-none select-none">404</p>
      <h1 className="font-display text-3xl font-bold -mt-8 mb-3">Trang không tồn tại</h1>
      <p className="text-on-muted mb-6">Có lẽ trang bạn tìm đã bay lên bầu trời rồi.</p>
      <a href="/" className="bg-tsubaki-red text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-all">Về trang chủ</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/"                element={<Home />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Student only — admin/teacher bị chuyển về dashboard riêng */}
            <Route path="/dashboard"  element={<StudentRoute><Dashboard /></StudentRoute>} />
            <Route path="/courses"    element={<StudentRoute><Courses /></StudentRoute>} />
            <Route path="/courses/:id" element={<StudentRoute><CourseDetail /></StudentRoute>} />
            <Route path="/lessons/:id" element={<StudentRoute><LessonView /></StudentRoute>} />
            <Route path="/vocabulary" element={<StudentRoute><Vocabulary /></StudentRoute>} />
            <Route path="/grammar"    element={<StudentRoute><Grammar /></StudentRoute>} />
            <Route path="/kanji"      element={<StudentRoute><Kanji /></StudentRoute>} />
            <Route path="/kanji/writing" element={<StudentRoute><KanjiWriting /></StudentRoute>} />
            <Route path="/study-lists/:type"     element={<StudentRoute><StudyListBrowse /></StudentRoute>} />
            <Route path="/study-lists/:type/:id" element={<StudentRoute><StudyListDetail /></StudentRoute>} />
            <Route path="/writing"    element={<StudentRoute><Writing /></StudentRoute>} />
            <Route path="/listening"       element={<StudentRoute><Listening /></StudentRoute>} />
            <Route path="/placement-test" element={<StudentRoute><PlacementTest /></StudentRoute>} />
            <Route path="/pricing"        element={<StudentRoute><Pricing /></StudentRoute>} />
            <Route path="/subscription"   element={<StudentRoute><SubscriptionStatus /></StudentRoute>} />
            <Route path="/billing"        element={<StudentRoute><BillingHistory /></StudentRoute>} />
            <Route path="/classes"    element={<StudentRoute><Classes /></StudentRoute>} />
            <Route path="/quizzes/:id" element={<StudentRoute><Quiz /></StudentRoute>} />
            <Route path="/dictionary" element={<StudentRoute><Dictionary /></StudentRoute>} />
            <Route path="/news"       element={<StudentRoute><NewsList /></StudentRoute>} />
            <Route path="/news/:id"   element={<StudentRoute><NewsReader /></StudentRoute>} />
            <Route path="/exams"      element={<StudentRoute><Exams /></StudentRoute>} />
            <Route path="/exams/:assignmentId" element={<StudentRoute><TakeExam /></StudentRoute>} />
            <Route path="/mock-exams"          element={<StudentRoute><MockExamList /></StudentRoute>} />
            <Route path="/mock-exams/history"  element={<StudentRoute><MockExamHistory /></StudentRoute>} />
            <Route path="/mock-exams/:id"      element={<StudentRoute><MockExamDetail /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId"        element={<StudentRoute><MockExamRoom /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId/result" element={<StudentRoute><MockExamResult /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId/review" element={<StudentRoute><MockExamReview /></StudentRoute>} />
            <Route path="/flashcards"             element={<StudentRoute><Flashcards /></StudentRoute>} />
            <Route path="/flashcards/new"         element={<StudentRoute><FlashcardSetForm /></StudentRoute>} />
            <Route path="/flashcards/folders/:id" element={<StudentRoute><FlashcardFolderDetail /></StudentRoute>} />
            <Route path="/flashcards/:id/edit"    element={<StudentRoute><FlashcardSetForm /></StudentRoute>} />
            <Route path="/flashcards/:id/learn"   element={<StudentRoute><FlashcardLearn /></StudentRoute>} />
            <Route path="/flashcards/:id/test"    element={<StudentRoute><FlashcardTest /></StudentRoute>} />
            <Route path="/flashcards/:id"         element={<StudentRoute><FlashcardStudy /></StudentRoute>} />
            {/* Dùng chung mọi role (layout hiển thị theo role) */}
            <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/chat"       element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/classes/:id" element={<ProtectedRoute><ClassBoard /></ProtectedRoute>} />

            {/* Teacher (teacher + admin) */}
            <Route path="/teacher"       element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/courses" element={<TeacherRoute><TeacherCourses /></TeacherRoute>} />
            <Route path="/teacher/courses/:courseId/edit" element={<TeacherRoute><TeacherCourseContent /></TeacherRoute>} />
            <Route path="/teacher/courses/:courseId/units/:unitId/edit" element={<TeacherRoute><UnitEditPage /></TeacherRoute>} />
            {/* Trình soạn chuyên sâu cho giáo viên — dùng chung component với admin (role-aware) */}
            <Route path="/teacher/lessons/:lessonId/video"      element={<TeacherRoute><AdminLessonVideo /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/reading"    element={<TeacherRoute><AdminLessonReading /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/grammar"    element={<TeacherRoute><AdminLessonGrammar /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/vocabulary" element={<TeacherRoute><AdminLessonVocabulary /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/kanji"      element={<TeacherRoute><AdminLessonKanji /></TeacherRoute>} />
            <Route path="/teacher/vocab" element={<TeacherRoute><TeacherVocabulary /></TeacherRoute>} />
            <Route path="/teacher/kanji"    element={<TeacherRoute><TeacherKanji /></TeacherRoute>} />
            <Route path="/teacher/study-lists" element={<TeacherRoute><TeacherStudyLists /></TeacherRoute>} />
            <Route path="/teacher/classes"  element={<TeacherRoute><TeacherClasses /></TeacherRoute>} />
            <Route path="/teacher/dictionary" element={<TeacherRoute><TeacherDictionary /></TeacherRoute>} />
            <Route path="/teacher/question-bank" element={<TeacherRoute><TeacherQuestionBank /></TeacherRoute>} />
            <Route path="/teacher/quizzes"       element={<TeacherRoute><TeacherExams /></TeacherRoute>} />
            <Route path="/teacher/quizzes/:id"   element={<TeacherRoute><ExamEditor /></TeacherRoute>} />
            {/* Admin (admin only) */}
            <Route path="/admin"             element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users"       element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/courses"     element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/vocabulary"  element={<AdminRoute><AdminVocabulary /></AdminRoute>} />
            <Route path="/admin/grammar"    element={<AdminRoute><AdminGrammar /></AdminRoute>} />
            <Route path="/admin/kanji"       element={<AdminRoute><AdminKanji /></AdminRoute>} />
            <Route path="/admin/grammar-points" element={<AdminRoute><AdminGrammarPoints /></AdminRoute>} />
            <Route path="/admin/quizzes"      element={<AdminRoute><AdminQuizzes /></AdminRoute>} />
            <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissions /></AdminRoute>} />
            <Route path="/admin/classes"     element={<AdminRoute><AdminClasses /></AdminRoute>} />
            <Route path="/admin/system"     element={<AdminRoute><AdminSystemStatus /></AdminRoute>} />
            <Route path="/admin/questions"  element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
            <Route path="/admin/mock-exams"     element={<AdminRoute><AdminMockExams /></AdminRoute>} />
            <Route path="/admin/mock-exams/:id" element={<AdminRoute><AdminMockExamEditor /></AdminRoute>} />
            <Route path="/admin/news"       element={<AdminRoute><AdminNews /></AdminRoute>} />
            <Route path="/admin/listening"         element={<AdminRoute><AdminListening /></AdminRoute>} />
            <Route path="/admin/placement"       element={<AdminRoute><AdminPlacementQuestions /></AdminRoute>} />
            <Route path="/admin/subscriptions"   element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
            <Route path="/admin/payments"        element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/courses/:courseId/edit"         element={<AdminRoute><ManageCourseContent /></AdminRoute>} />
            <Route path="/admin/courses/:courseId/units/:unitId/edit" element={<AdminRoute><UnitEditPage /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/vocabulary"  element={<AdminRoute><AdminLessonVocabulary /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/grammar"     element={<AdminRoute><AdminLessonGrammar /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/quiz"        element={<AdminRoute><AdminLessonQuiz /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/reading"     element={<AdminRoute><AdminLessonReading /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/kanji"       element={<AdminRoute><AdminLessonKanji /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/video"       element={<AdminRoute><AdminLessonVideo /></AdminRoute>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
