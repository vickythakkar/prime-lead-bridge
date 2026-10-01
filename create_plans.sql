CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  base_price numeric NOT NULL,
  monthly_fee numeric,
  included_minutes integer,
  overage_rate numeric NOT NULL
);

INSERT INTO public.subscription_plans (id, name, base_price, monthly_fee, included_minutes, overage_rate) VALUES
('pay_as_you_go', 'Pay As You Go', 5.00, 5.00, 0, 0.10),
('starter', 'Starter', 25.00, 25.00, 500, 0.08),
('pro', 'Pro', 50.00, 50.00, 1000, 0.05)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  base_price = EXCLUDED.base_price,
  monthly_fee = EXCLUDED.monthly_fee,
  included_minutes = EXCLUDED.included_minutes,
  overage_rate = EXCLUDED.overage_rate;
