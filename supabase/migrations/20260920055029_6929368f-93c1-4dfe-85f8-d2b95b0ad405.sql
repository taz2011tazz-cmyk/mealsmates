ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  cta_label text,
  target_url text,
  advertiser text,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_placements TO anon;
GRANT SELECT ON public.ad_placements TO authenticated;
GRANT ALL ON public.ad_placements TO service_role;

ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active placements" ON public.ad_placements;
CREATE POLICY "Anyone reads active placements"
  ON public.ad_placements FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP TRIGGER IF EXISTS update_ad_placements_updated_at ON public.ad_placements;
CREATE TRIGGER update_ad_placements_updated_at
  BEFORE UPDATE ON public.ad_placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS ad_placements_slot_idx ON public.ad_placements (slot) WHERE is_active;

INSERT INTO public.ad_placements (slot, title, body, image_url, cta_label, target_url, advertiser, weight)
VALUES
  ('home_feed', 'Fresh produce, delivered weekly', 'Stock your kitchen with in-season veggies and save on every basket.', NULL, 'Shop the basket', '/restaurants', 'Harvest Box', 2),
  ('recipes', 'Spice up weeknight cooking', 'A pantry starter set built for South African home kitchens.', NULL, 'See the set', '/recipes', 'Kitchen Co.', 1),
  ('restaurants', 'Free delivery on your first order', 'Try a new local kitchen tonight with zero delivery fees.', NULL, 'Browse kitchens', '/restaurants', 'MealMate Partners', 2)
ON CONFLICT DO NOTHING;