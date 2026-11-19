BEGIN;

CREATE TABLE public.auth_sessions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash text NOT NULL UNIQUE,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    device_id bigint NOT NULL REFERENCES public.devices (id) ON DELETE CASCADE,
    login_ip_id bigint REFERENCES public.ips (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CONSTRAINT auth_sessions_token_hash_length_check CHECK (length(token_hash) = 64),
    CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_id_idx ON public.auth_sessions (user_id);
CREATE INDEX auth_sessions_device_id_idx ON public.auth_sessions (device_id);
CREATE INDEX auth_sessions_login_ip_id_idx ON public.auth_sessions (login_ip_id);

COMMIT;
