BEGIN;

CREATE FUNCTION public.valid_api_restriction_policy(candidate jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    minute_key text;
    attempt_value jsonb;
BEGIN
    IF candidate IS NULL OR jsonb_typeof(candidate) <> 'object' OR candidate = '{}'::jsonb THEN
        RETURN false;
    END IF;

    FOR minute_key, attempt_value IN SELECT key, value FROM jsonb_each(candidate) LOOP
        IF minute_key !~ '^[1-9][0-9]*$'
            OR jsonb_typeof(attempt_value) <> 'number'
            OR attempt_value::text !~ '^[1-9][0-9]*$' THEN
            RETURN false;
        END IF;
    END LOOP;

    RETURN true;
END;
$$;

CREATE TABLE public.api_restrictions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    api_id bigint NOT NULL UNIQUE REFERENCES public.apis (id) ON DELETE RESTRICT,
    policy jsonb NOT NULL,
    items text[] NOT NULL,
    CONSTRAINT api_restrictions_policy_check CHECK (public.valid_api_restriction_policy(policy)),
    CONSTRAINT api_restrictions_items_check CHECK (
        cardinality(items) BETWEEN 1 AND 3
        AND array_position(items, NULL) IS NULL
        AND items <@ ARRAY['ip', 'device', 'session']::text[]
        AND cardinality(items) =
            (CASE WHEN 'ip' = ANY(items) THEN 1 ELSE 0 END)
            + (CASE WHEN 'device' = ANY(items) THEN 1 ELSE 0 END)
            + (CASE WHEN 'session' = ANY(items) THEN 1 ELSE 0 END)
    )
);

COMMIT;
