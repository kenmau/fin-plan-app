import { Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<div>Login page (FIN-37)</div>} />
      <Route path="/dashboard" element={<div>Dashboard (FIN-49)</div>} />
      <Route path="/accounts" element={<div>Accounts (FIN-38)</div>} />
      <Route path="/transactions" element={<div>Transactions (FIN-41)</div>} />
      <Route path="/budgets" element={<div>Budgets (FIN-46)</div>} />
      <Route path="/goals" element={<div>Goals (FIN-51)</div>} />
      <Route path="/tax" element={<div>Tax Planning (FIN-53)</div>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
