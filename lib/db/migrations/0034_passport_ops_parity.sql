-- Passport ops parity: reviewer assignment + polymorphic corrections/staff edits

ALTER TABLE "passport_services" ADD COLUMN "assigned_reviewer_id" uuid;--> statement-breakpoint
ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passport_services_assigned_reviewer_id_idx" ON "passport_services" USING btree ("assigned_reviewer_id");--> statement-breakpoint

ALTER TABLE "correction_requests" DROP CONSTRAINT IF EXISTS "correction_requests_application_id_visa_applications_id_fk";--> statement-breakpoint
ALTER TABLE "correction_requests" DROP CONSTRAINT IF EXISTS "correction_requests_traveller_id_visa_application_travellers_id_fk";--> statement-breakpoint
ALTER TABLE "correction_requests" ADD COLUMN "application_type" varchar(50) DEFAULT 'visa' NOT NULL;--> statement-breakpoint
ALTER TABLE "correction_requests" ALTER COLUMN "traveller_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "correction_requests_application_type_idx" ON "correction_requests" USING btree ("application_type","application_id");--> statement-breakpoint

ALTER TABLE "staff_field_edits" DROP CONSTRAINT IF EXISTS "staff_field_edits_application_id_visa_applications_id_fk";--> statement-breakpoint
ALTER TABLE "staff_field_edits" DROP CONSTRAINT IF EXISTS "staff_field_edits_traveller_id_visa_application_travellers_id_fk";--> statement-breakpoint
ALTER TABLE "staff_field_edits" ADD COLUMN "application_type" varchar(50) DEFAULT 'visa' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_field_edits" ALTER COLUMN "traveller_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_field_edits" ADD CONSTRAINT "staff_field_edits_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_field_edits_application_type_idx" ON "staff_field_edits" USING btree ("application_type","application_id");
