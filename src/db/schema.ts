import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  baseCurrency: text('base_currency').default('USD').notNull(),
  inviteCode: text('invite_code'), // <-- Required for household invite codes
  legacyPillars: text('legacy_pillars'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('MEMBER'), // OWNER, ADMIN, MEMBER, VIEWER
  
  // AI Provider Settings & Multi-Keys
  aiProvider: text('ai_provider').default('gemini'),
  aiApiKey: text('ai_api_key'),
  geminiApiKey: text('gemini_api_key'),
  openaiApiKey: text('openai_api_key'),
  anthropicApiKey: text('anthropic_api_key'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const portfolios = pgTable('portfolios', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  isHouseholdVisible: boolean('is_household_visible').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull(),
  userId: uuid('user_id').notNull(),
  portfolioId: uuid('portfolio_id').notNull(),
  name: text('name').notNull(),
  ticker: text('ticker'),
  assetType: text('asset_type').notNull(),
  accountCategory: text('account_category').notNull(),
  accountNumber: text('account_number').notNull(),
  rationale: text('rationale').notNull(),
  nativeCurrency: text('native_currency').notNull(),
  quantity: text('quantity').default('1'),
  nativeValue: text('native_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').notNull(),
  type: text('type').notNull(),
  quantity: text('quantity').notNull(),
  nativePrice: text('native_price').notNull(),
  nativeCurrency: text('native_currency').notNull(),
  fxRateToBaseOnDate: text('fx_rate_to_base_on_date').notNull(),
  transactionDate: timestamp('transaction_date').defaultNow().notNull(),
});

export const draftLineItems = pgTable('draft_line_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull(),
  userId: uuid('user_id').notNull(),
  assetName: text('asset_name').notNull(),
  ticker: text('ticker'),
  assetType: text('asset_type').notNull(),
  accountCategory: text('account_category').notNull(),
  accountNumber: text('account_number').notNull(),
  rationale: text('rationale').notNull(),
  quantity: text('quantity').default('1'),
  pricePerUnit: text('price_per_unit'),
  totalNativeValue: text('total_native_value').notNull(),
  nativeCurrency: text('native_currency').notNull(),
  status: text('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull(),
  userId: uuid('user_id').notNull(),
  assetId: uuid('asset_id'),
  name: text('name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: text('file_size'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});