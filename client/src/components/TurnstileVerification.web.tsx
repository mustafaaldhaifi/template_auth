import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Text } from 'react-native';
import { authColors } from '../theme/authColors';
import type { TurnstileVerificationHandle, TurnstileVerificationProps } from './TurnstileVerification.types';

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    size: 'compact';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': (code: string) => boolean;
  }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

function getTurnstile(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

function turnstileErrorMessage(code: string): string {
  switch (code) {
    case '110200':
      return 'This website is not allowed in Turnstile settings (110200).';
    case '110100':
    case '110110':
    case '400020':
      return `The Turnstile site key is invalid (${code}).`;
    case '200500':
      return 'Could not connect to Cloudflare (200500). Check your network or browser extensions.';
    default:
      return `Verification failed (${code}). Please retry the check.`;
  }
}

/**
 * Loads Cloudflare's script once for all authentication forms in the browser.
 * 1. Reuse an initialized API or pending script request.
 * 2. Append the official script and resolve only after its API is available.
 * 3. Clear a failed load so the next mount can retry.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  // STEP 1: Share the script across the three forms.
  const ready = getTurnstile();
  if (ready) return Promise.resolve(ready);
  if (scriptPromise) return scriptPromise;

  // STEP 2: Use Cloudflare's unmodified script URL for explicit rendering.
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      const api = getTurnstile();
      if (api) resolve(api);
      else {
        // STEP 3: Permit a later retry if loading did not initialize the API.
        script.remove();
        scriptPromise = null;
        reject(new Error('Turnstile did not initialize.'));
      }
    };
    script.onerror = () => {
      // STEP 3: Permit a later retry after a network failure.
      script.remove();
      scriptPromise = null;
      reject(new Error('Turnstile could not load.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Renders a reusable browser challenge and exposes token reset to its form.
 * 1. Load the Turnstile script and render a widget with a public site key.
 * 2. Clear expired or failed proofs and remove the widget on unmount.
 * 3. Reset a used proof before another form submission.
 */
const TurnstileVerification = forwardRef<TurnstileVerificationHandle, TurnstileVerificationProps>(
  function TurnstileVerification({ onTokenChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<string | null>(null);
    const callbackRef = useRef(onTokenChange);
    const [message, setMessage] = useState('');
    const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    callbackRef.current = onTokenChange;

    // STEP 1: Render after the external script is ready; ignore a late load after unmount.
    useEffect(() => {
      if (!siteKey) return;
      let active = true;
      loadTurnstile().then((api) => {
        if (!active || !containerRef.current) return;
        try {
          widgetRef.current = api.render(containerRef.current, {
            sitekey: siteKey,
            // NOTE: Compact fits narrow phone browsers; flexible has a 300px minimum width.
            size: 'compact',
            callback: (token) => {
              if (!active) return;
              setMessage('');
              callbackRef.current(token);
            },
            'expired-callback': () => {
              if (!active) return;
              callbackRef.current('');
              setMessage('Verification expired. Complete the check again.');
              if (widgetRef.current) api.reset(widgetRef.current);
            },
            'error-callback': (code) => {
              if (!active) return false;
              callbackRef.current('');
              setMessage(turnstileErrorMessage(code));
              // NOTE: A falsy return lets Turnstile keep its automatic retry behavior.
              return false;
            },
          });
        } catch {
          setMessage('Verification could not start. Refresh the page and try again.');
        }
      }).catch(() => {
        if (active) setMessage('Verification could not load. Refresh the page and try again.');
      });

      // STEP 2: Remove the previous widget before navigating to another form.
      return () => {
        active = false;
        if (widgetRef.current) {
          getTurnstile()?.remove(widgetRef.current);
          widgetRef.current = null;
        }
      };
    }, [siteKey]);

    // STEP 3: A submitted proof is single-use, including when the request fails.
    useImperativeHandle(ref, () => ({
      reset() {
        callbackRef.current('');
        setMessage('');
        if (widgetRef.current) getTurnstile()?.reset(widgetRef.current);
      },
    }), []);

    return (
      <div style={{ width: '100%', marginBottom: 12 }}>
        {siteKey ? <div ref={containerRef} /> : null}
        {!siteKey || message ? (
          <Text accessibilityRole="alert" style={{ color: authColors.error, fontSize: 14 }}>
            {message || 'Security verification is not configured.'}
          </Text>
        ) : null}
      </div>
    );
  },
);

export default TurnstileVerification;
