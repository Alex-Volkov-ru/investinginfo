import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { MobileLayout } from './components/MobileLayout';
import LoginPage from './pages/LoginPage';
import PortfolioPage from './pages/PortfolioPage';
import BudgetPage from './pages/BudgetPage';
import ObligationsPage from './pages/ObligationsPage';
import AdminPage from './pages/AdminPage';
import PortfolioPageMobile from './pages/PortfolioPageMobile';
import BudgetPageMobile from './pages/BudgetPageMobile';
import ObligationsPageMobile from './pages/ObligationsPageMobile';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PortfolioPage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="obligations" element={<ObligationsPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
            <Route
              path="/mobile"
              element={
                <ProtectedRoute>
                  <MobileLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PortfolioPageMobile />} />
            </Route>
            <Route
              path="/admin_mobile"
              element={
                <ProtectedRoute>
                  <MobileLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminPage />} />
            </Route>
            <Route
              path="/budget_mobile"
              element={
                <ProtectedRoute>
                  <MobileLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BudgetPageMobile />} />
            </Route>
            <Route
              path="/obligations_mobile"
              element={
                <ProtectedRoute>
                  <MobileLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ObligationsPageMobile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

