-- initcap('USA') stored "Usa". Keep short country acronyms uppercase.
UPDATE visa_listings
SET slug = regexp_replace(slug, '(^|-)Usa(-|$)', '\1USA\2', 'gi')
WHERE slug ~* '(^|-)usa(-|$)';

UPDATE visa_listings
SET slug = regexp_replace(slug, '(^|-)Uae(-|$)', '\1UAE\2', 'gi')
WHERE slug ~* '(^|-)uae(-|$)';

UPDATE visa_listings
SET slug = regexp_replace(slug, '(^|-)Uk(-|$)', '\1UK\2', 'gi')
WHERE slug ~* '(^|-)uk(-|$)';
