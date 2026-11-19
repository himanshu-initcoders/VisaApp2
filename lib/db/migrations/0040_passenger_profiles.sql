-- Traveler profiles + document vault columns (production-safe / idempotent).
-- Tag kept as 0040_passenger_profiles for journal continuity; table is traveler_profiles.
-- Destructive drops are IF EXISTS so re-runs / partial applies do not fail.

CREATE TABLE IF NOT EXISTS "traveler_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_key" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"passport_number" varchar(50),
	"date_of_birth" varchar(32),
	"nationality" varchar(100),
	"sex" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "traveler_profiles" ADD CONSTRAINT "traveler_profiles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "traveler_profiles_user_identity_unique"
  ON "traveler_profiles" USING btree ("user_id","identity_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traveler_profiles_user_id_idx"
  ON "traveler_profiles" USING btree ("user_id");
--> statement-breakpoint
-- If an older local DB still has passenger_profiles, copy once into traveler_profiles.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'passenger_profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM traveler_profiles LIMIT 1
  ) THEN
    INSERT INTO traveler_profiles (
      id, user_id, identity_key, name, passport_number, date_of_birth,
      nationality, sex, created_at, updated_at
    )
    SELECT
      id, user_id, identity_key, name, passport_number, date_of_birth,
      nationality, sex, created_at, updated_at
    FROM passenger_profiles;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "profile_id" uuid;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "visibility" varchar(20) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "superseded_by_document_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_profile_id_passenger_profiles_id_fk";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_profile_id_traveler_profiles_id_fk"
    FOREIGN KEY ("profile_id") REFERENCES "public"."traveler_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "documents" ADD CONSTRAINT "documents_superseded_by_document_id_fk"
    FOREIGN KEY ("superseded_by_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_user_id_idx" ON "documents" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_profile_id_idx" ON "documents" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_profile_slot_visibility_idx"
  ON "documents" USING btree ("profile_id","document_type","visibility");
--> statement-breakpoint
-- Apps attach docs via travellers JSON refs + storage path; drop legacy FKs.
DROP INDEX IF EXISTS "documents_application_id_idx";
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "application_id";
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN IF EXISTS "application_type";
--> statement-breakpoint
DROP TABLE IF EXISTS "passenger_profiles";
