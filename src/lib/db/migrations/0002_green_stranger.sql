CREATE TABLE "period_plan_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"description" varchar(200) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"preset_id" integer,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "billing_periods" ADD COLUMN "low_discount_percent" numeric(5, 2) DEFAULT '15.00';--> statement-breakpoint
ALTER TABLE "period_plan_expenses" ADD CONSTRAINT "period_plan_expenses_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_plan_expenses" ADD CONSTRAINT "period_plan_expenses_preset_id_expense_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."expense_presets"("id") ON DELETE no action ON UPDATE no action;