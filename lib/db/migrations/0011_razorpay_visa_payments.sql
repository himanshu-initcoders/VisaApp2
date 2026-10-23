ALTER TABLE "payments" ALTER COLUMN "application_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_order_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_payment_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "submit_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "price_option_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "government_fee_paise" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "service_fee_paise" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "gst_fee_paise" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "traveller_count" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_order_id_unique" ON "payments" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_payment_id_unique" ON "payments" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_pending_per_submit" ON "payments" USING btree ("submit_id") WHERE "payments"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "payments_user_created_at_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_application_id_idx" ON "payments" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "payments_submit_id_idx" ON "payments" USING btree ("submit_id");