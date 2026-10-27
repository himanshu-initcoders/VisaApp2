CREATE TABLE IF NOT EXISTS "phone_otp_challenges" (
	"phone" varchar(20) PRIMARY KEY NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
