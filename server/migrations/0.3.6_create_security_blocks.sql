BEGIN;

CREATE TABLE public.security_blocks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_id bigint REFERENCES public.ips (id) ON DELETE CASCADE,
    device_id bigint REFERENCES public.devices (id) ON DELETE CASCADE,
    session_id bigint REFERENCES public.auth_sessions (id) ON DELETE CASCADE,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    revoked_at timestamptz,
    CONSTRAINT security_blocks_one_target_check CHECK (num_nonnulls(ip_id, device_id, session_id) = 1),
    CONSTRAINT security_blocks_reason_check CHECK (length(trim(reason)) > 0),
    CONSTRAINT security_blocks_expiry_check CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT security_blocks_session_expiry_check CHECK (session_id IS NULL OR expires_at IS NULL)
);

CREATE INDEX security_blocks_ip_id_idx ON public.security_blocks (ip_id);
CREATE INDEX security_blocks_device_id_idx ON public.security_blocks (device_id);
CREATE INDEX security_blocks_session_id_idx ON public.security_blocks (session_id);

COMMIT;
