CREATE TABLE public.password_reset_tokens (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz DEFAULT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT password_reset_tokens_hash_length CHECK (length(token_hash) = 64),
    CONSTRAINT password_reset_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_tokens_user_created_at_idx
    ON public.password_reset_tokens (user_id, created_at DESC);
