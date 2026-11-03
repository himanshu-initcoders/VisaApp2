/**
 * Ensures blog_posts exists when migration 0027 was marked applied
 * but rolled back (it also tried to re-add visa_listings.slug).
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });

  try {
    const existing = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'blog_posts'
    `;

    if (existing.length > 0) {
      console.log('blog_posts already exists');
      return;
    }

    console.log('Creating blog_posts…');
    await sql`
      CREATE TABLE "blog_posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" varchar(120) NOT NULL,
        "title" varchar(255) NOT NULL,
        "excerpt" text,
        "body" text DEFAULT '' NOT NULL,
        "cover_image_url" text,
        "cover_image_key" text,
        "cover_image_alt" varchar(255),
        "seo" jsonb,
        "status" varchar(20) DEFAULT 'draft' NOT NULL,
        "published_at" timestamp,
        "author_user_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_unique"
      ON "blog_posts" USING btree ("slug")
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS "blog_posts_status_published_at_idx"
      ON "blog_posts" USING btree ("status", "published_at")
    `;
    console.log('blog_posts created successfully');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
