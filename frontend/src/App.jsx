import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import { PageContextProvider } from './contexts/PageContext';
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
import MyCoursePurchases     from './pages/student/MyCoursePurchases';
// import Classes      from './pages/student/Classes'; // HIDDEN
import Quiz         from './pages/student/Quiz';
import Dictionary   from './pages/student/Dictionary';
import ReadingList   from './pages/student/ReadingList';
import ReadingReader from './pages/student/ReadingReader';
import LessonReadingView from './pages/student/LessonReadingView';
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
import FlashcardTest         from './pages/student/FlashcardTest';
import FlashcardFolderDetail from './pages/student/FlashcardFolderDetail';
import StudyListDetail from './pages/student/StudyListDetail';
import StudyListItemDetail from './pages/student/StudyListItemDetail';
import LearningPath from './pages/student/LearningPath';
import TeacherApplication from './pages/public/TeacherApplication';
// Teacher pages
import TeacherDashboard  from './pages/teacher/TeacherDashboard';
import TeacherCourses    from './pages/teacher/TeacherCourses';
import TeacherCoursePreview from './pages/teacher/TeacherCoursePreview';
import TeacherLessonPreview from './pages/teacher/TeacherLessonPreview';
import TeacherLessonReadingView from './pages/teacher/TeacherLessonReadingView';
import TeacherQuizPreview from './pages/teacher/TeacherQuizPreview';
import TeacherCourseContent from './pages/teacher/TeacherCourseContent';
import UnitEditPage      from './pages/shared/UnitEditPage';
import TeacherVocabulary from './pages/teacher/TeacherVocabulary';
import TeacherKanji      from './pages/teacher/TeacherKanji';
import TeacherGrammar    from './pages/teacher/TeacherGrammar';
// import TeacherClasses    from './pages/teacher/TeacherClasses'; // HIDDEN
import TeacherDictionary from './pages/teacher/TeacherDictionary';
import TeacherQuestionBank from './pages/teacher/TeacherQuestionBank';
import TeacherExams      from './pages/teacher/TeacherExams';
import ExamEditor        from './pages/teacher/ExamEditor';
import TeacherStudyLists from './pages/teacher/TeacherStudyLists';
import TeacherListening  from './pages/teacher/TeacherListening';
import TeacherEarnings   from './pages/teacher/TeacherEarnings';
// Admin pages
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminUsers      from './pages/admin/AdminUsers';
import AdminCourses    from './pages/admin/AdminCourses';
import AdminCoursePreview from './pages/admin/AdminCoursePreview';
import AdminLessonPreview from './pages/admin/AdminLessonPreview';
import AdminLessonReadingView from './pages/admin/AdminLessonReadingView';
import AdminQuizPreview from './pages/admin/AdminQuizPreview';
import AdminVocabulary from './pages/admin/AdminVocabulary';
import AdminKanji      from './pages/admin/AdminKanji';
import AdminQuizzes      from './pages/admin/AdminQuizzes';
import AdminSubmissions  from './pages/admin/AdminSubmissions';
import AdminTeacherApplications from './pages/admin/AdminTeacherApplications';
// import AdminClasses      from './pages/admin/AdminClasses'; // HIDDEN
import AdminSystemStatus  from './pages/admin/AdminSystemStatus';
import AdminQuestionBank       from './pages/admin/AdminQuestionBank';
import AdminMockExams          from './pages/admin/AdminMockExams';
import AdminJlptBank           from './pages/admin/AdminJlptBank';
import AdminRevenuePool        from './pages/admin/AdminRevenuePool';
import AdminMockExamEditor     from './pages/admin/AdminMockExamEditor';
import AdminReading            from './pages/admin/AdminReading';
import AdminReadingPreview     from './pages/admin/AdminReadingPreview';
import AdminListening               from './pages/admin/AdminListening';
import AdminPlacementQuestions      from './pages/admin/AdminPlacementQuestions';
import AdminSubscriptions           from './pages/admin/AdminSubscriptions';
import AdminPayments                from './pages/admin/AdminPayments';
import ManageCourseContent     from './pages/admin/ManageCourseContent';
import AdminLessonVocabulary   from './pages/admin/AdminLessonVocabulary';
import AdminStudyLists         from './pages/admin/AdminStudyLists';
import AdminLessonQuiz         from './pages/admin/AdminLessonQuiz';
import AdminLessonReading      from './pages/admin/AdminLessonReading';
import AdminLessonKanji        from './pages/admin/AdminLessonKanji';
import AdminLessonVideo        from './pages/admin/AdminLessonVideo';
import AdminLessonGrammar      from './pages/admin/AdminLessonGrammar';
import AdminLessonGrammarItem  from './pages/admin/AdminLessonGrammarItem';
import LessonGrammarItemDetail from './pages/student/LessonGrammarItemDetail';
import AdminGrammarPoints      from './pages/admin/AdminGrammarPoints';

