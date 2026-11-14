ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "saved_by_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visa_applications_one_draft_per_user_listing" ON "visa_applications" USING btree ("user_id","visa_listing_id") WHERE "status" = 'draft';--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN IF NOT EXISTS "submit_id" uuid;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN IF NOT EXISTS "saved_by_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passport_services_submit_id_unique" ON "passport_services" USING btree ("submit_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passport_services_one_draft_per_user_listing" ON "passport_services" USING btree ("user_id","passport_listing_id") WHERE "status" = 'draft';--> statement-breakpoint
DROP TABLE IF EXISTS "application_drafts";--> statement-breakpoint
DROP TABLE IF EXISTS "passport_application_drafts";
