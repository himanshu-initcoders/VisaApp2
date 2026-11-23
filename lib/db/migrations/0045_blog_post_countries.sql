ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "country_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
