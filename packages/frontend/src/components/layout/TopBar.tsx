import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Plus, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth, useLogout } from '../../hooks/useAuth';
import { useUiStore } from '../../store/ui';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/recurring': 'Recurring',
  '/reports': 'Reports',
  '/goals': 'Goals',
  '/tax': 'Tax Planning',
};

function Breadcrumbs() {
  const { pathname } = useLocation();
  const label = ROUTE_LABELS[pathname] ?? 'FinPlan';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link to="/" className="text-gray-400 hover:text-gray-600">
        Home
      </Link>
      <span className="text-gray-300">/</span>
      <span className="font-medium text-gray-800">{label}</span>
    </nav>
  );
}

function UserMenu() {
  const { data: user } = useAuth();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <span className="hidden sm:block font-medium">{user?.displayName}</span>
        <ChevronDown size={14} className="hidden sm:block text-gray-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-2">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="truncate text-sm font-medium text-gray-800">{user?.displayName}</p>
          </div>
          <button
            role="menuitem"
            onClick={handleLogout}
            disabled={logout.isPending}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {logout.isPending ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4">
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Open navigation' : 'Close navigation'}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
      >
        {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
      </button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        {/* Quick-add button */}
        <button
          aria-label="Quick add"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add</span>
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
