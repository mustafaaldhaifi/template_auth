BEGIN;

INSERT INTO public.country_codes (iso2, dial_code, name) VALUES
    ('YE', '+967', 'Yemen'),
    ('SA', '+966', 'Saudi Arabia'),
    ('AE', '+971', 'United Arab Emirates'),
    ('OM', '+968', 'Oman'),
    ('QA', '+974', 'Qatar'),
    ('KW', '+965', 'Kuwait'),
    ('BH', '+973', 'Bahrain'),
    ('EG', '+20', 'Egypt'),
    ('JO', '+962', 'Jordan'),
    ('IQ', '+964', 'Iraq'),
    ('MA', '+212', 'Morocco'),
    ('DZ', '+213', 'Algeria'),
    ('TR', '+90', 'Turkey'),
    ('IN', '+91', 'India'),
    ('PK', '+92', 'Pakistan'),
    ('GB', '+44', 'United Kingdom'),
    ('US', '+1', 'United States'),
    ('CA', '+1', 'Canada')
ON CONFLICT (iso2) DO NOTHING;

COMMIT;
