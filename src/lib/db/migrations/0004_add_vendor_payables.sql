-- New enums
CREATE TYPE "public"."vendor_payable_status" AS ENUM('Unpaid', 'Partial', 'Paid', 'Overpaid');
--> statement-breakpoint
CREATE TYPE "public"."surcharge_type" AS ENUM('Interest', 'Penalty', 'Fee', 'Rounding');
--> statement-breakpoint
CREATE TYPE "public"."import_direction" AS ENUM('Income', 'Expense');
--> statement-breakpoint

-- New vendor_payables table
CREATE TABLE "vendor_payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"period_id" integer,
	"plan_expense_id" integer,
	"description" varchar(200) NOT NULL,
	"invoice_amount" numeric(12, 2) NOT NULL,
	"due_date" date,
	"amount_paid" numeric(12, 2) DEFAULT '0',
	"payment_status" "vendor_payable_status" DEFAULT 'Unpaid',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Add vendorId to period_plan_expenses
ALTER TABLE "period_plan_expenses" ADD COLUMN "vendor_id" integer;
--> statement-breakpoint

-- Add vendorId to expense_presets
ALTER TABLE "expense_presets" ADD COLUMN "vendor_id" integer;
--> statement-breakpoint

-- Add expense-side columns to bank_statement_imports
ALTER TABLE "bank_statement_imports" ADD COLUMN "direction" "import_direction" DEFAULT 'Income';
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "linked_payable_id" integer;
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "base_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "surcharge_amount" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN "surcharge_type" "surcharge_type";
--> statement-breakpoint

-- Add columns to transactions table
ALTER TABLE "transactions" ADD COLUMN "related_payable_id" integer;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "surcharge_type" "surcharge_type";
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "description" text;
--> statement-breakpoint

-- Foreign key constraints for vendor_payables
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vendor_payables" ADD CONSTRAINT "vendor_payables_plan_expense_id_period_plan_expenses_id_fk" FOREIGN KEY ("plan_expense_id") REFERENCES "public"."period_plan_expenses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Foreign key constraints for new period_plan_expenses.vendor_id
ALTER TABLE "period_plan_expenses" ADD CONSTRAINT "period_plan_expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Foreign key constraints for new expense_presets.vendor_id
ALTER TABLE "expense_presets" ADD CONSTRAINT "expense_presets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Foreign key constraints for bank_statement_imports.linked_payable_id
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_linked_payable_id_vendor_payables_id_fk" FOREIGN KEY ("linked_payable_id") REFERENCES "public"."vendor_payables"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Foreign key constraints for transactions.related_payable_id
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_payable_id_vendor_payables_id_fk" FOREIGN KEY ("related_payable_id") REFERENCES "public"."vendor_payables"("id") ON DELETE no action ON UPDATE no action;
