ALTER TABLE "scenes" ALTER COLUMN "audio_me_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "audio_vocals_url" text;