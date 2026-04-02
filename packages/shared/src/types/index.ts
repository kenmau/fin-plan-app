/**
 * Shared Type Definitions — Household Financial Planner
 *
 * Single source of truth imported by both frontend and backend.
 * Every type here mirrors a schema in openapi.yaml exactly.
 *
 * @module packages/shared/src/types/index.ts
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const AccountType = {
  CHEQUING: 'chequing',
  SAVINGS: 'savings',
  CREDIT_CARD: 'credit_card',
  RRSP: 'rrsp',
  TFSA: 'tfsa',
  SPOUSAL_RRSP: 'spousal_rrsp',
  RESP: 'resp',
  LIRA: 'lira',
  RRIF: 'rrif',
  NON_REGISTERED: 'non_registered',
  MORTGAGE: 'mortgage',
  LOC: 'loc',
  PROPERTY: 'property',
  VEHICLE: 'vehicle',
  OTHER_ASSET: 'other_asset',
  OTHER_LIABILITY: 'other_liability',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AssetOrLiability = {
  ASSET: 'asset',
  LIABILITY: 'liability',
} as const;
export type AssetOrLiability = (typeof AssetOrLiability)[keyof typeof AssetOrLiability];

/** Maps each account type to asset or liability. Source of truth for auto-classification. */
export const ACCOUNT_TYPE_CLASSIFICATION: Record<AccountType, AssetOrLiability> = {
  chequing: 'asset',
  savings: 'asset',
  credit_card: 'liability',
  rrsp: 'asset',
  tfsa: 'asset',
  spousal_rrsp: 'asset',
  resp: 'asset',
  lira: 'asset',
  rrif: 'asset',
  non_registered: 'asset',
  mortgage: 'liability',
  loc: 'liability',
  property: 'asset',
  vehicle: 'asset',
  other_asset: 'asset',
  other_liability: 'liability',
};

