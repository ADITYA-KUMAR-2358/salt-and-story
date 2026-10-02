import { useEffect, useState } from "react";
import { api, IN_PROGRESS, type Recipe } from "./api";

/** Polls a recipe every 2s while it is being written; stops once ready or failed. */
export function useRecipePoll(id: number | null, bump = 0) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);

  useEffect(() => {
    if (id == null || Number.isNaN(id)) return;
    let stop = false;
    let timer: number;
    let failures = 0;
    const tick = async () => {
      try {
        const r = await api.get(id);
        if (stop) return;
        setRecipe(r);
        setError(null);
        failures = 0;
        if (!IN_PROGRESS.includes(r.status)) return;
      } catch (e) {
        if (stop) return;
        const err = e as Error & { status?: number };
        setError({ message: err.message, status: err.status ?? 0 });
        if (err.status === 404) return;
        failures++;
      }
      // Back off gently if the server is struggling.
      timer = window.setTimeout(tick, Math.min(2000 * 2 ** failures, 15000));
    };
    tick();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [id, bump]);

  return { recipe, setRecipe, error };
}

/** True when the user asked the OS for less motion. */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Sets document.title for each page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Salt & Story` : "Salt & Story";
  }, [title]);
}
