import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Money / quantity columns are `numeric` (arbitrary precision). The pg
 * driver returns them as strings, so JS-side `parseFloat(...)` and
 * client sorting are unaffected; SQL comparisons/ORDER BY become correct.
 */

/**
 * ============================================================
 * HOUSEHOLDS
 * ============================================================
 */
export const households = pgTable(
  'households',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    name: text('name').notNull(),

    baseCurrency: text('base_currency').default('USD').notNull(),

    inviteCode: text('invite_code'),

    legacyPillars: text('legacy_pillars'),

    // JSON map of account-level family instructions, keyed by
    // `${accountCategory}|${accountNumber}` (e.g. "INDIVIDUAL|3780").
    accountInstructions: text('account_instructions'),

    // Unlocks the offline barcode stocking module (`/stocking` route + the
    // standalone com.omniwealth.stocking app). Off for every household
    // except the pilot shops.
    stockingEnabled: boolean('stocking_enabled').default(false).notNull(),

    // Permanent Retirement Planning Settings
    currentAge: integer('current_age').default(35).notNull(),

    retirementAge: integer('retirement_age').default(65).notNull(),

    desiredIncome: numeric('desired_income').default('60000').notNull(),

    retirementCountry: text('retirement_country').default('US').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    inviteCodeIdx: uniqueIndex('households_invite_code_idx').on(
      table.inviteCode
    ),
  })
);

/**
 * ============================================================
 * USERS
 * ============================================================
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    email: text('email').notNull().unique(),

    passwordHash: text('password_hash').notNull(),

    fullName: text('full_name').notNull(),

    /**
     * Supported roles:
     * SUPER_ADMIN
     * OWNER
     * ADMIN
     * MEMBER
     * VIEWER
     */
    role: text('role').default('MEMBER').notNull(),

    themePreference: text('theme_preference')
      .default('light')
      .notNull(),

    /**
     * AI provider selected by the user.
     */
    aiProvider: text('ai_provider')
      .default('gemini')
      .notNull(),

    // Opt-in to the periodic net-worth summary email. Off by default.
    emailDigest: boolean('email_digest').default(false).notNull(),

    /**
     * Generic encrypted API key.
     *
     * New authentication/server-actions code uses this field.
     * Stored encrypted with AES-256-GCM.
     */
    aiApiKey: text('ai_api_key'),

    /**
     * Provider-specific API keys.
     *
     * Existing application compatibility is preserved.
     * These should also be encrypted when written.
     */
    geminiApiKey: text('gemini_api_key'),

    openaiApiKey: text('openai_api_key'),

    anthropicApiKey: text('anthropic_api_key'),

    groqApiKey: text('groq_api_key'),

    openrouterApiKey: text('openrouter_api_key'),

    cerebrasApiKey: text('cerebras_api_key'),

    createdAt: timestamp('created_at').defaultNow().notNull(),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),

    householdIdIdx: index('users_household_id_idx').on(
      table.householdId
    ),
  })
);

/**
 * ============================================================
 * SESSIONS
 * ============================================================
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    /**
     * SHA-256 hash of the raw session token.
     *
     * The raw token is stored only in the HttpOnly cookie.
     */
    tokenHash: text('token_hash').notNull().unique(),

    expiresAt: timestamp('expires_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),

    expiresAtIdx: index('sessions_expires_at_idx').on(
      table.expiresAt
    ),
  })
);

/**
 * ============================================================
 * INVITATIONS
 * ============================================================
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    email: text('email').notNull(),

    role: text('role').default('MEMBER').notNull(),

    /**
     * SHA-256 hash of invitation token.
     *
     * Raw token is only sent to the recipient.
     */
    tokenHash: text('token_hash').notNull().unique(),

    expiresAt: timestamp('expires_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('invitations_email_idx').on(table.email),

    householdIdIdx: index('invitations_household_id_idx').on(
      table.householdId
    ),

    expiresAtIdx: index('invitations_expires_at_idx').on(
      table.expiresAt
    ),
  })
);

/**
 * ============================================================
 * RATE LIMITS
 * ============================================================
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),

    attempts: integer('attempts').default(1).notNull(),

    resetAt: timestamp('reset_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    resetAtIdx: index('rate_limits_reset_at_idx').on(
      table.resetAt
    ),
  })
);

/**
 * ============================================================
 * PASSWORD RESETS
 * ============================================================
 */
export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    /**
     * SHA-256 hash of password-reset token.
     */
    tokenHash: text('token_hash').notNull().unique(),

    expiresAt: timestamp('expires_at').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('password_resets_user_id_idx').on(
      table.userId
    ),

    expiresAtIdx: index('password_resets_expires_at_idx').on(
      table.expiresAt
    ),
  })
);

/**
 * ============================================================
 * PORTFOLIOS
 * ============================================================
 */
export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),

    isHouseholdVisible: boolean('is_household_visible')
      .default(true)
      .notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdIdx: index('portfolios_household_id_idx').on(
      table.householdId
    ),

    userIdIdx: index('portfolios_user_id_idx').on(
      table.userId
    ),
  })
);

/**
 * ============================================================
 * ASSETS
 * ============================================================
 */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    portfolioId: uuid('portfolio_id')
      .notNull()
      .references(() => portfolios.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),

    ticker: text('ticker'),

    assetType: text('asset_type').notNull(),

    accountCategory: text('account_category').notNull(),

    accountNumber: text('account_number').notNull(),

    rationale: text('rationale').notNull(),

    nativeCurrency: text('native_currency').notNull(),

    quantity: numeric('quantity'),

    nativeValue: numeric('native_value').notNull(),

    // Estate-planning metadata — optional free text.
    beneficiary: text('beneficiary'),

    accessNotes: text('access_notes'),

    createdAt: timestamp('created_at').defaultNow().notNull(),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdIdx: index('assets_household_id_idx').on(
      table.householdId
    ),

    userIdIdx: index('assets_user_id_idx').on(
      table.userId
    ),

    portfolioIdIdx: index('assets_portfolio_id_idx').on(
      table.portfolioId
    ),

    tickerIdx: index('assets_ticker_idx').on(table.ticker),
  })
);

