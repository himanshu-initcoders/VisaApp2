CREATE TABLE "application_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"traveller_id" uuid,
	"author_id" uuid,
	"author_role" varchar(20) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"target_key" varchar(200) NOT NULL,
	"comment" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb
);
--> statement-breakpoint
CREATE TABLE "correction_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"traveller_id" uuid NOT NULL,
	"requested_by" uuid,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resubmitted_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"href" varchar(500) NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_items" ADD CONSTRAINT "correction_items_request_id_correction_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."correction_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_application_id_visa_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."visa_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_comments_application_id_idx" ON "application_comments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "correction_items_request_id_idx" ON "correction_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "correction_requests_application_id_idx" ON "correction_requests" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "correction_requests_traveller_status_idx" ON "correction_requests" USING btree ("traveller_id","status");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");