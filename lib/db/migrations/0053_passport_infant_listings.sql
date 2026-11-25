-- Intentionally empty.
-- Infant listing seed cannot run in the same Drizzle transaction as 0052's
-- ALTER TYPE ... ADD VALUE (Postgres: new enum labels must be committed first).
-- Seed runs after migrate via scripts/ensure-passport-infant-listings.ts.
SELECT 1;
