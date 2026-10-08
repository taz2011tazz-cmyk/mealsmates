ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS rc_app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS rc_original_transaction_id TEXT;

ALTER TABLE public.usage_limits
  ADD COLUMN IF NOT EXISTS feature_key TEXT,
  ADD COLUMN IF NOT EXISTS period_key TEXT;
UPDATE public.usage_limits SET feature_key=COALESCE(feature_key,feature), period_key=COALESCE(period_key,period_start::text);
ALTER TABLE public.usage_limits ALTER COLUMN feature_key SET NOT NULL, ALTER COLUMN period_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usage_limits_user_feature_period_uq ON public.usage_limits(user_id,feature_key,period_key);

ALTER TABLE public.subscription_events
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS actor_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS last_active_date TEXT,
  ADD COLUMN IF NOT EXISTS elite_reward_claimed_at TIMESTAMPTZ;
ALTER TABLE public.user_challenges
  ADD COLUMN IF NOT EXISTS period_key TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.user_challenges SET period_key=COALESCE(period_key,to_char(created_at,'IYYY-"W"IW'));
ALTER TABLE public.user_challenges ALTER COLUMN period_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_challenges_user_challenge_period_uq ON public.user_challenges(user_id,challenge_id,period_key);
ALTER TABLE public.xp_events ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
UPDATE public.xp_events SET dedupe_key=COALESCE(dedupe_key,id::text);
ALTER TABLE public.xp_events ALTER COLUMN dedupe_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_dedupe_key_uq ON public.xp_events(dedupe_key);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS business_registration TEXT,
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS food_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_info JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS order_number TEXT;
UPDATE public.restaurant_orders SET order_number=COALESCE(order_number,'MM-'||upper(substr(replace(id::text,'-',''),1,12)));
ALTER TABLE public.restaurant_orders ALTER COLUMN order_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_order_number_uq ON public.restaurant_orders(order_number);