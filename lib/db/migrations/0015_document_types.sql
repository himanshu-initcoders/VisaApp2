CREATE TABLE IF NOT EXISTS "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"value" varchar(80) NOT NULL,
	"label" varchar(200) NOT NULL,
	"sample_document_key" text,
	"sample_document_url" text,
	"sample_document_filename" varchar(255),
	"sample_document_mime_type" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_types_value_idx" ON "document_types" USING btree ("value");
