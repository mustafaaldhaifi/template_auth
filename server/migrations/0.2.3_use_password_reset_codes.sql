BEGIN;

ALTER TABLE public.password_reset_tokens
    ADD COLUMN code_salt text DEFAULT NULL,
    ADD COLUMN verified_token_hash text DEFAULT NULL;

-- Retire old emailed links without deleting their audit rows.
UPDATE public.password_reset_tokens
SET consumed_at = now()
WHERE consumed_at IS NULL;

ALTER TABLE public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_code_salt_format
        CHECK (code_salt IS NULL OR code_salt ~ '^[0-9a-f]{32}$'),
    ADD CONSTRAINT password_reset_tokens_verified_hash_length
        CHECK (verified_token_hash IS NULL OR length(verified_token_hash) = 64),
    ADD CONSTRAINT password_reset_tokens_code_or_grant
        CHECK (NOT (code_salt IS NOT NULL AND verified_token_hash IS NOT NULL)),
    ADD CONSTRAINT password_reset_tokens_verified_hash_unique
        UNIQUE (verified_token_hash);

COMMIT;
