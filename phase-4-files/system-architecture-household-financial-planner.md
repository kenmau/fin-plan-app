# System Architecture: Household Financial Planner
## Version: 1.0
## Date: March 30, 2026
## Author: Ken Mau
## Status: Draft

---

## 1. Architecture Overview

The Household Financial Planner is a monorepo containing three packages — a React SPA frontend, a Fastify REST API backend, and a shared TypeScript types package — orchestrated by Nx, containerized with Docker, and deployable on Kubernetes.

### 1.1 System diagram

```
┌──────────────────────────────────────────────────────────┐
│                     Nx Monorepo                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   packages/  │  │   packages/  │  │   packages/  │   │
│  │   frontend   │  │   backend    │  │   shared     │   │
│  │              │  │              │  │              │   │
│  │  React 18    │  │  Fastify     │  │  TypeScript  │   │
│  │  Vite        │  │  Drizzle ORM │  │  types       │   │
│  │  TanStack Q  │  │  JWT auth    │  │  validators  │   │
│  │  Zustand     │  │  REST API    │  │  constants   │   │
│  │  Recharts    │  │              │  │              │   │
│  │  shadcn/ui   │  │              │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │
│         │                 │                              │
│         │  HTTPS/JSON     │                              │
│         └────────┬────────┘                              │
│                  │                                       │
│  ┌───────────────▼───────────────┐                       │
│  │        PostgreSQL 16          │                       │
│  └───────────────────────────────┘                       │
│                                                          │
│  ┌───────────────────────────────┐                       │
│  │   infra/ (Docker, k8s, CI)    │                       │
│  └───────────────────────────────┘                       │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Key architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo tool | Nx | Cached builds, affected-only testing, project graph, task orchestration. Heavier than npm workspaces but worth it for shared types and CI efficiency. |
| Frontend build | Vite | Fast HMR, native ESM, clean config. Pairs well with Nx via @nx/vite. |
| Backend framework | Fastify | Schema-based validation, plugin architecture, TypeScript-first, measurably faster than Express. |
| ORM | Drizzle | SQL-like API, no binary engine, type-safe, drizzle-kit for migrations. |
| Server state | TanStack Query | Caching, background refetch, optimistic updates for API data. |
| Client state | Zustand | UI-only state: modals, dashboard layout, user preferences. |
| Testing | Vitest + supertest + Playwright | Full pyramid: unit → integration → E2E. Vitest for both frontend and backend (same runner). |
| Containerization | Docker multi-stage | Separate images for frontend (Nginx) and backend (Node.js). |
| Orchestration | k8s (Docker Compose for dev) | Production-grade, cloud-portable. Dev uses Docker Compose for simplicity. |

---

## 2. Project Structure

```
finplan/
├── nx.json                          # Nx workspace configuration
├── package.json                     # Root package.json (npm workspaces)
├── tsconfig.base.json               # Shared TypeScript config
├── .env.example                     # Environment variable template
├── AGENTS.md                        # Agentic guardrails for AI-assisted development
├── CLAUDE.md                        # Claude Code project context
│
├── packages/
│   ├── frontend/                    # React SPA
│   │   ├── project.json            # Nx project config
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx            # App entry point
│   │   │   ├── App.tsx             # Root component with router
│   │   │   ├── routes/             # Page-level route components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Transactions.tsx
│   │   │   │   ├── Budgets.tsx
│   │   │   │   ├── Accounts.tsx
│   │   │   │   ├── AccountDetail.tsx
│   │   │   │   ├── Recurring.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   └── Login.tsx
│   │   │   ├── components/         # Reusable UI components
│   │   │   │   ├── layout/
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── TopBar.tsx
│   │   │   │   │   └── AppShell.tsx
│   │   │   │   ├── ui/             # shadcn/ui components (copied in)
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── select.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   ├── badge.tsx
│   │   │   │   │   ├── progress.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── MetricCard.tsx
│   │   │   │   │   ├── NetWorthChart.tsx
│   │   │   │   │   ├── AssetDonut.tsx
│   │   │   │   │   ├── BudgetWidget.tsx
│   │   │   │   │   ├── UpcomingBills.tsx
│   │   │   │   │   └── RecentTransactions.tsx
│   │   │   │   ├── transactions/
│   │   │   │   │   ├── TransactionTable.tsx
│   │   │   │   │   ├── QuickAddModal.tsx
│   │   │   │   │   ├── BatchEntryPanel.tsx
│   │   │   │   │   └── CategoryBadge.tsx
│   │   │   │   ├── budgets/
│   │   │   │   │   ├── BudgetCard.tsx
│   │   │   │   │   ├── BudgetProgress.tsx
│   │   │   │   │   └── PaceIndicator.tsx
│   │   │   │   └── accounts/
│   │   │   │       ├── AccountList.tsx
│   │   │   │       ├── BalanceChart.tsx
│   │   │   │       └── AddAccountForm.tsx
│   │   │   ├── hooks/              # Custom React hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useKeyboardShortcut.ts
│   │   │   ├── api/                # TanStack Query hooks (one file per resource)
│   │   │   │   ├── queryClient.ts
│   │   │   │   ├── accounts.ts     # useAccounts, useAccount, useCreateAccount, etc.
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── budgets.ts
│   │   │   │   ├── categories.ts
│   │   │   │   ├── recurring.ts
│   │   │   │   ├── balanceSnapshots.ts
│   │   │   │   └── dashboard.ts    # useDashboardData (aggregated)
│   │   │   ├── stores/             # Zustand stores (UI state only)
│   │   │   │   ├── uiStore.ts      # Modal state, sidebar collapsed
│   │   │   │   └── dashboardStore.ts # Widget layout, preferences
│   │   │   ├── lib/                # Utilities
│   │   │   │   ├── formatters.ts   # Currency, date formatting
│   │   │   │   └── constants.ts    # Re-exports from @finplan/shared
│   │   │   └── styles/
│   │   │       └── globals.css     # Tailwind imports + custom vars
│   │   └── tests/
│   │       ├── components/         # Component unit tests
│   │       └── setup.ts            # Vitest setup (jsdom, mocks)
│   │
│   ├── backend/                     # Fastify API server
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # Server entry point
│   │   │   ├── app.ts              # Fastify app factory (for testability)
│   │   │   ├── plugins/            # Fastify plugins
│   │   │   │   ├── auth.ts         # JWT verification plugin
│   │   │   │   ├── cors.ts
│   │   │   │   └── errorHandler.ts
│   │   │   ├── routes/             # Route handlers (one file per resource)
│   │   │   │   ├── auth.ts         # POST /auth/login, POST /auth/logout
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── balanceSnapshots.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── categories.ts
│   │   │   │   ├── budgets.ts
│   │   │   │   ├── recurring.ts
│   │   │   │   └── dashboard.ts    # GET /dashboard (aggregated data)
│   │   │   ├── services/           # Business logic (testable without HTTP)
│   │   │   │   ├── accountService.ts
│   │   │   │   ├── transactionService.ts
│   │   │   │   ├── budgetService.ts
│   │   │   │   ├── recurringService.ts  # Generates pending transactions
│   │   │   │   └── dashboardService.ts  # Aggregation queries
│   │   │   ├── db/                 # Database layer
│   │   │   │   ├── client.ts       # Drizzle client initialization
│   │   │   │   ├── schema.ts       # Drizzle schema (all tables)
│   │   │   │   ├── migrations/     # Generated by drizzle-kit
│   │   │   │   └── seed.ts         # Seed data (categories, users)
│   │   │   ├── schemas/            # Fastify JSON schemas (request/response validation)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── accounts.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   └── ...
│   │   │   └── config.ts           # Environment config with validation
│   │   └── tests/
│   │       ├── unit/               # Service unit tests
│   │       ├── integration/        # API endpoint tests (supertest)
│   │       └── helpers/
│   │           ├── testDb.ts       # Test database setup/teardown
│   │           └── fixtures.ts     # Test data factories
│   │
│   └── shared/                      # Shared TypeScript package
│       ├── project.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts            # Public API barrel export
│       │   ├── types/              # Shared type definitions
│       │   │   ├── account.ts
│       │   │   ├── transaction.ts
│       │   │   ├── budget.ts
│       │   │   ├── category.ts
│       │   │   ├── recurring.ts
│       │   │   ├── dashboard.ts
│       │   │   ├── auth.ts
│       │   │   └── api.ts          # API request/response wrapper types
│       │   ├── constants/
│       │   │   ├── accountTypes.ts  # Canadian account type enums
│       │   │   ├── categories.ts   # Default category list
│       │   │   └── frequencies.ts  # Recurring frequency enum
│       │   └── validators/         # Zod schemas (shared validation)
│       │       ├── account.ts
│       │       ├── transaction.ts
│       │       └── budget.ts
│       └── tests/
│
├── infra/                           # Infrastructure configs
│   ├── docker/
│   │   ├── Dockerfile.frontend     # Multi-stage: build → Nginx
│   │   ├── Dockerfile.backend      # Multi-stage: build → Node.js
│   │   ├── nginx.conf              # Frontend + API proxy config
│   │   └── docker-compose.yml      # Local development stack
│   ├── k8s/
│   │   ├── namespace.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── postgres-statefulset.yaml
│   │   ├── configmap.yaml
│   │   ├── secrets.yaml
│   │   └── ingress.yaml
│   └── scripts/
│       ├── backup.sh               # pg_dump backup script
│       └── seed.sh                 # Database seeding script
│
├── e2e/                             # Playwright E2E tests
│   ├── project.json
│   ├── playwright.config.ts
│   └── tests/
│       ├── auth.spec.ts
│       ├── transactions.spec.ts
│       ├── budgets.spec.ts
│       ├── dashboard.spec.ts
│       └── fixtures/
│           └── auth.ts             # Login helper fixture
│
└── tools/                           # Nx generators, scripts
    └── generators/
