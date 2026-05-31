import { createContext, useContext, useEffect, useState } from "react";

export interface ReplitUser {
  id: string;
  name: string;
  email: string;
  roles: string;
}

interface AuthContextValue {
  user: ReplitUser | null;
  loading: boolean;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<ReplitUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        if (!r.ok) return null;
        return r.json() as Promise<ReplitUser>;
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const signOut = () => {
    window.location.href = "/__replauthlogout";
  };

  return { user, loading, signOut };
}
