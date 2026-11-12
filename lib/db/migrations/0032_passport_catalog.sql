CREATE TYPE "public"."passport_service_type" AS ENUM('fresh', 'reissue');--> statement-breakpoint
CREATE TYPE "public"."passport_scheme" AS ENUM('normal', 'tatkaal');--> statement-breakpoint
CREATE TYPE "public"."passport_booklet_pages" AS ENUM('36', '60');--> statement-breakpoint
CREATE TABLE "passport_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_type" "passport_service_type" NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"standard_eta_duration" integer,
	"standard_eta_unit" "unit",
	"is_active" boolean DEFAULT true NOT NULL,
	"seo" jsonb,
	"last_edited_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_listing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"scheme" "passport_scheme" NOT NULL,
	"booklet_pages" "passport_booklet_pages" NOT NULL,
	"government_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"service_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"government_gst_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_form_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_additional_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"question_type" "question_type" NOT NULL,
	"required" boolean DEFAULT false,
	"extra_info" text,
	"required_doc" varchar(100),
	"source_url" text,
	"options" jsonb DEFAULT '[]'::jsonb,
	"visibility" jsonb DEFAULT 'null'::jsonb,
	"document_conditions" jsonb DEFAULT 'null'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_components_required" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"document_type" varchar(80),
	"label" text,
	"amount" numeric(10, 2) DEFAULT '0',
	"chargeable" boolean DEFAULT false,
	"toggle" boolean DEFAULT false,
	"attributes" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "passport_form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"published_by" uuid
);--> statement-breakpoint
CREATE TABLE "passport_application_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"passport_listing_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"saved_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "passport_listing_id" uuid;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "price_option_id" uuid;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "form_version_id" uuid;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "form_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "passport_services" ADD COLUMN "reference_number" varchar(32);--> statement-breakpoint
ALTER TABLE "passport_listing_prices" ADD CONSTRAINT "passport_listing_prices_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_form_steps" ADD CONSTRAINT "passport_form_steps_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_additional_questions" ADD CONSTRAINT "passport_additional_questions_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_additional_questions" ADD CONSTRAINT "passport_additional_questions_step_id_passport_form_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."passport_form_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_components_required" ADD CONSTRAINT "passport_components_required_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_faqs" ADD CONSTRAINT "passport_faqs_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_form_versions" ADD CONSTRAINT "passport_form_versions_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_form_versions" ADD CONSTRAINT "passport_form_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_application_drafts" ADD CONSTRAINT "passport_application_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_application_drafts" ADD CONSTRAINT "passport_application_drafts_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_application_drafts" ADD CONSTRAINT "passport_application_drafts_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_passport_listing_id_passport_listings_id_fk" FOREIGN KEY ("passport_listing_id") REFERENCES "public"."passport_listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_price_option_id_passport_listing_prices_id_fk" FOREIGN KEY ("price_option_id") REFERENCES "public"."passport_listing_prices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_form_version_id_passport_form_versions_id_fk" FOREIGN KEY ("form_version_id") REFERENCES "public"."passport_form_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "passport_listings_service_type_unique" ON "passport_listings" USING btree ("service_type");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_listings_slug_unique" ON "passport_listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "passport_listing_prices_listing_id_idx" ON "passport_listing_prices" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_listing_prices_matrix_unique" ON "passport_listing_prices" USING btree ("passport_listing_id","scheme","booklet_pages");--> statement-breakpoint
CREATE INDEX "passport_form_steps_listing_id_idx" ON "passport_form_steps" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE INDEX "passport_additional_questions_listing_id_idx" ON "passport_additional_questions" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE INDEX "passport_additional_questions_step_id_idx" ON "passport_additional_questions" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "passport_components_required_listing_id_idx" ON "passport_components_required" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE INDEX "passport_faqs_listing_id_idx" ON "passport_faqs" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_form_versions_listing_version_unique" ON "passport_form_versions" USING btree ("passport_listing_id","version");--> statement-breakpoint
CREATE INDEX "passport_form_versions_listing_id_idx" ON "passport_form_versions" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_application_drafts_user_listing_unique" ON "passport_application_drafts" USING btree ("user_id","passport_listing_id");--> statement-breakpoint
CREATE INDEX "passport_services_user_id_idx" ON "passport_services" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passport_services_listing_id_idx" ON "passport_services" USING btree ("passport_listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_services_reference_number_unique" ON "passport_services" USING btree ("reference_number");--> statement-breakpoint
INSERT INTO "passport_listings" ("id", "service_type", "name", "slug", "description", "standard_eta_duration", "standard_eta_unit", "is_active")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'fresh', 'Fresh passport', 'fresh-passport', 'For first-time applicants who have never held an Indian passport.', 30, 'days', true),
  ('a1000000-0000-4000-8000-000000000002', 'reissue', 'Re-issue passport', 'reissue-passport', 'For expiry, near-expiry, exhausted pages, change in particulars, lost, or damaged passport cases.', 30, 'days', true);--> statement-breakpoint
INSERT INTO "passport_listing_prices" ("passport_listing_id", "scheme", "booklet_pages", "government_fee_amount", "service_fee_amount", "government_gst_fee_amount", "sort_order")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'normal', '36', '1500.00', '2000.00', '0.00', 0),
  ('a1000000-0000-4000-8000-000000000001', 'normal', '60', '2000.00', '2000.00', '0.00', 1),
  ('a1000000-0000-4000-8000-000000000001', 'tatkaal', '36', '3500.00', '2000.00', '0.00', 2),
  ('a1000000-0000-4000-8000-000000000001', 'tatkaal', '60', '4000.00', '2000.00', '0.00', 3),
  ('a1000000-0000-4000-8000-000000000002', 'normal', '36', '1500.00', '2000.00', '0.00', 0),
  ('a1000000-0000-4000-8000-000000000002', 'normal', '60', '2000.00', '2000.00', '0.00', 1),
  ('a1000000-0000-4000-8000-000000000002', 'tatkaal', '36', '3500.00', '2000.00', '0.00', 2),
  ('a1000000-0000-4000-8000-000000000002', 'tatkaal', '60', '4000.00', '2000.00', '0.00', 3);