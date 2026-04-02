import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  PiggyBank,
  BarChart2,
  Target,
  Calculator,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  dimmed?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Accounts', to: '/accounts', icon: TrendingUp },
  { label: 'Transactions', to: '/transactions', icon: Receipt },
  { label: 'Budgets', to: '/budgets', icon: PiggyBank },
  { label: 'Reports', to: '/reports', icon: BarChart2 },
  { label: 'Goals', to: '/goals', icon: Target, dimmed: true },
  { label: 'Tax Planning', to: '/tax', icon: Calculator, dimmed: true },
  { label: 'Settings', to: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'flex flex-col h-full bg-slate-900 text-white transition-all duration-300 z-30',
          // Mobile: fixed drawer, toggleable
          'fixed inset-y-0 left-0 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          // Width: mobile always 220px, tablet (md-lg) always icon-only, desktop respects collapsed
          'w-[220px]',
          'md:w-[60px] lg:w-[220px]',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[220px]',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="flex items-center h-[52px] px-4 border-b border-slate-700 shrink-0">
          <span
            className={[
              'font-bold text-white text-lg tracking-tight overflow-hidden whitespace-nowrap transition-all duration-300',
              'md:hidden lg:block',
              collapsed ? 'lg:hidden' : 'lg:block',
            ].join(' ')}
          >
            FinPlan
          </span>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="ml-auto md:hidden p-1 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex ml-auto p-1 rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul role="list" className="space-y-0.5">
            {NAV_ITEMS.map(({ label, to, icon: Icon, dimmed }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : dimmed
                          ? 'text-slate-500 hover:bg-slate-800 hover:text-slate-300 cursor-default'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    ].join(' ')
                  }
                  onClick={dimmed ? (e) => e.preventDefault() : onMobileClose}
                  aria-disabled={dimmed}
                  tabIndex={dimmed ? -1 : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  <span
                    className={[
                      'overflow-hidden whitespace-nowrap transition-all duration-300',
                      // Mobile: always visible, tablet: hidden, desktop: depends on collapsed
                      'md:hidden lg:block',
                      collapsed ? 'lg:hidden' : 'lg:block',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}
