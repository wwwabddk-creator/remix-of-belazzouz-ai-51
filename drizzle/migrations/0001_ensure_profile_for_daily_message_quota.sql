CREATE OR REPLACE FUNCTION public.consume_daily_message()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row public.profiles%ROWTYPE;
  next_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.profiles (id, email)
  SELECT id, email FROM auth.users WHERE id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO profile_row
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF profile_row.is_vip OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', NULL, 'is_vip', profile_row.is_vip);
  END IF;

  IF profile_row.last_message_date IS DISTINCT FROM CURRENT_DATE THEN
    profile_row.daily_messages_count := 0;
    profile_row.last_message_date := CURRENT_DATE;
  END IF;

  IF profile_row.daily_messages_count >= 25 THEN
    UPDATE public.profiles
    SET last_message_date = CURRENT_DATE
    WHERE id = auth.uid();
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'is_vip', false);
  END IF;

  next_count := profile_row.daily_messages_count + 1;
  UPDATE public.profiles
  SET daily_messages_count = next_count,
      last_message_date = CURRENT_DATE
  WHERE id = auth.uid();

  RETURN jsonb_build_object('allowed', true, 'remaining', 25 - next_count, 'is_vip', false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_daily_message() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_daily_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_message() TO service_role;