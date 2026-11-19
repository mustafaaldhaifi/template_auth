import { forwardRef, useImperativeHandle } from 'react';
import type { TurnstileVerificationHandle, TurnstileVerificationProps } from './TurnstileVerification.types';

/** Native verification methods will be added separately; Turnstile is web only. */
const TurnstileVerification = forwardRef<TurnstileVerificationHandle, TurnstileVerificationProps>(
  function TurnstileVerification(_props, ref) {
    useImperativeHandle(ref, () => ({ reset() {} }), []);
    return null;
  },
);

export default TurnstileVerification;
