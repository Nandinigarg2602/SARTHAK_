import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MonitoringProvider } from './contexts/MonitoringContext';
import { NavigationBar } from './components/NavigationBar';
import { LandingPage } from './pages/LandingPage';
import { HomePage } from './pages/HomePage';
import { MedicationPage } from './pages/MedicationPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { LoginPage } from './pages/LoginPage';
import { CaregiverLoginPage } from './pages/CaregiverLoginPage';
import { CaregiverSetupPage } from './pages/CaregiverSetupPage';
import { Shield, Loader2 } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 text-surface-900">
      <div className="w-16 h-16 mb-4 rounded-3xl bg-sarthak-600 text-white flex items-center justify-center shadow-lg animate-pulse">
        <Shield size={32} className="stroke-[2.2]" />
      </div>
      <Loader2 size={24} className="text-sarthak-700 animate-spin" />
      <p className="text-sm font-semibold text-surface-700 mt-3">Loading Sarthak companion...</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Senior only: cannot access Caregiver Dashboard
function PatientRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, isCaregiver } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isCaregiver) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Caregiver only: cannot access Companion
function CaregiverRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, isCaregiver } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/caregiver/login" replace />;
  if (!isCaregiver) return <Navigate to="/companion" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isCaregiver } = useAuth();

  const authenticatedHome = isCaregiver ? '/dashboard' : '/companion';

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Senior Auth Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <LoginPage initialMode="login" />
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <LoginPage initialMode="register" />
        }
      />

      {/* Caregiver Auth Routes */}
      <Route
        path="/caregiver/login"
        element={
          isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <CaregiverLoginPage />
        }
      />
      <Route path="/caregiver/setup-password" element={<CaregiverSetupPage />} />

      {/* Public Emergency Token Page */}
      <Route path="/emergency" element={<EmergencyPage />} />

      {/* Senior Companion Protected Routes */}
      <Route
        path="/companion"
        element={
          <PatientRoute>
            <HomePage />
          </PatientRoute>
        }
      />
      <Route
        path="/home"
        element={<Navigate to="/companion" replace />}
      />
      <Route
        path="/medications"
        element={
          <PatientRoute>
            <MedicationPage />
          </PatientRoute>
        }
      />

      {/* Caregiver Portal Protected Route */}
      <Route
        path="/dashboard"
        element={
          <CaregiverRoute>
            <DashboardPage />
          </CaregiverRoute>
        }
      />

      {/* Shared Settings (available to both senior and caregiver) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const isPortalView = ['/companion', '/medications', '/dashboard', '/settings'].includes(location.pathname);

  return (
    <>
      <AppRoutes />
      {isAuthenticated && isPortalView && <NavigationBar />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MonitoringProvider>
          <AppLayout />
        </MonitoringProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
