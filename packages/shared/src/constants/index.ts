/**
 * Shared Constants — Household Financial Planner
 */

import { AccountType, AssetOrLiability, CategoryType, Frequency } from '../types';

export const ACCOUNT_TYPES_BY_CLASSIFICATION: Record<AssetOrLiability, AccountType[]> = {
  asset: [
    'chequing', 'savings', 'rrsp', 'tfsa', 'spousal_rrsp', 'resp', 'lira', 'rrif',
    'non_registered', 'property', 'vehicle', 'other_asset',
  ],
  liability: ['credit_card', 'mortgage', 'loc', 'other_liability'],
};

export const CANADIAN_ACCOUNT_TYPES: AccountType[] = [
  'rrsp', 'tfsa', 'spousal_rrsp', 'resp', 'lira', 'rrif',
];

export const DEFAULT_CURRENCY = 'CAD' as const;

export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 50,
  maxPageSize: 100,
} as const;

export const JWT_COOKIE_NAME = 'token' as const;

export const DEFAULT_CATEGORY_TYPES: CategoryType[] = ['expense', 'income', 'transfer'];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-annual',
  annual: 'Annual',
};

export const MONETARY_LOCALE = 'en-CA' as const;
export const MONETARY_CURRENCY = 'CAD' as const;
