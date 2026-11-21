This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Turnstile verification for authentication

Set `TURNSTILE_SECRET_KEY` on the server to the private key for the web widget, and set
`TURNSTILE_ALLOWED_HOSTNAMES` to a comma-separated list of exact hostnames, such as
`template-auth-web.vercel.app`. Keep the secret only on the server. The web client uses
the matching public `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.

The existing `POST /api/auth/login`, `POST /api/auth/signup`, and
`POST /api/auth/forgot-password` requests now require `verificationMethod: "turnstile"`
and `verificationToken` in addition to their existing fields. The widget sets an
action of `login`, `signup`, or `forgot_password` for the matching request. The server
redeems the token with Cloudflare and checks both its action and hostname before any
device, IP, account, or recovery data access. Successful response formats remain the
same. Missing or invalid proof returns `400` with the standard `error` object and a
field error; a missing verifier setting or Cloudflare outage returns retryable `503`
with `VERIFICATION_UNAVAILABLE`. Native verification methods are not yet implemented.

For local UI-only testing, Cloudflare's public test site key works on `localhost`.
It cannot validate against a real server secret or prove the expected hostname and
action, so use the real widget on an allowed deployed hostname for an end-to-end test.

## Sign-up API

Set `DATABASE_URL` to a PostgreSQL connection string before starting the server. For the linked Neon development branch in PowerShell:

```powershell
$env:DATABASE_URL = neon connection-string development --project-id weathered-sea-18643118 --pooled --ssl verify-full
npm run dev
```

`POST /api/auth/signup` accepts JSON with string fields `firstName`, `lastName`, `email`, `password`, and `confirmPassword`. Names are trimmed, the email is trimmed and stored in lowercase, passwords must contain 8–128 characters, and the confirmation must match. The password is stored only as a salted scrypt hash.

- `201`: `{ "data": { "id": "<uuid>", "firstName": "...", "lastName": "...", "email": "..." } }`
- `400`: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fieldErrors": { "email": "..." } } }` for invalid fields, or `INVALID_JSON` for malformed JSON.
- `409`: `{ "error": { "code": "EMAIL_ALREADY_EXISTS", "message": "...", "fieldErrors": { "email": "..." } } }` for a registered email.
- `429`: `{ "error": { "code": "TOO_MANY_REQUESTS", "message": "..." } }` when one trusted IP creates too many anonymous devices.
- `500`: `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }` when account creation fails unexpectedly.

Account creation writes `users`, `user_emails`, and `user_passwords` in one transaction. A successful sign-up does not create a login session.

## Device-bound login sessions

Apply the device and session migrations in order to the development database using a direct PostgreSQL connection before using authentication:

```powershell
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.1_create_platforms.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.2_create_devices.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.3_create_ips.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.4_create_ip_devices.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.5_create_auth_sessions.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.3.6_create_security_blocks.sql
```

Apply each migration only once. The server now issues an `HttpOnly` `auth_device` cookie on the first well-formed, Turnstile-verified login, sign-up, or password-recovery request, including unsuccessful credential attempts. Later verified requests reuse the same device. Only successful login creates a seven-day `auth_session` cookie; both cookies must match a live database session to read protected account data. The raw tokens are not stored in PostgreSQL. The server records Next.js's forwarded IP during local development and Vercel's forwarded IP in production. Local forwarding is not a security boundary because callers can spoof it; the production device-creation limit uses Vercel's overwritten header. A single trusted IP can register at most 30 new devices per hour.

`POST /api/auth/login` accepts JSON string fields `email` and `password`. A successful request returns `200` with `{ "data": { "id", "firstName", "lastName", "email" } }` and an `HttpOnly` `auth_session` cookie valid for seven days. Invalid fields return `400` with `VALIDATION_ERROR` and `fieldErrors`; wrong credentials return `401` with `INVALID_CREDENTIALS`. Malformed JSON returns `400` with `INVALID_JSON`. Excessive anonymous device creation from one trusted IP returns `429` with `TOO_MANY_REQUESTS`. Unexpected server failures return `500` with `INTERNAL_ERROR`.

`POST /api/auth/logout` takes no body. It invalidates the cookie's session and returns `204` with an empty body and an expired cookie, including when no session was supplied. Browser requests from Expo web must include credentials. In production, set `CLIENT_ORIGIN` to the exact web origin, or a comma-separated list of allowed origins, to enable credentialed cross-origin requests and cross-site cookies when the client and API are hosted separately.

