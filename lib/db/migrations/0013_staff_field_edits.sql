CREATE TABLE "staff_field_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"traveller_id" uuid NOT NULL,
	"actor_id" uuid,
	"kind" varchar(20) NOT NULL,
	"target_key" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_field_edits" ADD CONSTRAINT "staff_field_edits_application_id_visa_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."visa_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_field_edits" ADD CONSTRAINT "staff_field_edits_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_field_edits" ADD CONSTRAINT "staff_field_edits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_field_edits_application_id_idx" ON "staff_field_edits" USING btree ("application_id");