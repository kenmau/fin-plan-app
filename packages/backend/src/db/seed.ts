/**
 * Seed Data — Household Financial Planner
 *
 * Creates: 2 users (Ken, Lan), 18 default categories, default dashboard layouts.
 * Idempotent — safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Password hashes are read from environment variables:
 *   KEN_PASSWORD_HASH, LAN_PASSWORD_HASH
 *
 * @module packages/backend/src/db/seed.ts
 */

import { db } from './client';
import { users, categories, dashboardLayouts } from './schema';
import { sql } from 'drizzle-orm';

const DEFAULT_WIDGET_CONFIG = [
  { widgetId: 'net_worth_summary', visible: true, order: 0 },
  { widgetId: 'net_worth_chart', visible: true, order: 1 },
  { widgetId: 'asset_breakdown', visible: true, order: 2 },
  { widgetId: 'budget_status', visible: true, order: 3 },
  { widgetId: 'upcoming_bills', visible: true, order: 4 },
  { widgetId: 'recent_transactions', visible: true, order: 5 },
  { widgetId: 'monthly_spending', visible: true, order: 6 },
  { widgetId: 'savings_rate', visible: true, order: 7 },
];

interface SeedCategory {
  name: string;
  type: 'expense' | 'income' | 'transfer';
  icon: string;
  color: string;
  sortOrder: number;
}

const DEFAULT_CATEGORIES: SeedCategory[] = [
  // Expense categories
  { name: 'Housing', type: 'expense', icon: 'home', color: 'purple', sortOrder: 1 },
  { name: 'Transportation', type: 'expense', icon: 'car', color: 'blue', sortOrder: 2 },
  { name: 'Groceries', type: 'expense', icon: 'shopping-cart', color: 'teal', sortOrder: 3 },
  { name: 'Dining Out', type: 'expense', icon: 'utensils', color: 'coral', sortOrder: 4 },
  { name: 'Entertainment', type: 'expense', icon: 'film', color: 'pink', sortOrder: 5 },
  { name: 'Health', type: 'expense', icon: 'heart', color: 'red', sortOrder: 6 },
  { name: 'Personal Care', type: 'expense', icon: 'user', color: 'gray', sortOrder: 7 },
  { name: 'Clothing', type: 'expense', icon: 'shirt', color: 'amber', sortOrder: 8 },
  { name: 'Education', type: 'expense', icon: 'book', color: 'blue', sortOrder: 9 },
  { name: 'Gifts & Donations', type: 'expense', icon: 'gift', color: 'pink', sortOrder: 10 },
  { name: 'Insurance', type: 'expense', icon: 'shield', color: 'gray', sortOrder: 11 },
  { name: 'Utilities', type: 'expense', icon: 'zap', color: 'amber', sortOrder: 12 },
  { name: 'Subscriptions', type: 'expense', icon: 'credit-card', color: 'purple', sortOrder: 13 },
  { name: 'Travel', type: 'expense', icon: 'plane', color: 'teal', sortOrder: 14 },
  { name: 'Miscellaneous', type: 'expense', icon: 'more-horizontal', color: 'gray', sortOrder: 15 },
  // Income categories
  { name: 'Income (Salary)', type: 'income', icon: 'briefcase', color: 'green', sortOrder: 1 },
  { name: 'Income (Investment)', type: 'income', icon: 'trending-up', color: 'green', sortOrder: 2 },
  { name: 'Income (Other)', type: 'income', icon: 'dollar-sign', color: 'green', sortOrder: 3 },
];

export async function seed() {
  const kenHash = process.env.KEN_PASSWORD_HASH;
  const lanHash = process.env.LAN_PASSWORD_HASH;

  if (!kenHash || !lanHash) {
    throw new Error('KEN_PASSWORD_HASH and LAN_PASSWORD_HASH environment variables are required for seeding.');
  }

  console.log('Seeding users...');
  const [ken] = await db
    .insert(users)
    .values({ username: 'ken', passwordHash: kenHash, displayName: 'Ken' })
    .onConflictDoNothing({ target: users.username })
    .returning();

  const [lan] = await db
    .insert(users)
    .values({ username: 'lan', passwordHash: lanHash, displayName: 'Lan' })
    .onConflictDoNothing({ target: users.username })
    .returning();

  // If users already existed, fetch them
  const kenUser = ken ?? (await db.select().from(users).where(sql`username = 'ken'`).limit(1))[0];
  const lanUser = lan ?? (await db.select().from(users).where(sql`username = 'lan'`).limit(1))[0];

  console.log('Seeding categories...');
  for (const cat of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isSystem: true,
      })
      .onConflictDoNothing();
  }

  console.log('Seeding dashboard layouts...');
  for (const user of [kenUser, lanUser]) {
    await db
      .insert(dashboardLayouts)
      .values({
        userId: user.id,
        widgetConfig: DEFAULT_WIDGET_CONFIG,
      })
      .onConflictDoNothing({ target: dashboardLayouts.userId });
  }

  console.log('Seed complete.');
}