```

---

## 3. Data Architecture

### 3.1 Drizzle schema

The schema uses Drizzle's PostgreSQL adapter. All tables use serial IDs (not UUIDs — simpler for a two-user app), timestamps on every table, and explicit foreign key constraints.

```typescript
// packages/backend/src/db/schema.ts

import { pgTable, serial, varchar, text, integer, numeric, boolean, 
         timestamp, date, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const accountTypeEnum = pgEnum('account_type', [
  'chequing', 'savings', 'credit_card', 'rrsp', 'tfsa', 
  'spousal_rrsp', 'resp', 'lira', 'rrif', 'non_registered',
  'mortgage', 'loc', 'property', 'vehicle', 'other_asset', 'other_liability'
]);

export const assetOrLiabilityEnum = pgEnum('asset_or_liability', ['asset', 'liability']);
export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'transfer']);
export const transactionStatusEnum = pgEnum('transaction_status', ['confirmed', 'pending']);
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income', 'transfer']);
export const frequencyEnum = pgEnum('frequency', [
  'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual'
]);
export const goalPriorityEnum = pgEnum('goal_priority', ['high', 'medium', 'low']);
export const goalStatusEnum = pgEnum('goal_status', ['active', 'completed', 'abandoned']);

// Tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  institution: varchar('institution', { length: 100 }),
  accountType: accountTypeEnum('account_type').notNull(),
  assetOrLiability: assetOrLiabilityEnum('asset_or_liability').notNull(),
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const balanceSnapshots = pgTable('balance_snapshots', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  date: date('date').notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  parentCategoryId: integer('parent_category_id'),
  type: categoryTypeEnum('type').notNull(),
  icon: varchar('icon', { length: 10 }),
  color: varchar('color', { length: 7 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  type: transactionTypeEnum('type').notNull(),
  notes: text('notes'),
  isRecurringInstance: boolean('is_recurring_instance').default(false).notNull(),
  recurringTransactionId: integer('recurring_transaction_id'),
  enteredBy: integer('entered_by').references(() => users.id).notNull(),
  status: transactionStatusEnum('status').default('confirmed').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactionSplits = pgTable('transaction_splits', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id').references(() => transactions.id, { onDelete: 'cascade' }).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
});

export const recurringTransactions = pgTable('recurring_transactions', {
  id: serial('id').primaryKey(),
  description: varchar('description', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  type: transactionTypeEnum('type').notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id).notNull(),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  rolloverEnabled: boolean('rollover_enabled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).unique().notNull(),
  widgetConfig: text('widget_config').notNull(), // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 3.2 Indexing strategy

```sql
-- Performance indexes for common queries
CREATE INDEX idx_transactions_date ON transactions (date DESC);
CREATE INDEX idx_transactions_category ON transactions (category_id);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_month ON transactions (date) WHERE status = 'confirmed';
CREATE INDEX idx_balance_snapshots_account_date ON balance_snapshots (account_id, date DESC);
CREATE INDEX idx_budgets_month ON budgets (month);
CREATE INDEX idx_budgets_category_month ON budgets (category_id, month);
CREATE INDEX idx_recurring_active ON recurring_transactions (is_active) WHERE is_active = true;
```

### 3.3 Seed data

The seed script creates:
1. Two users (Ken, Lan) with bcrypt-hashed passwords from env vars
2. 18 default categories (Housing, Groceries, Dining Out, Transportation, Entertainment, Health, Personal Care, Clothing, Education, Gifts & Donations, Insurance, Utilities, Subscriptions, Travel, Miscellaneous, Income Salary, Income Investment, Income Other)
3. Default dashboard layout for each user

### 3.4 Migration strategy

- Migrations generated by `drizzle-kit generate`
- Applied with `drizzle-kit migrate` (runs in order, tracks applied migrations in a `drizzle` schema table)
- Migrations run automatically on backend startup in development
- In production (k8s), migrations run as a Job before the backend deployment

---

## 4. API Design

### 4.1 Base URL and conventions

```
Base:    /api/v1
Format:  JSON
Auth:    Bearer JWT in httpOnly cookie (auto-sent)
Errors:  { error: string, code: string, details?: any }
Lists:   { data: T[], total: number, page: number, pageSize: number }
```

### 4.2 Endpoints

**Authentication**
```
POST   /api/v1/auth/login          { username, password } → { user } + Set-Cookie
POST   /api/v1/auth/logout         → 204 + Clear-Cookie
GET    /api/v1/auth/me             → { user }
```

**Accounts**
```
GET    /api/v1/accounts            → { data: Account[] }
GET    /api/v1/accounts/:id        → Account (with latest balance)
POST   /api/v1/accounts            → Account
PUT    /api/v1/accounts/:id        → Account
DELETE /api/v1/accounts/:id        → 204
```

**Balance snapshots**
```
GET    /api/v1/accounts/:id/snapshots         → { data: Snapshot[] }
POST   /api/v1/accounts/:id/snapshots         → Snapshot
```

**Transactions**
```
GET    /api/v1/transactions        ?month=2026-03&type=expense&category=5&status=confirmed&search=loblaws&page=1&pageSize=50
POST   /api/v1/transactions        → Transaction
POST   /api/v1/transactions/batch  [Transaction[]] → Transaction[]
PUT    /api/v1/transactions/:id    → Transaction
DELETE /api/v1/transactions/:id    → 204
```

**Transaction splits**
```
PUT    /api/v1/transactions/:id/splits    [{ categoryId, amount }] → TransactionSplit[]
```

**Categories**
```
GET    /api/v1/categories          → { data: Category[] } (flat with parentId)
POST   /api/v1/categories          → Category
PUT    /api/v1/categories/:id      → Category
DELETE /api/v1/categories/:id      → 204
```

**Budgets**
```
GET    /api/v1/budgets             ?month=2026-03 → { data: Budget[] }
PUT    /api/v1/budgets             [{ categoryId, month, amount, rolloverEnabled }] → Budget[]
```

**Recurring transactions**
```
GET    /api/v1/recurring           → { data: RecurringTransaction[] }
POST   /api/v1/recurring           → RecurringTransaction
PUT    /api/v1/recurring/:id       → RecurringTransaction
DELETE /api/v1/recurring/:id       → 204
POST   /api/v1/recurring/generate  → Transaction[] (generates pending for current period)
```

**Dashboard (aggregated)**
```
GET    /api/v1/dashboard           → {
  netWorth: number,
  netWorthChange: number,
  monthlySpending: number,
  budgetTotal: number,
  savingsRate: number,
  upcomingBills: Transaction[],
  recentTransactions: Transaction[],
  netWorthHistory: { month: string, value: number }[],
  assetBreakdown: { type: string, value: number }[],
  budgetStatus: { category: string, spent: number, limit: number }[]
}
```

### 4.3 Request validation

Fastify's built-in schema validation with JSON Schema. Define schemas per route:

```typescript
// packages/backend/src/schemas/transactions.ts
export const createTransactionSchema = {
  body: {
    type: 'object',
    required: ['date', 'amount', 'description', 'categoryId', 'accountId', 'type'],
    properties: {
      date: { type: 'string', format: 'date' },
      amount: { type: 'number' },
      description: { type: 'string', minLength: 1, maxLength: 255 },
      categoryId: { type: 'integer' },
      accountId: { type: 'integer' },
      type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
      notes: { type: 'string', maxLength: 500 },
    }
  }
};
```

Zod schemas in `@finplan/shared` for client-side validation (pre-submit). Fastify JSON schemas for server-side validation (defense in depth).

### 4.4 Error responses

```typescript
// Standard error format
interface ApiError {
  error: string;       // Human-readable message
  code: string;        // Machine-readable code: VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, etc.
  details?: unknown;   // Validation details, field errors, etc.
}

// HTTP status mapping
// 400: VALIDATION_ERROR (bad input)
// 401: UNAUTHORIZED (no/invalid token)
// 404: NOT_FOUND
// 409: CONFLICT (e.g., duplicate category name)
// 500: INTERNAL_ERROR
```

---

## 5. Frontend Architecture

### 5.1 Routing

React Router v6 with a layout route for the authenticated shell:

```typescript
// packages/frontend/src/App.tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route element={<RequireAuth />}>
    <Route element={<AppShell />}>
      <Route index element={<Dashboard />} />
      <Route path="transactions" element={<Transactions />} />
      <Route path="budgets" element={<Budgets />} />
      <Route path="accounts" element={<Accounts />} />
      <Route path="accounts/:id" element={<AccountDetail />} />
      <Route path="recurring" element={<Recurring />} />
      <Route path="settings" element={<Settings />} />
    </Route>
  </Route>
</Routes>
```

`RequireAuth` checks for a valid JWT cookie (via `GET /auth/me`) and redirects to `/login` if unauthenticated. `AppShell` renders the sidebar + top bar layout with an `<Outlet />` for page content.

### 5.2 TanStack Query patterns

One file per resource in `src/api/`. Each exports custom hooks that wrap `useQuery` and `useMutation`:

```typescript
// packages/frontend/src/api/transactions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './queryClient';

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (params: TransactionFilters) => ['transactions', 'list', params] as const,
  detail: (id: number) => ['transactions', 'detail', id] as const,
};

export function useTransactions(params: TransactionFilters) {
  return useQuery({
    queryKey: transactionKeys.list(params),
    queryFn: () => api.get('/transactions', { params }),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionInput) => api.post('/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

Key patterns:
- **Query key factories** for consistent cache management
- **Invalidation cascades**: Creating a transaction invalidates transactions, budgets (spending changed), and dashboard (aggregates changed)
- **Optimistic updates** for quick-add modal: Show the transaction immediately, roll back if the server rejects
- **Stale time**: 30 seconds for dashboard data, 5 minutes for accounts and categories (change less frequently)

### 5.3 Zustand stores

Two stores, both small:

```typescript
// packages/frontend/src/stores/uiStore.ts
interface UIState {
  sidebarCollapsed: boolean;
  quickAddOpen: boolean;
  toggleSidebar: () => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
}

// packages/frontend/src/stores/dashboardStore.ts
interface DashboardState {
  widgetOrder: string[];
  visibleWidgets: Set<string>;
  reorderWidgets: (order: string[]) => void;
  toggleWidget: (id: string) => void;
}
```

These persist to the backend via `PUT /api/v1/dashboard/layout` (debounced) and load on app startup.

### 5.4 Component patterns

- **Page components** (`routes/`) own the data-fetching: call TanStack Query hooks, pass data down as props
- **Feature components** (`components/dashboard/`, etc.) are presentation-focused, receive data as props
- **UI components** (`components/ui/`) are shadcn/ui primitives, style-only, no business logic
- **Error boundaries** wrap each page-level route to catch rendering errors without crashing the full app
- **Suspense** wraps data-loading components with skeleton loaders

### 5.5 Keyboard shortcuts

Global shortcuts registered in `AppShell`:
- `Ctrl+N` / `Cmd+N`: Open quick-add transaction modal
- `Ctrl+K` / `Cmd+K`: Focus search (on transactions page)
- `Escape`: Close any open modal/panel

---

## 6. Security Architecture

### 6.1 Authentication flow

```
1. User submits username + password to POST /auth/login
2. Server validates credentials against bcrypt hash in users table
3. Server generates JWT { sub: userId, username, iat, exp } with 30-day expiry
4. JWT is set as httpOnly, Secure, SameSite=Strict cookie
5. All subsequent API requests include the cookie automatically
6. Server middleware extracts + verifies JWT on every request
7. Failed verification → 401 response → frontend redirects to /login
```

### 6.2 JWT configuration

```typescript
// Token payload
{
  sub: 1,                    // userId
  username: 'ken',
  iat: 1711756800,           // Issued at
  exp: 1714348800            // 30 days
}

// Cookie settings
{
  httpOnly: true,            // Not accessible to JavaScript
  secure: true,              // HTTPS only (even local with self-signed cert)
  sameSite: 'strict',        // CSRF protection
  path: '/',
  maxAge: 30 * 24 * 60 * 60  // 30 days in seconds
}
```

### 6.3 Secret management

```
JWT_SECRET          → Random 256-bit key, stored in .env (dev) or k8s Secret (prod)
KEN_PASSWORD_HASH   → bcrypt hash, stored in .env
LAN_PASSWORD_HASH   → bcrypt hash, stored in .env
DATABASE_URL        → PostgreSQL connection string, stored in .env or k8s Secret
```

**Never stored in source code.** `.env.example` documents required variables with placeholder values.

### 6.4 Input validation

Defense in depth — validate at three layers:
1. **Frontend (Zod)**: Pre-submit validation with user-facing error messages
2. **API (Fastify JSON Schema)**: Request schema validation before handler runs
3. **Database (Drizzle constraints)**: NOT NULL, UNIQUE, CHECK, foreign keys

### 6.5 CORS configuration

```typescript
// Only allow the frontend origin
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,  // Required for httpOnly cookies
});
```

---

## 7. Infrastructure & Deployment

### 7.1 Docker Compose (development)

```yaml
# infra/docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: finplan
      POSTGRES_USER: finplan
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build:
      context: ../../
      dockerfile: infra/docker/Dockerfile.backend
    environment:
      DATABASE_URL: postgres://finplan:${DB_PASSWORD:-devpassword}@postgres:5432/finplan
      JWT_SECRET: ${JWT_SECRET:-dev-secret-change-me}
      FRONTEND_URL: http://localhost:5173
    ports:
      - "3001:3001"
    depends_on:
      - postgres

  frontend:
    build:
      context: ../../
      dockerfile: infra/docker/Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
```

### 7.2 Docker images

**Frontend (multi-stage)**:
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json nx.json tsconfig.base.json ./
COPY packages/frontend/ packages/frontend/
COPY packages/shared/ packages/shared/
RUN npm ci && npx nx build frontend --prod

# Stage 2: Serve
FROM nginx:alpine
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/packages/frontend /usr/share/nginx/html
```

**Backend (multi-stage)**:
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json nx.json tsconfig.base.json ./
COPY packages/backend/ packages/backend/
COPY packages/shared/ packages/shared/
RUN npm ci && npx nx build backend --prod

# Stage 2: Run
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/packages/backend ./
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "index.js"]
```

### 7.3 Nginx configuration

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.4 Kubernetes manifests

Key resources in `infra/k8s/`:

- **Namespace**: `finplan`
- **PostgreSQL StatefulSet**: Single replica, 10Gi PVC, resource limits
- **Backend Deployment**: 1 replica, health checks on `/api/v1/health`, env from ConfigMap + Secret
- **Frontend Deployment**: 1 replica, Nginx serving static files
- **Services**: ClusterIP for postgres and backend, NodePort or Ingress for frontend
- **ConfigMap**: Non-sensitive config (FRONTEND_URL, log level)
- **Secret**: JWT_SECRET, DATABASE_URL, password hashes
- **Migration Job**: Runs `drizzle-kit migrate` before backend starts (uses init container or separate Job)
- **CronJob**: `pg_dump` backup every 6 hours to a PVC

### 7.5 CI/CD pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx nx affected --target=lint
      - run: npx nx affected --target=typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: finplan_test
          POSTGRES_USER: finplan
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx nx affected --target=test
      - run: npx nx e2e e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f infra/docker/Dockerfile.frontend -t finplan-frontend .
      - run: docker build -f infra/docker/Dockerfile.backend -t finplan-backend .
```

---

## 8. AGENTS.md — Agentic Guardrails

This file lives at the repo root and instructs AI coding agents (Claude Code) on development standards:

```markdown
# AGENTS.md — Agentic Development Guardrails

## Project context
Household Financial Planner — a React + Fastify + PostgreSQL monorepo managed by Nx.
Two users (Ken + Lan), self-hosted, Canadian financial focus.

## Testing requirements — MANDATORY

Every code change MUST include appropriate tests. Do not merge or mark work as complete
without tests. The testing pyramid:

### Unit tests (Vitest)
- Every service function in `packages/backend/src/services/` must have unit tests
- Every utility function in `packages/shared/src/` must have unit tests
- React components with business logic (not pure UI) must have unit tests
- Minimum: test the happy path + one error case per function
- Location: co-located `*.test.ts` files or `tests/unit/` directory

### Integration tests (supertest)
- Every API endpoint must have at least one integration test
- Tests run against a real PostgreSQL test database (not mocks)
- Test the full request → response cycle including auth, validation, and database
- Location: `packages/backend/tests/integration/`
- Setup: Use `testDb.ts` helper to create/tear down test database per suite

### E2E tests (Playwright)
- Every user-facing flow must have an E2E test
- Critical flows (required): login, add transaction, view dashboard, set budget
- Tests run against the full Docker Compose stack
- Location: `e2e/tests/`

### Coverage expectations
- Do not aim for a specific coverage number — aim for meaningful tests
- Every PR should include tests for the code it changes
- If a bug is found, write a regression test before fixing it

## Code standards

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- No `any` types — use `unknown` and narrow, or define proper types in `@finplan/shared`
- All API request/response types defined in `packages/shared/src/types/`

### API patterns
- All routes use Fastify schema validation (JSON Schema in `schemas/` directory)
- Business logic lives in `services/`, not in route handlers
- Route handlers: validate → call service → format response
- All monetary values stored as strings in Drizzle (numeric type), parsed to numbers at the API boundary

### Frontend patterns
- Server data fetched via TanStack Query hooks in `src/api/`
- UI-only state in Zustand stores in `src/stores/`
- No `useEffect` for data fetching — use TanStack Query
- No `useState` for server data — use TanStack Query
- Components in `components/ui/` are shadcn/ui primitives — don't modify their internals, compose them

### Database
- All schema changes go through Drizzle migrations (`npx drizzle-kit generate`)
- Never modify the database directly — always through migrations
- Seed data script must be idempotent (safe to run multiple times)

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`
- One logical change per commit
- Branch naming: `feat/add-transaction-splits`, `fix/budget-rollover-calculation`

## What NOT to do
- Do not install packages without checking if Nx, Fastify, or the existing stack already provides the functionality
- Do not add client-side routing libraries — React Router is already configured
- Do not add state management libraries — TanStack Query + Zustand is the pattern
- Do not create REST endpoints that bypass Fastify schema validation
- Do not store monetary values as JavaScript numbers in the database (use Drizzle's numeric type)
- Do not use `localStorage` for auth tokens — JWT is in httpOnly cookies
- Do not add ESLint plugins without discussion — the Nx preset is sufficient
```

---

## 9. Recurring Transaction Engine

### 9.1 Generation logic

The recurring engine runs on two triggers:
1. **On backend startup**: Generates pending transactions for the current period
2. **On-demand**: `POST /api/v1/recurring/generate` called from the frontend (e.g., when navigating to Transactions page)

```typescript
// packages/backend/src/services/recurringService.ts
async function generatePendingTransactions(upToDate: Date): Promise<Transaction[]> {
  // 1. Fetch all active recurring transactions
  // 2. For each, find the most recent generated instance
  // 3. Calculate the next occurrence(s) up to upToDate
  // 4. For each missing occurrence, create a transaction with status: 'pending'
  // 5. Skip if a transaction already exists for that recurring+date combo
  // 6. Return all newly created transactions
}
```

### 9.2 Frequency calculation

```typescript
function getNextDate(current: Date, frequency: Frequency): Date {
  switch (frequency) {
    case 'weekly':     return addWeeks(current, 1);
    case 'biweekly':   return addWeeks(current, 2);
    case 'monthly':    return addMonths(current, 1);
    case 'quarterly':  return addMonths(current, 3);
    case 'semiannual': return addMonths(current, 6);
    case 'annual':     return addYears(current, 1);
  }
}
```

Uses `date-fns` for date arithmetic — handles month-end edge cases (e.g., Jan 31 + 1 month = Feb 28).

---

## 10. Dashboard Aggregation

### 10.1 Query strategy

The dashboard endpoint (`GET /api/v1/dashboard`) executes multiple queries in parallel using `Promise.all`:

```typescript
async function getDashboardData(userId: number) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [netWorthData, spendingData, budgetData, bills, recent, history] = await Promise.all([
    getNetWorth(),                          // Sum latest snapshots by asset/liability
    getMonthlySpending(currentMonth),       // Sum confirmed expense transactions
    getBudgetStatus(currentMonth),          // Join budgets with transaction sums
    getUpcomingBills(14),                   // Pending transactions next 14 days
    getRecentTransactions(5),               // Last 5 confirmed transactions
    getNetWorthHistory(12),                 // Monthly net worth for last 12 months
  ]);
  // Compute derived values (savings rate, changes) and return
}
```

### 10.2 Net worth history

Net worth history is computed from balance snapshots. For each month, take the latest snapshot per account and sum:

```sql
SELECT DISTINCT ON (account_id, date_trunc('month', date))
  account_id,
  date_trunc('month', date) as month,
  balance,
  a.asset_or_liability
FROM balance_snapshots bs
JOIN accounts a ON a.id = bs.account_id
WHERE a.is_active = true
ORDER BY account_id, date_trunc('month', date), date DESC
```

Then group by month and compute: `net_worth = sum(assets) - sum(liabilities)`.

### 10.3 Performance consideration

For v1 with two users and thousands of transactions, these queries will be fast. If performance becomes an issue (unlikely before v2), pre-compute monthly aggregates into a `monthly_summaries` materialized view refreshed on transaction insert/update.

---

## 11. Open Architectural Decisions

| Decision | Status | Notes |
|---|---|---|
| WebSocket for live sync between Ken and Lan | Deferred | v1 uses polling via TanStack Query's refetchInterval (30s). If both are logged in simultaneously, data updates on next refetch. WebSockets add complexity for minimal gain at two users. |
| Auto-complete index for transaction descriptions | Implementation detail | Options: (a) in-memory trie built from recent transactions on frontend, (b) backend endpoint with `LIKE` query. Recommend (a) for v1 — fewer network calls, fast enough for personal data volume. |
| CSV export format | Implementation detail | Standard CSV with headers matching the transaction table columns. Use `papaparse` on the frontend or stream from the backend. Recommend backend streaming for large exports. |
| Backup encryption | Deferred | v1 `pg_dump` writes unencrypted SQL to a PVC. For cloud deployment, encrypt at rest with the storage provider or pipe through `gpg`. |

---

## 12. Technology Versions

| Package | Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Current LTS, supported until April 2026 |
| React | 18.x | Stable, well-supported by Nx |
| TypeScript | 5.x | Latest stable |
| Nx | 19.x | Latest, includes @nx/vite and @nx/node |
| Vite | 5.x | Fast HMR, ESM-native |
| Fastify | 4.x | Stable, TypeScript-first |
| Drizzle ORM | 0.35+ | Active development, API is stable |
| PostgreSQL | 16 | Latest stable |
| TanStack Query | 5.x | Latest stable |
| Zustand | 4.x | Stable, minimal API |
| React Router | 6.x | Latest with data router |
| Tailwind CSS | 3.x | Stable, broad ecosystem |
| Vitest | 2.x | Fast, Vite-native |
| Playwright | 1.x | Latest stable |
| Docker | 24+ | Latest stable |
| Kubernetes | 1.28+ | Current supported versions |

---

## 13. References

- PRD: Household Financial Planner (Confluence: PM space, pageId 720898)
- Design Specs: Household Financial Planner (Confluence: PM space, pageId 1179649)
- Market Research (Confluence: PM space, pageId 294914)
- Drizzle ORM docs: https://orm.drizzle.team
- Fastify docs: https://fastify.dev
- Nx docs: https://nx.dev
- TanStack Query docs: https://tanstack.com/query
