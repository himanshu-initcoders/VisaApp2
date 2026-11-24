-- Remove file number / old-passport fields from default Personal details (OCR) questions.
-- Admins can still add custom questions if needed; these are no longer seeded.

DELETE FROM additional_questions
WHERE system_key IN (
  'fileNumber',
  'oldPassportNumber',
  'oldPassportDateOfIssue',
  'oldPassportPlaceOfIssue'
);
