ALTER TABLE "users" ADD COLUMN "weekly_reminder_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "post_tone" text DEFAULT 'professional' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "post_length" text DEFAULT 'normal' NOT NULL;