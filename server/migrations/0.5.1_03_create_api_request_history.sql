BEGIN;

CREATE TABLE public.api_request_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    api_id bigint NOT NULL REFERENCES public.apis (id) ON DELETE RESTRICT,
    ip_id bigint REFERENCES public.ips (id) ON DELETE SET NULL,
    device_id bigint REFERENCES public.devices (id) ON DELETE SET NULL,
    session_id bigint REFERENCES public.auth_sessions (id) ON DELETE SET NULL,
    status smallint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT api_request_history_status_check CHECK (status IN (0, 1))
);

CREATE INDEX api_request_history_api_time_ip_idx ON public.api_request_history (api_id, created_at, ip_id);
CREATE INDEX api_request_history_api_time_device_idx ON public.api_request_history (api_id, created_at, device_id);
CREATE INDEX api_request_history_api_time_session_idx ON public.api_request_history (api_id, created_at, session_id);

COMMIT;
