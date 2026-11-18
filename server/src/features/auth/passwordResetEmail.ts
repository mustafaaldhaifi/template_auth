import nodemailer from 'nodemailer';
import { passwordResetLifetimeMinutes } from './passwordResetToken';

type PasswordResetMailConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  resetUrl: URL;
};

/**
 * Reads trusted SMTP and reset-page settings before account lookup.
 * 1. Require a valid mail server, sender, and full reset-page URL.
 * 2. Keep production links on HTTPS and credential pairs complete.
 * 3. Return settings without deriving a URL from the incoming request.
 */
export function getPasswordResetMailConfig(): PasswordResetMailConfig {
  // STEP 1: Reject missing or invalid delivery settings for every account equally.
  const host = process.env.SMTP_HOST?.trim() ?? '';
  const port = Number(process.env.SMTP_PORT ?? '587');
  const from = process.env.SMTP_FROM?.trim() ?? '';
  const urlText = process.env.PASSWORD_RESET_URL?.trim() ?? '';
  let resetUrl: URL;
  try {
    resetUrl = new URL(urlText);
  } catch {
    throw new Error('PASSWORD_RESET_URL must be an absolute URL.');
  }
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured.');
  }

  // STEP 2: Never email a reset token over a non-HTTPS production link.
  const localUrl = process.env.NODE_ENV !== 'production' &&
    resetUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(resetUrl.hostname);
  if (resetUrl.protocol !== 'https:' && !localUrl) {
    throw new Error('PASSWORD_RESET_URL must use HTTPS outside local development.');
  }
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured together.');
  }

  // STEP 3: The link destination is configured, not taken from the Host header.
  return { host, port, user, password, from, resetUrl };
}

/**
 * Sends a reset link to the account's stored email address.
 * 1. Add the bearer token to the trusted reset-page URL.
 * 2. Configure SMTP transport from server settings.
 * 3. Send the link with its expiration time.
 */
export async function sendPasswordResetEmail(
  config: PasswordResetMailConfig,
  email: string,
  token: string,
): Promise<void> {
  // STEP 1: Never derive the reset destination from request headers.
  const resetUrl = new URL(config.resetUrl);
  resetUrl.searchParams.set('token', token);

  // STEP 2: Require TLS for production SMTP on non-implicit TLS ports.
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: process.env.NODE_ENV === 'production' && config.port !== 465,
    auth: config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined,
  });

  // STEP 3: Keep the raw token out of logs and database storage.
  await transport.sendMail({
    from: config.from,
    to: email,
    subject: 'Reset your password',
    text: `Use this link to reset your password:\n\n${resetUrl.toString()}\n\n` +
      `The link expires in ${passwordResetLifetimeMinutes} minutes. If you did not request this, ignore this message.`,
  });
}
