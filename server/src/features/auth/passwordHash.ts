import { randomBytes, scrypt } from 'node:crypto';

const scryptCost = 16384;
const scryptBlockSize = 8;
const scryptParallelization = 1;

/**
 * Derives a salted password hash for storage instead of storing the submitted password.
 * 1. Generate a random salt for this credential.
 * 2. Derive a key asynchronously with explicit scrypt parameters.
 * 3. Encode the parameters, salt, and key for future verification.
 */
export async function hashPassword(password: string): Promise<string> {
  // STEP 1: Give every credential an independent random salt.
  const salt = randomBytes(16);

  // STEP 2: Keep key derivation off the main event loop.
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, {
      N: scryptCost,
      r: scryptBlockSize,
      p: scryptParallelization,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

  // STEP 3: Store enough information to verify this hash during login.
  return [
    'scrypt',
    scryptCost,
    scryptBlockSize,
    scryptParallelization,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}
