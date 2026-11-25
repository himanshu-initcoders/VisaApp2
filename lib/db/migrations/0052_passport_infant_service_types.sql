-- Extend passport catalog enum for infant products.
-- Separate from data seed: new enum values cannot be used until this migration commits.
ALTER TYPE "public"."passport_service_type" ADD VALUE IF NOT EXISTS 'fresh_infant';--> statement-breakpoint
ALTER TYPE "public"."passport_service_type" ADD VALUE IF NOT EXISTS 'reissue_infant';
