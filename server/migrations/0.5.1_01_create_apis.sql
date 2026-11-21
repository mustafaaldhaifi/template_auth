BEGIN;

CREATE TABLE public.apis (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    method text NOT NULL,
    path text NOT NULL,
    CONSTRAINT apis_method_path_unique UNIQUE (method, path),
    CONSTRAINT apis_method_path_nonempty_check CHECK (length(trim(method)) > 0 AND length(trim(path)) > 0)
);

INSERT INTO public.apis (method, path) VALUES
    ('POST', '/api/auth/forgot-password'),
    ('POST', '/api/auth/login'),
    ('POST', '/api/auth/logout'),
    ('GET', '/api/auth/me'),
    ('POST', '/api/auth/reset-password'),
    ('POST', '/api/auth/signup'),
    ('POST', '/api/auth/verify-reset-code');

COMMIT;
