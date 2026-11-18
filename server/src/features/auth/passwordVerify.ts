import { scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Checks a submitted password against the stored scrypt credential.
 * 1. Reject malformed or unsupported hash parameters.
 * 2. Derive a key with the stored salt.
 * 3. Compare keys without revealing where they differ.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // STEP 1: Only credentials created with the supported parameters can be verified.
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' ||
      parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '1') return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length !== 16 || expected.length !== 64) return false;

  // STEP 2: Use the same cost as account creation.
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

  // STEP 3: Avoid a byte-by-byte comparison of secret material.
  return timingSafeEqual(actual, expected);
}
