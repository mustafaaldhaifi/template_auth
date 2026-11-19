BEGIN;

CREATE TABLE public.platforms (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    CONSTRAINT platforms_code_check CHECK (code IN ('ios', 'android', 'web'))
);

INSERT INTO public.platforms (code) VALUES
    ('ios'),
    ('android'),
    ('web');

COMMIT;
