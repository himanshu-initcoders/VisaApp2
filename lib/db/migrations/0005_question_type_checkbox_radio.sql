-- Add checkbox and radio to question_type enum
ALTER TYPE "question_type" ADD VALUE IF NOT EXISTS 'checkbox';
ALTER TYPE "question_type" ADD VALUE IF NOT EXISTS 'radio';
