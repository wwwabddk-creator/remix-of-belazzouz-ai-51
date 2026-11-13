ALTER TABLE public.profiles
  ADD COLUMN is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN daily_messages_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_message_date date;

COMMENT ON COLUMN public.profiles.is_vip IS 'VIP entitlement; users cannot change their own value.';
COMMENT ON COLUMN public.profiles.daily_messages_count IS 'Registered-user message count for last_message_date; free limit is 25.';
COMMENT ON COLUMN public.profiles.last_message_date IS 'UTC date used to reset the free daily message allowance.';

CREATE OR REPLACE FUNCTION public.protect_profile_vip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NEW.is_vip IS DISTINCT FROM OLD.is_vip THEN
    RAISE EXCEPTION 'VIP status cannot be changed by the user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_vip
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_vip();

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