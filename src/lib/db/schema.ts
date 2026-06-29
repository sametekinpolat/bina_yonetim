import {
  pgTable,
  pgEnum,
  integer,
  varchar,
  decimal,
  date,
  timestamp,
  boolean,
  text,
  serial,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleTypeEnum = pgEnum("role_type", ["Ev Sahibi", "Kiracı"]);
export const waterUsageTierEnum = pgEnum("water_usage_tier", ["Tam", "Düşük", "Yok"]);
export const readingTypeEnum = pgEnum("reading_type", ["Isı", "Su"]);
export const accountTypeEnum = pgEnum("account_type", ["Banka", "Kasa"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["Gelir", "Gider", "Transfer"]);
export const importStatusEnum = pgEnum("import_status", ["Bekliyor", "Otomatik Eşleşti", "Manuel Eşleşti", "Yok Sayıldı"]);
export const vendorTypeEnum = pgEnum("vendor_type", ["Şirket", "Personel", "Kamu"]);
export const expenseStatusEnum = pgEnum("expense_status", ["Tahmini", "Kesinleşti"]);
export const vendorPaymentStatusEnum = pgEnum("vendor_payment_status", ["Ödenmedi", "Kısmi", "Ödendi", "Fazla Ödendi"]);
export const fileReferenceTypeEnum = pgEnum("file_reference_type", ["Gider", "İşlem"]);
export const periodStatusEnum = pgEnum("period_status", ["Taslak", "Yayınlandı", "Kapandı"]);
export const paymentStatusEnum = pgEnum("payment_status", ["Ödenmedi", "Kısmi", "Ödendi", "Fazla Ödendi"]);
export const userRoleEnum = pgEnum("user_role", ["SüperAdmin", "Yönetici", "Denetçi"]);

// New enums for vendor payables & bank import direction
export const vendorPayableStatusEnum = pgEnum("vendor_payable_status", ["Ödenmedi", "Kısmi", "Ödendi", "Fazla Ödendi"]);
export const surchargeTypeEnum = pgEnum("surcharge_type", ["Faiz", "Ceza", "Ücret", "Yuvarlama"]);
export const importDirectionEnum = pgEnum("import_direction", ["Gelir", "Gider"]);

// ---------------------------------------------------------------------------
// Auth — admin user accounts (not residents)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("Yönetici"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ---------------------------------------------------------------------------
// Core property tables
// ---------------------------------------------------------------------------

export const flats = pgTable("flats", {
  id: serial("id").primaryKey(),
  flatNumber: integer("flat_number").notNull().unique(),
  sizeSqm: decimal("size_sqm", { precision: 6, scale: 2 }),
  waterTier: waterUsageTierEnum("water_tier").notNull().default("Tam"),
  isEmpty: boolean("is_empty").default(false),
});

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }),
  email: varchar("email", { length: 255 }),
});

export const flatRelationships = pgTable("flat_relationships", {
  id: serial("id").primaryKey(),
  flatId: integer("flat_id")
    .notNull()
    .references(() => flats.id),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id),
  role: roleTypeEnum("role").notNull(),
  moveInDate: date("move_in_date").notNull(),
  moveOutDate: date("move_out_date"),
});

export const meterReadings = pgTable("meter_readings", {
  id: serial("id").primaryKey(),
  flatId: integer("flat_id")
    .notNull()
    .references(() => flats.id),
  readingType: readingTypeEnum("reading_type").notNull(),
  readingValue: decimal("reading_value", { precision: 10, scale: 3 }).notNull(),
  readingDate: date("reading_date").notNull(),
});

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export const billingPeriods = pgTable("billing_periods", {
  id: serial("id").primaryKey(),
  periodName: varchar("period_name", { length: 100 }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  status: periodStatusEnum("status").default("Taslak"),
  rawWaterBill: decimal("raw_water_bill", { precision: 12, scale: 2 }),
  rawGasBill: decimal("raw_gas_bill", { precision: 12, scale: 2 }),
  rawDuesPlanned: decimal("raw_dues_planned", { precision: 12, scale: 2 }),
  lowDiscountPercent: decimal("low_discount_percent", { precision: 5, scale: 2 }).default("15.00"),
  emptyFlatsPayGas: boolean("empty_flats_pay_gas").default(false),
  distributedWater: decimal("distributed_water", { precision: 12, scale: 2 }),
  distributedGas: decimal("distributed_gas", { precision: 12, scale: 2 }),
  distributedDues: decimal("distributed_dues", { precision: 12, scale: 2 }),
  totalRoundingDiff: decimal("total_rounding_diff", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").default(sql`now()`),
  publishedAt: timestamp("published_at"),
});

export const monthlyInvoices = pgTable("monthly_invoices", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id")
    .notNull()
    .references(() => billingPeriods.id),
  flatId: integer("flat_id")
    .notNull()
    .references(() => flats.id),
  gasFee: decimal("gas_fee", { precision: 10, scale: 2 }).default("0"),
  waterFee: decimal("water_fee", { precision: 10, scale: 2 }).default("0"),
  otherFee: decimal("other_fee", { precision: 10, scale: 2 }).default("0"),
  totalDue: decimal("total_due", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  status: paymentStatusEnum("status").default("Ödenmedi"),
});

export const periodPlanExpenses = pgTable("period_plan_expenses", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id")
    .notNull()
    .references(() => billingPeriods.id),
  description: varchar("description", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  presetId: integer("preset_id").references(() => expensePresets.id),
  // Optional vendor link — which company/staff member will be paid for this item
  vendorId: integer("vendor_id").references(() => vendors.id),
  sortOrder: integer("sort_order").default(0),
});

// ---------------------------------------------------------------------------
// Expenses & Vendors
// ---------------------------------------------------------------------------

export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
});

