BEGIN;

WITH ins_acc AS (
  INSERT INTO accounts (name, email_billing)
  SELECT 'Airlec, Inc.', 'billing@airlec.example'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='Airlec, Inc.')
  RETURNING id
), acc AS (
  SELECT COALESCE((SELECT id FROM ins_acc),(SELECT id FROM accounts WHERE name='Airlec, Inc.')) AS account_id
), ins_user AS (
  INSERT INTO users (email, full_name)
  SELECT 'dylan@airlec.example','Dylan Tromp'
  WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='dylan@airlec.example')
  RETURNING id
), usr AS (
  SELECT COALESCE((SELECT id FROM ins_user),(SELECT id FROM users WHERE email='dylan@airlec.example')) AS user_id
), link AS (
  INSERT INTO account_users (account_id, user_id, role, invited_at, joined_at)
  SELECT account_id, user_id, 'owner', (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC')
  FROM acc, usr
  ON CONFLICT (account_id, user_id) DO NOTHING
)
, ins_prod AS (
  INSERT INTO products (name)
  SELECT 'Airlec App Pro'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE name='Airlec App Pro')
  RETURNING id
), prod AS (
  SELECT COALESCE((SELECT id FROM ins_prod),(SELECT id FROM products WHERE name='Airlec App Pro')) AS product_id
)
, ins_plan AS (
  INSERT INTO plans (product_id, code, name, trial_days, active)
  SELECT product_id, 'pro', 'Pro', 14, true FROM prod
  ON CONFLICT (code) DO NOTHING
  RETURNING id
), plan AS (
  SELECT COALESCE((SELECT id FROM ins_plan),(SELECT id FROM plans WHERE code='pro')) AS plan_id
)
, ins_prices AS (
  INSERT INTO prices (plan_id, currency, unit_amount, billing_period, interval_count, tax_inclusive, active)
  SELECT plan_id, 'usd', 2900,  'month'::billing_period, 1, false, true FROM plan
  WHERE NOT EXISTS (
    SELECT 1 FROM prices WHERE plan_id=(SELECT plan_id FROM plan)
      AND currency='usd' AND billing_period='month'::billing_period AND interval_count=1 AND active=true
  )
  UNION ALL
  SELECT plan_id, 'usd', 29000, 'year'::billing_period, 1, false, true FROM plan
  WHERE NOT EXISTS (
    SELECT 1 FROM prices WHERE plan_id=(SELECT plan_id FROM plan)
      AND currency='usd' AND billing_period='year'::billing_period AND interval_count=1 AND active=true
  )
  RETURNING 1
)
, ins_features AS (
  INSERT INTO features (code, name, value_type) VALUES
    ('seats.max','Max seats','integer'),
    ('api.rate_limit','API rate/min','integer'),
    ('projects.max','Max projects','integer')
  ON CONFLICT (code) DO NOTHING
  RETURNING 1
), ins_pfe AS (
  INSERT INTO plan_feature_entitlements (plan_id, feature_code, value)
  SELECT (SELECT plan_id FROM plan), 'seats.max', '5'
  WHERE NOT EXISTS (SELECT 1 FROM plan_feature_entitlements WHERE plan_id=(SELECT plan_id FROM plan) AND feature_code='seats.max')
  UNION ALL
  SELECT (SELECT plan_id FROM plan), 'api.rate_limit','120'
  WHERE NOT EXISTS (SELECT 1 FROM plan_feature_entitlements WHERE plan_id=(SELECT plan_id FROM plan) AND feature_code='api.rate_limit')
  UNION ALL
  SELECT (SELECT plan_id FROM plan), 'projects.max','50'
  WHERE NOT EXISTS (SELECT 1 FROM plan_feature_entitlements WHERE plan_id=(SELECT plan_id FROM plan) AND feature_code='projects.max')
  RETURNING 1
)
, ins_meter AS (
  INSERT INTO usage_meters (code, name, aggregation)
  VALUES ('api_calls','API Calls','sum')
  ON CONFLICT (code) DO NOTHING
  RETURNING 1
)
SELECT 'seed_complete' AS status;

COMMIT;
