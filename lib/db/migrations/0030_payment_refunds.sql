ALTER TABLE "payments" ADD COLUMN "kind" varchar(50) DEFAULT 'charge' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "parent_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "razorpay_refund_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_parent_payment_id_payments_id_fk" FOREIGN KEY ("parent_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "payments_razorpay_payment_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_payment_id_unique" ON "payments" USING btree ("razorpay_payment_id") WHERE "razorpay_payment_id" IS NOT NULL AND "kind" = 'charge';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_razorpay_refund_id_unique" ON "payments" USING btree ("razorpay_refund_id");--> statement-breakpoint
CREATE INDEX "payments_parent_payment_id_idx" ON "payments" USING btree ("parent_payment_id");