Sessions persist in PostgreSQL across server restarts. Logout revokes only the current session and leaves the device cookie for later sign-ins.

## Password reset API

Apply the original token table migration if the table is not present. Then apply the code migration to the development database using a direct, non-pooled PostgreSQL connection:

```powershell
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.1.11_create_password_reset_tokens.sql
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.2.3_use_password_reset_codes.sql
psql $env:DATABASE_URL_UNPOOLED -c "\d public.password_reset_tokens"
```

Set `SMTP_HOST`, `SMTP_FROM`, and `PASSWORD_RESET_CODE_SECRET` in the server environment. `SMTP_PORT` defaults to `587`; set `SMTP_USER` and `SMTP_PASS` together when the SMTP server requires authentication. `PASSWORD_RESET_CODE_SECRET` must be 64 hexadecimal characters (32 random bytes) and must stay server-only. Generate one in PowerShell with `[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()`. Keep this secret stable between server restarts while codes may still be active. `PASSWORD_RESET_URL` is no longer used; recovery emails contain only a numeric code.

`POST /api/auth/forgot-password` accepts `{ "email": "..." }`. It returns `204` with no body for both registered and unregistered email addresses, and sends at most one eight-digit code per account per minute. Invalid input returns `400` with `VALIDATION_ERROR` and `fieldErrors.email`; malformed JSON returns `400` with `INVALID_JSON`; excessive anonymous device creation returns `429` with `TOO_MANY_REQUESTS`. Missing delivery configuration or database failures return `500` with `INTERNAL_ERROR`. Mail delivery failures are logged and still receive the generic `204` response so the API does not reveal account existence.

`POST /api/auth/verify-reset-code` accepts `{ "email": "...", "code": "12345678" }`. Keep the code as a string to preserve leading zeroes. A valid code returns `200` with `{ "data": { "token": "<one-time-grant>" } }`. Invalid fields return `400` with `VALIDATION_ERROR` and `fieldErrors`; an unknown account or wrong, expired, or reused code returns `400` with `INVALID_RESET_CODE` and `fieldErrors.code`. Malformed JSON returns `400` with `INVALID_JSON`; server failures return `500` with `INTERNAL_ERROR`. Code-entry attempts are currently unlimited, with no failed-attempt counter or lockout.

`POST /api/auth/reset-password` accepts `{ "token": "<one-time-grant>", "password": "...", "confirmPassword": "..." }` after code verification. Passwords must be 8–128 characters and the confirmation must match. Success returns `204` with no body and clears the current browser's session cookie. Invalid fields return `400` with `VALIDATION_ERROR` and `fieldErrors`; a missing, expired, or used grant returns `400` with `INVALID_RESET_TOKEN`; unexpected failures return `500` with `INTERNAL_ERROR`.

Codes and verified grants each expire after 10 minutes. The database stores a salted HMAC digest of the short code and a SHA-256 digest of the verified grant. The code migration marks earlier unused link tokens as consumed while preserving their rows. Verifying a code exchanges it for one grant, so the code cannot be reused. Consuming the grant, updating the password, and revoking other outstanding codes and all account sessions happen in one database transaction.

## API request limits

Apply the `0.5.1_01`, `0.5.1_02`, and `0.5.1_03` migrations before enabling request history or policies. Each row in `api_restrictions` selects one existing method and path through `api_id`. For example, a policy of `{"1":3}` allows three verified requests per rolling minute for each available identifier in `items`, such as `ARRAY['ip', 'device', 'session']`. Each time window and identifier is checked independently; missing identifiers are skipped. A fourth request receives HTTP 429, `TOO_MANY_REQUESTS`, and a `Retry-After` header. Blocked verified requests are also recorded and count toward the rolling limit.

To test login limits by both IP and device in the development database, configure `{"1":3}` with `items = ARRAY['ip', 'device']`. The first verified request may not have a device ID yet, so its IP is checked immediately; the issued device ID is written to its history row and is counted on later requests from that device.

Authentication requests are checked only after Turnstile succeeds. Protected account routes are checked only after validating the device-bound session. Routes without a configured policy continue without a limit. If a policy check cannot reach storage, the server returns HTTP 503 with `RESTRICTION_UNAVAILABLE` instead of bypassing a configured limit.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
