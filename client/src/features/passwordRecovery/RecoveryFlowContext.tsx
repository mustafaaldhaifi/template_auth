import { createContext, useContext, useState, type ReactNode } from 'react';

type RecoveryFlow = {
  email: string;
  token: string | null;
  begin: (email: string) => void;
  authorize: (token: string) => void;
  clear: () => void;
};

const RecoveryFlowContext = createContext<RecoveryFlow | null>(null);

/** Keeps the verified grant in per-app memory instead of a URL or persistent storage. */
export function RecoveryFlowProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);

  function begin(nextEmail: string) {
    setEmail(nextEmail);
    setToken(null);
  }

  function authorize(nextToken: string) {
    setToken(nextToken);
  }

  function clear() {
    setEmail('');
    setToken(null);
  }

  return (
    <RecoveryFlowContext.Provider value={{ email, token, begin, authorize, clear }}>
      {children}
    </RecoveryFlowContext.Provider>
  );
}

/** Returns the current recovery step and its in-memory transitions. */
export function useRecoveryFlow(): RecoveryFlow {
  const flow = useContext(RecoveryFlowContext);
  if (!flow) throw new Error('RecoveryFlowProvider is missing.');
  return flow;
}
