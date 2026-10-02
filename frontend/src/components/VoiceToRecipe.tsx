import { ArrowDown, ArrowRight, Microphone, Quotes } from "@phosphor-icons/react";
import { useState } from "react";
import { CLASSICS } from "../classics";
import { demoSaid, landing } from "../content/landing";

const PIE = CLASSICS.find((c) => c.key === "apple-pie")!;

/**
 * A real, interactive explanation (not a screenshot): the complete spoken memo on
 * the left, the complete finished recipe on the right. Every highlighted phrase is
 * linked to the line it became. Hover, focus or tap either side.
 */
export default function VoiceToRecipe() {
  const [active, setActive] = useState<string | null>(null);
  const on = (id: string) => ({
    onMouseEnter: () => setActive(id),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(id),
    onBlur: () => setActive(null),
    onClick: () => setActive((a) => (a === id ? null : id)),
    "aria-pressed": active === id,
  });
  const said = (id: string) =>
    `rounded-md px-1 py-0.5 text-left transition-colors duration-200 ${
      active === id ? "bg-accent text-on-accent" : active ? "bg-accent-soft/50" : "bg-accent-soft"}`;
  const cooked = (id: string) =>
    `w-full rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ${
      active === id ? "bg-accent text-on-accent" : "hover:bg-bg-2"}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
      <figure className="min-w-0 rounded-[var(--r)] border border-line bg-surface p-6 sm:p-8 lg:sticky lg:top-6">
        <figcaption className="mb-4 flex items-center gap-2 font-semibold text-muted">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-on-primary"><Microphone size={18} weight="fill" /></span>
          {landing.demo.said}
        </figcaption>
        <p className="text-[1.04rem] leading-[2.05]">
          {demoSaid.map((p, i) =>
            typeof p === "string" ? <span key={i}>{p}</span> : (
              <button key={i} type="button" {...on(p.id)} className={said(p.id)}>{p.text}</button>
            ))}
        </p>
      </figure>

      <div aria-hidden="true" className="flex justify-center text-primary lg:pt-40">
        <ArrowDown size={32} className="lg:hidden" />
        <ArrowRight size={36} className="hidden lg:block" />
      </div>

      <article className="index-card lift min-w-0 px-6 pt-3.5 pb-7 sm:px-8">
        <h3 className="flex h-8 items-center font-display text-lg font-bold">{PIE.title}</h3>
        <p className="mt-4 text-sm font-semibold text-muted">
          {landing.demo.cooked}: {[PIE.servings && `serves ${PIE.servings}`, PIE.prep_time && `prep ${PIE.prep_time}`, PIE.cook_time && `cook ${PIE.cook_time}`].filter(Boolean).join(", ")}
        </p>

        <h4 className="mt-5 font-display font-bold">Ingredients</h4>
        <ul className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {PIE.ingredients.map((x, n) => (
            <li key={x.name}>
              <button type="button" {...on(`ing-${n}`)} className={cooked(`ing-${n}`)}>
                {x.quantity && <strong>{x.quantity} </strong>}{x.name}
                {x.note && <span className={active === `ing-${n}` ? "" : "text-muted"}> ({x.note})</span>}
              </button>
            </li>
          ))}
        </ul>

        <h4 className="mt-5 font-display font-bold">Method</h4>
        <ol className="mt-1 grid gap-0.5">
          {PIE.steps.map((s, n) => (
            <li key={n}>
              <button type="button" {...on(`step-${n}`)} className={`${cooked(`step-${n}`)} flex gap-3`}>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${active === `step-${n}` ? "bg-on-accent text-accent" : "bg-accent-soft"}`}>{n + 1}</span>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <h4 className="mt-5 font-display font-bold">Good to know</h4>
        {PIE.tips.map((tip, n) => (
          <button key={n} type="button" {...on(`tip-${n}`)} className={cooked(`tip-${n}`)}>{tip}</button>
        ))}

        <button type="button" {...on("quote")} className={`${cooked("quote")} mt-4 flex gap-2`}>
          <Quotes size={20} weight="fill" className={`mt-1 shrink-0 ${active === "quote" ? "" : "text-accent"}`} aria-hidden />
          <span>
            <span className="font-hand block text-[1.6rem] leading-8">{PIE.quote}</span>
            <span className="text-sm font-semibold opacity-80">{PIE.speaker_name}, {landing.demo.quoteLabel.toLowerCase()}</span>
          </span>
        </button>
      </article>
    </div>
  );
}
