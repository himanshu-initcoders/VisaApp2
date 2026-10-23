CREATE TABLE "application_credential_reveals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" uuid NOT NULL,
	"revealed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"application_type" varchar(50) NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_ciphertext" text NOT NULL,
	"password_iv" varchar(32) NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_credential_reveals" ADD CONSTRAINT "application_credential_reveals_credential_id_application_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."application_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_credential_reveals" ADD CONSTRAINT "application_credential_reveals_revealed_by_users_id_fk" FOREIGN KEY ("revealed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_credentials" ADD CONSTRAINT "application_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_credentials" ADD CONSTRAINT "application_credentials_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_credential_reveals_credential_id_idx" ON "application_credential_reveals" USING btree ("credential_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_credentials_application_unique" ON "application_credentials" USING btree ("application_id","application_type");