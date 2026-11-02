-- New visa listings: Trip Details section off by default (existing rows unchanged)
ALTER TABLE "visa_listings" ALTER COLUMN "show_trip_details" SET DEFAULT false;
