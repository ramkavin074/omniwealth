-- Round 25: operator-console audit trail.
-- Records account / access actions only — store created, member added/removed,
-- status changed, password reset sent, sessions revoked. Never business data.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "store"."admin_audit" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id"       uuid,
  "action"         text NOT NULL,
  "store_id"       uuid,
  "target_user_id" uuid,
  "detail"         text,
  "created_at"     timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "store"."admin_audit"
    ADD CONSTRAINT "admin_audit_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "admin_audit_created_at_idx"
  ON "store"."admin_audit" USING btree ("created_at");
