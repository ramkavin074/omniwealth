import {
  pgTable,
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
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

    // A "shell" household exists only to satisfy users.household_id NOT NULL
    // for a store-only account (a shop employee with no wealth vault). Wealth
    // pages redirect these users straight to /stocking.
    isStoreShell: boolean('is_store_shell').default(false).notNull(),

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
 * STORE MODULE  (schema: `store`)
 * ============================================================
 *
 * The Round <10 household-keyed `stock_products` / `stock_movements` tables
 * and `households.stocking_enabled` were retired in Round 10–11; data was
 * migrated into `store.*` and the legacy objects dropped
 * (scripts/round11-cleanup.sql).
 *
 * A shop is its own entity with its own membership — fully independent of
 * `households` so a shop employee can be given stock access without any
 * visibility into a family's wealth vault.
 *
 *   store.stores          one row per shop
 *   store.store_members    user ↔ store + role (owner | manager | staff)
 *   store.suppliers        per-store supplier directory (syncs)
 *   store.products         offline-first catalogue (syncs; was stock_products)
 *   store.stock_movements  append-only ledger (syncs; was stock_movements)
 *
 * The three synced tables keep the same contract: client-generated UUID PKs,
 * `updated_at` (epoch ms, client clock) drives last-write-wins, `deleted_at`
 * carries tombstones, server-assigned `synced_at` is the pull cursor.
 */
export const store = pgSchema('store');

export const stores = store.table('stores', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  // 'active' | 'trial' | 'suspended' — a suspended store loses stocking access
  // (sync + APIs) without its data being deleted.
  status: text('status').notNull().default('active'),
  createdBy: uuid('created_by').references(() => users.id),
  // WhatsApp number for the daily low-stock alert (owner-set). Null = no alert.
  alertPhone: text('alert_phone'),
  // GST setup (owner-set). gstin present ⇒ issue tax invoices.
  gstin: text('gstin'),
  gstEnabled: boolean('gst_enabled').notNull().default(false),
  pricesIncludeTax: boolean('prices_include_tax').notNull().default(true),
  defaultGstRate: numeric('default_gst_rate').notNull().default('0'),
  // Tax-filing helper config.
  gstScheme: text('gst_scheme').notNull().default('regular'), // regular | composition
  presumptive: boolean('presumptive').notNull().default(true), // income tax u/s 44AD
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Operator-console audit trail: account / access actions only (who created a
// store, added a member, sent a reset…). Never business data.
export const adminAudit = store.table('admin_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  storeId: uuid('store_id'),
  targetUserId: uuid('target_user_id'),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storeMembers = store.table(
  'store_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // 'owner' | 'manager' | 'staff'
    role: text('role').notNull().default('staff'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    storeUserIdx: uniqueIndex('store_members_store_user_idx').on(
      t.storeId,
      t.userId,
    ),
    userIdx: index('store_members_user_idx').on(t.userId),
  }),
);

export const suppliers = store.table(
  'suppliers',
  {
    id: uuid('id').primaryKey(), // client-generated
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    note: text('note'),
    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_suppliers_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
  }),
);

// Manual payments made to a supplier. Purchases come from stock_movements
// (delta > 0 with a supplier_id + unit_cost); paid − purchased = balance owed.
export const supplierPayments = store.table(
  'supplier_payments',
  {
    id: uuid('id').primaryKey(), // client-generated
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id').notNull(),
    amount: numeric('amount').notNull(),
    note: text('note'),
    paidAt: numeric('paid_at').notNull(), // epoch ms, client clock
    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_supplier_payments_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
    supplierIdx: index('store_supplier_payments_supplier_idx').on(t.supplierId),
  }),
);

// Billing (B1). Line items are embedded as JSON — the stock effect of a sale
// is recorded separately as scan-out rows in stock_movements; this table is
// the bill record for receipts + day-end reporting.
export const storeSales = store.table(
  'sales',
  {
    id: uuid('id').primaryKey(), // client-generated
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id), // server-stamped
    billNo: text('bill_no').notNull(),
    items: jsonb('items').notNull(), // SaleItem[]
    discount: numeric('discount').notNull().default('0'),
    taxTotal: numeric('tax_total').notNull().default('0'),
    taxBreakup: jsonb('tax_breakup').notNull().default('[]'), // TaxRow[]
    total: numeric('total').notNull(),
    tenderType: text('tender_type').notNull(),
    cashAmount: numeric('cash_amount').notNull().default('0'),
    upiAmount: numeric('upi_amount').notNull().default('0'),
    refundOf: uuid('refund_of'), // original sale id when this row is a customer refund
    note: text('note'),
    createdAt: numeric('created_at').notNull(), // epoch ms, client clock
    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'), // set when voided
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_sales_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
    storeCreatedIdx: index('store_sales_store_created_idx').on(
      t.storeId,
      t.createdAt,
    ),
  }),
);

// UPI money actually received, for reconciliation against upi/split sales.
export const storeUpiReceipts = store.table(
  'upi_receipts',
  {
    id: uuid('id').primaryKey(), // client-generated
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id), // server-stamped
    amount: numeric('amount').notNull(),
    receivedAt: numeric('received_at').notNull(), // epoch ms
    ref: text('ref'),
    payerName: text('payer_name'),
    source: text('source').notNull().default('manual'),
    matchedSaleId: uuid('matched_sale_id'),
    note: text('note'),
    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_upi_receipts_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
  }),
);

export const storeProducts = store.table(
  'products',
  {
    id: uuid('id').primaryKey(), // client-generated (matches IndexedDB id)
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),

    barcode: text('barcode'),
    name: text('name').notNull(),
    mrp: numeric('mrp').notNull().default('0'),
    price: numeric('price').notNull().default('0'),
    costPrice: numeric('cost_price').notNull().default('0'),
    stockQty: numeric('stock_qty').notNull().default('0'),
    unit: text('unit').notNull().default('piece'),
    lowStockThreshold: numeric('low_stock_threshold').notNull().default('0'),
    expiryDate: text('expiry_date'), // 'YYYY-MM-DD' of the current batch; null = untracked
    gstRate: numeric('gst_rate').notNull().default('0'), // GST %
    hsn: text('hsn'),

    updatedAt: numeric('updated_at').notNull(),
    deletedAt: numeric('deleted_at'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_products_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
    storeBarcodeIdx: index('store_products_store_barcode_idx').on(
      t.storeId,
      t.barcode,
    ),
  }),
);

export const storeStockMovements = store.table(
  'stock_movements',
  {
    id: uuid('id').primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    // Server-stamped from the caller's session on push.
    userId: uuid('user_id').references(() => users.id),
    supplierId: uuid('supplier_id'),

    delta: numeric('delta').notNull(),
    reason: text('reason').notNull(),
    qtyAfter: numeric('qty_after').notNull(),
    unitCost: numeric('unit_cost'),
    note: text('note'),

    createdAt: numeric('created_at').notNull(),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
  },
  (t) => ({
    storeSyncedIdx: index('store_movements_store_synced_idx').on(
      t.storeId,
      t.syncedAt,
    ),
    productIdx: index('store_movements_product_idx').on(t.productId),
  }),
);
