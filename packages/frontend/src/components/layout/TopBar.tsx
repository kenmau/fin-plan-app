import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Plus, LogOut, ChevronRight } from 'lucide-react';
import { useAuth, AUTH_QUERY_KEY } from '../../hooks/useAuth';
import { api } from '../../lib/api';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  accounts: 'Accounts',
  transactions: 'Transactions',
  budgets: 'Budgets',
  goals: 'Goals',
  tax: 'Tax Planning',
  reports: 'Reports',
  settings: 'Settings',
};

function useBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.replace(/^\//, '').split('/').filter(Boolean);
  return segments.map((seg, i) => ({
    label: ROUTE_LABELS[seg] ?? seg,
    to: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));
}

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();
  const breadcrumbs = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const logoutMutation = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, undefined);
      queryClient.clear();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <header className="flex items-center h-[52px] px-4 bg-white border-b border-slate-200 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm flex-1 min-w-0">
        <Link to="/" className="text-slate-400 hover:text-slate-600 shrink-0">
          Home
        </Link>
        {breadcrumbs.map(({ label, to, isLast }) => (
          <span key={to} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={14} className="text-slate-300 shrink-0" />
            {isLast ? (
              <span className="font-medium text-slate-900 truncate">{label}</span>
            ) : (
              <Link to={to} className="text-slate-500 hover:text-slate-700 truncate">
                {label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Quick-add button */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          aria-label="Add new item"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add</span>
        </button>

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            aria-label="User menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {initials}
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50"
              role="menu"
            >
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.displayName}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.username}</p>
              </div>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  logoutMutation.mutate();
                }}
                disabled={logoutMutation.isPending}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:bg-slate-50"
                role="menuitem"
              >
                <LogOut size={15} />
                {logoutMutation.isPending ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
