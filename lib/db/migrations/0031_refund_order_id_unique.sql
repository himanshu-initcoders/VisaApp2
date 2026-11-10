DROP INDEX IF EXISTS "payments_razorpay_order_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_order_id_unique" ON "payments" USING btree ("razorpay_order_id") WHERE "razorpay_order_id" IS NOT NULL AND "kind" = 'charge';
