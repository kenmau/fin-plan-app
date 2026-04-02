/**
 * Shared Zod Validators — Household Financial Planner
 *
 * Used for client-side pre-submit validation and as reference schemas.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive decimal with up to 2 decimal places');

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format');

export const monthStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Must be a month in YYYY-MM format');

export const uuidSchema = z.string().uuid('Must be a valid UUID');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const loginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required').max(50),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  institution: z.string().max(100).optional(),
  accountType: z.enum([
    'chequing', 'savings', 'credit_card', 'rrsp', 'tfsa', 'spousal_rrsp',
    'resp', 'lira', 'rrif', 'non_registered', 'mortgage', 'loc',
    'property', 'vehicle', 'other_asset', 'other_liability',
  ]),
  currency: z.enum(['CAD', 'USD']).optional().default('CAD'),
  notes: z.string().max(1000).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  institution: z.string().max(100).optional(),
  currency: z.enum(['CAD', 'USD']).optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Balance Snapshot
// ---------------------------------------------------------------------------

export const createSnapshotSchema = z.object({
  date: dateStringSchema.optional(),
  balance: decimalStringSchema,
  notes: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  parentCategoryId: uuidSchema.optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  icon: z.string().max(30).optional(),
  color: z.string().max(20).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(30).optional(),
  color: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export const transactionSplitInputSchema = z.object({
  categoryId: uuidSchema,
  amount: decimalStringSchema,
  notes: z.string().max(500).optional(),
});

export const createTransactionSchema = z.object({
  date: dateStringSchema.optional(),
  amount: decimalStringSchema,
  description: z.string().max(200).optional(),
  categoryId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  notes: z.string().max(1000).optional(),
  splits: z.array(transactionSplitInputSchema).optional(),
});

export const updateTransactionSchema = z.object({
  date: dateStringSchema.optional(),
  amount: decimalStringSchema.optional(),
  description: z.string().max(200).optional(),
  categoryId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['confirmed', 'pending', 'skipped']).optional(),
  splits: z.array(transactionSplitInputSchema).optional(),
});

export const batchCreateTransactionsSchema = z.object({
  transactions: z.array(createTransactionSchema).min(1).max(100),
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export const budgetUpsertInputSchema = z.object({
  categoryId: uuidSchema,
  month: monthStringSchema,
  amount: decimalStringSchema,
  rolloverEnabled: z.boolean().optional().default(false),
});

export const budgetUpsertRequestSchema = z.object({
  budgets: z.array(budgetUpsertInputSchema).min(1),
});

// ---------------------------------------------------------------------------
// Recurring Transaction
// ---------------------------------------------------------------------------

export const createRecurringSchema = z.object({
  description: z.string().min(1).max(200),
  amount: decimalStringSchema,
  categoryId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']),
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional(),
});

export const updateRecurringSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: decimalStringSchema.optional(),
  categoryId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']).optional(),
  endDate: dateStringSchema.optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const widgetConfigEntrySchema = z.object({
  widgetId: z.enum([
    'net_worth_summary', 'net_worth_chart', 'asset_breakdown', 'monthly_spending',
    'upcoming_bills', 'budget_status', 'recent_transactions', 'savings_rate',
  ]),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

export const dashboardLayoutRequestSchema = z.object({
  widgetConfig: z.array(widgetConfigEntrySchema),
});

// ---------------------------------------------------------------------------
// Goal (P1)
// ---------------------------------------------------------------------------

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: decimalStringSchema,
  targetDate: dateStringSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  linkedAccountId: uuidSchema.optional(),
  icon: z.string().max(30).optional(),
  color: z.string().max(20).optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetAmount: decimalStringSchema.optional(),
  currentAmount: decimalStringSchema.optional(),
  targetDate: dateStringSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  linkedAccountId: uuidSchema.nullable().optional(),
  icon: z.string().max(30).optional(),
  color: z.string().max(20).optional(),
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
});

export const createGoalContributionSchema = z.object({
  date: dateStringSchema.optional(),
  amount: decimalStringSchema,
  notes: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Tax Planning (P1)
// ---------------------------------------------------------------------------

export const createTaxProfileSchema = z.object({
  taxYear: z.number().int().min(2020).max(2099),
  annualIncome: decimalStringSchema,
  rrspRoom: decimalStringSchema,
  tfsaRoom: decimalStringSchema,
});

export const updateTaxProfileSchema = z.object({
  annualIncome: decimalStringSchema.optional(),
  rrspRoom: decimalStringSchema.optional(),
  tfsaRoom: decimalStringSchema.optional(),
});

export const createTaxContributionSchema = z.object({
  accountId: uuidSchema.optional(),
  date: dateStringSchema.optional(),
  amount: decimalStringSchema,
  contributionType: z.enum(['rrsp', 'tfsa', 'spousal_rrsp', 'resp']),
  beneficiaryUserId: uuidSchema.optional(),
});
