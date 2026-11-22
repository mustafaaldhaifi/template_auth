BEGIN;

CREATE TABLE public.country_codes (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    iso2 char(2) NOT NULL UNIQUE,
    dial_code varchar(5) NOT NULL,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT country_codes_iso2_check CHECK (iso2 ~ '^[A-Z]{2}$'),
    CONSTRAINT country_codes_dial_code_check CHECK (dial_code ~ '^\+[1-9][0-9]{0,3}$')
);

CREATE TABLE public.user_phones (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users (id),
    country_code_id smallint NOT NULL REFERENCES public.country_codes (id),
    phone_e164 varchar(16) NOT NULL UNIQUE,
    verified_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_phones_e164_check CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$')
);

CREATE INDEX user_phones_user_id_idx ON public.user_phones (user_id);

COMMIT;
