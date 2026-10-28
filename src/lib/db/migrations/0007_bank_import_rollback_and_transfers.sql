ALTER TABLE "bank_statement_imports" ADD COLUMN IF NOT EXISTS "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD COLUMN IF NOT EXISTS "linked_transfer_account_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "source_import_id" integer;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint c
		JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
		WHERE c.conrelid = 'public.bank_statement_imports'::regclass
			AND c.contype = 'f'
			AND a.attname = 'linked_transfer_account_id'
	) THEN
		ALTER TABLE "bank_statement_imports"
			ADD CONSTRAINT "bank_statement_imports_linked_transfer_account_id_accounts_id_fk"
			FOREIGN KEY ("linked_transfer_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;
