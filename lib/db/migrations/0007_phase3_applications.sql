CREATE TABLE IF NOT EXISTS "form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"published_by" uuid
);
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "form_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "form_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "travellers" jsonb;
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "applicant_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "applicant_phone" varchar(20);
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "passenger_names" text;
--> statement-breakpoint
ALTER TABLE "visa_applications" ADD COLUMN IF NOT EXISTS "submit_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"phone" varchar(30) NOT NULL,
	"note" text NOT NULL,
	"admin_user_id" uuid,
	"admin_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"body" text NOT NULL,
	"admin_user_id" uuid,
	"admin_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_listing_id_visa_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_form_version_id_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_call_logs" ADD CONSTRAINT "application_call_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_versions_listing_version_unique" ON "form_versions" USING btree ("listing_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_versions_listing_id_idx" ON "form_versions" USING btree ("listing_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visa_applications_submit_id_unique" ON "visa_applications" USING btree ("submit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visa_applications_status_submitted_at_idx" ON "visa_applications" USING btree ("status","submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visa_applications_country_code_idx" ON "visa_applications" USING btree ("country_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visa_applications_applicant_phone_idx" ON "visa_applications" USING btree ("applicant_phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_call_logs_application_id_idx" ON "application_call_logs" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "application_notes_application_id_idx" ON "application_notes" USING btree ("application_id");