import ChatPage from './pages/ChatPage';
import AiAssistantBubble from './components/ai/AiAssistantBubble';
// import ClassBoard from './pages/ClassBoard'; // HIDDEN

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
          <PageContextProvider>
          <Routes>
            {/* Public */}
            <Route path="/"                element={<Home />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Student only — admin/teacher bị chuyển về dashboard riêng */}
            <Route path="/dashboard"  element={<StudentRoute><Dashboard /></StudentRoute>} />
            {/* allowAdmin: admin vào xem/học khóa học như học sinh thật (miễn thanh toán) */}
            <Route path="/courses"    element={<StudentRoute allowAdmin><Courses /></StudentRoute>} />
            <Route path="/courses/:id" element={<StudentRoute adminRedirectTo="/admin/courses/preview/:id"><CourseDetail /></StudentRoute>} />
            <Route path="/lessons/:id" element={<StudentRoute adminRedirectTo="/admin/lessons/preview/:id" teacherRedirectTo="/teacher/lessons/preview/:id"><LessonView /></StudentRoute>} />
            <Route path="/lessons/:id/reading" element={<StudentRoute adminRedirectTo="/admin/lessons/:id/reading-view" teacherRedirectTo="/teacher/lessons/:id/reading-view"><LessonReadingView /></StudentRoute>} />
            <Route path="/lessons/:lessonId/grammar/:itemId" element={<StudentRoute allowAdmin><LessonGrammarItemDetail /></StudentRoute>} />
            <Route path="/vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
            <Route path="/grammar"    element={<ProtectedRoute><Grammar /></ProtectedRoute>} />
            <Route path="/kanji"      element={<ProtectedRoute><Kanji /></ProtectedRoute>} />
            <Route path="/kanji/writing" element={<StudentRoute><KanjiWriting /></StudentRoute>} />
            <Route path="/study-lists/:type/:id" element={<ProtectedRoute><StudyListDetail /></ProtectedRoute>} />
            <Route path="/study-lists/:type/:id/:itemId" element={<ProtectedRoute><StudyListItemDetail /></ProtectedRoute>} />
            <Route path="/writing"    element={<StudentRoute><Writing /></StudentRoute>} />
            <Route path="/listening"       element={<StudentRoute><Listening /></StudentRoute>} />
            <Route path="/placement-test" element={<StudentRoute><PlacementTest /></StudentRoute>} />
            <Route path="/learning-path"  element={<StudentRoute><LearningPath /></StudentRoute>} />
            <Route path="/pricing"        element={<StudentRoute><Pricing /></StudentRoute>} />
            <Route path="/subscription"   element={<StudentRoute><SubscriptionStatus /></StudentRoute>} />
            <Route path="/billing"        element={<StudentRoute><BillingHistory /></StudentRoute>} />
            <Route path="/my-purchases"   element={<StudentRoute><MyCoursePurchases /></StudentRoute>} />
            {/* <Route path="/classes"    element={<StudentRoute><Classes /></StudentRoute>} /> */}{/* HIDDEN */}
            <Route path="/quizzes/:id" element={<StudentRoute adminRedirectTo="/admin/quizzes/preview/:id" teacherRedirectTo="/teacher/quizzes/preview/:id"><Quiz /></StudentRoute>} />
            <Route path="/dictionary" element={<StudentRoute><Dictionary /></StudentRoute>} />
            <Route path="/reading"     element={<StudentRoute><ReadingList /></StudentRoute>} />
            <Route path="/reading/:id" element={<StudentRoute><ReadingReader /></StudentRoute>} />
            <Route path="/exams"      element={<StudentRoute><Exams /></StudentRoute>} />
            <Route path="/exams/:assignmentId" element={<StudentRoute><TakeExam /></StudentRoute>} />
            <Route path="/mock-exams"          element={<StudentRoute allowTeacher><MockExamList /></StudentRoute>} />
            <Route path="/mock-exams/history"  element={<StudentRoute allowTeacher><MockExamHistory /></StudentRoute>} />
            <Route path="/mock-exams/:id"      element={<StudentRoute allowTeacher><MockExamDetail /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId"        element={<StudentRoute allowTeacher><MockExamRoom /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId/result" element={<StudentRoute allowTeacher><MockExamResult /></StudentRoute>} />
            <Route path="/mock-exams/attempt/:attemptId/review" element={<StudentRoute allowTeacher><MockExamReview /></StudentRoute>} />
            <Route path="/flashcards"             element={<StudentRoute><Flashcards /></StudentRoute>} />
            <Route path="/flashcards/new"         element={<StudentRoute><FlashcardSetForm /></StudentRoute>} />
            <Route path="/flashcards/folders/:id" element={<StudentRoute><FlashcardFolderDetail /></StudentRoute>} />
            <Route path="/flashcards/:id/edit"    element={<StudentRoute><FlashcardSetForm /></StudentRoute>} />
            <Route path="/flashcards/:id/test"    element={<StudentRoute><FlashcardTest /></StudentRoute>} />
            <Route path="/flashcards/:id"         element={<StudentRoute><FlashcardStudy /></StudentRoute>} />
            {/* Dùng chung mọi role (layout hiển thị theo role) */}
            <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/chat"       element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/teacher-application" element={<ProtectedRoute><TeacherApplication /></ProtectedRoute>} />
            {/* <Route path="/classes/:id" element={<ProtectedRoute><ClassBoard /></ProtectedRoute>} /> */}{/* HIDDEN */}

            {/* Teacher (teacher + admin) */}
            <Route path="/teacher"       element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/courses" element={<TeacherRoute><TeacherCourses /></TeacherRoute>} />
            <Route path="/teacher/courses/preview/:id" element={<TeacherRoute><TeacherCoursePreview /></TeacherRoute>} />
            <Route path="/teacher/lessons/preview/:id" element={<TeacherRoute><TeacherLessonPreview /></TeacherRoute>} />
            <Route path="/teacher/lessons/:id/reading-view" element={<TeacherRoute><TeacherLessonReadingView /></TeacherRoute>} />
            <Route path="/teacher/quizzes/preview/:id" element={<TeacherRoute><TeacherQuizPreview /></TeacherRoute>} />
            <Route path="/teacher/courses/:courseId/edit" element={<TeacherRoute><TeacherCourseContent /></TeacherRoute>} />
            <Route path="/teacher/courses/:courseId/units/:unitId/edit" element={<TeacherRoute><UnitEditPage /></TeacherRoute>} />
            {/* Trình soạn chuyên sâu cho giáo viên — dùng chung component với admin (role-aware) */}
            <Route path="/teacher/lessons/:lessonId/video"      element={<TeacherRoute><AdminLessonVideo /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/reading"    element={<TeacherRoute><AdminLessonReading /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/vocabulary" element={<TeacherRoute><AdminLessonVocabulary /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/kanji"      element={<TeacherRoute><AdminLessonKanji /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/quiz"       element={<TeacherRoute><AdminLessonQuiz /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/grammar"    element={<TeacherRoute><AdminLessonGrammar /></TeacherRoute>} />
            <Route path="/teacher/lessons/:lessonId/grammar/:itemId" element={<TeacherRoute><AdminLessonGrammarItem /></TeacherRoute>} />
            <Route path="/teacher/vocab" element={<TeacherRoute><TeacherVocabulary /></TeacherRoute>} />
            <Route path="/teacher/kanji"    element={<TeacherRoute><TeacherKanji /></TeacherRoute>} />
            <Route path="/teacher/grammar"  element={<TeacherRoute><TeacherGrammar /></TeacherRoute>} />
            <Route path="/teacher/study-lists" element={<TeacherRoute><TeacherStudyLists /></TeacherRoute>} />
            <Route path="/teacher/listening" element={<TeacherRoute><TeacherListening /></TeacherRoute>} />
            <Route path="/teacher/earnings"  element={<TeacherRoute><TeacherEarnings /></TeacherRoute>} />
            {/* <Route path="/teacher/classes"  element={<TeacherRoute><TeacherClasses /></TeacherRoute>} /> */}{/* HIDDEN */}
            <Route path="/teacher/dictionary" element={<TeacherRoute><TeacherDictionary /></TeacherRoute>} />
            <Route path="/teacher/question-bank" element={<TeacherRoute><TeacherQuestionBank /></TeacherRoute>} />
            <Route path="/teacher/quizzes"       element={<TeacherRoute><TeacherExams /></TeacherRoute>} />
            <Route path="/teacher/quizzes/:id"   element={<TeacherRoute><ExamEditor /></TeacherRoute>} />
            {/* Admin (admin only) */}
            <Route path="/admin"             element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users"       element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/courses"     element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/courses/preview/:id" element={<AdminRoute><AdminCoursePreview /></AdminRoute>} />
            <Route path="/admin/lessons/preview/:id" element={<AdminRoute><AdminLessonPreview /></AdminRoute>} />
            <Route path="/admin/lessons/:id/reading-view" element={<AdminRoute><AdminLessonReadingView /></AdminRoute>} />
            <Route path="/admin/quizzes/preview/:id" element={<AdminRoute><AdminQuizPreview /></AdminRoute>} />
            <Route path="/admin/vocabulary"   element={<AdminRoute><AdminVocabulary /></AdminRoute>} />
            <Route path="/admin/study-lists" element={<AdminRoute><AdminStudyLists /></AdminRoute>} />
            <Route path="/admin/kanji"        element={<AdminRoute><AdminKanji /></AdminRoute>} />
            <Route path="/admin/grammar-points" element={<AdminRoute><AdminGrammarPoints /></AdminRoute>} />
            <Route path="/admin/quizzes"      element={<AdminRoute><AdminQuizzes /></AdminRoute>} />
            <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissions /></AdminRoute>} />
            <Route path="/admin/teacher-applications" element={<AdminRoute><AdminTeacherApplications /></AdminRoute>} />
            {/* <Route path="/admin/classes"     element={<AdminRoute><AdminClasses /></AdminRoute>} /> */}{/* HIDDEN */}
            <Route path="/admin/system"     element={<AdminRoute><AdminSystemStatus /></AdminRoute>} />
            <Route path="/admin/questions"  element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
            <Route path="/admin/mock-exams"     element={<AdminRoute><AdminMockExams /></AdminRoute>} />
            <Route path="/admin/jlpt-bank"      element={<AdminRoute><AdminJlptBank /></AdminRoute>} />
            <Route path="/admin/revenue-pool"   element={<AdminRoute><AdminRevenuePool /></AdminRoute>} />
            <Route path="/admin/mock-exams/:id" element={<AdminRoute><AdminMockExamEditor /></AdminRoute>} />
            <Route path="/admin/reading"                element={<AdminRoute><AdminReading /></AdminRoute>} />
            <Route path="/admin/reading/preview"        element={<AdminRoute><AdminReadingPreview /></AdminRoute>} />
            <Route path="/admin/reading/preview/:id"    element={<AdminRoute><AdminReadingPreview /></AdminRoute>} />
            <Route path="/admin/listening"         element={<AdminRoute><AdminListening /></AdminRoute>} />
            <Route path="/admin/placement"       element={<AdminRoute><AdminPlacementQuestions /></AdminRoute>} />
            <Route path="/admin/subscriptions"   element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
            <Route path="/admin/payments"        element={<AdminRoute><AdminPayments /></AdminRoute>} />
            <Route path="/admin/courses/:courseId/edit"         element={<AdminRoute><ManageCourseContent /></AdminRoute>} />
            <Route path="/admin/courses/:courseId/units/:unitId/edit" element={<AdminRoute><UnitEditPage /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/vocabulary"  element={<AdminRoute><AdminLessonVocabulary /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/quiz"        element={<AdminRoute><AdminLessonQuiz /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/reading"     element={<AdminRoute><AdminLessonReading /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/kanji"       element={<AdminRoute><AdminLessonKanji /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/video"       element={<AdminRoute><AdminLessonVideo /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/grammar"     element={<AdminRoute><AdminLessonGrammar /></AdminRoute>} />
            <Route path="/admin/lessons/:lessonId/grammar/:itemId" element={<AdminRoute><AdminLessonGrammarItem /></AdminRoute>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AiAssistantBubble />
          </PageContextProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
