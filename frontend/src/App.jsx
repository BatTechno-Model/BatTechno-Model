import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { ToastProvider } from './context/ToastContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Students from './pages/Students';
import CreateStudent from './pages/CreateStudent';
import EditStudent from './pages/EditStudent';
import Sessions from './pages/Sessions';
import CreateSession from './pages/CreateSession';
import EditSession from './pages/EditSession';
import AttendanceSheet from './pages/AttendanceSheet';
import Attendance from './pages/Attendance';
import Assignments from './pages/Assignments';
import AssignmentDetail from './pages/AssignmentDetail';
import CreateAssignment from './pages/CreateAssignment';
import EditAssignment from './pages/EditAssignment';
import SubmitAssignment from './pages/SubmitAssignment';
import ReviewSubmission from './pages/ReviewSubmission';
import Profile from './pages/Profile';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/courses"
          element={
            <ProtectedRoute>
              <Layout>
                <Courses />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <CourseDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/students"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <Students />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/students/create"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <CreateStudent />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/students/edit/:id"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <EditStudent />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/sessions/:courseId"
          element={
            <ProtectedRoute>
              <Layout>
                <Sessions />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/sessions/:courseId/create"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <CreateSession />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/sessions/:courseId/edit/:sessionId"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <EditSession />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Layout>
                <Attendance />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/attendance/:sessionId"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <AttendanceSheet />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <Layout>
                <Assignments />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <AssignmentDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments/create"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <CreateAssignment />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments/:id/edit"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <EditAssignment />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments/:id/submit"
          element={
            <ProtectedRoute requireRole={['STUDENT']}>
              <Layout>
                <SubmitAssignment />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/assignments/:id/submissions/:submissionId/review"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <ReviewSubmission />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/submissions/:id/review"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'INSTRUCTOR']}>
              <Layout>
                <ReviewSubmission />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
