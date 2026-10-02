import { CaretDown, Check, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { classicImage, type Classic } from "../classics";
import { t } from "../strings";
import Img from "./Img";
import { useToast } from "./Toast";

/** Adds a classic as a real recipe, then attaches its photo so it prints in the book. */
export async function addClassic(c: Classic) {
  const { key, region: _r, place: _p, alt: _a, ...draft } = c;
  const recipe = await api.create(draft);
  try {
    const res = await fetch(classicImage(key, 1280));
    if (res.ok) return await api.uploadPhoto(recipe.id, await res.blob(), `${key}.webp`);
  } catch { /* the recipe is saved; a missing photo is not worth failing over */ }
  return recipe;
}

export default function ClassicCard({ c, size = "normal", onAdded }:
  { c: Classic; size?: "normal" | "wide"; onAdded?: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [newId, setNewId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function add() {
    setState("adding");
    try {
      const r = await addClassic(c);
      setNewId(r.id);
      setState("added");
      toast.success(t.classic.addedToast(c.title));
      onAdded?.();
    } catch (e) {
      toast.error((e as Error).message);
      setState("idle");
    }
  }

  const wide = size === "wide";
  return (
    <article className={`classic-card lift grid overflow-hidden rounded-[var(--r)] border border-line bg-surface ${wide ? "md:grid-cols-[1.1fr_1fr]" : ""}`}>
      <div className={`reveal-img group/img relative overflow-hidden ${wide ? "aspect-[4/3] md:aspect-auto md:min-h-[26rem]" : "aspect-[4/3]"}`}>
        <Img src={classicImage(c.key, wide ? 1280 : 640)} alt={c.alt} frame="!absolute inset-0 size-full"
          className="transition-transform duration-[1.2s] ease-out group-hover/img:scale-[1.06]" />
      </div>
      <div className="index-card !rounded-none !border-0 flex flex-col px-6 pt-3.5 pb-6">
        <div className="flex h-8 items-center justify-between gap-2">
          <h3 className="truncate font-display text-lg font-bold">{c.title}</h3>
          <span className="chip shrink-0">{c.region}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">{c.speaker_name}, {c.place}</p>
        <blockquote className={`font-hand mt-3 leading-8 ${wide ? "text-[1.9rem]" : "text-[1.6rem]"}`}>&ldquo;{c.quote}&rdquo;</blockquote>

        <button className="mt-4 flex w-fit items-center gap-1.5 rounded-full font-semibold text-primary hover:underline"
          aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? t.classic.hide : t.classic.read}
          <CaretDown size={14} weight="bold" className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className="grid gap-3 pt-4 text-[0.95rem]">
              <p className="text-muted">{c.story}</p>
              <div>
                <h4 className="font-display font-bold">{t.recipe.ingredients}</h4>
                <ul className="mt-1 columns-1 gap-6 sm:columns-2">
                  {c.ingredients.map((x) => (
                    <li key={x.name} className="break-inside-avoid">
                      {x.quantity && <strong>{x.quantity} </strong>}{x.name}
                      {x.note && <span className="text-muted"> ({x.note})</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-display font-bold">{t.recipe.steps}</h4>
                <ol className="mt-1 list-decimal space-y-1 pl-5 marker:font-bold marker:text-primary">
                  {c.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
          {state === "added" && newId !== null ? (
            <Link to={`/recipes/${newId}`} className="btn pop">
              <Check size={18} weight="bold" className="text-primary" /> {t.classic.added}. {t.classic.open}
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={add} disabled={state === "adding"}>
              <Plus size={18} weight="bold" /> {state === "adding" ? t.classic.adding : t.classic.add}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
