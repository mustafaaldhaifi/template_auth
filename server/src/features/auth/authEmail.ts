import nodemailer from 'nodemailer';

export type AuthMailConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
};

/**
 * Reads shared SMTP settings for account-related email.
 * 1. Require a valid host, port, and sender.
 * 2. Keep optional authentication credentials paired.
 */
export function getAuthMailConfig(): AuthMailConfig {
  // STEP 1: Reject incomplete delivery settings.
  const host = process.env.SMTP_HOST?.trim() ?? '';
  const port = Number(process.env.SMTP_PORT ?? '587');
  const from = process.env.SMTP_FROM?.trim() ?? '';
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured.');
  }

  // STEP 2: Avoid using only one half of the SMTP credential pair.
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured together.');
  }
  return { host, port, user, password, from };
}

/** Sends one account email using the configured TLS and SMTP credentials. */
export async function sendAuthEmail(
  config: AuthMailConfig,
  message: { to: string; subject: string; text: string },
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: process.env.NODE_ENV === 'production' && config.port !== 465,
    auth: config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined,
  });
  await transport.sendMail({ from: config.from, ...message });
}
