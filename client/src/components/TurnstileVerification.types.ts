export type TurnstileVerificationProps = {
  action: 'login' | 'signup' | 'forgot_password';
  onTokenChange: (token: string) => void;
};

export type TurnstileVerificationHandle = {
  reset: () => void;
};