export const expensePresets = pgTable("expense_presets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  defaultAmount: decimal("default_amount", { precision: 12, scale: 2 }).notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => expenseCategories.id),
  // Optional default vendor for this preset type
  vendorId: integer("vendor_id").references(() => vendors.id),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  vendorType: vendorTypeEnum("vendor_type").notNull(),
  contactInfo: text("contact_info"),
  iban: varchar("iban", { length: 34 }),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendors.id),
  categoryId: integer("category_id")
    .notNull()
    .references(() => expenseCategories.id),
  estimatedAmount: decimal("estimated_amount", { precision: 12, scale: 2 }),
  actualAmount: decimal("actual_amount", { precision: 12, scale: 2 }),
  status: expenseStatusEnum("status").default("Kesinleşti"),
  expenseDate: date("expense_date").notNull(),
  dueDate: date("due_date"),
  isPaid: boolean("is_paid").default(false),
});

// ---------------------------------------------------------------------------
// Vendor Payables (Accounts Payable — AP)
// ---------------------------------------------------------------------------

/**
 * A vendorPayable represents a real invoice/bill we owe to a vendor.
 * Created manually by the manager when the actual bill arrives; optionally
 * linked to a budget line (periodPlanExpenses) for a billing period.
 *
 * Payment tracking rules:
 *  - amountPaid += baseAmount from each bank-import reconciliation.
 *  - Surcharge amounts (interest, penalties) are NOT added to amountPaid —
 *    they are recorded as separate Expense transactions but do not reduce the
 *    payable balance, so the vendor never shows a false credit.
 *  - If amountPaid > invoiceAmount (no surcharge) → paymentStatus = "Overpaid",
 *    meaning the vendor owes us money (credit balance).
 */
export const vendorPayables = pgTable("vendor_payables", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendors.id),
  // Optional: billing period this payable belongs to
  periodId: integer("period_id").references(() => billingPeriods.id),
  // Optional: planned expense budget line this originated from
  planExpenseId: integer("plan_expense_id").references(() => periodPlanExpenses.id),
  description: varchar("description", { length: 200 }).notNull(),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default("0"),
  paymentStatus: vendorPayableStatusEnum("payment_status").default("Ödenmedi"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  accountName: varchar("account_name", { length: 200 }).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  transactionDate: date("transaction_date").notNull(),
  relatedInvoiceId: integer("related_invoice_id").references(() => monthlyInvoices.id),
  relatedExpenseId: integer("related_expense_id").references(() => expenses.id),
  // Expense-side: generic vendor payment
  vendorId: integer("vendor_id").references(() => vendors.id),
  // Legacy Expense-side: link to vendor payable (can be kept for historical data)
  relatedPayableId: integer("related_payable_id").references(() => vendorPayables.id),
  // For surcharge sub-transactions (Interest, Penalty, etc.)
  surchargeType: surchargeTypeEnum("surcharge_type"),
  description: text("description"),
});

// ---------------------------------------------------------------------------
// Bank Statement Import
// ---------------------------------------------------------------------------

export const bankStatementImports = pgTable("bank_statement_imports", {
  id: serial("id").primaryKey(),
  batchId: varchar("batch_id", { length: 100 }).notNull(),
  rawDate: date("raw_date").notNull(),
  rawAmount: decimal("raw_amount", { precision: 12, scale: 2 }).notNull(),
  rawDescription: text("raw_description"),
  status: importStatusEnum("status").default("Bekliyor"),
  // Direction: Income = resident payment, Expense = outgoing vendor payment
  direction: importDirectionEnum("direction").default("Gelir"),
  // Income side: link to resident invoice
  linkedInvoiceId: integer("linked_invoice_id").references(() => monthlyInvoices.id),
  parsedFlatNumber: integer("parsed_flat_number"),
  parsedMonth: varchar("parsed_month", { length: 20 }),
  // Expense side: generic link to vendor
  linkedVendorId: integer("linked_vendor_id").references(() => vendors.id),
  // Legacy Expense side: link to vendor payable
  linkedPayableId: integer("linked_payable_id").references(() => vendorPayables.id),
  // For expense rows: how much of rawAmount goes to the payable vs. is surcharge
  baseAmount: decimal("base_amount", { precision: 12, scale: 2 }),
  surchargeAmount: decimal("surcharge_amount", { precision: 12, scale: 2 }),
  surchargeType: surchargeTypeEnum("surcharge_type"),
  reconciledBy: varchar("reconciled_by", { length: 255 }),
  reconciliationNotes: text("reconciliation_notes"),
});

// ---------------------------------------------------------------------------
// File Attachments
// ---------------------------------------------------------------------------

export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  referenceType: fileReferenceTypeEnum("reference_type").notNull(),
  referenceId: integer("reference_id").notNull(),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
});
