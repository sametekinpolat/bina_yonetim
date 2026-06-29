ALTER TABLE "flats" ADD COLUMN "water_tier" "water_usage_tier" DEFAULT 'Full' NOT NULL;--> statement-breakpoint
ALTER TABLE "flat_relationships" DROP COLUMN "water_tier";