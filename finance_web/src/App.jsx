import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, ThemeToggleButton } from './context/ThemeContext';
import { CurrencyProvider, useCurrency } from './context/CurrencyContext';
import Sidebar, { MobileMenuButton } from './components/Sidebar';

const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = React.lazy(() => import('./pages/TransactionsPage'));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const BudgetsPage = React.lazy(() => import('./pages/BudgetsPage'));
const StreamsPage = React.lazy(() => import('./pages/StreamsPage'));
const RecurringPage = React.lazy(() => import('./pages/RecurringPage'));

const PageLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-slate-400">
    <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3"></div>
    <span className="text-xs font-medium tracking-wide">Loading view...</span>
  </div>
);

const CurrencyPill = () => {
  const { currency, symbol, setCurrency, currencies } = useCurrency();
  const nextCurrency = () => {
    const keys = Object.keys(currencies);
    const nextIdx = (keys.indexOf(currency) + 1) % keys.length;
    setCurrency(keys[nextIdx]);
  };
  return (
    <button
      type="button"
      onClick={nextCurrency}
      title={`Active Currency: ${currency} (${symbol}). Click to switch.`}
      className="currency-pill-btn touch-lift"
    >
      <span className="currency-pill-symbol">{symbol}</span>
      <span className="currency-pill-code">{currency}</span>
    </button>
  );
};

const SecondaryTopBar = () => {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  if (
    normalizedPath === '/dashboard' ||
    normalizedPath.startsWith('/dashboard/') ||
    normalizedPath === '/' ||
    normalizedPath === ''
  ) {
    return null;
  }

  const pageTitles = {
    '/transactions': 'Transactions Ledger',
    '/reports': 'Reports & P&L Intelligence',
    '/budgets': 'Budgets & Threshold Alerts',
    '/categories': 'Category Governance',
    '/admin': 'Admin & Entities Control',
    '/settings': 'Security & Vault Settings',
    '/streams': 'Streams & Financial Books',
    '/recurring': 'Subscriptions & Cash Runway',
  };

  const title =
    pageTitles[normalizedPath] ||
    (normalizedPath.startsWith('/streams') ? 'Streams & Financial Books' : 'Finance Intel');

  return (
    <header
      className="top-navbar-safe glacier-header sticky top-0 z-30 flex-shrink-0 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors duration-200"
      data-purpose="top-navigation-bar"
    >
      <div className="flex items-center space-x-3 min-w-max">
        <MobileMenuButton />
        <h1 className="text-base sm:text-xl font-bold tracking-tight text-white header-title truncate max-w-[170px] xs:max-w-[240px] sm:max-w-none">
          {title}
        </h1>
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
          <span className="hidden xs:inline">Live Sync</span>
        </span>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <CurrencyPill />
        <ThemeToggleButton />
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070C14] text-slate-400 text-sm">
        Loading Finance Intel...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex app-shell-container antialiased selection:bg-cyan-500 selection:text-slate-900 relative overflow-hidden">
      <div aria-hidden="true" className="glacier-ambient-1"></div>
      <div aria-hidden="true" className="glacier-ambient-2"></div>
      <div className="relative z-10 flex w-full h-full min-h-screen overflow-hidden backdrop-blur-[2px]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <SecondaryTopBar />
          {children}
        </div>
      </div>
    </div>
  );
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <AuthProvider>
          <BrowserRouter>
            <React.Suspense fallback={<PageLoader />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <RegisterPage />
                    </PublicRoute>
                  }
                />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <TransactionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <ReportsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/categories"
                  element={
                    <ProtectedRoute>
                      <CategoriesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/budgets"
                  element={
                    <ProtectedRoute>
                      <BudgetsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/streams"
                  element={
                    <ProtectedRoute>
                      <StreamsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recurring"
                  element={
                    <ProtectedRoute>
                      <RecurringPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/streams/:bookId"
                  element={
                    <ProtectedRoute>
                      <StreamsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </AuthProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
};

export default App;
