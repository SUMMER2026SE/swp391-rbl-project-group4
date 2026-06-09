import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './contexts/LangContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
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
import Kanji        from './pages/student/Kanji';
import Classes      from './pages/student/Classes';
import Quiz         from './pages/student/Quiz';

// Teacher pages
import TeacherDashboard  from './pages/teacher/TeacherDashboard';
import TeacherVocabulary from './pages/teacher/TeacherVocabulary';
import TeacherKanji      from './pages/teacher/TeacherKanji';
import TeacherClasses    from './pages/teacher/TeacherClasses';

// Admin pages
import AdminDashboard  from './pages/admin/AdminDashboard';
import AdminUsers      from './pages/admin/AdminUsers';
import AdminCourses    from './pages/admin/AdminCourses';
import AdminLessons    from './pages/admin/AdminLessons';
import AdminVocabulary from './pages/admin/AdminVocabulary';
import AdminKanji      from './pages/admin/AdminKanji';
import AdminQuizzes      from './pages/admin/AdminQuizzes';
import AdminSubmissions  from './pages/admin/AdminSubmissions';
import AdminClasses      from './pages/admin/AdminClasses';
import AdminSystemStatus  from './pages/admin/AdminSystemStatus';
import AdminQuestionBank       from './pages/admin/AdminQuestionBank';
import ManageCourseContent     from './pages/admin/ManageCourseContent';

import ChatPage from './pages/ChatPage';

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

            {/* Student (protected) */}
            <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile"    element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/courses"    element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/lessons/:id" element={<ProtectedRoute><LessonView /></ProtectedRoute>} />
            <Route path="/vocabulary" element={<ProtectedRoute><Vocabulary /></ProtectedRoute>} />
            <Route path="/kanji"      element={<ProtectedRoute><Kanji /></ProtectedRoute>} />
            <Route path="/classes"    element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            <Route path="/quizzes/:id" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/chat"       element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

            {/* Teacher (teacher + admin) */}
            <Route path="/teacher"       element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/vocab" element={<TeacherRoute><TeacherVocabulary /></TeacherRoute>} />
            <Route path="/teacher/kanji"    element={<TeacherRoute><TeacherKanji /></TeacherRoute>} />
            <Route path="/teacher/classes"  element={<TeacherRoute><TeacherClasses /></TeacherRoute>} />

            {/* Admin (admin only) */}
            <Route path="/admin"             element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users"       element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/courses"     element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/lessons"     element={<AdminRoute><AdminLessons /></AdminRoute>} />
            <Route path="/admin/vocabulary"  element={<AdminRoute><AdminVocabulary /></AdminRoute>} />
            <Route path="/admin/kanji"       element={<AdminRoute><AdminKanji /></AdminRoute>} />
            <Route path="/admin/quizzes"      element={<AdminRoute><AdminQuizzes /></AdminRoute>} />
            <Route path="/admin/submissions" element={<AdminRoute><AdminSubmissions /></AdminRoute>} />
            <Route path="/admin/classes"     element={<AdminRoute><AdminClasses /></AdminRoute>} />
            <Route path="/admin/system"     element={<AdminRoute><AdminSystemStatus /></AdminRoute>} />
            <Route path="/admin/questions"  element={<AdminRoute><AdminQuestionBank /></AdminRoute>} />
            <Route path="/admin/courses/:courseId/edit" element={<AdminRoute><ManageCourseContent /></AdminRoute>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
