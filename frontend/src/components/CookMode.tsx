import { ArrowLeft, ArrowRight, Basket, Check, SunDim, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Recipe } from "../api";
import { t } from "../strings";

/**
 * Full-screen, one step at a time, big type, readable at arm's length.
 * Keeps the screen awake (Wake Lock) while open. Keyboard: arrows, Esc.
 */
export default function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [awake, setAwake] = useState(false);
  const total = recipe.steps.length;
  const finished = step >= total;
  const dialog = useRef<HTMLDivElement>(null);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, total)), [total]);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [next, prev, onClose]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock?.request("screen");
        setAwake(!!lock);
      } catch { setAwake(false); }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => undefined); };
  }, []);

  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${t.cook.title}: ${recipe.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-bg outline-none">
      <div className="gingham h-3 shrink-0" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{recipe.title}</p>
          {awake && <p className="flex items-center gap-1 text-sm text-muted"><SunDim size={16} aria-hidden /> {t.cook.awake}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn" aria-expanded={showIngredients} onClick={() => setShowIngredients((s) => !s)}>
            <Basket size={20} /> <span className="hidden sm:inline">{t.cook.ingredients}</span>
          </button>
          <button className="btn btn-icon" aria-label={t.cook.close} onClick={onClose}><X size={22} /></button>
        </div>
      </div>

      {/* progress */}
      <div className="mx-4 h-2 overflow-hidden rounded-full bg-bg-2 sm:mx-8" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${total ? (Math.min(step + 1, total) / total) * 100 : 0}%` }} />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-8 sm:px-10">
          {total === 0 ? (
            <p className="text-2xl">{t.cook.noSteps}</p>
          ) : finished ? (
            <div key="done" className="pop grid gap-4 text-center">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-on-primary"><Check size={40} weight="bold" /></span>
              <p className="font-display text-5xl font-extrabold">{t.cook.done}</p>
              {recipe.quote && <p className="font-hand text-4xl text-muted">&ldquo;{recipe.quote}&rdquo;</p>}
            </div>
          ) : (
            <div key={step} className="fade-up grid gap-6" aria-live="polite">
              <p className="font-display text-xl font-bold text-primary">{t.cook.of(step + 1, total)}</p>
              <p className="font-display text-[clamp(1.9rem,4.6vw,3.4rem)] leading-[1.18] font-semibold">{recipe.steps[step]}</p>
            </div>
          )}
        </div>

        {showIngredients && (
          <aside aria-label={t.cook.ingredients}
            className="pop lift absolute inset-y-4 right-4 w-[min(88vw,22rem)] overflow-y-auto rounded-[var(--r)] border border-line bg-surface p-5">
            <h2 className="mb-3 font-display text-2xl font-bold">{t.cook.ingredients}</h2>
            <ul className="grid gap-2 text-lg">
              {recipe.ingredients.map((i, n) => (
                <li key={n}>{i.quantity && <strong>{i.quantity} </strong>}{i.name}</li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-4 sm:px-8">
        <button className="btn btn-lg" onClick={prev} disabled={step === 0}>
          <ArrowLeft size={22} /> <span className="hidden sm:inline">{t.cook.prev}</span>
        </button>
        <p className="hidden text-sm text-muted md:block">{t.cook.keys}</p>
        {finished ? (
          <button className="btn btn-primary btn-lg" onClick={onClose}>{t.cook.close}</button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={next} disabled={total === 0}>
            {step === total - 1 ? t.cook.finish : t.cook.next} <ArrowRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
