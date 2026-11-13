-- Align passport "draft → submitted" status_history timestamps with passport_services.submitted_at.
-- Those rows used PG defaultNow() on timestamp-without-tz while Node writers store UTC wall times,
-- which displayed ~+5:30 IST and sorted the submit event above later real updates.
UPDATE status_history AS sh
SET created_at = ps.submitted_at
FROM passport_services AS ps
WHERE sh.application_id = ps.id
  AND sh.application_type = 'passport'
  AND sh.old_status = 'draft'
  AND sh.new_status = 'submitted'
  AND sh.notes = 'Applicant submitted passport application'
  AND ps.submitted_at IS NOT NULL
  AND sh.created_at IS DISTINCT FROM ps.submitted_at;
