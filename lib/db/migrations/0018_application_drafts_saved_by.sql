ALTER TABLE "application_drafts" ADD COLUMN IF NOT EXISTS "saved_by_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_drafts" ADD CONSTRAINT "application_drafts_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
