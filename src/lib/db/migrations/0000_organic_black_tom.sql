CREATE TYPE "public"."account_type" AS ENUM('Bank', 'Cash');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('Estimated', 'Finalized');--> statement-breakpoint
CREATE TYPE "public"."file_reference_type" AS ENUM('Expense', 'Transaction');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('Pending', 'Auto_Matched', 'Manual_Matched', 'Ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('Unpaid', 'Partial', 'Paid', 'Overpaid');--> statement-breakpoint
CREATE TYPE "public"."period_status" AS ENUM('Draft', 'Published', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."reading_type" AS ENUM('Heat', 'Water');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('Owner', 'Tenant');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('Income', 'Expense', 'Transfer');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SuperAdmin', 'Manager', 'Auditor');--> statement-breakpoint
CREATE TYPE "public"."vendor_type" AS ENUM('Company', 'Staff', 'Government');--> statement-breakpoint
CREATE TYPE "public"."water_usage_tier" AS ENUM('Full', 'Low', 'None');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_name" varchar(200) NOT NULL,
	"account_type" "account_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statement_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" varchar(100) NOT NULL,
	"raw_date" date NOT NULL,
	"raw_amount" numeric(12, 2) NOT NULL,
	"raw_description" text,
	"status" "import_status" DEFAULT 'Pending',
	"linked_invoice_id" integer,
	"parsed_flat_number" integer,
	"parsed_month" varchar(20),
	"reconciled_by" varchar(255),
	"reconciliation_notes" text
);
--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_name" varchar(100) NOT NULL,
	"status" "period_status" DEFAULT 'Draft',
	"raw_water_bill" numeric(12, 2),
	"raw_gas_bill" numeric(12, 2),
	"raw_dues_planned" numeric(12, 2),
	"distributed_water" numeric(12, 2),
	"distributed_gas" numeric(12, 2),
	"distributed_dues" numeric(12, 2),
	"total_rounding_diff" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expense_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"default_amount" numeric(12, 2) NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"estimated_amount" numeric(12, 2),
	"actual_amount" numeric(12, 2),
	"status" "expense_status" DEFAULT 'Finalized',
	"expense_date" date NOT NULL,
	"due_date" date,
	"is_paid" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "file_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"reference_type" "file_reference_type" NOT NULL,
	"reference_id" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flat_relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"flat_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" "role_type" NOT NULL,
	"water_tier" "water_usage_tier" DEFAULT 'Full',
	"move_in_date" date NOT NULL,
	"move_out_date" date
);
--> statement-breakpoint
CREATE TABLE "flats" (
	"id" serial PRIMARY KEY NOT NULL,
	"flat_number" integer NOT NULL,
	"size_sqm" numeric(6, 2),
	CONSTRAINT "flats_flat_number_unique" UNIQUE("flat_number")
);
--> statement-breakpoint
CREATE TABLE "meter_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"flat_id" integer NOT NULL,
	"reading_type" "reading_type" NOT NULL,
	"reading_value" numeric(10, 3) NOT NULL,
	"reading_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"flat_id" integer NOT NULL,
	"gas_fee" numeric(10, 2) DEFAULT '0',
	"water_fee" numeric(10, 2) DEFAULT '0',
	"other_fee" numeric(10, 2) DEFAULT '0',
	"total_due" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0',
	"status" "payment_status" DEFAULT 'Unpaid'
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone_number" varchar(30),
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_date" date NOT NULL,
	"related_invoice_id" integer,
	"related_expense_id" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'Manager' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"vendor_type" "vendor_type" NOT NULL,
	"contact_info" text,
	"iban" varchar(34)
);
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_linked_invoice_id_monthly_invoices_id_fk" FOREIGN KEY ("linked_invoice_id") REFERENCES "public"."monthly_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_presets" ADD CONSTRAINT "expense_presets_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flat_relationships" ADD CONSTRAINT "flat_relationships_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flat_relationships" ADD CONSTRAINT "flat_relationships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_invoices" ADD CONSTRAINT "monthly_invoices_period_id_billing_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."billing_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_invoices" ADD CONSTRAINT "monthly_invoices_flat_id_flats_id_fk" FOREIGN KEY ("flat_id") REFERENCES "public"."flats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_invoice_id_monthly_invoices_id_fk" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."monthly_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_related_expense_id_expenses_id_fk" FOREIGN KEY ("related_expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;