CREATE TABLE "visa_application_travellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"passenger_id" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'submitted' NOT NULL,
	"reviewed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_history" ADD COLUMN "traveller_id" uuid;--> statement-breakpoint
ALTER TABLE "visa_application_travellers" ADD CONSTRAINT "visa_application_travellers_application_id_visa_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."visa_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "visa_application_travellers_app_passenger_unique" ON "visa_application_travellers" USING btree ("application_id","passenger_id");--> statement-breakpoint
CREATE INDEX "visa_application_travellers_application_id_idx" ON "visa_application_travellers" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "visa_application_travellers_status_idx" ON "visa_application_travellers" USING btree ("status");--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_traveller_id_visa_application_travellers_id_fk" FOREIGN KEY ("traveller_id") REFERENCES "public"."visa_application_travellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_history_traveller_id_idx" ON "status_history" USING btree ("traveller_id");--> statement-breakpoint
INSERT INTO "visa_application_travellers" (
  "application_id",
  "passenger_id",
  "name",
  "status",
  "reviewed_at",
  "completed_at"
)
SELECT
  src.application_id,
  left(
    CASE
      WHEN src.dup = 1 THEN src.passenger_key
      ELSE src.passenger_key || '-' || (src.ord - 1)::text
    END,
    100
  ),
  left(src.display_name, 255),
  src.status,
  CASE
    WHEN src.status IN ('under_review', 'approved', 'rejected', 'partially_approved')
      THEN src.reviewed_at
    ELSE NULL
  END,
  CASE
    WHEN src.status IN ('approved', 'rejected', 'partially_approved')
      THEN src.completed_at
    ELSE NULL
  END
FROM (
  SELECT
    expanded.application_id,
    expanded.status,
    expanded.reviewed_at,
    expanded.completed_at,
    expanded.ord,
    COALESCE(expanded.raw_passenger_id, 'traveller-' || (expanded.ord - 1)::text) AS passenger_key,
    COALESCE(expanded.raw_name, NULLIF(btrim(expanded.applicant_name), ''), 'Traveller ' || expanded.ord::text) AS display_name,
    row_number() OVER (
      PARTITION BY expanded.application_id, COALESCE(expanded.raw_passenger_id, 'traveller-' || (expanded.ord - 1)::text)
      ORDER BY expanded.ord
    ) AS dup
  FROM (
    SELECT
      va.id AS application_id,
      va.status,
      va.reviewed_at,
      va.completed_at,
      va.applicant_name,
      NULLIF(btrim(elem->>'passengerId'), '') AS raw_passenger_id,
      NULLIF(btrim(elem->>'name'), '') AS raw_name,
      ord
    FROM "visa_applications" va
    CROSS JOIN LATERAL jsonb_array_elements(va.travellers) WITH ORDINALITY AS t(elem, ord)
    WHERE jsonb_typeof(va.travellers) = 'array'
      AND jsonb_array_length(va.travellers) > 0
  ) expanded
) src;--> statement-breakpoint
INSERT INTO "visa_application_travellers" (
  "application_id",
  "passenger_id",
  "name",
  "status",
  "reviewed_at",
  "completed_at"
)
SELECT
  va.id,
  left('legacy-' || va.id::text, 100),
  left(COALESCE(NULLIF(btrim(va.applicant_name), ''), 'Applicant'), 255),
  va.status,
  CASE
    WHEN va.status IN ('under_review', 'approved', 'rejected', 'partially_approved')
      THEN va.reviewed_at
    ELSE NULL
  END,
  CASE
    WHEN va.status IN ('approved', 'rejected', 'partially_approved')
      THEN va.completed_at
    ELSE NULL
  END
FROM "visa_applications" va
WHERE NOT EXISTS (
  SELECT 1
  FROM "visa_application_travellers" vat
  WHERE vat.application_id = va.id
);--> statement-breakpoint
UPDATE "status_history" sh
SET "traveller_id" = vat.id
FROM "visa_application_travellers" vat
WHERE sh.application_type = 'visa'
  AND sh.traveller_id IS NULL
  AND sh.application_id = vat.application_id
  AND (
    SELECT count(*)::int
    FROM "visa_application_travellers" v2
    WHERE v2.application_id = sh.application_id
  ) = 1;