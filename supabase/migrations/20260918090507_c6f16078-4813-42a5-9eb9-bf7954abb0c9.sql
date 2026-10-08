DROP POLICY IF EXISTS "Public reads profiles" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;
DROP POLICY IF EXISTS "Public reads dish searches" ON public.dish_searches;
REVOKE SELECT ON public.dish_searches FROM anon;
REVOKE SELECT ON public.dish_searches FROM authenticated;