import { createContext, useContext, useEffect, useState } from "react";
import { api, type Capabilities } from "../api";

interface CapState { caps: Capabilities | null; loaded: boolean }
const Ctx = createContext<CapState>({ caps: null, loaded: false });

/** What this server can do (transcription, narration, model reachable). Fetched once. */
export function CapabilitiesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CapState>({ caps: null, loaded: false });
  useEffect(() => {
    let stop = false;
    const load = (attempt = 0) => {
      api.status()
        .then((caps) => !stop && setState({ caps, loaded: true }))
        .catch(() => {
          // The server may still be waking up; retry a few times quietly.
          if (stop) return;
          if (attempt < 6) window.setTimeout(() => load(attempt + 1), 5000);
          else setState({ caps: null, loaded: true });
        });
    };
    load();
    return () => { stop = true; };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useCapabilities = () => useContext(Ctx);