export const TransactionType = {
  EXPENSE: 'expense',
  INCOME: 'income',
  TRANSFER: 'transfer',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  SKIPPED: 'skipped',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const CategoryType = {
  EXPENSE: 'expense',
  INCOME: 'income',
  TRANSFER: 'transfer',
} as const;
export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export const Frequency = {
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMIANNUAL: 'semiannual',
  ANNUAL: 'annual',
} as const;
export type Frequency = (typeof Frequency)[keyof typeof Frequency];

export const GoalStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const GoalPriority = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type GoalPriority = (typeof GoalPriority)[keyof typeof GoalPriority];

export const ContributionType = {
  RRSP: 'rrsp',
  TFSA: 'tfsa',
  SPOUSAL_RRSP: 'spousal_rrsp',
  RESP: 'resp',
} as const;
export type ContributionType = (typeof ContributionType)[keyof typeof ContributionType];

export const PaceStatus = {
  UNDER_PACE: 'under_pace',
  ON_PACE: 'on_pace',
  OVER_PACE: 'over_pace',
} as const;
export type PaceStatus = (typeof PaceStatus)[keyof typeof PaceStatus];

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const DashboardWidget = {
  NET_WORTH_SUMMARY: 'net_worth_summary',
  NET_WORTH_CHART: 'net_worth_chart',
  ASSET_BREAKDOWN: 'asset_breakdown',
  MONTHLY_SPENDING: 'monthly_spending',
  UPCOMING_BILLS: 'upcoming_bills',
  BUDGET_STATUS: 'budget_status',
  RECENT_TRANSACTIONS: 'recent_transactions',
  SAVINGS_RATE: 'savings_rate',
} as const;
export type DashboardWidget = (typeof DashboardWidget)[keyof typeof DashboardWidget];

export const AssetCategory = {
  CASH: 'cash',
  INVESTMENT: 'investment',
  PROPERTY: 'property',
  DEBT: 'debt',
  OTHER: 'other',
} as const;
export type AssetCategory = (typeof AssetCategory)[keyof typeof AssetCategory];

// ---------------------------------------------------------------------------
// API Response Wrapper
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Array<{ field: string; issue: string }>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  institution: string | null;
  accountType: AccountType;
  assetOrLiability: AssetOrLiability;
  currency: 'CAD' | 'USD';
  notes: string | null;
  isActive: boolean;
  currentBalance: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  name: string;
  institution?: string;
  accountType: AccountType;
  currency?: 'CAD' | 'USD';
  notes?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  institution?: string;
  currency?: 'CAD' | 'USD';
  notes?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Balance Snapshot
// ---------------------------------------------------------------------------

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  balance: string; // decimal string
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateSnapshotRequest {
  date?: string;
  balance: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  children?: Category[];
}

export interface CreateCategoryRequest {
  name: string;
  parentCategoryId?: string;
  type: CategoryType;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface TransactionSplit {
  id: string;
  categoryId: string;
  category?: Category;
  amount: string;
  notes: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: string; // always positive; type indicates direction
  description: string | null;
  categoryId: string | null;
  category?: Category;
  accountId: string | null;
  type: TransactionType;
  notes: string | null;
  isRecurringInstance: boolean;
  recurringTransactionId: string | null;
  status: TransactionStatus;
  enteredBy: string;
  splits?: TransactionSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionSplitInput {
  categoryId: string;
  amount: string;
  notes?: string;
}

export interface CreateTransactionRequest {
  date?: string;
  amount: string;
  description?: string;
  categoryId?: string;
  accountId?: string;
  type: TransactionType;
  notes?: string;
  splits?: CreateTransactionSplitInput[];
}

export interface UpdateTransactionRequest {
  date?: string;
  amount?: string;
  description?: string;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  notes?: string;
  status?: TransactionStatus;
  splits?: CreateTransactionSplitInput[];
}

export interface BatchCreateTransactionsRequest {
  transactions: CreateTransactionRequest[];
}

export interface BatchCreateTransactionsResponse {
  created: Transaction[];
  errors: Array<{ index: number; error: string }>;
}

export interface TransactionAutoComplete {
  description: string;
  categoryId: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface BudgetEntry {
  id: string;
  categoryId: string;
  category?: Category;
  month: string; // YYYY-MM
  amount: string;
  rolloverEnabled: boolean;
  // Computed fields
  spent?: string;
  remaining?: string;
  rolloverAmount?: string;
  paceStatus?: PaceStatus;
}

export interface BudgetUpsertInput {
  categoryId: string;
  month: string;
  amount: string;
  rolloverEnabled?: boolean;
}

export interface BudgetUpsertRequest {
  budgets: BudgetUpsertInput[];
}

export interface BudgetSummary {
  month: string;
  totalIncome: string;
  totalBudgeted: string;
  totalSpent: string;
  remaining: string;
  savingsRate: number; // percentage
}

export interface BudgetTrendEntry {
  month: string;
  categoryId: string;
  categoryName: string;
  budgeted: string;
  actual: string;
}

// ---------------------------------------------------------------------------
// Recurring Transaction
// ---------------------------------------------------------------------------

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: string;
  categoryId: string | null;
  category?: Category;
  accountId: string | null;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  nextOccurrence?: string; // computed
  createdBy: string;
  createdAt: string;
}

export interface CreateRecurringRequest {
  description: string;
  amount: string;
  categoryId?: string;
  accountId?: string;
  type: TransactionType;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
}

export interface UpdateRecurringRequest {
  description?: string;
  amount?: string;
  categoryId?: string;
  accountId?: string;
  frequency?: Frequency;
  endDate?: string;
  isActive?: boolean;
}

export interface GenerateRecurringResponse {
  generated: number;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface NetWorthData {
  total: string;
  totalAssets: string;
  totalLiabilities: string;
  changeFromLastMonth: string;
}

export interface SpendingCategorySummary {
  categoryId: string;
  categoryName: string;
  amount: string;
}

export interface BudgetStatusEntry {
  categoryId: string;
  categoryName: string;
  budgeted: string;
  spent: string;
  paceStatus: PaceStatus;
}

export interface UpcomingBill {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  accountId: string;
  isOverdue: boolean;
}

export interface NetWorthHistoryEntry {
  month: string;
  netWorth: string;
  assets: string;
  liabilities: string;
}

export interface AssetBreakdownEntry {
  category: AssetCategory;
  total: string;
  percentage: number;
}

export interface DashboardResponse {
  netWorth: NetWorthData;
  monthlySpending: {
    total: string;
    topCategories: SpendingCategorySummary[];
  };
  budgetStatus: {
    totalBudgeted: string;
    totalSpent: string;
    categories: BudgetStatusEntry[];
  };
  upcomingBills: UpcomingBill[];
  recentTransactions: Transaction[];
  netWorthHistory: NetWorthHistoryEntry[];
  assetBreakdown: AssetBreakdownEntry[];
  savingsRate: number | null;
}

export interface WidgetConfigEntry {
  widgetId: DashboardWidget;
  visible: boolean;
  order: number;
}

export interface DashboardLayoutRequest {
  widgetConfig: WidgetConfigEntry[];
}

export interface DashboardLayoutResponse {
  id: string;
  userId: string;
  widgetConfig: WidgetConfigEntry[];
}

// ---------------------------------------------------------------------------
// Goal (P1)
// ---------------------------------------------------------------------------

export interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string | null;
  priority: GoalPriority;
  linkedAccountId: string | null;
  icon: string | null;
  color: string | null;
  status: GoalStatus;
  monthlySavingsTarget: string | null; // computed
  projectedCompletionDate: string | null; // computed
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  contributions?: GoalContribution[];
}

export interface CreateGoalRequest {
  name: string;
  targetAmount: string;
  targetDate?: string;
  priority?: GoalPriority;
  linkedAccountId?: string;
  icon?: string;
  color?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  targetAmount?: string;
  currentAmount?: string;
  targetDate?: string;
  priority?: GoalPriority;
  linkedAccountId?: string | null;
  icon?: string;
  color?: string;
  status?: GoalStatus;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  date: string;
  amount: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateGoalContributionRequest {
  date?: string;
  amount: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Tax Planning (P1)
// ---------------------------------------------------------------------------

export interface TaxProfile {
  id: string;
  userId: string;
  taxYear: number;
  annualIncome: string;
  rrspRoom: string;
  tfsaRoom: string;
  // Computed
  rrspUsed?: string;
  tfsaUsed?: string;
  rrspRemaining?: string;
  tfsaRemaining?: string;
  federalMarginalRate?: number;
  provincialMarginalRate?: number;
  combinedMarginalRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxProfileRequest {
  taxYear: number;
  annualIncome: string;
  rrspRoom: string;
  tfsaRoom: string;
}

export interface UpdateTaxProfileRequest {
  annualIncome?: string;
  rrspRoom?: string;
  tfsaRoom?: string;
}

export interface TaxContribution {
  id: string;
  taxProfileId: string;
  accountId: string | null;
  date: string;
  amount: string;
  contributionType: ContributionType;
  beneficiaryUserId: string | null;
  attributionExpiryDate: string | null; // computed for spousal RRSP
  attributionCleared: boolean; // computed
  createdAt: string;
}

export interface CreateTaxContributionRequest {
  accountId?: string;
  date?: string;
  amount: string;
  contributionType: ContributionType;
  beneficiaryUserId?: string; // required for spousal_rrsp
}

export interface TaxRecommendation {
  recommendation: 'prioritize_rrsp' | 'prioritize_tfsa' | 'split_evenly';
  rationale: string;
  estimatedRrspRefund: string;
  disclaimer: string;
}
