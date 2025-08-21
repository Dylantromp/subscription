CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE billing_period AS ENUM ('day','week','month','year');
CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','canceled','incomplete','incomplete_expired','paused');
CREATE TYPE invoice_status AS ENUM ('draft','open','paid','void','uncollectible');
CREATE TYPE payment_status AS ENUM ('requires_payment_method','requires_action','processing','succeeded','failed','refunded');
CREATE TYPE role_type AS ENUM ('owner','admin','member','viewer');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email_billing CITEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE account_users (
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role role_type NOT NULL DEFAULT 'member',
  invited_at TIMESTAMP WITHOUT TIME ZONE,
  joined_at TIMESTAMP WITHOUT TIME ZONE,
  PRIMARY KEY (account_id, user_id)
);

CREATE TABLE features (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL DEFAULT 'integer',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  trial_days INT NOT NULL DEFAULT 14,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  unit_amount BIGINT NOT NULL,
  billing_period billing_period NOT NULL,
  interval_count INT NOT NULL DEFAULT 1,
  tax_inclusive BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (plan_id, currency, billing_period, interval_count, active)
);

CREATE TABLE plan_feature_entitlements (
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  feature_code TEXT REFERENCES features(code),
  value TEXT NOT NULL,
  PRIMARY KEY (plan_id, feature_code)
);

CREATE TABLE coupons (
  code TEXT PRIMARY KEY,
  percent_off NUMERIC(5,2),
  amount_off BIGINT,
  duration_months INT,
  max_redemptions INT,
  redeem_by TIMESTAMP WITHOUT TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT REFERENCES coupons(code),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_id UUID,
  redeemed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  UNIQUE (coupon_code, account_id)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'trialing',
  start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  trial_end TIMESTAMP WITHOUT TIME ZONE,
  current_period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  current_period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  cancel_at TIMESTAMP WITHOUT TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ended_at TIMESTAMP WITHOUT TIME ZONE,
  default_currency TEXT NOT NULL DEFAULT 'usd',
  collection_method TEXT NOT NULL DEFAULT 'charge_automatically',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  price_id UUID NOT NULL REFERENCES prices(id),
  quantity INT NOT NULL DEFAULT 1,
  UNIQUE (subscription_id, price_id)
);

CREATE TABLE subscription_entitlements (
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  feature_code TEXT REFERENCES features(code),
  value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'plan',
  PRIMARY KEY (subscription_id, feature_code)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL,
  subtotal BIGINT NOT NULL DEFAULT 0,
  tax_amount BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  due_at TIMESTAMP WITHOUT TIME ZONE,
  issued_at TIMESTAMP WITHOUT TIME ZONE,
  paid_at TIMESTAMP WITHOUT TIME ZONE,
  number TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  price_id UUID,
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_amount BIGINT NOT NULL DEFAULT 0,
  amount BIGINT GENERATED ALWAYS AS (quantity * unit_amount) STORED
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status payment_status NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  processor TEXT,
  processor_txn_id TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  succeeded_at TIMESTAMP WITHOUT TIME ZONE,
  failure_reason TEXT
);

CREATE TABLE usage_meters (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aggregation TEXT NOT NULL DEFAULT 'sum'
);

CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  meter_code TEXT NOT NULL REFERENCES usage_meters(code),
  quantity NUMERIC NOT NULL,
  occurred_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE usage_aggregates (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  meter_code TEXT NOT NULL REFERENCES usage_meters(code),
  day DATE NOT NULL,
  quantity NUMERIC NOT NULL,
  PRIMARY KEY (subscription_id, meter_code, day)
);

CREATE TABLE billing_events (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID,
  subscription_id UUID,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  secret TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

-- helpers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := (now() AT TIME ZONE 'UTC');
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_touch BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_subs_touch BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION next_period_end(start_ts TIMESTAMP WITHOUT TIME ZONE, period billing_period, interval_count INT)
RETURNS TIMESTAMP WITHOUT TIME ZONE AS $$
BEGIN
  CASE period
    WHEN 'day'   THEN RETURN start_ts + (interval_count || ' days')::interval;
    WHEN 'week'  THEN RETURN start_ts + (interval_count || ' weeks')::interval;
    WHEN 'month' THEN RETURN start_ts + (interval_count || ' months')::interval;
    WHEN 'year'  THEN RETURN start_ts + (interval_count || ' years')::interval;
  END CASE;
END;$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION has_entitlement(p_subscription UUID, p_feature TEXT, p_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() AT TIME ZONE 'UTC'))
RETURNS TEXT AS $$
DECLARE v_val TEXT;
BEGIN
  SELECT e.value INTO v_val
  FROM subscription_entitlements e
  JOIN subscriptions s ON s.id = e.subscription_id
  WHERE e.subscription_id = p_subscription
    AND e.feature_code = p_feature
    AND s.status IN ('trialing','active','past_due','paused')
    AND (p_at >= s.current_period_start AND p_at < s.current_period_end)
  LIMIT 1;
  RETURN v_val;
END;$$ LANGUAGE plpgsql STABLE;
