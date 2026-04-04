import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';

const Dashboard = lazy(() => import('./pages/DashboardPage'));
const Accounts = lazy(() => import('./pages/AccountsPage'));
const Transactions = lazy(() => import('./pages/TransactionsPage'));
const Budgets = lazy(() => import('./pages/BudgetsPage'));
const Goals = lazy(() => import('./pages/GoalsPage'));
const Tax = lazy(() => import('./pages/TaxPage'));

function PagePlaceholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-lg font-medium">{name}</p>
      <p className="text-sm mt-1">Coming soon</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — rendered inside AppShell layout */}
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={null}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/accounts"
          element={
            <Suspense fallback={null}>
              <Accounts />
            </Suspense>
          }
        />
        <Route
          path="/transactions"
          element={
            <Suspense fallback={null}>
              <Transactions />
            </Suspense>
          }
        />
        <Route
          path="/budgets"
          element={
            <Suspense fallback={null}>
              <Budgets />
            </Suspense>
          }
        />
        <Route path="/recurring" element={<PagePlaceholder name="Recurring" />} />
        <Route path="/reports" element={<PagePlaceholder name="Reports" />} />
        <Route
          path="/goals"
          element={
            <Suspense fallback={null}>
              <Goals />
            </Suspense>
          }
        />
        <Route
          path="/tax"
          element={
            <Suspense fallback={null}>
              <Tax />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
