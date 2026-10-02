import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, session, UNAUTHORIZED_EVENT, type AuthConfig, type User } from "./api";

type State =
  | { status: "loading" }
  | { status: "signed-out"; config: AuthConfig | null; error?: string }
  | { status: "signed-in"; config: AuthConfig; user: User };

interface AuthApi {
  state: State;
  signIn: (credential: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/**
 * Knows who is signed in. Reads the server's auth mode first:
 *  - "google": a session token from Sign in with Google is required.
 *  - "dev": sign-in is off (local development); everyone is one local account.
 *  - "closed": the server is not set up for sign-in yet.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    let config: AuthConfig | null = null;
    for (let attempt = 0; attempt < 6 && !config; attempt++) {
      try { config = await api.authConfig(); } catch { await new Promise((r) => setTimeout(r, 4000)); }
    }
    if (!config) return setState({ status: "signed-out", config: null, error: "Cannot reach the server right now." });
    if (config.mode === "closed") return setState({ status: "signed-out", config });
    if (config.mode === "google" && !session.get()) return setState({ status: "signed-out", config });
    try {
      setState({ status: "signed-in", config, user: await api.me() });
    } catch {
      session.clear();
      setState({ status: "signed-out", config });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onUnauthorized = () => {
      session.clear();
      setState((s) => (s.status === "signed-in" ? { status: "signed-out", config: s.config } : s));
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback(async (credential: string) => {
    const { token, user } = await api.signInWithGoogle(credential);
    session.set(token);
    setState((s) => ({ status: "signed-in", config: "config" in s && s.config ? s.config : { mode: "google", google_client_id: "", daily_limit: user.daily_limit }, user }));
  }, []);

  const signOut = useCallback(() => {
    session.clear();
    window.google?.accounts.id.disableAutoSelect();
    setState((s) => ({ status: "signed-out", config: "config" in s ? s.config : null }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const user = await api.me();
      setState((s) => (s.status === "signed-in" ? { ...s, user } : s));
    } catch { /* the 401 handler signs out */ }
  }, []);

  const value = useMemo(() => ({ state, signIn, signOut, refresh }), [state, signIn, signOut, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Wrap pages that need an account. Sends visitors to sign in, then brings them back. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") {
    return (
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-12 w-2/3 max-w-lg" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (state.status === "signed-out") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  return <>{children}</>;
}

// ---- Google Identity Services typing (just what we use) ----------------------
interface GsiButtonOptions {
  type?: "standard" | "icon"; theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small"; text?: "signin_with" | "signup_with" | "continue_with";
  shape?: "rectangular" | "pill"; logo_alignment?: "left" | "center"; width?: number; locale?: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void;
            auto_select?: boolean; ux_mode?: "popup"; context?: "signin" | "signup" | "use" }) => void;
          renderButton: (el: HTMLElement, o: GsiButtonOptions) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;
/** Load Google's sign-in script once, on demand (only the sign-in page needs it). */
export function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), {
      src: "https://accounts.google.com/gsi/client", async: true, defer: true,
    });
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => { gsiPromise = null; reject(new Error("Google sign-in could not load. Check your connection.")); });
    document.head.appendChild(s);
  });
  return gsiPromise;
}
