import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyTurnstileToken } from '../src/features/auth/turnstileVerification.ts';

const originalFetch = globalThis.fetch;
const originalSecret = process.env.TURNSTILE_SECRET_KEY;
const originalHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES;

function siteverifyReply(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

test('Turnstile verification fails closed and checks action and hostname', async (t) => {
  try {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'template-auth-web.vercel.app';
    globalThis.fetch = () => { throw new Error('Siteverify must not run without a secret'); };
    await t.test('missing configuration never calls Siteverify', async () => {
      assert.equal(await verifyTurnstileToken('token', 'login'), 'unavailable');
    });

    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    let requestBody;
    globalThis.fetch = async (_url, options) => {
      requestBody = options.body;
      return siteverifyReply({ success: true, action: 'login', hostname: 'template-auth-web.vercel.app' });
    };
    await t.test('valid proof sends secret and token to Siteverify', async () => {
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'valid');
      assert.equal(requestBody.get('secret'), 'test-secret');
      assert.equal(requestBody.get('response'), 'proof');
    });

    await t.test('wrong action and hostname are rejected', async () => {
      assert.equal(await verifyTurnstileToken('proof', 'signup'), 'invalid');
      process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'another.example';
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'invalid');
      process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'template-auth-web.vercel.app';
    });

    await t.test('expired or reused proof is rejected', async () => {
      globalThis.fetch = async () => siteverifyReply({ success: false, 'error-codes': ['timeout-or-duplicate'] });
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'invalid');
    });

    await t.test('provider failures remain retryable', async () => {
      globalThis.fetch = async () => siteverifyReply({ success: false, 'error-codes': ['internal-error'] });
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'unavailable');
      globalThis.fetch = async () => { throw new Error('network down'); };
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'unavailable');
      globalThis.fetch = async () => siteverifyReply({}, 502);
      assert.equal(await verifyTurnstileToken('proof', 'login'), 'unavailable');
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    if (originalHostnames === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.TURNSTILE_ALLOWED_HOSTNAMES = originalHostnames;
  }
});
