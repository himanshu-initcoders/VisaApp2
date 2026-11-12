-- Rewrite legacy PP… passport references to canonical PS… (PS + 12 digits).
UPDATE "passport_services"
SET "reference_number" = 'PS' || substring("reference_number" from 3)
WHERE "reference_number" ~ '^PP[0-9]{12}$';
