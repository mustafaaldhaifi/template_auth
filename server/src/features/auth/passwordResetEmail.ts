import nodemailer from 'nodemailer';
import { passwordResetLifetimeMinutes } from './passwordResetToken';

type PasswordResetMailConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
};

/**
 * Reads SMTP settings before account lookup.
 * 1. Require a valid mail server and sender.
 * 2. Keep authentication credentials paired.
 */
export function getPasswordResetMailConfig(): PasswordResetMailConfig {
  // STEP 1: Reject missing or invalid delivery settings for every account equally.
  const host = process.env.SMTP_HOST?.trim() ?? '';
  const port = Number(process.env.SMTP_PORT ?? '587');
  const from = process.env.SMTP_FROM?.trim() ?? '';
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured.');
  }

  // STEP 2: Avoid sending unauthenticated mail when only half the pair is set.
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured together.');
  }
  return { host, port, user, password, from };
}

/**
 * Sends a numeric recovery code to the account's stored email address.
 * 1. Configure SMTP transport from server settings.
 * 2. Send only the short code and its expiration.
 */
export async function sendPasswordResetCodeEmail(
  config: PasswordResetMailConfig,
  email: string,
  code: string,
): Promise<void> {
  // STEP 1: Require TLS for production SMTP on non-implicit TLS ports.
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: process.env.NODE_ENV === 'production' && config.port !== 465,
    auth: config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined,
  });

  // STEP 2: The email contains a code, never a bearer URL or grant token.
  await transport.sendMail({
    from: config.from,
    to: email,
    subject: 'Your password recovery code',
    text: `Your password recovery code is ${code}.\n\n` +
      `It expires in ${passwordResetLifetimeMinutes} minutes. If you did not request this, ignore this message.`,
  });
}
