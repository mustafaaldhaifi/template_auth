BEGIN;

CREATE FUNCTION public.valid_value_attempts(candidate jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF candidate = '0'::jsonb THEN
        RETURN true;
    END IF;

    IF candidate IS NULL OR jsonb_typeof(candidate) <> 'object' THEN
        RETURN false;
    END IF;

    IF NOT (candidate ? 'count' AND candidate ? 'block_duration')
        OR (SELECT count(*) FROM jsonb_object_keys(candidate)) <> 2 THEN
        RETURN false;
    END IF;

    RETURN jsonb_typeof(candidate -> 'count') = 'number'
        AND jsonb_typeof(candidate -> 'block_duration') = 'number'
        AND (candidate ->> 'count') ~ '^[1-9][0-9]*$'
        AND (candidate ->> 'block_duration') ~ '^[1-9][0-9]*$';
END;
$$;

ALTER TABLE public.api_restrictions
    ADD COLUMN value_attemps jsonb NOT NULL DEFAULT '0'::jsonb,
    ADD CONSTRAINT api_restrictions_value_attemps_check
        CHECK (public.valid_value_attempts(value_attemps));

ALTER TABLE public.api_request_history
    ADD COLUMN value text DEFAULT NULL,
    ADD CONSTRAINT api_request_history_value_check
        CHECK (value IS NULL OR value ~ '^[0-9a-f]{64}$');

CREATE INDEX api_request_history_api_value_time_idx
    ON public.api_request_history (api_id, value, created_at)
    WHERE value IS NOT NULL;

CREATE TABLE public.blocked_values (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    api_id bigint NOT NULL REFERENCES public.apis (id),
    value text NOT NULL,
    user_id uuid DEFAULT NULL REFERENCES public.users (id) ON DELETE SET NULL,
    blocked_at timestamptz NOT NULL DEFAULT now(),
    blocked_until timestamptz NOT NULL,
    notified_at timestamptz DEFAULT NULL,
    CONSTRAINT blocked_values_api_value_unique UNIQUE (api_id, value),
    CONSTRAINT blocked_values_value_check CHECK (value ~ '^[0-9a-f]{64}$'),
    CONSTRAINT blocked_values_expiry_check CHECK (blocked_until > blocked_at)
);

COMMIT;
