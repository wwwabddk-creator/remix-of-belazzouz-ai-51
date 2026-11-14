ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_memory text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS memory_revision integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.protect_user_memory()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_memory <> '' AND NOT NEW.is_vip THEN
      RAISE EXCEPTION 'VIP required for memory';
    END IF;
    NEW.memory_revision := 0;
  ELSE
    IF NEW.user_memory IS DISTINCT FROM OLD.user_memory THEN
      IF auth.uid() IS NOT NULL AND (auth.uid() <> OLD.id OR NOT OLD.is_vip OR NOT NEW.is_vip) THEN
        RAISE EXCEPTION 'VIP required for memory';
      END IF;
      NEW.memory_revision := OLD.memory_revision + 1;
    ELSE
      NEW.memory_revision := OLD.memory_revision;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_user_memory BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_user_memory();

CREATE OR REPLACE FUNCTION public.append_user_memory(facts text[], expected_revision integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE; fact text; merged text;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT p.is_vip THEN RAISE EXCEPTION 'VIP required for memory'; END IF;
  IF p.memory_revision <> expected_revision THEN RETURN false; END IF;
  merged := p.user_memory;
  FOREACH fact IN ARRAY facts LOOP
    fact := trim(fact);
    IF fact <> '' AND NOT (lower(fact) = ANY(string_to_array(lower(merged), E'\n'))) THEN
      merged := concat_ws(E'\n', NULLIF(merged, ''), fact);
    END IF;
  END LOOP;
  UPDATE public.profiles SET user_memory = merged WHERE id = auth.uid();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.append_user_memory(text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_user_memory(text[], integer) TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;