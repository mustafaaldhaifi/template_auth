BEGIN;

CREATE TABLE public.ips (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    address inet NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
