BEGIN;

CREATE TABLE public.ip_devices (
    device_id bigint NOT NULL REFERENCES public.devices (id) ON DELETE CASCADE,
    ip_id bigint NOT NULL REFERENCES public.ips (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, ip_id)
);

CREATE INDEX ip_devices_ip_id_idx ON public.ip_devices (ip_id);

COMMIT;
