import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import PortfolioPage from './pages/PortfolioPage';
import BudgetPage from './pages/BudgetPage';
import ObligationsPage from './pages/ObligationsPage';

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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

