BEGIN;

CREATE TABLE public.users (
    id uuid PRIMARY KEY,
    first_name text NOT NULL,
    last_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
