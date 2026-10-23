CREATE TYPE "public"."process_type" AS ENUM('electronic_travel_authorisation', 'afc', 'visa', 'appointment', 'visa_on_arrival', 'sticker_visa', 'visa_free');--> statement-breakpoint
CREATE TYPE "public"."purpose" AS ENUM('tourism', 'business', 'work', 'study', 'family', 'medical', 'transit');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('text', 'date', 'select', 'dropdown', 'file', 'flight', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('minutes', 'hours', 'days', 'months', 'years');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"application_type" varchar(50) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"s3_key" varchar(500) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"verified" boolean DEFAULT false,
	"verification_notes" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passport_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"personal_info" jsonb,
	"address_info" jsonb,
	"documents" jsonb,
	"appointment_date" timestamp,
	"appointment_location" varchar(255),
	"payment_id" uuid,
	"submitted_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"application_type" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(50),
	"transaction_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"application_type" varchar(50) NOT NULL,
	"old_status" varchar(50),
	"new_status" varchar(50) NOT NULL,
	"changed_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"email_verified" timestamp,
	"phone_verified" timestamp,
	"role" varchar(50) DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visa_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"country_code" char(2),
	"visa_listing_id" uuid,
	"country" varchar(100),
	"visa_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"personal_info" jsonb,
	"travel_info" jsonb,
	"employment_info" jsonb,
	"documents" jsonb,
	"payment_id" uuid,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "additional_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"question_type" "question_type" NOT NULL,
	"required" boolean DEFAULT false,
	"family_enabled" boolean DEFAULT false,
	"only_b2b" boolean DEFAULT false,
	"extra_info" text,
	"required_doc" varchar(100),
	"source_url" text,
	"options" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components_required" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0',
	"chargeable" boolean DEFAULT false,
	"family_enabled" boolean DEFAULT false,
	"only_b2b" boolean DEFAULT false,
	"toggle" boolean DEFAULT false,
	"attributes" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"iso2_code" char(2) NOT NULL,
	"supported" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"images" jsonb,
	"seo" jsonb,
	"show_authorization_tag" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "countries_iso2_code_unique" UNIQUE("iso2_code")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(100),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_trip_countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"additional_country_code" char(2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupation_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(100) NOT NULL,
	"value" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "occupation_types_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "passport_ocr_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"skip_blur_detection" boolean DEFAULT false,
	"skip_glare_detection" boolean DEFAULT false,
	"skip_fingers_detection" boolean DEFAULT false,
	"use_strict_fingers_detection_model" boolean DEFAULT true,
	"enable_travel_doc_check" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_validation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"setting_type" varchar(50) NOT NULL,
	"restrict_invalid_photo" boolean DEFAULT true,
	"restrict_multiple_faces" boolean DEFAULT true,
	"restrict_face_outside_frame" boolean DEFAULT true,
	"restrict_covered_face" boolean DEFAULT true,
	"restrict_closed_eyes" boolean DEFAULT true,
	"restrict_glasses" boolean DEFAULT true,
	"restrict_headcover" boolean DEFAULT false,
	"restrict_not_centered_face" boolean DEFAULT false,
	"restrict_not_straight_face" boolean DEFAULT false,
	"restrict_improper_light_conditions" boolean DEFAULT false,
	"restrict_too_close_face" boolean DEFAULT false,
	"restrict_too_far_face" boolean DEFAULT false,
	"restrict_teeth_visibility" boolean DEFAULT true,
	"restrict_hair_in_front" boolean DEFAULT true,
	"restrict_ears_not_visible" boolean DEFAULT false,
	"restrict_shoulders_visible" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_checkout_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"heading" text NOT NULL,
	"subheading" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_listing_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visa_listing_id" uuid NOT NULL,
	"entry_validity_amount" integer,
	"entry_validity_unit" "unit",
	"entry_length_stay_amount" integer,
	"entry_length_stay_unit" "unit",
	"government_fee_amount" numeric(10, 2) DEFAULT '0',
	"service_fee_amount" numeric(10, 2) DEFAULT '0',
	"government_gst_fee_amount" numeric(10, 2) DEFAULT '0',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_name" varchar(100) NOT NULL,
	"destination_country" char(2) NOT NULL,
	"purpose" "purpose" DEFAULT 'tourism' NOT NULL,
	"process_type" "process_type" NOT NULL,
	"process_type_label" varchar(50),
	"process_physical" boolean DEFAULT false NOT NULL,
	"entry_type" varchar(50),
	"is_multiple_entry" boolean DEFAULT false,
	"family_enabled" boolean DEFAULT false NOT NULL,
	"unsupported" boolean DEFAULT false,
	"visa_on_arrival" boolean DEFAULT false,
	"visa_free" boolean DEFAULT false,
	"standard_eta_duration" integer,
	"standard_eta_unit" "unit",
	"dev_options" jsonb DEFAULT '{}'::jsonb,
	"last_edited_by" varchar(100),
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visa_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"expired_passport" boolean DEFAULT false,
	"insufficient_funds" boolean DEFAULT false,
	"criminal_record" boolean DEFAULT false,
	"previous_visa_violations" boolean DEFAULT false,
	"invalid_insurance" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passport_services" ADD CONSTRAINT "passport_services_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_country_code_countries_iso2_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("iso2_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_applications" ADD CONSTRAINT "visa_applications_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_questions" ADD CONSTRAINT "additional_questions_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components_required" ADD CONSTRAINT "components_required_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multi_trip_countries" ADD CONSTRAINT "multi_trip_countries_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passport_ocr_settings" ADD CONSTRAINT "passport_ocr_settings_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_validation_settings" ADD CONSTRAINT "photo_validation_settings_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_checkout_steps" ADD CONSTRAINT "post_checkout_steps_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_listing_prices" ADD CONSTRAINT "visa_listing_prices_visa_listing_id_visa_listings_id_fk" FOREIGN KEY ("visa_listing_id") REFERENCES "public"."visa_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_listings" ADD CONSTRAINT "visa_listings_destination_country_countries_iso2_code_fk" FOREIGN KEY ("destination_country") REFERENCES "public"."countries"("iso2_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visa_risks" ADD CONSTRAINT "visa_risks_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "additional_questions_visa_listing_id_idx" ON "additional_questions" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "components_required_visa_listing_id_idx" ON "components_required" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "countries_iso2_code_idx" ON "countries" USING btree ("iso2_code");--> statement-breakpoint
CREATE INDEX "faqs_visa_listing_id_idx" ON "faqs" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "multi_trip_countries_visa_listing_id_idx" ON "multi_trip_countries" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "passport_ocr_settings_visa_listing_id_idx" ON "passport_ocr_settings" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "photo_validation_settings_visa_listing_id_idx" ON "photo_validation_settings" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "post_checkout_steps_visa_listing_id_idx" ON "post_checkout_steps" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "visa_listing_prices_visa_listing_id_idx" ON "visa_listing_prices" USING btree ("visa_listing_id");--> statement-breakpoint
CREATE INDEX "visa_listings_destination_country_idx" ON "visa_listings" USING btree ("destination_country");--> statement-breakpoint
CREATE INDEX "visa_risks_country_id_idx" ON "visa_risks" USING btree ("country_id");