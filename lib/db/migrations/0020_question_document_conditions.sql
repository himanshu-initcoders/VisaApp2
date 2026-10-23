ALTER TABLE "additional_questions" ADD COLUMN IF NOT EXISTS "document_conditions" jsonb DEFAULT 'null'::jsonb;
