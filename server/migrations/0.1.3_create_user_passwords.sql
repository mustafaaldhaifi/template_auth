BEGIN;

CREATE TABLE public.user_passwords (
    user_id uuid PRIMARY KEY REFERENCES public.users (id),
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
