import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, type Session, ApiError } from "./api";

type Ctx = {
  session: Session | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me().then(setSession).catch((e) => {
      if (!(e instanceof ApiError && e.status === 401)) console.error(e);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AuthCtx.Provider value={{
      session, loading,
      async login(u, p) { await auth.login(u, p); setSession(await auth.me()); },
      async logout() { await auth.logout(); setSession(null); },
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): Ctx {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
