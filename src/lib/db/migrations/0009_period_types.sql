ALTER TABLE "billing_periods" ADD COLUMN "period_type" varchar(20) DEFAULT 'Aylık' NOT NULL;
--> statement-breakpoint

-- Existing custom named assessments (for example, Drenaj Çalışması Ekim 2026)
-- are isolated from monthly aidat credit pools.
UPDATE public.billing_periods
SET period_type = 'Ek Dönem'
WHERE period_name !~ '^(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) [0-9]{4}$';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_flat_invoice_payments(target_flat_id integer)
RETURNS void
LANGUAGE sql
AS $$
  WITH invoice_rows AS (
    SELECT mi.id, mi.flat_id, mi.total_due::numeric AS total_due,
      CASE WHEN bp.period_type = 'Aylık' THEN 'Aylık' ELSE 'Ek:' || bp.id::text END AS payment_bucket,
      COALESCE(SUM(mi.total_due::numeric) OVER (
        PARTITION BY mi.flat_id, CASE WHEN bp.period_type = 'Aylık' THEN 'Aylık' ELSE 'Ek:' || bp.id::text END
        ORDER BY bp.period_year, bp.period_month, mi.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS due_before,
      COALESCE(SUM(mi.total_due::numeric) OVER (
        PARTITION BY mi.flat_id, CASE WHEN bp.period_type = 'Aylık' THEN 'Aylık' ELSE 'Ek:' || bp.id::text END
        ORDER BY bp.period_year, bp.period_month, mi.id
        ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
      ), 0) AS due_after
    FROM public.monthly_invoices mi
    JOIN public.billing_periods bp ON bp.id = mi.period_id
    WHERE mi.flat_id = target_flat_id
      AND bp.status IS DISTINCT FROM 'Taslak'::public.period_status
  ),
  payment_pools AS (
    SELECT CASE WHEN source_period.period_type = 'Aylık' THEN 'Aylık' ELSE 'Ek:' || source_period.id::text END AS payment_bucket,
      COALESCE(SUM(t.amount::numeric), 0) AS total_paid
    FROM public.transactions t
    JOIN public.monthly_invoices source_invoice ON source_invoice.id = t.related_invoice_id
    JOIN public.billing_periods source_period ON source_period.id = source_invoice.period_id
    WHERE source_invoice.flat_id = target_flat_id
      AND t.transaction_type = 'Gelir'::public.transaction_type
      AND source_period.status IS DISTINCT FROM 'Taslak'::public.period_status
    GROUP BY CASE WHEN source_period.period_type = 'Aylık' THEN 'Aylık' ELSE 'Ek:' || source_period.id::text END
  ),
  allocated AS (
    SELECT i.id,
      CASE WHEN i.due_after = 0
        THEN ROUND(GREATEST(0, COALESCE(p.total_paid, 0) - i.due_before), 2)
        ELSE ROUND(GREATEST(0, LEAST(i.total_due, COALESCE(p.total_paid, 0) - i.due_before)), 2)
      END AS paid
    FROM invoice_rows i
    LEFT JOIN payment_pools p ON p.payment_bucket = i.payment_bucket
  )
  UPDATE public.monthly_invoices mi
  SET amount_paid = a.paid,
      status = CASE
        WHEN a.paid <= 0 THEN 'Ödenmedi'::public.payment_status
        WHEN a.paid < mi.total_due THEN 'Kısmi'::public.payment_status
        WHEN a.paid = mi.total_due THEN 'Ödendi'::public.payment_status
        ELSE 'Fazla Ödendi'::public.payment_status
      END
  FROM allocated a
  WHERE mi.id = a.id;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_all_invoice_payments()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE flat_row record;
BEGIN
  FOR flat_row IN SELECT id FROM public.flats LOOP
    PERFORM public.refresh_flat_invoice_payments(flat_row.id);
  END LOOP;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_payments_after_transaction_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE old_flat_id integer; new_flat_id integer;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.transaction_type = 'Gelir' AND OLD.related_invoice_id IS NOT NULL THEN
    SELECT flat_id INTO old_flat_id FROM public.monthly_invoices WHERE id = OLD.related_invoice_id;
    IF old_flat_id IS NOT NULL THEN PERFORM public.refresh_flat_invoice_payments(old_flat_id); END IF;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.transaction_type = 'Gelir' AND NEW.related_invoice_id IS NOT NULL THEN
    SELECT flat_id INTO new_flat_id FROM public.monthly_invoices WHERE id = NEW.related_invoice_id;
    IF new_flat_id IS NOT NULL AND new_flat_id IS DISTINCT FROM old_flat_id THEN
      PERFORM public.refresh_flat_invoice_payments(new_flat_id);
    ELSIF new_flat_id IS NOT NULL AND TG_OP = 'INSERT' THEN
      PERFORM public.refresh_flat_invoice_payments(new_flat_id);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS transactions_sync_invoice_payment ON public.transactions;
DROP TRIGGER IF EXISTS transactions_refresh_invoice_payments ON public.transactions;
CREATE TRIGGER transactions_refresh_invoice_payments
AFTER INSERT OR DELETE OR UPDATE OF transaction_type, amount, related_invoice_id
ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.refresh_payments_after_transaction_change();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_payments_after_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.refresh_flat_invoice_payments(OLD.flat_id); END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.flat_id IS DISTINCT FROM OLD.flat_id) THEN
    PERFORM public.refresh_flat_invoice_payments(NEW.flat_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_flat_invoice_payments(NEW.flat_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS monthly_invoices_refresh_payments ON public.monthly_invoices;
CREATE TRIGGER monthly_invoices_refresh_payments
AFTER INSERT OR DELETE OR UPDATE OF flat_id, period_id, total_due
ON public.monthly_invoices
FOR EACH ROW EXECUTE FUNCTION public.refresh_payments_after_invoice_change();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.refresh_payments_after_period_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE flat_row record;
BEGIN
  FOR flat_row IN
    SELECT DISTINCT flat_id FROM public.monthly_invoices WHERE period_id = NEW.id
  LOOP
    PERFORM public.refresh_flat_invoice_payments(flat_row.flat_id);
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS billing_periods_refresh_payments ON public.billing_periods;
CREATE TRIGGER billing_periods_refresh_payments
AFTER UPDATE OF period_type, status, period_year, period_month
ON public.billing_periods
FOR EACH ROW EXECUTE FUNCTION public.refresh_payments_after_period_change();
--> statement-breakpoint

SELECT public.refresh_all_invoice_payments();
