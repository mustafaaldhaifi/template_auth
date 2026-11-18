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
- `500`: `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }` when account creation fails unexpectedly.

Account creation writes `users`, `user_emails`, and `user_passwords` in one transaction. A successful sign-up does not create a login session.

## Local login session

`POST /api/auth/login` accepts JSON string fields `email` and `password`. A successful request returns `200` with `{ "data": { "id", "firstName", "lastName", "email" } }` and an `HttpOnly` `auth_session` cookie valid for seven days. Invalid fields return `400` with `VALIDATION_ERROR` and `fieldErrors`; wrong credentials return `401` with `INVALID_CREDENTIALS`. Malformed JSON returns `400` with `INVALID_JSON`. Unexpected server failures return `500` with `INTERNAL_ERROR`.

`POST /api/auth/logout` takes no body. It invalidates the cookie's session and returns `204` with an empty body and an expired cookie, including when no session was supplied. Browser requests from the Expo web development origin must include credentials. In production, set `CLIENT_ORIGIN` to the exact client origin to enable credentialed cross-origin requests.

Sessions live in this server process and are cleared when it restarts. This is the local session requested for this task; account data and password hashes remain in PostgreSQL.

## Password reset API

Apply the approved token table migration to the development database using a direct, non-pooled PostgreSQL connection:

```powershell
psql $env:DATABASE_URL_UNPOOLED -f .\migrations\0.1.11_create_password_reset_tokens.sql
```

Set `SMTP_HOST`, `SMTP_FROM`, and `PASSWORD_RESET_URL` in the server environment. `SMTP_PORT` defaults to `587`; set `SMTP_USER` and `SMTP_PASS` together when the SMTP server requires authentication. `PASSWORD_RESET_URL` must be a full URL for the client page that accepts the `token` query parameter. It must use HTTPS outside local development. The reset page is not part of backend task `0.1.11` and is not created by these endpoints.

`POST /api/auth/forgot-password` accepts `{ "email": "..." }`. It returns `204` with no body for both registered and unregistered email addresses, and sends at most one link per account per minute. Invalid input returns `400` with `VALIDATION_ERROR` and `fieldErrors.email`; malformed JSON returns `400` with `INVALID_JSON`. Missing delivery configuration or database failures return `500` with `INTERNAL_ERROR`. Mail delivery failures are logged and still receive the generic `204` response so the API does not reveal account existence.

`POST /api/auth/reset-password` accepts `{ "token": "...", "password": "...", "confirmPassword": "..." }`. Passwords must be 8–128 characters and the confirmation must match. Success returns `204` with no body and clears the current browser's session cookie. Invalid fields return `400` with `VALIDATION_ERROR` and `fieldErrors`; a missing, expired, or used token returns `400` with `INVALID_RESET_TOKEN`; unexpected failures return `500` with `INTERNAL_ERROR`.

Reset links expire after 30 minutes. The database stores only a SHA-256 token digest. Consuming a token, updating the password, and invalidating other reset links happen in one transaction. The server also invalidates the user's sessions in its current process. The local session store must be replaced before running this authentication flow across multiple server processes.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
