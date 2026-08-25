CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"headline" text,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "achievements" ALTER COLUMN "project" SET DEFAULT 'General';--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "category" text DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "evidence_url" text;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "achieved_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "title" text DEFAULT 'LinkedIn post' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "post_type" text DEFAULT 'one_off' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;