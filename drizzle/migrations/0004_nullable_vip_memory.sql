ALTER TABLE public.profiles
  ALTER COLUMN user_memory DROP NOT NULL,
  ALTER COLUMN user_memory SET DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.protect_user_memory()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_memory IS NOT NULL AND NOT NEW.is_vip THEN
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

CREATE OR REPLACE FUNCTION public.append_user_memory(facts text[], expected_revision integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  fact text;
  merged text;
  candidate text;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR NOT p.is_vip THEN RAISE EXCEPTION 'VIP required for memory'; END IF;
  IF p.memory_revision <> expected_revision THEN RETURN false; END IF;

  merged := coalesce(p.user_memory, '');
  FOREACH fact IN ARRAY coalesce(facts, ARRAY[]::text[]) LOOP
    fact := trim(regexp_replace(trim(fact), '^[-•*][[:space:]]*', ''));
    IF fact = '' OR EXISTS (
      SELECT 1 FROM unnest(string_to_array(merged, E'\n')) AS saved(line)
      WHERE lower(trim(regexp_replace(saved.line, '^[-•*][[:space:]]*', ''))) = lower(fact)
    ) THEN
      CONTINUE;
    END IF;

    candidate := concat_ws(E'\n', NULLIF(merged, ''), '- ' || fact);
    IF cardinality(regexp_split_to_array(trim(candidate), '[[:space:]]+')) <= 500 THEN
      merged := candidate;
    END IF;
  END LOOP;

  IF merged IS DISTINCT FROM coalesce(p.user_memory, '') THEN
    UPDATE public.profiles SET user_memory = merged WHERE id = auth.uid();
  END IF;
  RETURN true;
END;
$$;
