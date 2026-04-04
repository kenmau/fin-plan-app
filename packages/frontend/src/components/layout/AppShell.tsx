import { Outlet } from 'react-router-dom';
import { RequireAuth } from '../auth/RequireAuth';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * AppShell wraps all authenticated pages.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  Sidebar (220px) │  Top bar     │
 *   │                  ├──────────────┤
 *   │                  │  <Outlet />  │
 *   └─────────────────────────────────┘
 *
 * Responsive:
 *   ≥1024px  full 220px sidebar (collapsible to 60px icon-only)
 *   768–1023px  icon-only sidebar (60px, always)
 *   <768px   sidebar hidden
 */
export function AppShell() {
  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
