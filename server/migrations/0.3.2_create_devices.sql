BEGIN;

CREATE TABLE public.devices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_token_hash text NOT NULL UNIQUE,
    platform_id smallint NOT NULL REFERENCES public.platforms (id) ON DELETE RESTRICT,
    os_version text,
    model text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT devices_token_hash_length_check CHECK (length(device_token_hash) = 64)
);

CREATE INDEX devices_platform_id_idx ON public.devices (platform_id);

COMMIT;
