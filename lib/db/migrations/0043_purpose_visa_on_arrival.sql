-- Add Visa On Arrival as a listing purpose (distinct from process_type / visa_on_arrival flag)
ALTER TYPE "purpose" ADD VALUE IF NOT EXISTS 'visa_on_arrival';
