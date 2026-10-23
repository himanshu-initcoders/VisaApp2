ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "assigned_reviewer_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visa_applications_assigned_reviewer_id_idx" ON "visa_applications" USING btree ("assigned_reviewer_id");
