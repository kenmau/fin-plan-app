/**
 * Drizzle ORM Schema — Household Financial Planner
 *
 * All tables use UUID primary keys (via gen_random_uuid()).
 * Monetary values use numeric(14,2) — never JavaScript floats.
 * Includes P0 (MVP) and P1 (Goals, Tax) tables.
 *
 * @module packages/backend/src/db/schema.ts
 */

import { pgTable, uuid, varchar, text, boolean, integer, numeric, date, timestamp, pgEnum, uniqueIndex, index, jsonb, PgColumn } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const accountTypeEnum = pgEnum('account_type', [
  'chequing', 'savings', 'credit_card',
  'rrsp', 'tfsa', 'spousal_rrsp', 'resp', 'lira', 'rrif', 'non_registered',
  'mortgage', 'loc',
  'property', 'vehicle',
  'other_asset', 'other_liability',
]);

export const assetOrLiabilityEnum = pgEnum('asset_or_liability', ['asset', 'liability']);

export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'transfer']);

export const transactionStatusEnum = pgEnum('transaction_status', ['confirmed', 'pending', 'skipped']);

export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income', 'transfer']);

export const frequencyEnum = pgEnum('frequency', [
  'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual',
]);

export const goalStatusEnum = pgEnum('goal_status', ['active', 'completed', 'abandoned']);

export const goalPriorityEnum = pgEnum('goal_priority', ['high', 'medium', 'low']);

export const contributionTypeEnum = pgEnum('contribution_type', ['rrsp', 'tfsa', 'spousal_rrsp', 'resp']);

// ---------------------------------------------------------------------------
// P0 Tables
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  institution: varchar('institution', { length: 100 }),
  accountType: accountTypeEnum('account_type').notNull(),
  assetOrLiability: assetOrLiabilityEnum('asset_or_liability').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('CAD'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('idx_accounts_type').on(table.accountType),
  activeIdx: index('idx_accounts_active').on(table.isActive),
}));

export const balanceSnapshots = pgTable('balance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountDateIdx: index('idx_snapshots_account_date').on(table.accountId, table.date),
}));

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull(),
  parentCategoryId: uuid('parent_category_id').references((): PgColumn => categories.id, { onDelete: 'restrict' }),
  type: categoryTypeEnum('type').notNull(),
  icon: varchar('icon', { length: 30 }),
  color: varchar('color', { length: 20 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameParentUniq: uniqueIndex('uniq_category_name_parent').on(table.name, table.parentCategoryId),
  typeIdx: index('idx_categories_type').on(table.type),
}));

export const recurringTransactions = pgTable('recurring_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  description: varchar('description', { length: 200 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  activeIdx: index('idx_recurring_active').on(table.isActive),
}));

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 200 }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  notes: text('notes'),
  isRecurringInstance: boolean('is_recurring_instance').notNull().default(false),
  recurringTransactionId: uuid('recurring_transaction_id').references(() => recurringTransactions.id, { onDelete: 'set null' }),
  status: transactionStatusEnum('status').notNull().default('confirmed'),
  enteredBy: uuid('entered_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dateIdx: index('idx_transactions_date').on(table.date),
  categoryIdx: index('idx_transactions_category').on(table.categoryId),
  accountIdx: index('idx_transactions_account').on(table.accountId),
  statusIdx: index('idx_transactions_status').on(table.status),
  recurringDateUniq: uniqueIndex('uniq_recurring_date').on(table.recurringTransactionId, table.date),
}));

export const transactionSplits = pgTable('transaction_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  notes: text('notes'),
}, (table) => ({
  txnIdx: index('idx_splits_transaction').on(table.transactionId),
}));

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  rolloverEnabled: boolean('rollover_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  categoryMonthUniq: uniqueIndex('uniq_budget_category_month').on(table.categoryId, table.month),
}));

export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  widgetConfig: jsonb('widget_config').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// P1 Tables — Goals
// ---------------------------------------------------------------------------

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  targetAmount: numeric('target_amount', { precision: 14, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  targetDate: date('target_date'),
  priority: goalPriorityEnum('priority').notNull().default('medium'),
  linkedAccountId: uuid('linked_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  icon: varchar('icon', { length: 30 }),
  color: varchar('color', { length: 20 }),
  status: goalStatusEnum('status').notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('idx_goals_status').on(table.status),
  priorityIdx: index('idx_goals_priority').on(table.priority),
}));

export const goalContributions = pgTable('goal_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  goalIdx: index('idx_goal_contributions_goal').on(table.goalId),
}));

// ---------------------------------------------------------------------------
// P1 Tables — Tax Planning
// ---------------------------------------------------------------------------

export const taxProfiles = pgTable('tax_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taxYear: integer('tax_year').notNull(),
  annualIncome: numeric('annual_income', { precision: 14, scale: 2 }).notNull(),
  rrspRoom: numeric('rrsp_room', { precision: 14, scale: 2 }).notNull(),
  tfsaRoom: numeric('tfsa_room', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userYearUniq: uniqueIndex('uniq_tax_profile_user_year').on(table.userId, table.taxYear),
}));

export const taxContributions = pgTable('tax_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxProfileId: uuid('tax_profile_id').notNull().references(() => taxProfiles.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  contributionType: contributionTypeEnum('contribution_type').notNull(),
  beneficiaryUserId: uuid('beneficiary_user_id').references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  profileIdx: index('idx_tax_contributions_profile').on(table.taxProfileId),
  typeIdx: index('idx_tax_contributions_type').on(table.contributionType),
}));
