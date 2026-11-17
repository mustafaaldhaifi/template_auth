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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