/**
 * ============================================================
 * TRANSACTIONS
 * ============================================================
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, {
        onDelete: 'cascade',
      }),

    type: text('type').notNull(),

    quantity: numeric('quantity').notNull(),

    nativePrice: numeric('native_price').notNull(),

    nativeCurrency: text('native_currency').notNull(),

    fxRateToBaseOnDate: numeric('fx_rate_to_base_on_date').notNull(),

    transactionDate: timestamp('transaction_date')
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    assetIdIdx: index('transactions_asset_id_idx').on(
      table.assetId
    ),

    transactionDateIdx: index(
      'transactions_transaction_date_idx'
    ).on(table.transactionDate),
  })
);

/**
 * ============================================================
 * DRAFT LINE ITEMS
 * ============================================================
 */
export const draftLineItems = pgTable(
  'draft_line_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    assetName: text('asset_name').notNull(),

    ticker: text('ticker'),

    assetType: text('asset_type').notNull(),

    accountCategory: text('account_category').notNull(),

    accountNumber: text('account_number').notNull(),

    rationale: text('rationale').notNull(),

    quantity: numeric('quantity').default('1'),

    pricePerUnit: numeric('price_per_unit'),

    totalNativeValue: numeric('total_native_value').notNull(),

    nativeCurrency: text('native_currency').notNull(),

    status: text('status').default('PENDING').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdIdx: index('draft_line_items_household_id_idx').on(
      table.householdId
    ),

    userIdIdx: index('draft_line_items_user_id_idx').on(
      table.userId
    ),

    statusIdx: index('draft_line_items_status_idx').on(
      table.status
    ),
  })
);

/**
 * ============================================================
 * DOCUMENTS
 * ============================================================
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, {
        onDelete: 'cascade',
      }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),

    assetId: uuid('asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),

    name: text('name').notNull(),

    fileUrl: text('file_url').notNull(),

    fileType: text('file_type').notNull(),

    fileSize: text('file_size'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdIdx: index('documents_household_id_idx').on(
      table.householdId
    ),

    userIdIdx: index('documents_user_id_idx').on(
      table.userId
    ),

    assetIdIdx: index('documents_asset_id_idx').on(
      table.assetId
    ),
  })
);
/**
 * ============================================================
 * AUDIT LOG (append-only)
 * ============================================================
 *
 * No FK constraints on purpose — the trail must survive deletion of the
 * user / household it refers to. actorEmail is denormalized for the same
 * reason.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id'),

    actorUserId: uuid('actor_user_id'),

    actorEmail: text('actor_email'),

    action: text('action').notNull(),

    targetType: text('target_type'),

    targetId: text('target_id'),

    meta: text('meta'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdx: index('audit_log_household_id_idx').on(table.householdId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
  })
);

/**
 * Daily net-worth snapshots. Written once per day per household by the
 * /api/cron/net-worth-snapshot route so the trend chart can show real
 * history instead of values reconstructed from current holdings.
 * One row per (household, date) — the cron upserts on that pair.
 */
export const netWorthSnapshots = pgTable(
  'net_worth_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    householdId: uuid('household_id').notNull(),

    // Base currency the total was computed in, at snapshot time.
    currency: text('currency').notNull(),

    total: numeric('total').notNull(),

    snapshotDate: date('snapshot_date', { mode: 'string' }).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    householdDateIdx: uniqueIndex('nws_household_date_idx').on(
      table.householdId,
      table.snapshotDate,
    ),
  })
);

/**
 * ============================================================
 * STOCKING MODULE — cloud sync targets (LATER PHASE)
 * ============================================================
 *
 * The stocking app is offline-first: IndexedDB on the device is the source of
 * truth. These tables are the eventual sync destination. Primary keys are the
 * client-generated UUIDs so a push is a plain upsert; `updatedAt` drives
 * last-write-wins and `deletedAt` carries tombstones. Nothing writes here
 * yet — the sync endpoint is a future phase.
 */
export const stockProducts = pgTable(
  'stock_products',
  {
    // Client-generated UUID (matches the IndexedDB row id).
    id: uuid('id').primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),

    barcode: text('barcode'),
    name: text('name').notNull(),
    mrp: numeric('mrp').notNull().default('0'),
    price: numeric('price').notNull().default('0'),
    stockQty: numeric('stock_qty').notNull().default('0'),
    unit: text('unit').notNull().default('piece'),
    lowStockThreshold: numeric('low_stock_threshold').notNull().default('0'),

    // Epoch-ms mirrors of the device clock (not server time) — the client
    // owns these so sync ordering is stable across the round trip.
    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'),

    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdx: index('stock_products_household_idx').on(table.householdId),
    householdBarcodeIdx: index('stock_products_household_barcode_idx').on(
      table.householdId,
      table.barcode,
    ),
  }),
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey(),

    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),

    productId: uuid('product_id').notNull(),

    delta: numeric('delta').notNull(),
    reason: text('reason').notNull(),
    qtyAfter: numeric('qty_after').notNull(),
    note: text('note'),

    createdAt: numeric('created_at').notNull(),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (table) => ({
    householdIdx: index('stock_movements_household_idx').on(table.householdId),
    productIdx: index('stock_movements_product_idx').on(table.productId),
  }),
);
