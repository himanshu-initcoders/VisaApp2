ALTER TABLE "application_comments" ADD COLUMN IF NOT EXISTS "attachment_s3_key" varchar(500);
ALTER TABLE "application_comments" ADD COLUMN IF NOT EXISTS "attachment_filename" varchar(255);
ALTER TABLE "application_comments" ADD COLUMN IF NOT EXISTS "attachment_mime_type" varchar(100);
ALTER TABLE "application_comments" ADD COLUMN IF NOT EXISTS "attachment_file_size" integer;
