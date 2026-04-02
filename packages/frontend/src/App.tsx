import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth } from './components/auth/RequireAuth';
import LoginPage from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — wrapped in RequireAuth → AppShell */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<div className="p-4 text-slate-700">Dashboard (FIN-49)</div>} />
          <Route path="/accounts" element={<div className="p-4 text-slate-700">Accounts (FIN-38)</div>} />
          <Route path="/transactions" element={<div className="p-4 text-slate-700">Transactions (FIN-41)</div>} />
          <Route path="/budgets" element={<div className="p-4 text-slate-700">Budgets (FIN-46)</div>} />
          <Route path="/goals" element={<div className="p-4 text-slate-700">Goals (FIN-51)</div>} />
          <Route path="/tax" element={<div className="p-4 text-slate-700">Tax Planning (FIN-53)</div>} />
          <Route path="/reports" element={<div className="p-4 text-slate-700">Reports (coming soon)</div>} />
          <Route path="/settings" element={<div className="p-4 text-slate-700">Settings (coming soon)</div>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
