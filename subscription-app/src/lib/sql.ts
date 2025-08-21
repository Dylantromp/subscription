export const selectPlanPriceMonthly = `
  SELECT pr.id AS price_id, pr.billing_period, pr.interval_count, pl.trial_days
  FROM prices pr
  JOIN plans pl ON pl.id = pr.plan_id
  WHERE pl.code = $1 AND pr.billing_period = 'month'::billing_period AND pr.active
  LIMIT 1;
`;

export const createSubscriptionSql = `
  WITH ins_sub AS (
    INSERT INTO subscriptions (
      account_id, status, trial_end, current_period_start, current_period_end, default_currency
    )
    SELECT $1, 'trialing', (now() AT TIME ZONE 'UTC') + (p.trial_days || ' days')::interval,
           (now() AT TIME ZONE 'UTC'),
           next_period_end((now() AT TIME ZONE 'UTC'), p.billing_period, p.interval_count),
           'usd'
    FROM (SELECT $2::billing_period AS billing_period, $3::int AS interval_count, $4::int AS trial_days) p
    RETURNING id
  )
  INSERT INTO subscription_items (subscription_id, price_id, quantity)
  SELECT (SELECT id FROM ins_sub), $5, 1;
`;

export const invoiceForSubSql = `
  WITH s AS (
    SELECT s.id AS sub_id, s.account_id, pr.currency, pr.unit_amount
    FROM subscriptions s
    JOIN subscription_items si ON si.subscription_id = s.id
    JOIN prices pr ON pr.id = si.price_id
    WHERE s.id = $1 AND s.status IN ('active','trialing','past_due')
    LIMIT 1
  ),
  i AS (
    INSERT INTO invoices (account_id, subscription_id, status, currency, subtotal, tax_amount, total, due_at, issued_at, number)
    SELECT
      s.account_id, s.sub_id, 'open', s.currency,
      s.unit_amount, 0, s.unit_amount,
      (now() AT TIME ZONE 'UTC') + INTERVAL '7 days',
      (now() AT TIME ZONE 'UTC'),
      'INV-' || to_char((now() AT TIME ZONE 'UTC'),'YYYY') || '-' ||
        lpad((SELECT COALESCE(MAX(split_part(number,'-',3)::INT)+1,1) FROM invoices WHERE number LIKE 'INV-'||to_char((now() AT TIME ZONE 'UTC'),'YYYY')||'-%'),6,'0')
    FROM s
    RETURNING id
  )
  INSERT INTO invoice_lines (invoice_id, description, quantity, unit_amount)
  SELECT (SELECT id FROM i), 'Pro plan (monthly)', 1, (SELECT unit_amount FROM s);
`;

export const logUsageSql = `
  INSERT INTO usage_events (account_id, subscription_id, meter_code, quantity, occurred_at)
  VALUES ($1, $2, $3, $4, (now() AT TIME ZONE 'UTC'));
`;

export const rollupUsageSql = `
  INSERT INTO usage_aggregates (subscription_id, meter_code, day, quantity)
  SELECT subscription_id, meter_code, ((occurred_at)::date) AS day, SUM(quantity)
  FROM usage_events
  WHERE subscription_id = $1 AND meter_code = $2
    AND occurred_at::date = (now() AT TIME ZONE 'UTC')::date
  GROUP BY subscription_id, meter_code, day
  ON CONFLICT (subscription_id, meter_code, day)
  DO UPDATE SET quantity = EXCLUDED.quantity;
`;

export const entitlementCheckSql = `
  SELECT (has_entitlement($1::uuid, $2::text)) AS raw_value;
`;
