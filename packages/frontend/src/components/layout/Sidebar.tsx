import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  PieChart,
  RefreshCw,
  BarChart3,
  Target,
  Calculator,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUiStore } from '../../store/ui';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  /** Phase-1 items are dimmed — deferred to a later wave */
  isP1?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Accounts', to: '/accounts', icon: <Landmark size={20} /> },
  { label: 'Transactions', to: '/transactions', icon: <ArrowLeftRight size={20} /> },
  { label: 'Budgets', to: '/budgets', icon: <PieChart size={20} /> },
  { label: 'Recurring', to: '/recurring', icon: <RefreshCw size={20} /> },
  { label: 'Reports', to: '/reports', icon: <BarChart3 size={20} /> },
  { label: 'Goals', to: '/goals', icon: <Target size={20} />, isP1: true },
  { label: 'Tax Planning', to: '/tax', icon: <Calculator size={20} />, isP1: true },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  // At md (768–1023px) sidebar is always icon-only.
  // At lg+ (≥1024px) the user can collapse/expand via toggle.
  const showLabels = !sidebarCollapsed; // lg+ only

  return (
    <aside
      className={[
        // hidden <768px; icon-only 768–1023px; variable at 1024px+
        'hidden md:flex md:w-[60px] lg:transition-all lg:duration-200',
        sidebarCollapsed ? 'lg:w-[60px]' : 'lg:w-[220px]',
        'flex-col bg-gray-900 text-gray-100',
      ].join(' ')}
    >
      {/* Logo row */}
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-gray-700 px-2">
        {/* Brand — only visible at lg+ when expanded */}
        <span
          className={[
            'overflow-hidden text-sm font-bold tracking-wide text-white whitespace-nowrap transition-all duration-200',
            showLabels ? 'lg:w-auto lg:opacity-100' : 'w-0 opacity-0',
          ].join(' ')}
        >
          FinPlan
        </span>

        {/* Collapse toggle — only visible at lg+ */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex items-center justify-center rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        <ul role="list" className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ label, to, icon, isP1 }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                    'justify-center lg:justify-start',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isP1
                        ? 'text-gray-500 cursor-default pointer-events-none'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                aria-disabled={isP1}
                tabIndex={isP1 ? -1 : undefined}
                title={label}
              >
                <span className="shrink-0">{icon}</span>
                {/* Label hidden on md (tablet icon-only), hidden at lg when collapsed */}
                <span
                  className={[
                    'hidden truncate',
                    showLabels ? 'lg:inline' : '',
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
  );
}
