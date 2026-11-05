CREATE TABLE IF NOT EXISTS "email_otp_challenges" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"purpose" varchar(20) NOT NULL,
	"pending_name" varchar(255),
	"pending_phone" varchar(20),
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
