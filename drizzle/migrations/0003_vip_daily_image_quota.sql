CREATE TABLE public.vip_image_usage (
  user_id uuid PRIMARY KEY,
  usage_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  images_count integer NOT NULL DEFAULT 0 CHECK (images_count BETWEEN 0 AND 10)
);
GRANT SELECT ON public.vip_image_usage TO authenticated;
GRANT ALL ON public.vip_image_usage TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.vip_image_usage FROM anon, authenticated;
ALTER TABLE public.vip_image_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY vip_image_usage_read_own ON public.vip_image_usage FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consume_vip_image()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); today date := (now() AT TIME ZONE 'UTC')::date; used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND is_vip = true) THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', NULL, 'is_vip', false);
  END IF;
  INSERT INTO public.vip_image_usage AS usage (user_id, usage_date, images_count)
    VALUES (uid, today, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET usage_date = today,
          images_count = CASE WHEN usage.usage_date IS DISTINCT FROM today THEN 1 ELSE usage.images_count + 1 END
      WHERE usage.usage_date IS DISTINCT FROM today OR usage.images_count < 10
    RETURNING images_count INTO used;
  IF used IS NULL THEN RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'is_vip', true); END IF;
  RETURN jsonb_build_object('allowed', true, 'remaining', 10 - used, 'is_vip', true);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_vip_image() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_vip_image() TO authenticated, service_role;