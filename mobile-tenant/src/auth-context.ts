import { createContext, useContext } from 'react';

export interface AuthContextValue {
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
