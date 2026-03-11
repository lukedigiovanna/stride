import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { WorkoutProvider } from '@/context/WorkoutContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import ExercisesPage from '@/pages/ExercisesPage';
import ExerciseDetailPage from '@/pages/ExerciseDetailPage';
import HistoryPage from '@/pages/HistoryPage';
import WorkoutDetailPage from '@/pages/WorkoutDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import WorkoutSheet from '@/components/workout/WorkoutSheet';

/**
 * Route tree:
 *
 *   /auth                 — public, no chrome
 *   <ProtectedRoute>      — auth gate
 *     <AppLayout>         — nav chrome (BottomNav + WorkoutBar)
 *       /                 → HomePage
 *       /exercises        → ExercisesPage
 *       /exercises/:id    → ExerciseDetailPage
 *       /history          → HistoryPage
 *       /history/:id      → WorkoutDetailPage
 *       /profile          → ProfilePage
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkoutProvider>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Auth gate */}
            <Route element={<ProtectedRoute />}>
              {/* Layout chrome — all authenticated pages live inside here */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:id" element={<WorkoutDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <WorkoutSheet />
          <Toaster position="top-center" richColors />
        </WorkoutProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
