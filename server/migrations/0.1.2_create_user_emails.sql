BEGIN;

CREATE TABLE public.user_emails (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id),
    email text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
