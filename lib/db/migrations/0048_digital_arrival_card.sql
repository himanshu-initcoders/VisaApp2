-- Add Digital Arrival Card as a distinct process type (not a visa)
ALTER TYPE "process_type" ADD VALUE IF NOT EXISTS 'digital_arrival_card';
