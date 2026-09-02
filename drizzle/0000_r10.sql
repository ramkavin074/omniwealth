CREATE SCHEMA "store";
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ticker" text,
	"asset_type" text NOT NULL,
	"account_category" text NOT NULL,
	"account_number" text NOT NULL,
	"rationale" text NOT NULL,
	"native_currency" text NOT NULL,
	"quantity" numeric,
	"native_value" numeric NOT NULL,
	"beneficiary" text,
	"access_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"actor_user_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"meta" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid,
	"name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_name" text NOT NULL,
	"ticker" text,
	"asset_type" text NOT NULL,
	"account_category" text NOT NULL,
	"account_number" text NOT NULL,
	"rationale" text NOT NULL,
	"quantity" numeric DEFAULT '1',
	"price_per_unit" numeric,
	"total_native_value" numeric NOT NULL,
	"native_currency" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"invite_code" text,
	"legacy_pillars" text,
	"account_instructions" text,
	"stocking_enabled" boolean DEFAULT false NOT NULL,
	"is_store_shell" boolean DEFAULT false NOT NULL,
	"current_age" integer DEFAULT 35 NOT NULL,
	"retirement_age" integer DEFAULT 65 NOT NULL,
	"desired_income" numeric DEFAULT '60000' NOT NULL,
	"retirement_country" text DEFAULT 'US' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"total" numeric NOT NULL,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_household_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"delta" numeric NOT NULL,
	"reason" text NOT NULL,
	"qty_after" numeric NOT NULL,
	"unit_cost" numeric,
	"note" text,
	"created_at" numeric NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"mrp" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"cost_price" numeric DEFAULT '0' NOT NULL,
	"stock_qty" numeric DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"low_stock_threshold" numeric DEFAULT '0' NOT NULL,
	"updated_at" numeric NOT NULL,
	"deleted_at" numeric,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."store_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"mrp" numeric DEFAULT '0' NOT NULL,
	"price" numeric DEFAULT '0' NOT NULL,
	"cost_price" numeric DEFAULT '0' NOT NULL,
	"stock_qty" numeric DEFAULT '0' NOT NULL,
	"unit" text DEFAULT 'piece' NOT NULL,
	"low_stock_threshold" numeric DEFAULT '0' NOT NULL,
	"updated_at" numeric NOT NULL,
	"deleted_at" numeric,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid,
	"supplier_id" uuid,
	"delta" numeric NOT NULL,
	"reason" text NOT NULL,
	"qty_after" numeric NOT NULL,
	"unit_cost" numeric,
	"note" text,
	"created_at" numeric NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"updated_at" numeric NOT NULL,
	"deleted_at" numeric,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"native_price" numeric NOT NULL,
	"native_currency" text NOT NULL,
	"fx_rate_to_base_on_date" numeric NOT NULL,
	"transaction_date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"theme_preference" text DEFAULT 'light' NOT NULL,
	"ai_provider" text DEFAULT 'gemini' NOT NULL,
	"email_digest" boolean DEFAULT false NOT NULL,
	"ai_api_key" text,
	"gemini_api_key" text,
	"openai_api_key" text,
	"anthropic_api_key" text,
	"groq_api_key" text,
	"openrouter_api_key" text,
	"cerebras_api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_line_items" ADD CONSTRAINT "draft_line_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_line_items" ADD CONSTRAINT "draft_line_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_products" ADD CONSTRAINT "stock_products_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."store_members" ADD CONSTRAINT "store_members_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."store_members" ADD CONSTRAINT "store_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."stores" ADD CONSTRAINT "stores_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."suppliers" ADD CONSTRAINT "suppliers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "store"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_household_id_idx" ON "assets" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "assets_user_id_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assets_portfolio_id_idx" ON "assets" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "assets_ticker_idx" ON "assets" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "audit_log_household_id_idx" ON "audit_log" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_household_id_idx" ON "documents" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_asset_id_idx" ON "documents" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "draft_line_items_household_id_idx" ON "draft_line_items" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "draft_line_items_user_id_idx" ON "draft_line_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "draft_line_items_status_idx" ON "draft_line_items" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "households_invite_code_idx" ON "households" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_household_id_idx" ON "invitations" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "invitations_expires_at_idx" ON "invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nws_household_date_idx" ON "net_worth_snapshots" USING btree ("household_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "password_resets_user_id_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_resets_expires_at_idx" ON "password_resets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "portfolios_household_id_idx" ON "portfolios" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "portfolios_user_id_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stock_movements_household_synced_idx" ON "stock_movements" USING btree ("household_id","synced_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_products_household_synced_idx" ON "stock_products" USING btree ("household_id","synced_at");--> statement-breakpoint
CREATE INDEX "stock_products_household_barcode_idx" ON "stock_products" USING btree ("household_id","barcode");--> statement-breakpoint
CREATE UNIQUE INDEX "store_members_store_user_idx" ON "store"."store_members" USING btree ("store_id","user_id");--> statement-breakpoint
CREATE INDEX "store_members_user_idx" ON "store"."store_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_products_store_synced_idx" ON "store"."products" USING btree ("store_id","synced_at");--> statement-breakpoint
CREATE INDEX "store_products_store_barcode_idx" ON "store"."products" USING btree ("store_id","barcode");--> statement-breakpoint
CREATE INDEX "store_movements_store_synced_idx" ON "store"."stock_movements" USING btree ("store_id","synced_at");--> statement-breakpoint
CREATE INDEX "store_movements_product_idx" ON "store"."stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "store_suppliers_store_synced_idx" ON "store"."suppliers" USING btree ("store_id","synced_at");--> statement-breakpoint
CREATE INDEX "transactions_asset_id_idx" ON "transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "transactions_transaction_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_household_id_idx" ON "users" USING btree ("household_id");