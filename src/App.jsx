import React, { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Layouts
import MainLayout from './layouts/MainLayout';

// Public & Core Pages (Lazy-loaded)
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Practice = lazy(() => import('./pages/Practice'));
const ProblemDetails = lazy(() => import('./pages/ProblemDetails'));
const Quiz = lazy(() => import('./pages/Quiz'));
const QuizResult = lazy(() => import('./pages/QuizResult'));

// Protected Pages (Lazy-loaded)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const QuizHistory = lazy(() => import('./pages/QuizHistory'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Diagnostic = lazy(() => import('./pages/Diagnostic'));
const DiagnosticReport = lazy(() => import('./pages/DiagnosticReport'));
const Roadmap = lazy(() => import('./pages/Roadmap'));

// Admin Pages (Lazy-loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const QuestionList = lazy(() => import('./pages/admin/QuestionList'));
const QuestionForm = lazy(() => import('./pages/admin/QuestionForm'));
const QuizManagement = lazy(() => import('./pages/admin/QuizManagement'));
const QuizBuilder = lazy(() => import('./pages/admin/QuizBuilder'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));

// Fallback Page (Lazy-loaded)
const NotFound = lazy(() => import('./pages/NotFound'));

/**
 * Root Application Component with configured React Router routes.
 * Wraps routes in AuthProvider and guards private routes with ProtectedRoute.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              {/* Public routes */}
              <Route index element={<Home />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="practice" element={<Practice />} />
              <Route path="practice/:id" element={<ProblemDetails />} />
              <Route path="quiz" element={<Quiz />} />
              <Route path="quiz/result" element={<QuizResult />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="quiz/history" element={<QuizHistory />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="diagnostic" element={<Diagnostic />} />
                <Route path="diagnostic/report" element={<DiagnosticReport />} />
                <Route path="diagnostic/report/:id" element={<DiagnosticReport />} />
                <Route path="roadmap" element={<Roadmap />} />
              </Route>

              {/* Admin routes */}
              <Route path="admin" element={<AdminRoute />}>
                <Route index element={<AdminDashboard />} />
                <Route path="questions" element={<QuestionList />} />
                <Route path="questions/new" element={<QuestionForm />} />
                <Route path="questions/:id/edit" element={<QuestionForm />} />
                <Route path="quizzes" element={<QuizManagement />} />
                <Route path="quizzes/new" element={<QuizBuilder />} />
                <Route path="quizzes/:id/edit" element={<QuizBuilder />} />
                <Route path="audit-logs" element={<AdminAuditLog />} />
              </Route>

              {/* Fallback route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
