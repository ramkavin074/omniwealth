-- Lot expiry on stock movements (Kadai "sell this lot first").
-- One nullable column. Safe to run more than once, safe to run before the new code
-- is deployed (nothing reads it until then).
ALTER TABLE store.stock_movements ADD COLUMN IF NOT EXISTS expiry_date text;
