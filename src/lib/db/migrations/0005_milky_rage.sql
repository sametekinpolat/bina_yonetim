CREATE TYPE "public"."import_direction" AS ENUM('Gelir', 'Gider');--> statement-breakpoint
CREATE TYPE "public"."surcharge_type" AS ENUM('Faiz', 'Ceza', 'Ücret', 'Yuvarlama');--> statement-breakpoint
CREATE TYPE "public"."vendor_payable_status" AS ENUM('Ödenmedi', 'Kısmi', 'Ödendi', 'Fazla Ödendi');--> statement-breakpoint
CREATE TYPE "public"."vendor_payment_status" AS ENUM('Ödenmedi', 'Kısmi', 'Ödendi', 'Fazla Ödendi');--> statement-breakpoint
CREATE TABLE "vendor_payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"period_id" integer,
	"plan_expense_id" integer,
	"description" varchar(200) NOT NULL,
	"invoice_amount" numeric(12, 2) NOT NULL,
	"due_date" date,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"payment_status" "vendor_payable_status" DEFAULT 'Ödenmedi',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "account_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."account_type";--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('Banka', 'Kasa');--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "account_type" SET DATA TYPE "public"."account_type" USING "account_type"::"public"."account_type";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "status" SET DEFAULT 'Kesinleşti'::text;--> statement-breakpoint
DROP TYPE "public"."expense_status";--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('Tahmini', 'Kesinleşti');--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "status" SET DEFAULT 'Kesinleşti'::"public"."expense_status";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "status" SET DATA TYPE "public"."expense_status" USING "status"::"public"."expense_status";--> statement-breakpoint
ALTER TABLE "file_attachments" ALTER COLUMN "reference_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."file_reference_type";--> statement-breakpoint
CREATE TYPE "public"."file_reference_type" AS ENUM('Gider', 'İşlem');--> statement-breakpoint
ALTER TABLE "file_attachments" ALTER COLUMN "reference_type" SET DATA TYPE "public"."file_reference_type" USING "reference_type"::"public"."file_reference_type";--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ALTER COLUMN "status" SET DEFAULT 'Bekliyor'::text;--> statement-breakpoint
DROP TYPE "public"."import_status";--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('Bekliyor', 'Otomatik Eşleşti', 'Manuel Eşleşti', 'Yok Sayıldı');--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ALTER COLUMN "status" SET DEFAULT 'Bekliyor'::"public"."import_status";--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ALTER COLUMN "status" SET DATA TYPE "public"."import_status" USING "status"::"public"."import_status";--> statement-breakpoint
ALTER TABLE "monthly_invoices" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "monthly_invoices" ALTER COLUMN "status" SET DEFAULT 'Ödenmedi'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('Ödenmedi', 'Kısmi', 'Ödendi', 'Fazla Ödendi');--> statement-breakpoint
ALTER TABLE "monthly_invoices" ALTER COLUMN "status" SET DEFAULT 'Ödenmedi'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "monthly_invoices" ALTER COLUMN "status" SET DATA TYPE "public"."payment_status" USING "status"::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "billing_periods" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "billing_periods" ALTER COLUMN "status" SET DEFAULT 'Taslak'::text;--> statement-breakpoint
DROP TYPE "public"."period_status";--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('Taslak', 'Yayınlandı', 'Kapandı');--> statement-breakpoint
ALTER TABLE "billing_periods" ALTER COLUMN "status" SET DEFAULT 'Taslak'::"public"."period_status";--> statement-breakpoint
ALTER TABLE "billing_periods" ALTER COLUMN "status" SET DATA TYPE "public"."period_status" USING "status"::"public"."period_status";--> statement-breakpoint
ALTER TABLE "meter_readings" ALTER COLUMN "reading_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."reading_type";--> statement-breakpoint
CREATE TYPE "public"."reading_type" AS ENUM('Isı', 'Su');--> statement-breakpoint
ALTER TABLE "meter_readings" ALTER COLUMN "reading_type" SET DATA TYPE "public"."reading_type" USING "reading_type"::"public"."reading_type";--> statement-breakpoint
ALTER TABLE "flat_relationships" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role_type";--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('Ev Sahibi', 'Kiracı');--> statement-breakpoint
ALTER TABLE "flat_relationships" ALTER COLUMN "role" SET DATA TYPE "public"."role_type" USING "role"::"public"."role_type";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "transaction_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."transaction_type";--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('Gelir', 'Gider', 'Transfer');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "transaction_type" SET DATA TYPE "public"."transaction_type" USING "transaction_type"::"public"."transaction_type";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'Yönetici'::text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SüperAdmin', 'Yönetici', 'Denetçi');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'Yönetici'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "vendor_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."vendor_type";--> statement-breakpoint
CREATE TYPE "public"."vendor_type" AS ENUM('Şirket', 'Personel', 'Kamu');--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "vendor_type" SET DATA TYPE "public"."vendor_type" USING "vendor_type"::"public"."vendor_type";--> statement-breakpoint
ALTER TABLE "flats" ALTER COLUMN "water_tier" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "flats" ALTER COLUMN "water_tier" SET DEFAULT 'Tam'::text;--> statement-breakpoint
DROP TYPE "public"."water_usage_tier";--> statement-breakpoint
CREATE TYPE "public"."water_usage_tier" AS ENUM('Tam', 'Düşük', 'Yok');--> statement-breakpoint
ALTER TABLE "flats" ALTER COLUMN "water_tier" SET DEFAULT 'Tam'::"public"."water_usage_tier";--> statement-breakpoint
ALTER TABLE "flats" ALTER COLUMN "water_tier" SET DATA TYPE "public"."water_usage_tier" USING "water_tier"::"public"."water_usage_tier";--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "direction" "import_direction" DEFAULT 'Gelir';--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "linked_payable_id" integer;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "base_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "surcharge_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "surcharge_type" "surcharge_type";--> statement-breakpoint
ALTER TABLE "billing_periods" ADD COLUMN "empty_flats_pay_gas" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "expense_presets" ADD COLUMN "vendor_id" integer;--> statement-breakpoint
ALTER TABLE "flats" ADD COLUMN "is_empty" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "period_plan_expenses" ADD COLUMN "vendor_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "related_payable_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "surcharge_type" "surcharge_type";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_plan_expense_id_period_plan_expenses_id_fk" FOREIGN KEY ("plan_expense_id") REFERENCES "public"."period_plan_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_linked_payable_id_vendor_payables_id_fk" FOREIGN KEY ("linked_payable_id") REFERENCES "public"."vendor_payables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_presets" ADD CONSTRAINT "expense_presets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_plan_expenses" ADD CONSTRAINT "period_plan_expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_payable_id_vendor_payables_id_fk" FOREIGN KEY ("related_payable_id") REFERENCES "public"."vendor_payables"("id") ON DELETE no action ON UPDATE no action;