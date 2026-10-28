-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION public.sync_monthly_invoice_payment(target_invoice_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	paid_amount numeric(12, 2);
BEGIN
	SELECT COALESCE(SUM(t.amount::numeric), 0)
	INTO paid_amount
	FROM public.transactions t
	WHERE t.related_invoice_id = target_invoice_id
		AND t.transaction_type = 'Gelir';

	UPDATE public.monthly_invoices mi
	SET amount_paid = paid_amount,
		status = CASE
			WHEN paid_amount <= 0 THEN 'Ödenmedi'::public.payment_status
			WHEN paid_amount < mi.total_due THEN 'Kısmi'::public.payment_status
			WHEN paid_amount = mi.total_due THEN 'Ödendi'::public.payment_status
			ELSE 'Fazla Ödendi'::public.payment_status
		END
	WHERE mi.id = target_invoice_id;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.sync_invoice_payment_after_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.transaction_type = 'Gelir' AND OLD.related_invoice_id IS NOT NULL THEN
			PERFORM public.sync_monthly_invoice_payment(OLD.related_invoice_id);
		END IF;
		RETURN OLD;
	END IF;

	IF TG_OP = 'UPDATE'
		AND OLD.transaction_type = 'Gelir'
		AND OLD.related_invoice_id IS NOT NULL
		AND (OLD.related_invoice_id IS DISTINCT FROM NEW.related_invoice_id
			OR NEW.transaction_type IS DISTINCT FROM 'Gelir') THEN
		PERFORM public.sync_monthly_invoice_payment(OLD.related_invoice_id);
	END IF;

	IF NEW.transaction_type = 'Gelir' AND NEW.related_invoice_id IS NOT NULL THEN
		PERFORM public.sync_monthly_invoice_payment(NEW.related_invoice_id);
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS transactions_sync_invoice_payment ON public.transactions;--> statement-breakpoint
CREATE TRIGGER transactions_sync_invoice_payment
AFTER INSERT OR DELETE OR UPDATE OF transaction_type, amount, related_invoice_id
ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_payment_after_transaction_change();--> statement-breakpoint

DO $$
DECLARE invoice_row record;
BEGIN
	FOR invoice_row IN SELECT id FROM public.monthly_invoices LOOP
		PERFORM public.sync_monthly_invoice_payment(invoice_row.id);
	END LOOP;
END;
$$;
