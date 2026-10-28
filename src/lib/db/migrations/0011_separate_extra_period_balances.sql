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
$$;--> statement-breakpoint

SELECT public.refresh_all_invoice_payments();
