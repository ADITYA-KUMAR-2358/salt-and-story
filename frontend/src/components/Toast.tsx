import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Kind = "success" | "error";
interface Toast { id: number; kind: Kind; message: string }
interface ToastApi { success: (m: string) => void; error: (m: string) => void }

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}

/** Transient confirmations only. Errors that block a task stay inline. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = next.current++;
    setToasts((ts) => [...ts.slice(-2), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((x) => (
          <div key={x.id} role={x.kind === "error" ? "alert" : "status"}
            className="pop lift pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line bg-surface py-2 pr-2 pl-4 font-semibold">
            {x.kind === "success"
              ? <CheckCircle size={22} weight="fill" className="shrink-0 text-primary" />
              : <WarningCircle size={22} weight="fill" className="shrink-0 text-danger" />}
            <span className="text-[0.95rem]">{x.message}</span>
            <button className="btn btn-ghost btn-icon !min-h-9 !w-9" aria-label="Dismiss" onClick={() => dismiss(x.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
